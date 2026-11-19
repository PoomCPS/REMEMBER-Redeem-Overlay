(() => {
  const cardElement = document.getElementById('redeemCard');
  const viewerNameEl = document.getElementById('viewerName');
  const rewardTitleEl = document.getElementById('rewardTitle');
  const liveIndicatorEl = document.getElementById('liveIndicator');
  const indicatorLabelEl = document.getElementById('indicatorLabel');

  let ws = null;
  let reconnectTimer = null;
  let currentUser = {
    badgeText: '👑 1ST REDEEMER',
    badgeColor: '#fbbf24',
    cardTheme: 'purple',
    soundEnabled: true,
  };

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

    ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        handleServerMessage(payload);
      } catch (err) {
        console.error('[Overlay] Error parsing message:', err);
      }
    };

    ws.onclose = (event) => {
      if (event.code !== 4001) {
        // Reconnect unless unauthorized
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
      case 'INIT':
        if (data?.user) {
          currentUser = { ...currentUser, ...data.user };
          applyTheme(currentUser.cardTheme);
        }
        if (data?.session?.latestRedemption) {
          displayRedemption(data.session.latestRedemption, false);
        } else {
          hideRedemption();
        }
        break;

      case 'SETTINGS_UPDATED':
        currentUser = { ...currentUser, ...data };
        applyTheme(currentUser.cardTheme);
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

  function applyTheme(theme) {
    const currentClasses = Array.from(cardElement.classList).filter((c) => !c.startsWith('theme-'));
    cardElement.className = currentClasses.join(' ');
    cardElement.classList.add(`theme-${theme || 'purple'}`);
  }

  function displayRedemption(redemption, animatePulse = true) {
    if (!redemption) return;

    const displayName = redemption.displayName || redemption.userName || 'Viewer';
    const rewardTitle = redemption.rewardTitle || 'Reward';

    // Safe rendering with textContent
    viewerNameEl.textContent = displayName;
    rewardTitleEl.textContent = rewardTitle;

    // Badge styling for 1st redeemer
    if (indicatorLabelEl && liveIndicatorEl) {
      if (redemption.isFirst) {
        indicatorLabelEl.textContent = currentUser.badgeText || '👑 1ST REDEEMER';
        indicatorLabelEl.style.color = currentUser.badgeColor || '#fbbf24';
        liveIndicatorEl.style.borderColor = currentUser.badgeColor || '#fbbf24';
        liveIndicatorEl.classList.add('first-redeemer');
      } else {
        indicatorLabelEl.textContent = 'LATEST';
        indicatorLabelEl.style.color = '';
        liveIndicatorEl.style.borderColor = '';
        liveIndicatorEl.classList.remove('first-redeemer');
      }
    }

    cardElement.classList.remove('hidden');

    if (animatePulse) {
      cardElement.classList.remove('pulse');
      void cardElement.offsetWidth;
      cardElement.classList.add('pulse');
    }
  }

  function hideRedemption() {
    cardElement.classList.add('hidden');
  }

  connectWebSocket();
})();
