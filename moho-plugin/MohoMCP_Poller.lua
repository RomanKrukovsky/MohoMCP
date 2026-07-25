-- **************************************************
-- Provide Moho with the name of this script object
-- **************************************************

ScriptName = "MohoMCP_Poller"

-- **************************************************
-- General information about this script
-- **************************************************

MohoMCP_Poller = {}

function MohoMCP_Poller:Name()
	return "MohoMCP Poller"
end

function MohoMCP_Poller:Version()
	return "0.1.0"
end

function MohoMCP_Poller:Description()
	return "Select this tool to enable MohoMCP polling. The server processes requests while this tool is active."
end

function MohoMCP_Poller:Creator()
	return "MohoMCP Project"
end

function MohoMCP_Poller:UILabel()
	return "MohoMCP Poller"
end

-- **************************************************
-- Tool icon (optional — uses default if not found)
-- **************************************************

function MohoMCP_Poller:ColorizeIcon()
	return true
end

-- **************************************************
-- Tool is always enabled/relevant when a document is open
-- **************************************************

function MohoMCP_Poller:IsEnabled(moho)
	return true
end

function MohoMCP_Poller:IsRelevant(moho)
	return true
end

-- **************************************************
-- DrawMe — called on every viewport repaint.
-- This is our polling hook.
-- **************************************************

function MohoMCP_Poller:DrawMe(moho, view)
	-- Auto-start MohoMCP_Server if not yet active
	if not _G.MohoMCP_Server or not _G.MohoMCP_Server.pollActive then
		pcall(function()
			if _G.MohoMCP_Server and _G.MohoMCP_Server.IsEnabled then
				_G.MohoMCP_Server:IsEnabled(moho)
			end
		end)
	end

	if _G.MohoMCP_Server and _G.MohoMCP_Server.pollActive and _G.MohoMCP_Server.server then
		local pollOk, pollErr = pcall(_G.MohoMCP_Server.server.poll, moho)
		if not pollOk then
			print("[MohoMCP] Poll error: " .. tostring(pollErr))
		end
		-- Self-sustaining timer via UpdateUI (throttled to ~4Hz)
		local now = os.clock()
		if not _G.MohoMCP_Server._lastPollTime or (now - _G.MohoMCP_Server._lastPollTime) > 0.25 then
			_G.MohoMCP_Server._lastPollTime = now
			pcall(function() moho:UpdateUI() end)
		end
	end
end

-- **************************************************
-- Unused but required tool callbacks
-- **************************************************

function MohoMCP_Poller:OnMouseDown(moho, mouseEvent)
end

function MohoMCP_Poller:OnMouseMoved(moho, mouseEvent)
end

function MohoMCP_Poller:OnMouseUp(moho, mouseEvent)
end
