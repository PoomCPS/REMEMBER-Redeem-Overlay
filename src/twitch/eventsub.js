import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { config } from '../config.js';

export class TwitchEventSub extends EventEmitter {
  constructor() {
    super();
    this.ws = null;
    this.sessionId = null;
    this.keepaliveTimer = null;
    this.keepaliveTimeoutSec = 10;
    this.reconnectTimeout = null;
    this.reconnectAttempts = 0;
    this.maxReconnectDelayMs = 30000;
    this.isExplicitlyClosed = false;
    this.seenMessageIds = new Set();
    this.maxSeenMessages = 500;
    this.userSubscriptions = new Map(); // broadcasterId -> Array of { type, status, error, timestamp }
    this.subscriptionQueue = new Set(); // Set of user objects waiting for sessionId
  }

  connect(url = config.twitch.eventsubWsUrl) {
    this.clearKeepaliveTimer();
    console.log(`[Twitch EventSub] Connecting to ${url}...`);

    try {
      this.ws = new WebSocket(url);
    } catch (err) {
      console.error('[Twitch EventSub] Failed to initialize WebSocket:', err.message);
      this.scheduleReconnect();
      return;
    }

    this.ws.on('open', () => {
      console.log('[Twitch EventSub] WebSocket connected. Waiting for session_welcome...');
      this.reconnectAttempts = 0;
    });

    this.ws.on('message', (data) => {
      this.handleMessage(data);
    });

    this.ws.on('close', (code, reason) => {
      console.log(`[Twitch EventSub] WebSocket closed: ${code} - ${reason?.toString() || 'none'}`);
      this.clearKeepaliveTimer();
      this.sessionId = null;
      this.emit('disconnected');

      if (!this.isExplicitlyClosed) {
        this.scheduleReconnect();
      }
    });

    this.ws.on('error', (err) => {
      console.error('[Twitch EventSub] WebSocket error:', err.message);
    });
  }

  handleMessage(data) {
    this.resetKeepalive();

    let message;
    try {
      message = JSON.parse(data.toString());
    } catch {
      return;
    }

    const { metadata, payload } = message;
    if (!metadata || !metadata.message_type) return;

    // Deduplication check
    if (metadata.message_id) {
      if (this.seenMessageIds.has(metadata.message_id)) return;
      this.seenMessageIds.add(metadata.message_id);
      if (this.seenMessageIds.size > this.maxSeenMessages) {
        const iter = this.seenMessageIds.values();
        for (let i = 0; i < 50; i++) this.seenMessageIds.delete(iter.next().value);
      }
    }

    switch (metadata.message_type) {
      case 'session_welcome':
        this.sessionId = payload.session.id;
        this.keepaliveTimeoutSec = payload.session.keepalive_timeout_seconds || 10;
        this.resetKeepalive();
        console.log(`[Twitch EventSub] Ready! Session ID: ${this.sessionId}`);
        this.emit('ready', { sessionId: this.sessionId });

        // Process any queued users
        if (this.subscriptionQueue.size > 0) {
          const queued = Array.from(this.subscriptionQueue);
          this.subscriptionQueue.clear();
          for (const u of queued) {
            this.subscribeUser(u);
          }
        }
        break;

      case 'session_keepalive':
        break;

      case 'session_reconnect':
        this.handleReconnect(payload.session.reconnect_url);
        break;

      case 'notification':
        this.handleNotification(metadata, payload);
        break;

      case 'revocation':
        console.warn('[Twitch EventSub] Subscription revoked:', payload.subscription?.type);
        break;
    }
  }

