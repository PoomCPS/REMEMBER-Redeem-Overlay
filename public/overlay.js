import {
  renderCustomTemplate,
  scopeCss,
  populateDomHooks,
  DEFAULT_VHS_STARTER_HTML,
  DEFAULT_VHS_STARTER_CSS
} from './template-engine.js';

(() => {
  const cardElement = document.getElementById('redeemCard');
  const viewerNameEl = document.getElementById('viewerName');
  const rewardTitleEl = document.getElementById('rewardTitle');
  const liveIndicatorEl = document.getElementById('liveIndicator');
  const indicatorLabelEl = document.getElementById('indicatorLabel');
  const customOverlayRoot = document.getElementById('customOverlayRoot');
  const customOverlayStyle = document.getElementById('customOverlayStyle');

  let ws = null;
  let reconnectTimer = null;
  let heartbeatTimer = null;
  let pollingTimer = null;
  let lastMessageTime = Date.now();
  let currentRedemptionId = null;
  let lastRedemptionData = null;

  const PING_INTERVAL_MS = 15000; // Send PING every 15s to keep Cloud Run / reverse proxies alive
  const WATCHDOG_TIMEOUT_MS = 35000; // Reconnect if no message/pong received in 35s
  const FALLBACK_POLL_INTERVAL_MS = 6000; // Background HTTP fallback sync every 6s

  let currentUser = {
    badgeText: '1ST',
    badgeColor: '#10111A',
    badgeBgColor: '#00A896',
    fontFamily: 'Kanit',
    fontSizeScale: 1.0,
    viewerColor: '#FFFFFF',
    cardTheme: 'purple',
    cardBgColor: '#10111A',
    cardBgOpacity: 1.0,
    cardBorderColor: '#000000',
    cardGlowColor: '#F2B857',
    cardRadius: '0px',
    soundEnabled: true,
    configMode: 'preset',
    customHtml: '',
    customCss: '',
  };

  const THEME_PRESETS = {
    // Classic Blank VHS Tape Brands
    polaroid: { bg: '#F4F1EA', border: '#1A1A1A', text: '#1A1A1A', badgeBg: '#1A1A1A', badgeColor: '#F4F1EA', glow: '#E63946', stripes: ['#E63946', '#F77F00', '#FCBF49', '#0096C7', '#2A9D8F'] },
    tdk: { bg: '#121212', border: '#D4AF37', text: '#F4F1EA', badgeBg: '#D4AF37', badgeColor: '#121212', glow: '#F2B857', stripes: ['#5C3A38', '#E0604E', '#F2B857', '#EDE3D2', '#D4AF37'] },
    maxell: { bg: '#10111A', border: '#FCBF49', text: '#FFFFFF', badgeBg: '#FCBF49', badgeColor: '#10111A', glow: '#FCBF49', stripes: ['#8C6D53', '#BC6C25', '#FCBF49', '#F4F1EA', '#FCBF49'] },
    jvc: { bg: '#0D1B2A', border: '#00F0FF', text: '#F4F1EA', badgeBg: '#00A896', badgeColor: '#0D1B2A', glow: '#00F0FF', stripes: ['#00A896', '#00F0FF', '#3A86FF', '#F4F1EA', '#00A896'] },
    sony: { bg: '#0B061A', border: '#0096C7', text: '#F4F1EA', badgeBg: '#E63946', badgeColor: '#FFFFFF', glow: '#0096C7', stripes: ['#0096C7', '#7209B7', '#FF007F', '#F4F1EA', '#0096C7'] },

    // Filmora 15 VHS Color Palettes
    'neon-midnight': { bg: '#0B061A', border: '#00F0FF', text: '#00F0FF', badgeBg: '#FF007F', badgeColor: '#FFFFFF', glow: '#00F0FF', stripes: ['#0B061A', '#1E1145', '#FF007F', '#00F0FF', '#FF007F'] },
    outrun: { bg: '#050505', border: '#FF9E00', text: '#FF9E00', badgeBg: '#F72585', badgeColor: '#FFFFFF', glow: '#FF9E00', stripes: ['#050505', '#7209B7', '#F72585', '#FF9E00', '#F72585'] },
    'sun-bleached': { bg: '#3A3335', border: '#E07A5F', text: '#F4F1DE', badgeBg: '#81B29A', badgeColor: '#3A3335', glow: '#E07A5F', stripes: ['#3A3335', '#E07A5F', '#F4F1DE', '#81B29A', '#E07A5F'] },
    'aged-attic': { bg: '#2C221E', border: '#D4A373', text: '#FAEDCD', badgeBg: '#7A5C48', badgeColor: '#FAEDCD', glow: '#D4A373', stripes: ['#2C221E', '#7A5C48', '#D4A373', '#FAEDCD', '#D4A373'] },
    'toxic-crt': { bg: '#050F0A', border: '#2DC653', text: '#90BE6D', badgeBg: '#2DC653', badgeColor: '#050F0A', glow: '#2DC653', stripes: ['#050F0A', '#0D3B22', '#2DC653', '#90BE6D', '#2DC653'] },
    'glitch-core': { bg: '#0D1B2A', border: '#00FF66', text: '#00FF66', badgeBg: '#FF3366', badgeColor: '#FFFFFF', glow: '#00FF66', stripes: ['#0D1B2A', '#1B263B', '#00FF66', '#FF3366', '#00FF66'] },
    smpte: { bg: '#10111A', border: '#CC0000', text: '#FFFFFF', badgeBg: '#003366', badgeColor: '#FFFFFF', glow: '#009999', stripes: ['#003366', '#990099', '#009999', '#CC0000', '#FFFFFF'] },
    cartoon: { bg: '#1D3557', border: '#FFB703', text: '#FFFFFF', badgeBg: '#E63946', badgeColor: '#FFFFFF', glow: '#FFB703', stripes: ['#1D3557', '#E63946', '#FFB703', '#8ECAE6', '#E63946'] },

    // Backward-compatible presets
    purple: { bg: '#10111A', border: '#000000', text: '#FFFFFF', radius: '0px' },
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
    } catch { }
  }

  function startHeartbeat() {
    stopHeartbeat();
    heartbeatTimer = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: 'PING' }));
        } catch { }
      }
      // Watchdog: If no message or pong received within WATCHDOG_TIMEOUT_MS, reconnect
      if (Date.now() - lastMessageTime > WATCHDOG_TIMEOUT_MS) {
        console.warn('[Overlay] WebSocket connection appears stale. Reconnecting...');
        try { ws.close(); } catch { }
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
    } catch { }
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
    if (currentUser.configMode === 'manual') {
      const css = currentUser.customCss || DEFAULT_VHS_STARTER_CSS;
      if (customOverlayStyle) {
        customOverlayStyle.textContent = scopeCss(css, '#customOverlayRoot');
      }
      if (cardElement) cardElement.classList.add('hidden');
      if (lastRedemptionData) {
        displayRedemption(lastRedemptionData, false);
      }
      return;
    }

    // Preset mode
    if (customOverlayRoot) customOverlayRoot.classList.add('hidden');
    if (customOverlayStyle) customOverlayStyle.textContent = '';

    applyTheme(currentUser.cardTheme);
    cardElement.style.setProperty('--overlay-font', currentUser.fontFamily || 'Kanit');
    cardElement.style.setProperty('--overlay-scale', currentUser.fontSizeScale || 1.0);
    cardElement.style.setProperty('--badge-color', currentUser.badgeColor || '#10111A');
    cardElement.style.setProperty('--badge-bg', currentUser.badgeBgColor || '#00A896');
    cardElement.style.setProperty('--viewer-color', currentUser.viewerColor || '#FFFFFF');
    cardElement.style.setProperty('--card-bg', currentUser.cardBgColor || '#10111A');
    cardElement.style.setProperty('--card-border', currentUser.cardBorderColor || '#000000');
    cardElement.style.setProperty('--card-radius', '0px');

    // If preset defines stripes, apply them
    const preset = THEME_PRESETS[currentUser.cardTheme];
    if (preset && preset.stripes && preset.stripes.length >= 4) {
      preset.stripes.forEach((color, idx) => {
        cardElement.style.setProperty(`--stripe-${idx + 1}`, color);
      });
    } else if (currentUser.cardGlowColor) {
      // Use card glow color as an accent highlight stripe
      cardElement.style.setProperty('--stripe-3', currentUser.cardGlowColor);
    }

    if (lastRedemptionData) {
      displayRedemption(lastRedemptionData, false);
    }
  }

  function applyTheme(theme) {
    const currentClasses = Array.from(cardElement.classList).filter((c) => !c.startsWith('theme-'));
    cardElement.className = currentClasses.join(' ');
    cardElement.classList.add(`theme-${theme || 'purple'}`);
  }

  function displayRedemption(redemption, animatePulse = true) {
    if (!redemption) return;

    lastRedemptionData = redemption;
    currentRedemptionId = redemption.id || `${redemption.userName}_${redemption.redeemedAt}`;
    const displayName = redemption.displayName || redemption.userName || 'Viewer';
    const rewardTitle = redemption.rewardTitle || 'Reward';

    if (currentUser.configMode === 'manual') {
      if (cardElement) cardElement.classList.add('hidden');
      if (customOverlayRoot) {
        const html = currentUser.customHtml || DEFAULT_VHS_STARTER_HTML;
        const bindData = {
          displayName,
          userName: redemption.userName,
          rewardTitle,
          badgeText: currentUser.badgeText,
          isFirst: redemption.isFirst,
          order: redemption.order,
        };
        customOverlayRoot.innerHTML = renderCustomTemplate(html, bindData);
        populateDomHooks(customOverlayRoot, bindData);
        customOverlayRoot.classList.remove('hidden');

        if (animatePulse) {
          customOverlayRoot.classList.remove('pulse');
          void customOverlayRoot.offsetWidth;
          customOverlayRoot.classList.add('pulse');
        }
      }
      return;
    }

    // Preset mode
    if (customOverlayRoot) customOverlayRoot.classList.add('hidden');

    // Safe rendering with textContent
    if (viewerNameEl) viewerNameEl.textContent = displayName;
    if (rewardTitleEl) rewardTitleEl.textContent = rewardTitle;

    // Badge styling for 1st redeemer
    if (redemption.isFirst) {
      cardElement.classList.add('first-redeemer');
    } else {
      cardElement.classList.remove('first-redeemer');
    }

    // Left Block text (Default "1ST", no emojis or brackets)
    if (indicatorLabelEl) {
      let bText = currentUser.badgeText || '1ST';
      bText = bText.replace(/[👑\[\]]/g, '').trim() || '1ST';
      indicatorLabelEl.textContent = bText;
      if (currentUser.badgeColor) {
        indicatorLabelEl.style.color = currentUser.badgeColor;
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
    currentRedemptionId = null;
    lastRedemptionData = null;
    if (cardElement) cardElement.classList.add('hidden');
    if (customOverlayRoot) customOverlayRoot.classList.add('hidden');
  }

  // Initial immediate fetch for instant loading on OBS
  fetchOverlayData();

  // Connect WebSocket for real-time events
  connectWebSocket();

  // Start background fallback sync
  startPollingSync();
})();
