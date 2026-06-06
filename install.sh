#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="${HOME}/.local/share/inbox"
BIN_DIR="${HOME}/.local/bin"
SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> Installing inbox to ${INSTALL_DIR}"

# 1. Copy source files
rm -rf "${INSTALL_DIR}"
mkdir -p "${INSTALL_DIR}"
cp -r "${SOURCE_DIR}/src" "${INSTALL_DIR}/src"
cp -r "${SOURCE_DIR}/bin" "${INSTALL_DIR}/bin"
cp "${SOURCE_DIR}/package.json" "${INSTALL_DIR}/package.json"
cp "${SOURCE_DIR}/bun.lock" "${INSTALL_DIR}/bun.lock" 2>/dev/null || true
cp "${SOURCE_DIR}/tsconfig.json" "${INSTALL_DIR}/tsconfig.json"

# 2. Install dependencies
cd "${INSTALL_DIR}"
bun install --production

# 3. Install CLI wrapper
mkdir -p "${BIN_DIR}"
cat > "${BIN_DIR}/inbox" << 'WRAPPER'
#!/usr/bin/env bash
cd "${HOME}/.local/share/inbox" && exec bun run bin/inbox.ts "$@"
WRAPPER
chmod +x "${BIN_DIR}/inbox"
echo "   CLI installed to ${BIN_DIR}/inbox"

# 4. Install systemd service
mkdir -p "${HOME}/.config/systemd/user"
cat > "${HOME}/.config/systemd/user/inbox.service" << SERVICE
[Unit]
Description=Inbox API server
After=network-online.target tailscaled.service
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${INSTALL_DIR}
ExecStart=${HOME}/.npm-global/bin/bun run src/server.ts
Environment=INBOX_PORT=3333
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
SERVICE

systemctl --user daemon-reload
systemctl --user enable --now inbox

# 5. Verify
sleep 2
if curl -sf http://localhost:3333/api/health > /dev/null 2>&1; then
    echo "   Server: running on :3333 ✓"
else
    echo "   Server: failed to start. Check: journalctl --user -u inbox"
fi

echo ""
echo "   Done. ${BIN_DIR}/inbox is ready."
echo "   Ensure ${BIN_DIR} is in your PATH."
