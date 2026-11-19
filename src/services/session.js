import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { config } from '../config.js';

export class SessionService extends EventEmitter {
  constructor(filePath = config.paths.sessionFile) {
    super();
    this.filePath = filePath;
    this.state = {
      isStreaming: false,
      sessionId: null,
      streamStartedAt: null,
      latestRedemption: null,
      redemptionCount: 0,
      updatedAt: null,
    };
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const data = JSON.parse(raw);
        this.state = {
          isStreaming: Boolean(data.isStreaming),
          sessionId: data.sessionId || null,
          streamStartedAt: data.streamStartedAt || null,
          latestRedemption: data.latestRedemption || null,
          redemptionCount: Number(data.redemptionCount) || 0,
          updatedAt: data.updatedAt || null,
        };
        console.log('[Session] Loaded persistent state:', {
          isStreaming: this.state.isStreaming,
          sessionId: this.state.sessionId,
          hasLatestRedemption: Boolean(this.state.latestRedemption),
        });
      }
    } catch (err) {
      console.error('[Session] Error loading session file, resetting to clean state:', err.message);
      this.save();
    }
  }

  save() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.state.updatedAt = new Date().toISOString();
      fs.writeFileSync(this.filePath, JSON.stringify(this.state, null, 2), 'utf8');
    } catch (err) {
      console.error('[Session] Error saving session file:', err.message);
    }
  }

  getState() {
    return { ...this.state };
  }

  /**
   * Called when OBS explicitly transitions from not streaming to streaming.
   * Creates a new stream session and clears previous redemptions.
   */
  startStreamSession() {
    const newSessionId = `stream_${Date.now()}`;
    console.log(`[Session] Starting new stream session: ${newSessionId}`);
    this.state.isStreaming = true;
    this.state.sessionId = newSessionId;
    this.state.streamStartedAt = new Date().toISOString();
    this.state.latestRedemption = null;
    this.state.redemptionCount = 0;
    this.save();

    this.emit('session_start', { ...this.state });
    this.emit('clear', { reason: 'stream_started' });
    this.emit('state_change', this.getState());
  }

  /**
   * Called when OBS transitions from streaming to stopped.
   * Ends current session and clears the redemption overlay.
   */
  endStreamSession() {
    console.log(`[Session] Ending stream session: ${this.state.sessionId}`);
    this.state.isStreaming = false;
    this.state.latestRedemption = null;
    this.state.redemptionCount = 0;
    this.save();

    this.emit('session_end', { ...this.state });
    this.emit('clear', { reason: 'stream_stopped' });
    this.emit('state_change', this.getState());
  }

  /**
   * Synchronize stream status when connecting to OBS.
   * If OBS is already streaming when the app boots, we restore the active session
   * without wiping existing redemptions.
   */
  syncStreamingState(isStreamingActive) {
    const previousState = this.state.isStreaming;

    if (isStreamingActive) {
      if (!previousState) {
        // App started while OBS was already streaming and session file was offline/not streaming
        console.log('[Session] OBS is currently streaming. Activating session without wiping if present.');
        this.state.isStreaming = true;
        if (!this.state.sessionId) {
          this.state.sessionId = `stream_${Date.now()}`;
          this.state.streamStartedAt = new Date().toISOString();
        }
        this.save();
        this.emit('state_change', this.getState());
      } else {
        console.log('[Session] OBS streaming state confirmed active. Retaining current session & redemption.');
      }
    } else {
      // OBS is not streaming
      if (previousState) {
        console.log('[Session] OBS confirmed not streaming (was previously active). Closing session.');
        this.endStreamSession();
      }
    }
  }

  /**
   * Handle OBS StreamStateChanged event.
   */
  handleObsStreamStateChanged(outputActive, outputState) {
    console.log(`[Session] OBS StreamStateChanged - active: ${outputActive}, state: ${outputState}`);

    if (outputActive && !this.state.isStreaming) {
      this.startStreamSession();
    } else if (!outputActive && this.state.isStreaming) {
      this.endStreamSession();
    }
  }

  /**
   * Sets the latest redemption. Replaces any previous redemption immediately.
   */
  setLatestRedemption(data) {
    if (!data) return null;

    this.state.redemptionCount = (this.state.redemptionCount || 0) + 1;
    const isFirst = this.state.redemptionCount === 1;

    const formatted = {
      id: String(data.id || `redemption_${Date.now()}`),
      rewardId: String(data.rewardId || ''),
      rewardTitle: String(data.rewardTitle || 'Reward'),
      userId: String(data.userId || ''),
      userName: String(data.userName || 'Viewer'),
      displayName: String(data.displayName || data.userName || 'Viewer'),
      userInput: String(data.userInput || ''),
      redeemedAt: data.redeemedAt || new Date().toISOString(),
      isTest: Boolean(data.isTest),
      isFirst,
      order: this.state.redemptionCount,
    };

    console.log(`[Session] New latest redemption: ${formatted.displayName} (${formatted.userName}) - "${formatted.rewardTitle}"`);
    this.state.latestRedemption = formatted;
    this.save();

    this.emit('redemption', formatted);
    this.emit('state_change', this.getState());
    return formatted;
  }

  /**
   * Manually resets the overlay display from the dashboard
   * without ending the active OBS stream session.
   */
  resetOverlay() {
    console.log('[Session] Overlay reset requested from dashboard.');
    this.state.latestRedemption = null;
    this.save();

    this.emit('clear', { reason: 'manual_reset' });
    this.emit('state_change', this.getState());
  }
}

export const sessionService = new SessionService();

