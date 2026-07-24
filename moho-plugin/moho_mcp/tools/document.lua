-- document.lua
-- Tool handlers for querying document-level information in Moho.
-- Returns a table of handler functions that accept (moho, params) and return
-- a result table on success, or nil + errorMessage on failure.

local document = {}

-- Map numeric layer type constants to human-readable strings.
local LAYER_TYPE_NAMES = {}
local function initLayerTypeNames()
    if next(LAYER_TYPE_NAMES) ~= nil then
        return
    end
    local M = nil
    pcall(function() M = MOHO end)
    if not M then
        pcall(function() M = LM.MOHO end)
    end
    if M then
        pcall(function() LAYER_TYPE_NAMES[M.LT_VECTOR]   = "vector" end)
        pcall(function() LAYER_TYPE_NAMES[M.LT_BONE]     = "bone" end)
        pcall(function() LAYER_TYPE_NAMES[M.LT_GROUP]    = "group" end)
        pcall(function() LAYER_TYPE_NAMES[M.LT_IMAGE]    = "image" end)
        pcall(function() LAYER_TYPE_NAMES[M.LT_AUDIO]    = "audio" end)
        pcall(function() LAYER_TYPE_NAMES[M.LT_SWITCH]   = "switch" end)
        pcall(function() LAYER_TYPE_NAMES[M.LT_PARTICLE] = "particle" end)
        pcall(function() LAYER_TYPE_NAMES[M.LT_NOTE]     = "note" end)
        pcall(function() LAYER_TYPE_NAMES[M.LT_PATCH]    = "patch" end)
    end
end

local function layerTypeName(layerType)
    initLayerTypeNames()
    return LAYER_TYPE_NAMES[layerType] or "unknown"
end

local function collectChildren(moho, groupLayer, parentId)
    local children = {}
    local count = groupLayer:CountLayers()

    for i = 0, count - 1 do
        local ok, childOrErr = pcall(function() return groupLayer:Layer(i) end)
        if ok and childOrErr then
            local child = childOrErr
            local idOk, absId = pcall(function()
                if moho and moho.LayerAbsoluteID then
                    return moho:LayerAbsoluteID(child)
                end
                return i
            end)
            local entry = {
                id       = (idOk and absId ~= nil) and absId or i,
                name     = child:Name(),
                type     = layerTypeName(child:LayerType()),
                visible  = child:IsVisible(),
                locked   = child:IsLocked(),
                parentId = parentId,
                children = {}
            }

            if child:IsGroupType() then
                local gOk, group = pcall(function() return moho:LayerAsGroup(child) end)
                if gOk and group then
                    entry.children = collectChildren(moho, group, entry.id)
                end
            end

            children[#children + 1] = entry
        end
    end

    return children
end

function document.getInfo(moho, params)
    local ok, err = pcall(function()
        if not moho or not moho.document then
            error("No active document")
        end
    end)
    if not ok then
        return nil, tostring(err)
    end

    local doc = moho.document
    local result = {}

    local nOk, name = pcall(function() return doc:Name() end)
    result.name = nOk and name or ""

    local pOk, path = pcall(function() return doc:Path() end)
    result.filePath = pOk and path or ""

    local wOk, w = pcall(function() return doc:Width() end)
    result.width = wOk and w or 0

    local hOk, h = pcall(function() return doc:Height() end)
    result.height = hOk and h or 0

    local fOk, fps = pcall(function() return doc:Fps() end)
    result.fps = fOk and fps or 24

    local sOk, sf = pcall(function() return doc:StartFrame() end)
    result.startFrame = sOk and sf or 0

    local eOk, ef = pcall(function() return doc:EndFrame() end)
    result.endFrame = eOk and ef or 0

    local cOk, cf = pcall(function() return doc:CurrentFrame() end)
    result.currentFrame = cOk and cf or 0

    if result.fps > 0 then
        result.duration = (result.endFrame - result.startFrame) / result.fps
    else
        result.duration = 0
    end

    local tlOk, tl = pcall(function() return doc:TotalLayerCount() end)
    result.totalLayers = tlOk and tl or 0

    local clOk, cl = pcall(function() return doc:CountLayers() end)
    result.topLevelLayers = clOk and cl or 0

    return result
end

function document.getLayers(moho, params)
    if not moho or not moho.document then
        return nil, "No active document"
    end

    local doc = moho.document
    local layers = {}

    local countOk, topCount = pcall(function() return doc:CountLayers() end)
    if not countOk then
        return nil, "Failed to count top-level layers: " .. tostring(topCount)
    end

    for i = 0, topCount - 1 do
        local ok, layerOrErr = pcall(function() return doc:Layer(i) end)
        if ok and layerOrErr then
            local lyr = layerOrErr
            local idOk, absId = pcall(function()
                if moho and moho.LayerAbsoluteID then
                    return moho:LayerAbsoluteID(lyr)
                end
                return i
            end)
            local entry = {
                id       = (idOk and absId ~= nil) and absId or i,
                name     = lyr:Name(),
                type     = layerTypeName(lyr:LayerType()),
                visible  = lyr:IsVisible(),
                locked   = lyr:IsLocked(),
                parentId = -1,
                children = {}
            }

            if lyr:IsGroupType() then
                local gOk, group = pcall(function() return moho:LayerAsGroup(lyr) end)
                if gOk and group then
                    entry.children = collectChildren(moho, group, entry.id)
                end
            end

            layers[#layers + 1] = entry
        end
    end

    return layers
end

function document.setFrame(moho, params)
    if not moho then
        return nil, "No Moho instance"
    end

    local frame = params.frame
    if not frame or type(frame) ~= "number" then
        return nil, "Missing or invalid 'frame' parameter"
    end

    local ok, err = pcall(function()
        moho:SetCurFrame(math.floor(frame))
    end)

    if not ok then
        return nil, "Failed to set frame: " .. tostring(err)
    end

    return {
        success = true,
        currentFrame = math.floor(frame)
    }
end

function document.screenshot(moho, params)
    if not moho or not moho.document then
        return nil, "No active document"
    end

    local doc = moho.document
    local docWidth = doc:Width()
    local docHeight = doc:Height()

    local renderWidth = params.width or docWidth
    local renderHeight = params.height or docHeight

    if renderWidth <= 0 or renderHeight <= 0 then
        return nil, "Invalid render dimensions: " .. renderWidth .. "x" .. renderHeight
    end

    local tempDir = os.getenv("TEMP") or os.getenv("TMP") or os.getenv("TMPDIR") or "/tmp"
    local sep = package.config:sub(1, 1)
    local mcpDir = tempDir .. sep .. "moho-mcp"
    if sep == "\\" then
        io.popen('cmd.exe /c mkdir "' .. mcpDir .. '" 2>NUL'):close()
    else
        io.popen('/bin/mkdir -p "' .. mcpDir .. '" 2>/dev/null'):close()
    end

    local timestamp = tostring(os.clock()):gsub("%.", "_")
    local tempPath = mcpDir .. "/render_" .. timestamp .. ".png"

    local renderOk, renderErr = pcall(function()
        moho:Render(tempPath, renderWidth, renderHeight)
    end)

    if not renderOk then
        return nil, "Failed to render document screenshot: " .. tostring(renderErr)
    end

    return {
        success = true,
        filePath = tempPath,
        width = renderWidth,
        height = renderHeight
    }
end

return document
