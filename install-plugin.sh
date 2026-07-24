#!/bin/bash
echo "============================================"
echo " MohoMCP Plugin Installer (macOS)"
echo "============================================"
echo ""

USER_SCRIPTS="$HOME/Library/Application Support/Moho/scripts"
DEST="$USER_SCRIPTS/menu"
SUB_DEST="$DEST/MohoMCP"
TOOL_DEST="$USER_SCRIPTS/tool"
APP_DEST="/Applications/Moho.app/Contents/Resources/Support/Scripts/Menu/MohoMCP"

SRC="$(cd "$(dirname "$0")" && pwd)/moho-plugin"

echo "Installing to user scripts directory: $DEST and $SUB_DEST..."
mkdir -p "$DEST/moho_mcp/tools"
mkdir -p "$SUB_DEST/moho_mcp/tools"
mkdir -p "$TOOL_DEST"
mkdir -p "$HOME/Library/Application Support/MohoMCP/ipc"
mkdir -p "/tmp/moho-mcp"
chmod 777 "/tmp/moho-mcp" 2>/dev/null || true

echo "Copying main scripts and JSON library..."
cp -f "$SRC/MohoMCP_Server.lua" "$DEST/MohoMCP_Server.lua"
cp -f "$SRC/MohoMCP_Server.lua" "$SUB_DEST/MohoMCP_Server.lua"
cp -f "$SRC/MohoMCP_Poller.lua" "$DEST/MohoMCP_Poller.lua"
cp -f "$SRC/MohoMCP_Poller.lua" "$SUB_DEST/MohoMCP_Poller.lua"
cp -f "$SRC/json.lua" "$DEST/json.lua"
cp -f "$SRC/json.lua" "$SUB_DEST/json.lua"
if [ -f "$SRC/MohoMCP_Poller.lua" ]; then
    cp -f "$SRC/MohoMCP_Poller.lua" "$TOOL_DEST/MohoMCP_Poller.lua"
fi

echo "Copying core modules..."
cp -f "$SRC/moho_mcp/server.lua" "$DEST/moho_mcp/server.lua"
cp -f "$SRC/moho_mcp/server.lua" "$SUB_DEST/moho_mcp/server.lua"
cp -f "$SRC/moho_mcp/protocol.lua" "$DEST/moho_mcp/protocol.lua"
cp -f "$SRC/moho_mcp/protocol.lua" "$SUB_DEST/moho_mcp/protocol.lua"
cp -f "$SRC/moho_mcp/validator.lua" "$DEST/moho_mcp/validator.lua"
cp -f "$SRC/moho_mcp/validator.lua" "$SUB_DEST/moho_mcp/validator.lua"

echo "Copying tool handlers..."
for tool in document layer bone animation mesh batch; do
    cp -f "$SRC/moho_mcp/tools/${tool}.lua" "$DEST/moho_mcp/tools/${tool}.lua"
    cp -f "$SRC/moho_mcp/tools/${tool}.lua" "$SUB_DEST/moho_mcp/tools/${tool}.lua"
done

if [ -w "$APP_DEST" ]; then
    echo "Updating system application scripts at $APP_DEST..."
    mkdir -p "$APP_DEST/moho_mcp/tools" 2>/dev/null || true
    cp -f "$SRC/MohoMCP_Server.lua" "$APP_DEST/MohoMCP_Server.lua" 2>/dev/null || true
    cp -f "$SRC/json.lua" "$APP_DEST/json.lua" 2>/dev/null || true
    cp -f "$SRC/moho_mcp/server.lua" "$APP_DEST/moho_mcp/server.lua" 2>/dev/null || true
fi

echo ""
echo "Verifying installed user script files..."
find "$DEST" -maxdepth 4 \( -iname '*MohoMCP*' -o -name 'moho_mcp' -o -name 'json.lua' \) -print

echo ""
echo "============================================"
echo " Installation complete!"
echo "============================================"
