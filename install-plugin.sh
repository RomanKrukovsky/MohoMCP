#!/bin/bash
echo "============================================"
echo " MohoMCP Plugin Installer (macOS)"
echo "============================================"
echo ""

# Primary user scripts directory loaded by Moho
USER_SCRIPTS="$HOME/Library/Application Support/Moho/scripts"
DEST="$USER_SCRIPTS/menu"
TOOL_DEST="$USER_SCRIPTS/tool"

SRC="$(cd "$(dirname "$0")" && pwd)/moho-plugin"

echo "Installing to user scripts directory: $DEST"
mkdir -p "$DEST/moho_mcp/tools"
mkdir -p "$TOOL_DEST"

echo "Copying main scripts and JSON library..."
cp -f "$SRC/MohoMCP_Server.lua" "$DEST/MohoMCP_Server.lua"
cp -f "$SRC/MohoMCP_Poller.lua" "$DEST/MohoMCP_Poller.lua"
cp -f "$SRC/json.lua" "$DEST/json.lua"
if [ -f "$SRC/MohoMCP_Poller.lua" ]; then
    cp -f "$SRC/MohoMCP_Poller.lua" "$TOOL_DEST/MohoMCP_Poller.lua"
fi

echo "Copying core modules..."
cp -f "$SRC/moho_mcp/server.lua" "$DEST/moho_mcp/server.lua"
cp -f "$SRC/moho_mcp/protocol.lua" "$DEST/moho_mcp/protocol.lua"
cp -f "$SRC/moho_mcp/validator.lua" "$DEST/moho_mcp/validator.lua"

echo "Copying tool handlers..."
cp -f "$SRC/moho_mcp/tools/document.lua" "$DEST/moho_mcp/tools/document.lua"
cp -f "$SRC/moho_mcp/tools/layer.lua" "$DEST/moho_mcp/tools/layer.lua"
cp -f "$SRC/moho_mcp/tools/bone.lua" "$DEST/moho_mcp/tools/bone.lua"
cp -f "$SRC/moho_mcp/tools/animation.lua" "$DEST/moho_mcp/tools/animation.lua"
cp -f "$SRC/moho_mcp/tools/mesh.lua" "$DEST/moho_mcp/tools/mesh.lua"
cp -f "$SRC/moho_mcp/tools/batch.lua" "$DEST/moho_mcp/tools/batch.lua"

echo ""
echo "Verifying installed user script files..."
find "$DEST" -maxdepth 3 \( -iname '*MohoMCP*' -o -name 'moho_mcp' -o -name 'json.lua' \) -print

echo ""
echo "============================================"
echo " Installation complete!"
echo "============================================"