  async subscribeUser(user) {
    if (!user || !user.access_token) return;

    if (!this.sessionId) {
      console.warn(`[Twitch EventSub] Cannot subscribe @${user.login} yet: WebSocket not ready (sessionId is null). Queuing...`);
      this.subscriptionQueue.add(user);
      return;
    }

    const subscriptions = [
      {
        type: 'channel.channel_points_custom_reward_redemption.add',
        version: '1',
        condition: { broadcaster_user_id: user.id },
      },
      {
        type: 'stream.online',
        version: '1',
        condition: { broadcaster_user_id: user.id },
      },
      {
        type: 'stream.offline',
        version: '1',
        condition: { broadcaster_user_id: user.id },
      },
    ];

    const results = [];
    for (const sub of subscriptions) {
      try {
        const res = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
          method: 'POST',
          headers: {
            'Client-Id': config.twitch.clientId,
            Authorization: `Bearer ${user.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...sub,
            transport: {
              method: 'websocket',
              session_id: this.sessionId,
            },
          }),
        });

        if (res.status === 202 || res.status === 200) {
          console.log(`[Twitch EventSub] Successfully subscribed to ${sub.type} for @${user.login}`);
          results.push({ type: sub.type, success: true, status: res.status });
        } else if (res.status === 409) {
          console.log(`[Twitch EventSub] Already subscribed to ${sub.type} for @${user.login}`);
          results.push({ type: sub.type, success: true, status: 409, note: 'already_subscribed' });
        } else {
          const errBody = await res.text();
          console.warn(`[Twitch EventSub] Subscription error ${sub.type} for @${user.login} (HTTP ${res.status}):`, errBody);
          results.push({ type: sub.type, success: false, status: res.status, error: errBody });
        }
      } catch (err) {
        console.error(`[Twitch EventSub] Failed to subscribe to ${sub.type} for @${user.login}:`, err.message);
        results.push({ type: sub.type, success: false, error: err.message });
      }
    }
    this.userSubscriptions.set(user.id, results);
  }

  handleNotification(metadata, payload) {
    const subType = metadata.subscription_type;
    const event = payload.event;
    if (!event) return;

    const broadcasterId = event.broadcaster_user_id;

    if (subType === 'channel.channel_points_custom_reward_redemption.add') {
      const redemption = {
        id: event.id,
        rewardId: event.reward?.id,
        rewardTitle: event.reward?.title || 'Reward',
        rewardCost: event.reward?.cost || 0,
        userId: event.user_id,
        userName: event.user_login,
        displayName: event.user_name || event.user_login,
        userInput: event.user_input || '',
        redeemedAt: event.redeemed_at || new Date().toISOString(),
      };
      this.emit('redemption', { broadcasterId, redemption });
    } else if (subType === 'stream.online') {
      console.log(`[Twitch EventSub] Stream ONLINE for broadcaster ${broadcasterId}`);
      this.emit('stream_online', { broadcasterId, startedAt: event.started_at });
    } else if (subType === 'stream.offline') {
      console.log(`[Twitch EventSub] Stream OFFLINE for broadcaster ${broadcasterId}`);
      this.emit('stream_offline', { broadcasterId });
    }
  }

  handleReconnect(reconnectUrl) {
    console.log(`[Twitch EventSub] Reconnecting via ${reconnectUrl}`);
    const oldWs = this.ws;
    try {
      const newWs = new WebSocket(reconnectUrl);
      newWs.on('message', (data) => {
        let msg;
        try { msg = JSON.parse(data.toString()); } catch { return; }
        if (msg.metadata?.message_type === 'session_welcome') {
          try { oldWs?.close(); } catch {}
          this.ws = newWs;
        }
        this.handleMessage(data);
      });
      newWs.on('close', () => this.scheduleReconnect());
      newWs.on('error', () => this.scheduleReconnect());
    } catch {
      this.scheduleReconnect();
    }
  }

  resetKeepalive() {
    this.clearKeepaliveTimer();
    const timeoutMs = (this.keepaliveTimeoutSec + 4) * 1000;
    this.keepaliveTimer = setTimeout(() => {
      console.warn('[Twitch EventSub] Keepalive timeout. Reconnecting...');
      try { this.ws?.terminate(); } catch {}
      this.scheduleReconnect();
    }, timeoutMs);
  }

  clearKeepaliveTimer() {
    if (this.keepaliveTimer) {
      clearTimeout(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }
  }

  scheduleReconnect() {
    if (this.isExplicitlyClosed || this.reconnectTimeout) return;
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), this.maxReconnectDelayMs);
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, delay);
  }

  stop() {
    this.isExplicitlyClosed = true;
    this.clearKeepaliveTimer();
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    try { this.ws?.close(); } catch {}
  }
}

export const twitchEventSub = new TwitchEventSub();
