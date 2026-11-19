import OBSWebSocket from 'obs-websocket-js';
import { EventEmitter } from 'events';
import { config } from '../config.js';
import { sessionService } from '../services/session.js';

export class OBSManager extends EventEmitter {
  constructor() {
    super();
    this.obs = new OBSWebSocket();
    this.connected = false;
    this.connecting = false;
    this.isStreaming = false;
    this.reconnectTimeout = null;
    this.reconnectAttempts = 0;
    this.maxReconnectDelayMs = 20000;
    this.isExplicitlyClosed = false;
    this.lastError = null;

    this.setupListeners();
  }

  setupListeners() {
    this.obs.on('Identified', async () => {
      console.log(`[OBS Manager] Successfully connected & identified with OBS Studio WebSocket at ${config.obs.url}`);
      this.connected = true;
      this.connecting = false;
      this.reconnectAttempts = 0;
      this.lastError = null;

      try {
        // Query initial streaming status
        const streamStatus = await this.obs.call('GetStreamStatus');
        this.isStreaming = Boolean(streamStatus.outputActive);
        console.log(`[OBS Manager] Initial stream status queried: isStreaming = ${this.isStreaming}`);

        // Synchronize with session service
        sessionService.syncStreamingState(this.isStreaming);
      } catch (err) {
        console.warn('[OBS Manager] Could not query GetStreamStatus:', err.message);
      }

      this.emit('status_change', this.getStatus());
    });

    this.obs.on('ConnectionClosed', (err) => {
      console.log(`[OBS Manager] Connection closed: ${err?.message || 'OBS WebSocket disconnected'}`);
      this.connected = false;
      this.connecting = false;
      this.emit('status_change', this.getStatus());

      if (!this.isExplicitlyClosed) {
        this.scheduleReconnect();
      }
    });

    this.obs.on('ConnectionError', (err) => {
      console.warn(`[OBS Manager] Connection error: ${err.message}`);
      this.lastError = err.message;
      this.connected = false;
      this.connecting = false;
      this.emit('status_change', this.getStatus());
    });

    // Handle OBS StreamStateChanged
    this.obs.on('StreamStateChanged', (data) => {
      const { outputActive, outputState } = data;
      console.log(`[OBS Manager] StreamStateChanged event received: outputActive=${outputActive}, outputState=${outputState}`);
      this.isStreaming = Boolean(outputActive);

      // Pass directly to session service to manage livestream session lifecycle
      sessionService.handleObsStreamStateChanged(outputActive, outputState);

      this.emit('status_change', this.getStatus());
    });
  }

  /**
   * Connect to OBS Studio WebSocket.
   */
  async connect() {
    if (this.connecting || this.connected) return;

    this.isExplicitlyClosed = false;
    this.connecting = true;
    this.lastError = null;
    this.emit('status_change', this.getStatus());

    const url = config.obs.url;
    const password = config.obs.password;

    console.log(`[OBS Manager] Connecting to OBS WebSocket at ${url}...`);

    try {
      await this.obs.connect(url, password, { rpcVersion: 1 });
    } catch (err) {
      console.warn(`[OBS Manager] OBS connection attempt failed: ${err.message}`);
      this.connecting = false;
      this.connected = false;
      this.lastError = err.message;
      this.emit('status_change', this.getStatus());

      if (!this.isExplicitlyClosed) {
        this.scheduleReconnect();
      }
    }
  }

  scheduleReconnect() {
    if (this.isExplicitlyClosed) return;
    if (this.reconnectTimeout) return;

    this.reconnectAttempts++;
    const delay = Math.min(2000 * Math.pow(1.5, this.reconnectAttempts - 1), this.maxReconnectDelayMs);
    // console.log(`[OBS Manager] Reconnecting in ${Math.round(delay)}ms (Attempt #${this.reconnectAttempts})...`);

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, delay);
  }

  async reconnect() {
    console.log('[OBS Manager] Manual reconnect requested.');
    this.disconnect();
    this.reconnectAttempts = 0;
    await this.connect();
  }

  disconnect() {
    this.isExplicitlyClosed = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.connected || this.connecting) {
      try {
        this.obs.disconnect();
      } catch {}
    }
    this.connected = false;
    this.connecting = false;
    this.emit('status_change', this.getStatus());
  }

  getStatus() {
    return {
      connected: this.connected,
      connecting: this.connecting,
      isStreaming: this.isStreaming,
      url: config.obs.url,
      hasPassword: Boolean(config.obs.password),
      error: this.lastError,
    };
  }
}

export const obsManager = new OBSManager();

