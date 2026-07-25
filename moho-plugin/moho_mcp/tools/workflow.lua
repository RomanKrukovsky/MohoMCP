-- workflow.lua
-- High-level character and animation generation workflows for MohoMCP.

local workflow = {}

function workflow.createCountryball(moho, params)
    if not moho or not moho.document then
        return nil, "No active document"
    end

    params = params or {}
    local name = params.name or "Russiaball"
    local country = (params.country or "russia"):lower()
    local doc = moho.document

    local ok, resOrErr = pcall(function()
        doc:PrepUndo(nil)

        -- Create group layer for the Countryball character
        local charGroup = moho:CreateNewLayer(MOHO.LT_GROUP)
        if charGroup then
            charGroup:SetName(name)
        end
        local charGroupId = charGroup and doc:LayerAbsoluteID(charGroup) or 0

        -- Create Vector layer for Body
        local bodyLayer = moho:CreateNewLayer(MOHO.LT_VECTOR)
        if bodyLayer then
            bodyLayer:SetName(name .. " Body")
        end
        local bodyLyrId = bodyLayer and doc:LayerAbsoluteID(bodyLayer) or 0

        local vecLyr = bodyLayer and moho:LayerAsVector(bodyLayer)
        local mesh = vecLyr and vecLyr:Mesh()

        if mesh then
            local r = 0.45
            mesh:AddPoint(LM.Vector2:new_local(0, r))
            mesh:AddPoint(LM.Vector2:new_local(r, 0))
            mesh:AddPoint(LM.Vector2:new_local(0, -r))
            mesh:AddPoint(LM.Vector2:new_local(-r, 0))
            mesh:SelectAll()

            local shape = mesh:MakeShape(true)
            if shape and shape.fMyStyle then
                local style = shape.fMyStyle
                style.fHasFill = true
                style.fHasLine = true
                style.fLineWidth = 4.0

                if country == "russia" then
                    style.fFillCol.r = 0.95
                    style.fFillCol.g = 0.95
                    style.fFillCol.b = 0.95
                elseif country == "poland" then
                    style.fFillCol.r = 0.95
                    style.fFillCol.g = 0.15
                    style.fFillCol.b = 0.2
                elseif country == "ukraine" then
                    style.fFillCol.r = 0.0
                    style.fFillCol.g = 0.45
                    style.fFillCol.b = 0.85
                else
                    style.fFillCol.r = 0.9
                    style.fFillCol.g = 0.2
                    style.fFillCol.b = 0.2
                end

                style.fLineCol.r = 0.05
                style.fLineCol.g = 0.05
                style.fLineCol.b = 0.05
            end
        end

        -- Create Vector layer for Eyes
        local eyesLayer = moho:CreateNewLayer(MOHO.LT_VECTOR)
        if eyesLayer then
            eyesLayer:SetName(name .. " Eyes")
        end
        local eyesVec = eyesLayer and moho:LayerAsVector(eyesLayer)
        local eyesMesh = eyesVec and eyesVec:Mesh()

        if eyesMesh then
            local eyeR = 0.08
            local lX = -0.15
            local eY = 0.08

            eyesMesh:AddPoint(LM.Vector2:new_local(lX, eY + eyeR))
            eyesMesh:AddPoint(LM.Vector2:new_local(lX + eyeR, eY))
            eyesMesh:AddPoint(LM.Vector2:new_local(lX, eY - eyeR))
            eyesMesh:AddPoint(LM.Vector2:new_local(lX - eyeR, eY))
            eyesMesh:SelectAll()

            local lShape = eyesMesh:MakeShape(true)
            if lShape and lShape.fMyStyle then
                lShape.fMyStyle.fHasFill = true
                lShape.fMyStyle.fFillCol.r = 1.0
                lShape.fMyStyle.fFillCol.g = 1.0
                lShape.fMyStyle.fFillCol.b = 1.0
                lShape.fMyStyle.fHasLine = true
                lShape.fMyStyle.fLineWidth = 3.0
            end

            local rX = 0.15
            eyesMesh:DeselectAll()
            eyesMesh:AddPoint(LM.Vector2:new_local(rX, eY + eyeR))
            eyesMesh:AddPoint(LM.Vector2:new_local(rX + eyeR, eY))
            eyesMesh:AddPoint(LM.Vector2:new_local(rX, eY - eyeR))
            eyesMesh:AddPoint(LM.Vector2:new_local(rX - eyeR, eY))
            eyesMesh:SelectAll()

            local rShape = eyesMesh:MakeShape(true)
            if rShape and rShape.fMyStyle then
                rShape.fMyStyle.fHasFill = true
                rShape.fMyStyle.fFillCol.r = 1.0
                rShape.fMyStyle.fFillCol.g = 1.0
                rShape.fMyStyle.fFillCol.b = 1.0
                rShape.fMyStyle.fHasLine = true
                rShape.fMyStyle.fLineWidth = 3.0
            end
        end

        -- Keyframe animation (Squash and Stretch Bounce)
        if params.bounce ~= false and charGroup then
            for f = 0, 24, 6 do
                local tVec = LM.Vector2:new_local()
                local sVec = LM.Vector2:new_local()
                if f % 12 == 6 then
                    tVec.x = 0
                    tVec.y = 0.25
                    sVec.x = 0.85
                    sVec.y = 1.2
                else
                    tVec.x = 0
                    tVec.y = 0
                    sVec.x = 1.15
                    sVec.y = 0.85
                end
                pcall(function() charGroup.fTranslation:SetValue(f, tVec) end)
                pcall(function() charGroup.fScale:SetValue(f, sVec) end)
            end
        end

        doc:SetDirty()

        return {
            success = true,
            characterName = name,
            country = country,
            groupId = charGroupId,
            bodyLayerId = bodyLyrId,
            bounceAnimated = params.bounce ~= false
        }
    end)

    if not ok then
        return nil, "Failed to create Countryball: " .. tostring(resOrErr)
    end

    return resOrErr
end

return workflow
