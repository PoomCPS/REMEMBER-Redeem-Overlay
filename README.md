# REMEMBER - Multi-User Twitch First Redeemer Overlay

A complete, production-ready, **multi-user Web Application** for Twitch streamers. When viewers redeem Channel Points during a livestream, it automatically detects the **First Redeemer** of the stream and displays their username and redeemed reward on a transparent OBS Studio overlay.

---

## 🌟 Key Features

- **Multi-User Web-based Architecture**:
  - Anyone can visit the site and click **"Sign in with Twitch"** to connect their channel instantly.
  - No need for other streamers to create Twitch Developer applications or configure API keys.
- **Isolated User Dashboards**:
  - Each streamer gets their own private dashboard, unique Overlay URL with secret token (`/overlay.html?token=usr_...`), and isolated settings.
- **Custom Badge & Theme Builder**:
  - **Custom Badge Text**: Freely set your 1st redeemer badge text (e.g. `👑 1ST REDEEMER`, `✨ ผู้เปิดพิธี`, `คนแรกเลยล่ะ`).
  - **Badge Accent Color**: Choose from color presets (Gold, Neon Violet, Sky Cyan, Rose Pink, Emerald) or custom hex color.
  - **Card Theme**: Pick between *Dark Violet*, *Midnight Obsidian*, or *Cyberpunk Slate*.
  - **Sound Chime**: Optional soft chime alert when the first redemption occurs.
- **Dynamic Reward Whitelist (Wishlist Words)**:
  - Add or remove custom reward titles on the fly via a tag manager.
  - **Only whitelisted rewards trigger the overlay** (e.g. `รักแรกมันแยกยาก`, `คนแรกเลยล่ะ`, `กระผมมาเป็นคนแรกเลยนะ`). Unwanted rewards are filtered out automatically.
- **Automated Stream Lifecycle (Zero OBS Configuration Needed)**:
  - Uses native Twitch EventSub `stream.online` and `stream.offline` events to detect livestream start and stop.
  - Streamers do not need to configure OBS WebSocket ports, passwords, or port-forwarding!
- **Fast & Zero-Maintenance SQLite Storage**:
  - Uses Node.js 24's built-in `node:sqlite` database for user profiles, tokens, sessions, and settings.
- **Ready for 1-Click Cloud Deployment**:
  - Dockerfile and `railway.json` included for instant deployment on [Railway.app](https://railway.com) or [Render.com](https://render.com).

---

## 🚀 Quick Start (Local Run)

1. Open PowerShell or Command Prompt:
   ```powershell
   cd F:\projectcoding\REMEMBER-Redeem-Overlay
   ```

2. Install dependencies:
   ```powershell
   npm install
   ```

3. Ensure `.env` has your Twitch Developer credentials:
   ```env
   PORT=3000
   TWITCH_CLIENT_ID=your_client_id
   TWITCH_CLIENT_SECRET=your_client_secret
   TWITCH_REDIRECT_URI=http://localhost:3000/auth/twitch/callback
   ```

4. Start the server:
   ```powershell
   npm start
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser:
   - Click **Sign in with Twitch**.
   - Customize your badge, colors, and whitelist words.
   - Copy your unique OBS Overlay URL and paste it into an OBS Browser Source!

---

## ☁️ Deploying to Railway.app (Free & Always-On)

1. Push this repository to GitHub (make sure `.env` is NOT committed; `.gitignore` protects it).
2. Go to **[Railway.app](https://railway.com)** and create a new project.
3. Select **Deploy from GitHub repo** and choose your repository.
4. In Railway project settings, add the Environment Variables:
   - `PORT`: `3000`
   - `TWITCH_CLIENT_ID`: Your Twitch Client ID
   - `TWITCH_CLIENT_SECRET`: Your Twitch Client Secret
   - `TWITCH_REDIRECT_URI`: `https://<your-railway-subdomain>.up.railway.app/auth/twitch/callback`
5. In your [Twitch Developer Console](https://dev.twitch.tv/console/apps), add your Railway URL:
   - `https://<your-railway-subdomain>.up.railway.app/auth/twitch/callback`
6. Click **Deploy**! Your multi-user Twitch Overlay service is live on the internet!

---

## 🎮 How to Add Overlay to OBS Studio

1. In OBS Studio, click **+** under **Sources** dock and choose **Browser**.
2. Name it `REMEMBER Overlay`.
3. Paste your personal Overlay URL from your Dashboard:
   ```text
   http://localhost:3000/overlay.html?token=usr_xxxxxxxxxxxxxxxx
   ```
4. Recommended Width: **600**, Height: **250** (or 1920x1080 full canvas).
5. Uncheck *Shutdown source when not visible* and *Refresh browser when scene becomes active*.
6. Click **OK**.

---

## 🧪 Testing

Run the automated integration and multi-user isolation test suite:
```powershell
npm test
```
Verifies user isolation, custom badge updating, stream start/end detection, 1st redeemer ordering, and WebSocket security.
