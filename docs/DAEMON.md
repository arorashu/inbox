# Running inbox server persistently

## Option 1: tmux (recommended)

```bash
tmux new-session -d -s inbox "cd ~/misc/inbox && bun inbox serve"
```

To attach/detach: `tmux attach -t inbox` / `Ctrl+B, D`

## Option 2: systemd (if supported)

```bash
sudo cp docs/inbox.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now inbox
sudo systemctl status inbox
```

## Option 3: nohup (simple, no reconnection)

```bash
cd ~/misc/inbox && nohup bun run src/server.ts > /tmp/inbox.log 2>&1 &
```

Server will stay running until the machine reboots. View logs: `tail -f /tmp/inbox.log`

## Option 4: Docker

```dockerfile
FROM oven/bun:1
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install
COPY . .
EXPOSE 3333
CMD ["bun", "run", "src/server.ts"]
```

## Verify it's running

```bash
curl http://localhost:3333/api/health
# → {"ok":true}
```
