-- server.lua
-- File-based IPC server for MohoMCP. Runs inside MOHO's Lua 5.4 environment.
-- Uses a shared directory for request/response JSON files instead of TCP sockets.
-- Designed to be polled from MOHO's Run callback to avoid UI freezes.

local server = {}

-- Dependencies (set by init)
local protocol = nil
local validator = nil
local json = nil

-- Server state
local isRunning = false
local ipcDir = ""
local deadLetterDir = ""
local lastProcessedSeq = 0  -- Persistent cursor: highest sequence number processed
local processedSequences = {}  -- Deduplication set for processed request sequences
local lastHealthWrite = 0
local persistenceFile = ""  -- Path to cursor persistence file

-- Tool handler registry: method name -> function(moho, params) -> result, err
local handlers = {}

-- Platform detection
local SEP = package.config:sub(1, 1) -- "/" on unix, "\" on windows

-- Configuration constants
local MAX_JSON_SIZE = 1024 * 1024       -- 1MB max request size
local REQUEST_TTL_MS = 30000            -- 30 second TTL for requests
local MAX_DEAD_LETTERS = 100            -- Max files in dead-letter directory
local HEALTH_WRITE_INTERVAL_MS = 5000   -- Health file update interval
local PERSIST_INTERVAL = 100            -- Persist cursor every N requests

-- Initialize the server module with its dependencies.
-- @param deps table  Dependencies: { protocol, validator, json }
function server.init(deps)
    protocol = deps.protocol
    validator = deps.validator
    json = deps.json
end

-- Register a tool handler for a given method name.
-- @param method string  The JSON-RPC method name
-- @param handler function  Handler function(moho, params) -> result, err
function server.registerHandler(method, handler)
    handlers[method] = handler
end

-- Look up a registered handler by method name.
-- Used by the batch handler to dispatch operations without going through processRequest().
-- @param method string  The JSON-RPC method name
-- @return function|nil  The handler function, or nil if not registered
function server.getHandler(method)
    return handlers[method]
end

-- Get the primary IPC directory path.
-- Uses Application Support / LocalAppData primary folder. Overridden by MOHO_IPC_DIR.
local function getIpcDir()
    local override = os.getenv("MOHO_IPC_DIR") or os.getenv("MOHO_MCP_IPC_DIR")
    if override and override ~= "" then
        if not override:match("[/\\]$") then
            override = override .. SEP
        end
        return override
    end

    local home = os.getenv("HOME") or os.getenv("USERPROFILE") or ""
    if SEP == "/" then
        if home ~= "" then
            return home .. "/Library/Application Support/MohoMCP/ipc/"
        end
    else
        local localAppData = os.getenv("LOCALAPPDATA")
        if localAppData and localAppData ~= "" then
            return localAppData .. "\\MohoMCP\\ipc\\"
        elseif home ~= "" then
            return home .. "\\AppData\\Local\\MohoMCP\\ipc\\"
        end
    end

    local tmp = os.getenv("TEMP") or os.getenv("TMP") or os.getenv("TMPDIR") or "/tmp"
    return tmp .. SEP .. "moho-mcp" .. SEP
end

-- Ensure directory exists (uses platform commands to bypass PATH restrictions).
local function mkdirp(dirPath)
    local cleanPath = dirPath:gsub("[/\\]+$", "")
    local cmd
    if SEP == "\\" then
        cmd = 'cmd.exe /c mkdir "' .. cleanPath .. '" 2>NUL'
    else
        cmd = '/bin/mkdir -p "' .. cleanPath .. '" 2>/dev/null'
    end
    local handle = io.popen(cmd)
    if handle then handle:close() end
end

-- Validate path for safe shell usage: only alphanumeric, underscore, dash, dot, slash, backslash.
-- Prevents command injection via shell metacharacters.
local function isSafePath(path)
    return path:match("^[%w%_%-%./\\]+$") ~= nil
end

