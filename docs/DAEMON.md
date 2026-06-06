# Running inbox server persistently

## Option 1: systemd --user (NixOS compatible)

```bash
mkdir -p ~/.config/systemd/user
cp docs/inbox.service ~/.config/systemd/user/inbox.service
systemctl --user daemon-reload
systemctl --user enable --now inbox
systemctl --user status inbox
```

View logs: `journalctl --user -u inbox -f`

## Option 2: tmux

```bash
tmux new-session -d -s inbox "cd ~/misc/inbox && bun inbox serve"
```

To attach/detach: `tmux attach -t inbox` / `Ctrl+B, D`

## Option 3: nohup

```bash
cd ~/misc/inbox && nohup bun run src/server.ts > /tmp/inbox.log 2>&1 &
```

View logs: `tail -f /tmp/inbox.log`

## Verify

```bash
curl http://localhost:3333/api/health
# → {"ok":true}
```
