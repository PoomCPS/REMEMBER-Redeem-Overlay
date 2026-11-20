import { EventEmitter } from 'events';
import { config } from '../config.js';
import { twitchOAuth } from './oauth.js';
import { twitchEventSub } from './eventsub.js';
import { userRepo, sessionRepo, authRepo } from '../db/db.js';
import { broadcaster } from '../websocket/broadcaster.js';

export class TwitchMultiUserManager extends EventEmitter {
  constructor() {
    super();
    this.ready = false;
    this.setupListeners();
  }

  setupListeners() {
    twitchEventSub.on('ready', async () => {
      this.ready = true;
      console.log('[Twitch Multi-User] EventSub is ready. Subscribing all registered users...');
      await this.subscribeAllUsers();
    });

    twitchEventSub.on('disconnected', () => {
      this.ready = false;
    });

    // Handle incoming Channel Points Redemption
    twitchEventSub.on('redemption', ({ broadcasterId, redemption }) => {
      const user = userRepo.findUserById(broadcasterId);
      if (!user) return;

      // Check User's Custom Whitelist
      let whitelist = [];
      try {
        whitelist = JSON.parse(user.whitelist_words || '[]');
      } catch {}

      if (whitelist.length > 0) {
        const cleanReward = String(redemption.rewardTitle || '').trim().toLowerCase();
        const isAllowed = whitelist.some((w) => cleanReward === String(w).trim().toLowerCase());

        if (!isAllowed) {
          console.log(`[Twitch Multi-User] Skipping reward "${redemption.rewardTitle}" for @${user.login} (not in whitelist).`);
          return;
        }
      }

      console.log(`[Twitch Multi-User] Valid redemption for @${user.login}: ${redemption.displayName} - "${redemption.rewardTitle}"`);
      const formatted = sessionRepo.setLatestRedemption(broadcasterId, redemption);
      broadcaster.broadcastRedemption(broadcasterId, formatted);
    });

    // Handle Stream Online
    twitchEventSub.on('stream_online', ({ broadcasterId }) => {
      const user = userRepo.findUserById(broadcasterId);
      if (!user) return;

      console.log(`[Twitch Multi-User] @${user.login} started streaming. Resetting session.`);
      const session = sessionRepo.startStream(broadcasterId);
      broadcaster.broadcastClear(broadcasterId, 'stream_started');
      broadcaster.broadcastSessionState(broadcasterId, session);
    });

    // Handle Stream Offline
    twitchEventSub.on('stream_offline', ({ broadcasterId }) => {
      const user = userRepo.findUserById(broadcasterId);
      if (!user) return;

      console.log(`[Twitch Multi-User] @${user.login} stopped streaming. Clearing overlay.`);
      const session = sessionRepo.endStream(broadcasterId);
      broadcaster.broadcastClear(broadcasterId, 'stream_stopped');
      broadcaster.broadcastSessionState(broadcasterId, session);
    });
  }

  async init() {
    if (!config.isTwitchConfigured()) {
      console.warn('[Twitch Multi-User] Twitch Client ID or Secret missing in .env');
      return;
    }
    twitchEventSub.connect();
  }

  async subscribeAllUsers() {
    const users = userRepo.getAllUsers();
    for (const user of users) {
      await this.ensureUserSubscribed(user);
    }
  }

  async ensureUserSubscribed(user) {
    try {
      // Validate or refresh token
      let accessToken = user.access_token;
      const validation = await twitchOAuth.validateToken(accessToken);

      if (!validation.valid || validation.expiresIn < 300) {
        // Token invalid or expiring soon -> refresh
        console.log(`[Twitch Multi-User] Refreshing token for @${user.login}...`);
        const refreshed = await twitchOAuth.refreshAccessToken(user.refresh_token);
        accessToken = refreshed.access_token;
        user.access_token = refreshed.access_token;
        user.refresh_token = refreshed.refresh_token || user.refresh_token;
        user.token_expires_at = Date.now() + (refreshed.expires_in || 3600) * 1000;
        userRepo.upsertUser(user);
      }

      await twitchEventSub.subscribeUser(user);
    } catch (err) {
      console.error(`[Twitch Multi-User] Error subscribing user @${user.login}:`, err.message);
    }
  }

  async handleOAuthCallback(code, state) {
    const stateData = twitchOAuth.validateStateToken(state);
    if (!stateData) {
      throw new Error('Invalid or expired OAuth state token.');
    }

    const tokenData = await twitchOAuth.exchangeCodeForTokens(code, stateData.redirectUri);
    const profile = await twitchOAuth.getUserProfile(tokenData.access_token);

    if (!profile) {
      throw new Error('Failed to retrieve user profile from Twitch.');
    }

    const user = userRepo.upsertUser({
      id: profile.id,
      login: profile.login,
      displayName: profile.display_name,
      profileImageUrl: profile.profile_image_url,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenExpiresAt: Date.now() + (tokenData.expires_in || 3600) * 1000,
    });

    // Subscribe immediately in EventSub
    await this.ensureUserSubscribed(user);

    // Create web session token
    const sessionToken = authRepo.createSession(user.id);
    return { user, sessionToken };
  }
}

export const twitchManager = new TwitchMultiUserManager();
