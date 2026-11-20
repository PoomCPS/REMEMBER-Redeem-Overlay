import http from 'http';
import path from 'path';
import express from 'express';
import { config } from './config.js';
import { userRepo, sessionRepo, authRepo } from './db/db.js';
import { twitchOAuth } from './twitch/oauth.js';
import { twitchManager } from './twitch/twitch.js';
import { broadcaster } from './websocket/broadcaster.js';

const app = express();
const server = http.createServer(app);

// Simple lightweight cookie parser
app.use((req, res, next) => {
  req.cookies = {};
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    cookieHeader.split(';').forEach((cookie) => {
      const parts = cookie.split('=');
      if (parts.length === 2) {
        req.cookies[parts[0].trim()] = decodeURIComponent(parts[1].trim());
      }
    });
  }
  next();
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Auth middleware
const requireAuth = (req, res, next) => {
  const token = req.cookies.session_token;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Please log in with Twitch' });
  }

  const user = authRepo.getUserBySessionToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Session expired. Please log in again' });
  }

  req.user = user;
  next();
};

const optionalAuth = (req, res, next) => {
  const token = req.cookies.session_token;
  if (token) {
    req.user = authRepo.getUserBySessionToken(token);
  }
  next();
};

// Static files
const publicDir = path.join(config.paths.rootDir, 'public');
app.use(express.static(publicDir));

// WebSocket Broadcaster
broadcaster.init(server);

// --- Routes ---

// Main page
app.get('/', optionalAuth, (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Health check endpoint for UptimeRobot / Keep-alive monitors
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// Overlay page
app.get('/overlay', (req, res) => {
  res.sendFile(path.join(publicDir, 'overlay.html'));
});

// 1. Twitch OAuth Login Initiation
app.get('/auth/twitch/login', (req, res) => {
  try {
    const host = req.get('host') || 'localhost:3000';
    const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
    const redirectUri = isLocal
      ? `http://${host}/auth/twitch/callback`
      : (host.includes('onrender.com') ? `https://${host}/auth/twitch/callback` : config.twitch.redirectUri);

    const { url } = twitchOAuth.getAuthorizationUrl(redirectUri);
    res.redirect(url);
  } catch (err) {
    res.status(500).send(`<h3>Twitch Login Error</h3><p>${err.message}</p>`);
  }
});

// Local Dev Mock Login (Quick test without Twitch credentials)
app.get('/auth/dev-login', (req, res) => {
  const host = req.get('host') || '';
  if (!host.includes('localhost') && !host.includes('127.0.0.1')) {
    return res.status(403).send('Dev login only allowed on localhost');
  }

  const devUser = userRepo.upsertUser({
    id: 'local_dev_user',
    login: 'streamer_dev',
    displayName: 'สตรีมเมอร์ (Dev Test)',
    profileImageUrl: 'https://static-cdn.jtvnw.net/user-default-pictures-uv/75305d54-c7cc-40d1-bbbb-6a3f15440b54-profile_image-70x70.png',
    accessToken: 'mock_token',
    refreshToken: 'mock_refresh',
    tokenExpiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
  });

  const sessionToken = authRepo.createSession(devUser.id);
  res.setHeader(
    'Set-Cookie',
    `session_token=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`
  );

  res.redirect('/?auth=success');
});

// 2. Twitch OAuth Callback
app.get('/auth/twitch/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;

  if (error) {
    return res.redirect(`/?error=${encodeURIComponent(error_description || error)}`);
  }

  if (!code || !state) {
    return res.redirect('/?error=Missing+code+or+state');
  }

  try {
    const { sessionToken } = await twitchManager.handleOAuthCallback(code, state);

    // Set secure HTTP-only cookie
    res.setHeader(
      'Set-Cookie',
      `session_token=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`
    );

    res.redirect('/?auth=success');
  } catch (err) {
    console.error('[OAuth Callback Error]:', err.message);
    res.redirect(`/?error=${encodeURIComponent(err.message)}`);
  }
});

// 3. Logout
app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies.session_token;
  if (token) authRepo.deleteSession(token);

  res.setHeader('Set-Cookie', 'session_token=; Path=/; HttpOnly; Max-Age=0');
  res.json({ success: true });
});

// 4. Get Current User & Status
app.get('/api/me', requireAuth, (req, res) => {
  const user = userRepo.findUserById(req.user.id);
  const session = sessionRepo.getSession(req.user.id);

  let whitelistWords = [];
  try {
    whitelistWords = JSON.parse(user.whitelist_words || '[]');
  } catch {}

  res.json({
    user: {
      id: user.id,
      login: user.login,
      displayName: user.display_name,
      profileImageUrl: user.profile_image_url,
      overlayToken: user.overlay_token,
      badgeText: user.badge_text,
      badgeColor: user.badge_color,
      badgeBgColor: user.badge_bg_color || 'rgba(245, 158, 11, 0.22)',
      fontFamily: user.font_family || 'Kanit',
      fontSizeScale: Number(user.font_size_scale) || 1.0,
      viewerColor: user.viewer_color || '#ffffff',
      cardTheme: user.card_theme || 'purple',
      cardBgColor: user.card_bg_color || '#1c1030',
      cardBgOpacity: user.card_bg_opacity !== null && user.card_bg_opacity !== undefined ? Number(user.card_bg_opacity) : 0.94,
      cardBorderColor: user.card_border_color || '#c4b5fd',
      cardGlowColor: user.card_glow_color || '#a855f7',
      cardRadius: user.card_radius || '16px',
      whitelistWords,
      soundEnabled: Boolean(user.sound_enabled),
    },
    session,
  });
});