-- List all files in a directory using platform-appropriate command.
-- Returns array of filenames (without directory prefix).
-- Validates path safety before execution.
local function listDir(dirPath)
    if not isSafePath(dirPath) then
        return {}
    end
    local files = {}
    local cmd
    if SEP == "\\" then
        cmd = 'cmd.exe /c dir /b "' .. dirPath .. '" 2>NUL'
    else
        cmd = '/bin/ls -1 "' .. dirPath .. '" 2>/dev/null'
    end
    local handle = io.popen(cmd)
    if handle then
        for line in handle:lines() do
            files[#files + 1] = line
        end
        handle:close()
    end
    return files
end

-- Parse sequence number from request/response filename.
-- Expected format: req_<seq>.json or resp_<seq>.json
-- @return number|nil sequence number, or nil if not parseable
local function parseSeqFromFilename(fname)
    local seq = fname:match("^req_(%d+)%.json$") or fname:match("^resp_(%d+)%.json$")
    if seq then
        return tonumber(seq)
    end
    return nil
end

-- Check if a file exists by trying to open it.
local function fileExists(path)
    local f = io.open(path, "r")
    if f then
        f:close()
        return true
    end
    return false
end

-- Read the entire contents of a file.
local function readFile(path)
    local f, err = io.open(path, "r")
    if not f then
        return nil, err
    end
    local content = f:read("*a")
    f:close()
    return content
end

-- Write content to a file atomically (write to .tmp then rename).
local function writeFile(path, content)
    local tmpPath = path .. ".tmp"
    local f, err = io.open(tmpPath, "w")
    if not f then
        return false, "Failed to open " .. tmpPath .. ": " .. tostring(err)
    end
    f:write(content)
    f:close()
    -- Rename .tmp to final path (atomic on most filesystems)
    os.remove(path)
    local ok, renameErr = os.rename(tmpPath, path)
    if not ok then
        return false, "Failed to rename: " .. tostring(renameErr)
    end
    return true
end

-- Persist cursor and processed sequences to disk for crash recovery.
local function persistState()
    if persistenceFile == "" then return end
    local data = {
        lastProcessedSeq = lastProcessedSeq,
        processedSequences = processedSequences,
        savedAt = os.date("!%Y-%m-%dT%H:%M:%SZ"),
    }
    local content = json.encode(data)
    writeFile(persistenceFile, content)
end

-- Load persisted cursor and processed sequences from disk.
local function loadState()
    if persistenceFile == "" then return end
    if not fileExists(persistenceFile) then return end
    local content, err = readFile(persistenceFile)
    if not content then return end
    local ok, data = pcall(json.decode, content)
    if not ok or type(data) ~= "table" then return end
    if data.lastProcessedSeq and type(data.lastProcessedSeq) == "number" then
        lastProcessedSeq = data.lastProcessedSeq
    end
    if data.processedSequences and type(data.processedSequences) == "table" then
        processedSequences = data.processedSequences
    end
end

-- Write health.json atomically with current server status.
local function writeHealthFile()
    local healthPath = ipcDir .. "health.json"
    local healthData = {
        running = isRunning,
        pid = "moho",
        version = "0.1.0",
        protocolVersion = "1",
        lastPollTimestamp = os.date("!%Y-%m-%dT%H:%M:%SZ"),
        lastProcessedSequence = lastProcessedSeq,
        queueDepth = 0, -- Computed by bridge
        errorCount = 0,
        uptimeSeconds = math.floor(os.clock()),
    }
    local content = json.encode(healthData)
    writeFile(healthPath, content)
end

-- Move a file to the dead-letter directory with metadata sidecar.
local function quarantineFile(srcPath, fname, reason)
    mkdirp(deadLetterDir)
    local timestamp = os.date("!%Y%m%d_%H%M%S")
    local destName = timestamp .. "_" .. fname
    local destPath = deadLetterDir .. destName
    os.rename(srcPath, destPath)

    -- Write metadata sidecar
    local metaPath = destPath .. ".meta"
    local meta = {
        originalName = fname,
        quarantinedAt = os.date("!%Y-%m-%dT%H:%M:%SZ"),
        reason = reason,
        fileSize = 0,
    }
    if fileExists(destPath) then
        local f = io.open(destPath, "r")
        if f then
            f:seek("end")
            meta.fileSize = f:seek("end")
            f:close()
        end
    end
    writeFile(metaPath, json.encode(meta))

    -- Enforce max dead letters
    local files = listDir(deadLetterDir)
    local metaFiles = {}
    for _, f in ipairs(files) do
        if f:match("%.meta$") then
            metaFiles[#metaFiles + 1] = f
        end
    end
    if #metaFiles > MAX_DEAD_LETTERS then
        table.sort(metaFiles)
        for i = 1, #metaFiles - MAX_DEAD_LETTERS do
            local oldMeta = metaFiles[i]
            local base = oldMeta:gsub("%.meta$", "")
            os.remove(deadLetterDir .. oldMeta)
            os.remove(deadLetterDir .. base)
        end
    end
end

-- Clean up processed request/response files older than TTL.
local function cleanupStaleFiles()
    local now = os.clock() * 1000
    local ttlMs = REQUEST_TTL_MS

    local files = listDir(ipcDir)
    for _, fname in ipairs(files) do
        local path = ipcDir .. fname
        local seq = parseSeqFromFilename(fname)
        local isRequest = fname:match("^req_") ~= nil
        local isResponse = fname:match("^resp_") ~= nil

        if (isRequest or isResponse) and seq then
            -- Check if we've already processed this sequence
            if processedSequences[seq] then
                -- Already processed - remove both req and resp if they exist
                os.remove(ipcDir .. "req_" .. seq .. ".json")
                os.remove(ipcDir .. "resp_" .. seq .. ".json")
            else
                -- Check TTL using file modification time (platform-specific)
                local mtime = getFileModTime(path)
                if mtime then
                    local fileAgeMs = (os.time() - mtime) * 1000
                    if fileAgeMs > ttlMs then
                        -- Expired - quarantine
                        quarantineFile(path, fname, "expired_ttl")
                    end
                end
            end
        end
    end
end

-- Get file modification time (cross-platform, no lfs dependency).
-- @return number|nil modification time as Unix timestamp, or nil if unavailable
local function getFileModTime(path)
    -- Try platform-specific stat command
    local cmd
    if SEP == "\\" then
        cmd = 'cmd.exe /c for %I in ("' .. path .. '") do @echo %~tI 2>NUL'
    else
        cmd = 'stat -f "%m" "' .. path .. '" 2>/dev/null || stat -c "%Y" "' .. path .. '" 2>/dev/null'
    end
    local handle = io.popen(cmd)
    if handle then
        local result = handle:read("*a")
        handle:close()
        result = result:match("^%s*(.-)%s*$")
        local ts = tonumber(result)
        if ts then return ts end
    end
    return nil
end

-- Check if a file exists by trying to open it.
local function fileExists(path)
    local f = io.open(path, "r")
    if f then
        f:close()
        return true
    end
    return false
end

-- Read the entire contents of a file.
local function readFile(path)
    local f, err = io.open(path, "r")
    if not f then
        return nil, err
    end
    local content = f:read("*a")
    f:close()
    return content
end

-- Write content to a file atomically (write to .tmp then rename).
local function writeFile(path, content)
    local tmpPath = path .. ".tmp"
    local f, err = io.open(tmpPath, "w")
    if not f then
        return false, "Failed to open " .. tmpPath .. ": " .. tostring(err)
    end
    f:write(content)
    f:close()
    -- Rename .tmp to final path (atomic on most filesystems)
    os.remove(path)
    local ok, renameErr = os.rename(tmpPath, path)
    if not ok then
        return false, "Failed to rename: " .. tostring(renameErr)
    end
    return true
end

-- Start the file-based IPC server.
-- @return boolean  true if started successfully
-- @return string|nil  Error message on failure
function server.start()
    if isRunning then
        return true
    end

    ipcDir = getIpcDir()
    deadLetterDir = ipcDir .. "dead_letter" .. SEP
    persistenceFile = ipcDir .. "cursor.json"
    mkdirp(ipcDir)
    mkdirp(deadLetterDir)

    -- Load persisted state
    loadState()

    -- Verify directory is accessible
    local testPath = ipcDir .. ".mcp_test"
    local ok, err = writeFile(testPath, "ok")
    if not ok then
        -- Fallback 1: $HOME/.moho_mcp/ipc/
        local home = os.getenv("HOME") or os.getenv("USERPROFILE") or ""
        if home ~= "" then
            ipcDir = home .. SEP .. ".moho_mcp" .. SEP .. "ipc" .. SEP
            deadLetterDir = ipcDir .. "dead_letter" .. SEP
            persistenceFile = ipcDir .. "cursor.json"
            mkdirp(ipcDir)
            mkdirp(deadLetterDir)
            testPath = ipcDir .. ".mcp_test"
            ok, err = writeFile(testPath, "ok")
        end

        -- Fallback 2: System temp folder
        if not ok then
            local tmp = os.getenv("TEMP") or os.getenv("TMP") or os.getenv("TMPDIR") or "/tmp"
            ipcDir = tmp .. SEP .. "moho-mcp" .. SEP
            deadLetterDir = ipcDir .. "dead_letter" .. SEP
            persistenceFile = ipcDir .. "cursor.json"
            mkdirp(ipcDir)
            mkdirp(deadLetterDir)
            testPath = ipcDir .. ".mcp_test"
            ok, err = writeFile(testPath, "ok")
            if not ok then
                return false, "Cannot write to IPC directory " .. ipcDir .. ": " .. tostring(err)
            end
        end
    end
    os.remove(testPath)

    -- Clean up any stale request/response files from previous sessions
    local files = listDir(ipcDir)
    for _, fname in ipairs(files) do
        if fname:match("^req_") or fname:match("^resp_") then
            os.remove(ipcDir .. fname)
        end
    end

    -- Write initial health file
    writeHealthFile()

    isRunning = true
    print("[MohoMCP] Server started. IPC directory: " .. ipcDir)
    return true
end

-- Stop the IPC server.
function server.stop()
    if not isRunning then
        return
    end

    -- Persist final state
    persistState()

    -- Remove status and health files
    os.remove(ipcDir .. "status.json")
    os.remove(ipcDir .. "health.json")

    -- Clean up any remaining files
    local files = listDir(ipcDir)
    for _, fname in ipairs(files) do
        if fname:match("^req_") or fname:match("^resp_") then
            os.remove(ipcDir .. fname)
        end
    end

    isRunning = false
    print("[MohoMCP] Server stopped")
end

-- Check if the server is currently running.
function server.isRunning()
    return isRunning
end

-- Get the current IPC directory path (for diagnostics).
function server.getIpcDir()
    return ipcDir
end

-- Get server info for diagnostics.
function server.getInfo()
    return {
        running = isRunning,
        ipcDir = ipcDir,
        deadLetterDir = deadLetterDir,
        lastProcessedSequence = lastProcessedSeq,
        processedSequenceCount = 0, -- TODO: track size of processedSequences
        protocolVersion = "1",
    }
end

-- Process a single JSON-RPC request and return a response string.
local function processRequest(requestStr, moho)
    local request, parseErr = protocol.parseRequest(requestStr)
    if not request then
        return protocol.createError(nil, protocol.PARSE_ERROR, parseErr or "Parse error")
    end

    local method = request.method
    local params = request.params or {}
    local id = request.id

    local valMod = validator or require("moho_mcp.validator")
    if not valMod.isAllowed(method) then
        return protocol.createError(id, protocol.METHOD_NOT_FOUND,
            "Method not found: " .. tostring(method))
    end

    local valid, validErr = valMod.validateParams(method, params)
    if not valid then
        return protocol.createError(id, protocol.INVALID_PARAMS,
            validErr or "Invalid parameters")
    end

    local handler = handlers[method]
    if not handler then
        return protocol.createError(id, protocol.METHOD_NOT_FOUND,
            "No handler registered for: " .. tostring(method))
    end

    local ok, result, handlerErr = pcall(handler, moho, params)
    if not ok then
        return protocol.createError(id, protocol.INTERNAL_ERROR,
            "Handler error: " .. tostring(result))
    end

    if result == nil and handlerErr then
        return protocol.createError(id, protocol.INTERNAL_ERROR,
            handlerErr)
    end

    return protocol.createResponse(id, result)
end

-- Poll for incoming request files and process them.
-- Uses directory listing + cursor instead of linear ID scanning.
function server.poll(moho)
    if not isRunning then
        return
    end

    -- Periodic health file update
    local now = os.clock() * 1000
    if now - lastHealthWrite > HEALTH_WRITE_INTERVAL_MS then
        writeHealthFile()
        lastHealthWrite = now
    end

    -- Cleanup stale files periodically
    cleanupStaleFiles()

    -- List all request files
    local files = listDir(ipcDir)
    local requestFiles = {}

    for _, fname in ipairs(files) do
        local seq = parseSeqFromFilename(fname)
        if seq and fname:match("^req_") then
            requestFiles[#requestFiles + 1] = { seq = seq, fname = fname }
        end
    end

    -- Sort by sequence number (ascending)
    table.sort(requestFiles, function(a, b) return a.seq < b.seq end)

    -- Process each request in order
    local processedThisPoll = 0
    for _, rf in ipairs(requestFiles) do
        local seq = rf.seq
        local fname = rf.fname
        local reqPath = ipcDir .. fname
        local respPath = ipcDir .. "resp_" .. seq .. ".json"

        -- Skip if already processed (deduplication)
        if processedSequences[seq] then
            os.remove(reqPath)
            os.remove(respPath)
            goto continue
        end

        -- Read and remove request file
        local reqStr, err = readFile(reqPath)
        os.remove(reqPath)

        if reqStr then
            -- Check request size limit
            if #reqStr > MAX_JSON_SIZE then
                local errResp = protocol.createError(nil, protocol.INVALID_PARAMS,
                    "Request payload exceeds maximum size of " .. MAX_JSON_SIZE .. " bytes")
                writeFile(respPath, errResp)
                quarantineFile(reqPath, fname, "oversized_request")
            else
                local respStr = processRequest(reqStr, moho)
                writeFile(respPath, respStr)
            end
        end

        -- Mark as processed
        processedSequences[seq] = true
        lastProcessedSeq = math.max(lastProcessedSeq, seq)
        processedThisPoll = processedThisPoll + 1

        -- Persist state periodically
        if processedThisPoll % PERSIST_INTERVAL == 0 then
            persistState()
        end

        -- Limit deduplication set size
        local count = 0
        for _ in pairs(processedSequences) do count = count + 1 end
        if count > 10000 then
            -- Keep only the most recent 5000
            local keys = {}
            for k in pairs(processedSequences) do keys[#keys + 1] = k end
            table.sort(keys)
            for i = 1, #keys - 5000 do
                processedSequences[keys[i]] = nil
            end
        end

        ::continue::
    end
end

return server