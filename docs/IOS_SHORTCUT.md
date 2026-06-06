# iOS Share to Inbox

Share links from your iPhone/iPad directly to your inbox.

## Prerequisites

1. Tailscale installed on both your iPhone and this machine
2. This machine's Tailscale hostname: `agent-vm-1`
3. Inbox server running: `bun inbox serve` (port 3333)

---

## Create the Shortcut

Open the **Shortcuts** app on your iPhone and create a new shortcut:

### Step 1: Add "Receive" action

1. Tap the shortcut name → **Rename** → "Send to Inbox"
2. Tap the **(i)** info button → enable **Show in Share Sheet**
3. Set **Share Sheet Types** to **URLs** only
4. Tap **Done**

### Step 2: Build the shortcut

Add these actions in order:

| # | Action | Configuration |
|---|--------|---------------|
| 1 | **URL** | `http://agent-vm-1:3333/api/links` |
| 2 | **Get Contents of URL** | Method: **POST**, Headers: `Content-Type: application/json`, Request Body: `{"url":"` then tap the **Shortcut Input** variable, then `"}` |
| 3 | **Show Notification** | Title: "Saved to Inbox", Body: tap **Contents of URL** variable |

### Step 3: Detailed action setup

**Action 1 — URL:**
```
http://agent-vm-1:3333/api/links
```

**Action 2 — Get Contents of URL:**
- Tap **URL** → set to the URL from Action 1
- Tap **Show More** to reveal advanced options
- **Method**: POST
- **Headers**: Add one header:
  - Key: `Content-Type`
  - Value: `application/json`
- **Request Body**: JSON, then:
  ```
  {"url": "Shortcut Input"}
  ```
  (Tap where it says "Shortcut Input" — this is the URL you shared)

**Action 3 — Show Notification:**
- **Title**: "Saved to Inbox"
- **Body**: tap the magic variable from Action 2 (the response), or just "Link saved!"

### Step 4: Test

1. Open Safari on your iPhone
2. Go to any article
3. Tap the **Share** button
4. Scroll down → tap **Send to Inbox**
5. You should see the "Saved to Inbox" notification
6. Open `http://agent-vm-1:3333` in Safari to verify it appears

### Step 5: Add to Home Screen (optional)

For one-tap access:
1. Open `http://agent-vm-1:3333` in Safari
2. Tap Share → **Add to Home Screen**
3. Name it "Inbox"

Now you have a web app icon that shows your inbox.

---

## Troubleshooting

**Shortcut says "Could not connect to server"**
→ Make sure the inbox server is running: `bun inbox serve`
→ Make sure Tailscale is connected on both devices

**Shortcut runs but no item appears**
→ Check the server is running on port 3333
→ Check `http://agent-vm-1:3333/api/health` returns `{"ok":true}`

**"Saved to Inbox" but item not extracted properly**
→ Some sites block our user-agent. The URL is still saved — extraction happens server-side.