// 5. Update User Settings (Badge Text, Colors, Fonts, Sizes, Whitelist, Theme, Custom Cards)
app.post('/api/settings', requireAuth, (req, res) => {
  const {
    badgeText,
    badgeColor,
    badgeBgColor,
    fontFamily,
    fontSizeScale,
    viewerColor,
    cardTheme,
    cardBgColor,
    cardBgOpacity,
    cardBorderColor,
    cardGlowColor,
    cardRadius,
    whitelistWords,
    soundEnabled,
  } = req.body;

  const updated = userRepo.updateUserSettings(req.user.id, {
    badgeText,
    badgeColor,
    badgeBgColor,
    fontFamily,
    fontSizeScale,
    viewerColor,
    cardTheme,
    cardBgColor,
    cardBgOpacity,
    cardBorderColor,
    cardGlowColor,
    cardRadius,
    whitelistWords,
    soundEnabled,
  });

  // Broadcast settings update to live overlays
  broadcaster.broadcastSettingsUpdate(req.user.id, {
    badgeText: updated.badge_text,
    badgeColor: updated.badge_color,
    badgeBgColor: updated.badge_bg_color,
    fontFamily: updated.font_family,
    fontSizeScale: Number(updated.font_size_scale) || 1.0,
    viewerColor: updated.viewer_color,
    cardTheme: updated.card_theme,
    cardBgColor: updated.card_bg_color,
    cardBgOpacity: Number(updated.card_bg_opacity) || 0.94,
    cardBorderColor: updated.card_border_color,
    cardGlowColor: updated.card_glow_color,
    cardRadius: updated.card_radius,
    soundEnabled: Boolean(updated.sound_enabled),
  });

  res.json({ success: true, user: updated });
});

// 6. Regenerate Overlay Token
app.post('/api/regenerate-token', requireAuth, (req, res) => {
  const newToken = userRepo.regenerateOverlayToken(req.user.id);
  res.json({ success: true, overlayToken: newToken });
});

// 7. Trigger Test Redemption
app.post('/api/test-redemption', requireAuth, (req, res) => {
  const { userName, displayName, rewardTitle } = req.body;
  const user = userRepo.findUserById(req.user.id);

  let whitelist = [];
  try {
    whitelist = JSON.parse(user.whitelist_words || '[]');
  } catch {}

  const finalTitle = rewardTitle || (whitelist.length > 0 ? whitelist[0] : 'รักแรกมันแยกยาก');

  const testData = {
    id: `test_${Date.now()}`,
    rewardId: `test_reward_${Date.now()}`,
    rewardTitle: finalTitle,
    userId: '999999999',
    userName: userName || 'Viewer99',
    displayName: displayName || userName || 'Viewer99',
    userInput: '',
    redeemedAt: new Date().toISOString(),
    isTest: true,
  };

  const formatted = sessionRepo.setLatestRedemption(req.user.id, testData);
  broadcaster.broadcastRedemption(req.user.id, formatted);

  res.json({ success: true, redemption: formatted });
});

// 8. Reset Overlay Display
app.post('/api/reset-overlay', requireAuth, (req, res) => {
  sessionRepo.resetOverlay(req.user.id);
  broadcaster.broadcastClear(req.user.id, 'manual_reset');
  res.json({ success: true });
});

// 9. Public endpoint to verify overlay token & get initial data
app.get('/api/overlay-data', (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(400).json({ error: 'Missing token' });

  const user = userRepo.findUserByOverlayToken(token);
  if (!user) return res.status(404).json({ error: 'Invalid overlay token' });

  const session = sessionRepo.getSession(user.id);
  res.json({
    user: {
      displayName: user.display_name,
      badgeText: user.badge_text,
      badgeColor: user.badge_color,
      badgeBgColor: user.badge_bg_color || 'rgba(245, 158, 11, 0.22)',
      fontFamily: user.font_family || 'Kanit',
      fontSizeScale: Number(user.font_size_scale) || 1.0,
      viewerColor: user.viewer_color || '#ffffff',
      cardTheme: user.card_theme || 'purple',
      cardBgColor: user.card_bg_color || '#1c1030',
      cardBgOpacity: user.card_bg_opacity !== null && user.card_bg_opacity !== undefined ? Number(user.card_bg_opacity) : 0.94,
      cardBorderColor: user.card_border_color || '#c4b5fd',
      cardGlowColor: user.card_glow_color || '#a855f7',
      cardRadius: user.card_radius || '16px',
      soundEnabled: Boolean(user.sound_enabled),
    },
    session,
  });
});

// Start Server
server.listen(config.port, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`  REMEMBER Multi-User Twitch Overlay Server Running!`);
  console.log(`  Listening on: http://localhost:${config.port}`);
  console.log(`====================================================`);

  twitchManager.init().catch((err) => {
    console.error('[Startup] Twitch Manager init error:', err.message);
  });
});

export { app, server };
