(() => {
  const cardElement = document.getElementById('redeemCard');
  const viewerNameEl = document.getElementById('viewerName');
  const rewardTitleEl = document.getElementById('rewardTitle');
  const liveIndicatorEl = document.getElementById('liveIndicator');
  const indicatorLabelEl = document.getElementById('indicatorLabel');

  let ws = null;
  let reconnectTimer = null;
  let heartbeatTimer = null;
  let pollingTimer = null;
  let lastMessageTime = Date.now();
  let currentRedemptionId = null;

  const PING_INTERVAL_MS = 15000; // Send PING every 15s to keep Cloud Run / reverse proxies alive
  const WATCHDOG_TIMEOUT_MS = 35000; // Reconnect if no message/pong received in 35s
  const FALLBACK_POLL_INTERVAL_MS = 6000; // Background HTTP fallback sync every 6s

  let currentUser = {
    badgeText: '👑 1ST REDEEMER',
    badgeColor: '#fbbf24',
    badgeBgColor: 'rgba(245, 158, 11, 0.22)',
    fontFamily: 'Kanit',
    fontSizeScale: 1.0,
    viewerColor: '#ffffff',
    cardTheme: 'purple',
    cardBgColor: '#1c1030',
    cardBgOpacity: 0.94,
    cardBorderColor: '#c4b5fd',
    cardGlowColor: '#a855f7',
    cardRadius: '16px',
    soundEnabled: true,
  };

  const THEME_PRESETS = {
    purple: { bg: '#F4F1EA', border: '#1A1A1A', text: '#1A1A1A', radius: '0px' },
    midnight: { bg: '#121212', border: '#FCBF49', text: '#F4F1EA', radius: '0px' },
    cyberpunk: { bg: '#E2DFD7', border: '#E63946', text: '#1A1A1A', radius: '0px' },
    emerald: { bg: '#121212', border: '#2A9D8F', text: '#F4F1EA', radius: '0px' },
    sunset: { bg: '#121212', border: '#F77F00', text: '#F4F1EA', radius: '0px' },
    stealth: { bg: '#121212', border: '#5C5A54', text: '#F4F1EA', radius: '0px' },
    chrome: { bg: '#F4F1EA', border: '#1A1A1A', text: '#1A1A1A', radius: '0px' },
    metal: { bg: '#121212', border: '#FCBF49', text: '#F4F1EA', radius: '0px' },
    ferro: { bg: '#E2DFD7', border: '#E63946', text: '#1A1A1A', radius: '0px' },
    vhs: { bg: '#121212', border: '#2A9D8F', text: '#F4F1EA', radius: '0px' }
  };

  function hexToRgba(hex, alpha = 1.0) {
    if (!hex) return `rgba(28, 16, 48, ${alpha})`;
    if (hex.startsWith('rgba') || hex.startsWith('rgb')) return hex;
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    if (isNaN(num)) return `rgba(28, 16, 48, ${alpha})`;
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  function playChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch {}
  }

  function startHeartbeat() {
    stopHeartbeat();
    heartbeatTimer = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: 'PING' }));
        } catch {}
      }
      // Watchdog: If no message or pong received within WATCHDOG_TIMEOUT_MS, reconnect
      if (Date.now() - lastMessageTime > WATCHDOG_TIMEOUT_MS) {
        console.warn('[Overlay] WebSocket connection appears stale. Reconnecting...');
        try { ws.close(); } catch {}
      }
    }, PING_INTERVAL_MS);
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  function startPollingSync() {
    if (pollingTimer) clearInterval(pollingTimer);
    pollingTimer = setInterval(fetchOverlayData, FALLBACK_POLL_INTERVAL_MS);
  }

  async function fetchOverlayData() {
    if (!token) return;
    try {
      const res = await fetch(`/api/overlay-data?token=${encodeURIComponent(token)}`);
      if (!res.ok) return;
      const payload = await res.json();

      if (payload.user) {
        currentUser = { ...currentUser, ...payload.user };
        applyCustomStyles();
      }

      if (payload.session?.latestRedemption) {
        const latest = payload.session.latestRedemption;
        if (latest.id !== currentRedemptionId) {
          displayRedemption(latest, true);
        }
      } else if (currentRedemptionId !== null) {
        hideRedemption();
      }
    } catch {}
  }

  function connectWebSocket() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    if (!token) {
      console.warn('[Overlay] No token provided in URL (?token=...)');
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;

    try {
      ws = new WebSocket(wsUrl);
    } catch (err) {
      console.error('[Overlay] WebSocket create error:', err);
      reconnectTimer = setTimeout(connectWebSocket, 2500);
      return;
    }

    ws.onopen = () => {
      lastMessageTime = Date.now();
      startHeartbeat();
    };

    ws.onmessage = (event) => {
      lastMessageTime = Date.now();
      try {
        const payload = JSON.parse(event.data);
        handleServerMessage(payload);
      } catch (err) {
        console.error('[Overlay] Error parsing message:', err);
      }
    };

    ws.onclose = (event) => {
      stopHeartbeat();
      if (event.code !== 4001) {
        // Reconnect unless explicitly unauthorized
        reconnectTimer = setTimeout(connectWebSocket, 2500);
      }
    };

    ws.onerror = (err) => {
      console.error('[Overlay] WebSocket error:', err);
    };
  }

  function handleServerMessage(message) {
    const { type, data } = message;

    switch (type) {
      case 'PONG':
        // Heartbeat acknowledged
        lastMessageTime = Date.now();
        break;

      case 'INIT':
        if (data?.user) {
          currentUser = { ...currentUser, ...data.user };
          applyCustomStyles();
        }
        if (data?.session?.latestRedemption) {
          displayRedemption(data.session.latestRedemption, false);
        } else {
          hideRedemption();
        }
        break;

      case 'SETTINGS_UPDATED':
        currentUser = { ...currentUser, ...data };
        applyCustomStyles();
        break;

      case 'REDEMPTION':
        displayRedemption(data, true);
        if (data.isFirst && currentUser.soundEnabled) {
          playChime();
        }
        break;

      case 'CLEAR':
        hideRedemption();
        break;

      case 'SESSION_STATE':
        if (data?.latestRedemption) {
          displayRedemption(data.latestRedemption, false);
        } else {
          hideRedemption();
        }
        break;
    }
  }

  function applyCustomStyles() {
    applyTheme(currentUser.cardTheme);
    cardElement.style.setProperty('--overlay-font', currentUser.fontFamily || 'Kanit');
    cardElement.style.setProperty('--overlay-scale', currentUser.fontSizeScale || 1.0);
    cardElement.style.setProperty('--badge-color', currentUser.badgeColor || '#fbbf24');
    cardElement.style.setProperty('--badge-bg', currentUser.badgeBgColor || 'rgba(245, 158, 11, 0.22)');
    cardElement.style.setProperty('--badge-glow', `${currentUser.badgeColor || '#fbbf24'}66`);
    cardElement.style.setProperty('--viewer-color', currentUser.viewerColor || '#ffffff');

    // Theme & custom card properties
    const themeKey = currentUser.cardTheme || 'purple';
    const preset = THEME_PRESETS[themeKey];

    const bgColor = currentUser.cardBgColor || preset?.bg || '#F4F1EA';
    const borderColor = currentUser.cardBorderColor || preset?.border || '#1A1A1A';
    const textColor = preset?.text || (bgColor === '#121212' ? '#F4F1EA' : '#1A1A1A');

    cardElement.style.setProperty('--card-bg', bgColor);
    cardElement.style.setProperty('--card-border', borderColor);
    cardElement.style.setProperty('--card-text', textColor);
    cardElement.style.setProperty('--card-radius', '0px');
  }

  function applyTheme(theme) {
    const currentClasses = Array.from(cardElement.classList).filter((c) => !c.startsWith('theme-'));
    cardElement.className = currentClasses.join(' ');
    cardElement.classList.add(`theme-${theme || 'purple'}`);
  }

  function displayRedemption(redemption, animatePulse = true) {
    if (!redemption) return;

    currentRedemptionId = redemption.id || `${redemption.userName}_${redemption.redeemedAt}`;
    const displayName = redemption.displayName || redemption.userName || 'Viewer';
    const rewardTitle = redemption.rewardTitle || 'Reward';

    // Safe rendering with textContent
    if (viewerNameEl) viewerNameEl.textContent = displayName;
    if (rewardTitleEl) rewardTitleEl.textContent = rewardTitle;

    // Badge styling for 1st redeemer
    if (redemption.isFirst) {
      cardElement.classList.add('first-redeemer');
    } else {
      cardElement.classList.remove('first-redeemer');
    }

    if (indicatorLabelEl && liveIndicatorEl) {
      let bText = currentUser.badgeText || '👑 1ST REDEEM';
      if (!bText.startsWith('[')) bText = `[ ${bText} ]`;
      indicatorLabelEl.textContent = bText;
      indicatorLabelEl.style.color = currentUser.badgeColor || '#1A1A1A';
      liveIndicatorEl.style.borderColor = currentUser.badgeColor || '#1A1A1A';
      liveIndicatorEl.classList.add('first-redeemer');
    }

    cardElement.classList.remove('hidden');

    if (animatePulse) {
      cardElement.classList.remove('pulse');
      void cardElement.offsetWidth;
      cardElement.classList.add('pulse');
    }
  }

  function hideRedemption() {
    currentRedemptionId = null;
    cardElement.classList.add('hidden');
  }

  // Initial immediate fetch for instant loading on OBS
  fetchOverlayData();

  // Connect WebSocket for real-time events
  connectWebSocket();

  // Start background fallback sync
  startPollingSync();
})();
