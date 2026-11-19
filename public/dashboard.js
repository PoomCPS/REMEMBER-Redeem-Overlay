(() => {
  // DOM Elements
  const twitchBadge = document.getElementById('twitchBadge');
  const twitchUserInfo = document.getElementById('twitchUserInfo');
  const twitchErrorMsg = document.getElementById('twitchErrorMsg');
  const twitchLoginBtn = document.getElementById('twitchLoginBtn');
  const reconnectTwitchBtn = document.getElementById('reconnectTwitchBtn');
  const disconnectTwitchBtn = document.getElementById('disconnectTwitchBtn');

  const obsBadge = document.getElementById('obsBadge');
  const obsUrlInfo = document.getElementById('obsUrlInfo');
  const obsErrorMsg = document.getElementById('obsErrorMsg');
  const reconnectObsBtn = document.getElementById('reconnectObsBtn');
  const toggleObsConfigBtn = document.getElementById('toggleObsConfigBtn');
  const obsConfigPanel = document.getElementById('obsConfigPanel');
  const obsConfigForm = document.getElementById('obsConfigForm');
  const obsUrlInput = document.getElementById('obsUrlInput');
  const obsPasswordInput = document.getElementById('obsPasswordInput');

  const streamBadge = document.getElementById('streamBadge');
  const streamSessionInfo = document.getElementById('streamSessionInfo');
  const resetOverlayBtn = document.getElementById('resetOverlayBtn');

  const previewCard = document.getElementById('previewCard');
  const previewEmpty = document.getElementById('previewEmptyMessage');
  const previewContent = document.getElementById('previewActiveContent');
  const previewViewer = document.getElementById('previewViewer');
  const previewRewardTitle = document.getElementById('previewRewardTitle');
  const previewTimestamp = document.getElementById('previewTimestamp');

  const testRedeemForm = document.getElementById('testRedeemForm');
  const testViewerInput = document.getElementById('testViewerInput');
  const testRewardInput = document.getElementById('testRewardInput');
  const quickTestThaiBtn = document.getElementById('quickTestThaiBtn');
  const quickTestLongBtn = document.getElementById('quickTestLongBtn');

  const copyOverlayBtn = document.getElementById('copyOverlayBtn');
  const copyOverlayText = document.getElementById('copyOverlayText');
  const instructionsUrl = document.getElementById('instructionsUrl');
  const toastEl = document.getElementById('toast');

  let ws = null;
  let reconnectTimer = null;

  // Initialize Overlay URL display
  const overlayUrl = `${window.location.origin}/overlay.html`;
  if (instructionsUrl) instructionsUrl.textContent = overlayUrl;

  // Check URL query parameters for OAuth redirect notifications
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('auth') === 'success') {
    showToast('Twitch account connected successfully!');
    window.history.replaceState({}, document.title, window.location.pathname);
  } else if (urlParams.get('auth') === 'error') {
    const msg = urlParams.get('message') || 'Unknown OAuth error';
    showToast(`Twitch connection failed: ${msg}`, 6000);
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  // Toast notification helper
  let toastTimeout = null;
  function showToast(message, duration = 3500) {
    if (toastTimeout) clearTimeout(toastTimeout);
    toastEl.textContent = message;
    toastEl.classList.remove('hidden');
    toastTimeout = setTimeout(() => {
      toastEl.classList.add('hidden');
    }, duration);
  }

  // WebSocket Connection
  function connectWebSocket() {
    if (reconnectTimer) clearTimeout(reconnectTimer);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = () => {
      // console.log('[Dashboard] WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        handleServerEvent(payload);
      } catch (err) {
        console.error('[Dashboard] Error parsing WebSocket message:', err);
      }
    };

    ws.onclose = () => {
      reconnectTimer = setTimeout(connectWebSocket, 2000);
    };

    ws.onerror = (err) => {
      console.error('[Dashboard] WebSocket error:', err);
    };
  }

  function handleServerEvent(event) {
    const { type, data } = event;

    switch (type) {
      case 'INIT':
        updateTwitchUI(data?.twitch);
        updateObsUI(data?.obs);
        updateSessionUI(data?.session);
        break;

      case 'TWITCH_STATUS':
        updateTwitchUI(data);
        break;

      case 'OBS_STATUS':
        updateObsUI(data);
        break;

      case 'SESSION_STATE':
        updateSessionUI(data);
        break;

      case 'REDEMPTION':
        renderPreviewRedemption(data);
        break;

      case 'CLEAR':
        clearPreviewRedemption();
        break;

      default:
        break;
    }
  }

  // UI Updaters
  function updateTwitchUI(status) {
    if (!status) return;

    if (status.connected) {
      twitchBadge.className = 'badge badge-online';
      twitchBadge.textContent = 'CONNECTED';
      const username = status.user?.login ? `@${status.user.login}` : 'Authorized';
      twitchUserInfo.textContent = `Connected as ${username}`;
      twitchErrorMsg.classList.add('hidden');
      twitchLoginBtn.classList.add('hidden');
      disconnectTwitchBtn.classList.remove('hidden');
    } else if (status.connecting) {
      twitchBadge.className = 'badge badge-neutral';
      twitchBadge.textContent = 'CONNECTING...';
      twitchUserInfo.textContent = 'Connecting to Twitch EventSub...';
      twitchLoginBtn.classList.add('hidden');
    } else {
      twitchBadge.className = 'badge badge-offline';
      twitchBadge.textContent = 'DISCONNECTED';
      disconnectTwitchBtn.classList.add('hidden');

      if (!status.isConfigured) {
        twitchUserInfo.textContent = 'Missing Twitch Client ID/Secret in .env';
        twitchLoginBtn.classList.add('hidden');
      } else {
        twitchUserInfo.textContent = 'Not connected. Authenticate to subscribe.';
        twitchLoginBtn.classList.remove('hidden');
      }

      if (status.error) {
        twitchErrorMsg.textContent = status.error;
        twitchErrorMsg.classList.remove('hidden');
      } else {
        twitchErrorMsg.classList.add('hidden');
      }
    }
  }

  function updateObsUI(status) {
    if (!status) return;

    obsUrlInfo.textContent = status.url || 'ws://127.0.0.1:4455';
    if (obsUrlInput && !obsConfigPanel.classList.contains('hidden') === false) {
      obsUrlInput.value = status.url || 'ws://127.0.0.1:4455';
    }

    if (status.connected) {
      obsBadge.className = 'badge badge-online';
      obsBadge.textContent = 'CONNECTED';
      obsErrorMsg.classList.add('hidden');
    } else if (status.connecting) {
      obsBadge.className = 'badge badge-neutral';
      obsBadge.textContent = 'CONNECTING...';
    } else {
      obsBadge.className = 'badge badge-offline';
      obsBadge.textContent = 'DISCONNECTED';

      if (status.error) {
        obsErrorMsg.textContent = status.error;
        obsErrorMsg.classList.remove('hidden');
      } else {
        obsErrorMsg.classList.add('hidden');
      }
    }
  }

  function updateSessionUI(session) {
    if (!session) return;

    if (session.isStreaming) {
      streamBadge.className = 'badge badge-live';
      streamBadge.textContent = 'STREAM LIVE';
      const timeStr = session.streamStartedAt ? new Date(session.streamStartedAt).toLocaleTimeString() : '';
      streamSessionInfo.textContent = `Active stream session (Started ${timeStr})`;
    } else {
      streamBadge.className = 'badge badge-neutral';
      streamBadge.textContent = 'OFFLINE';
      streamSessionInfo.textContent = 'No active livestream (OBS not streaming)';
    }

    if (session.latestRedemption) {
      renderPreviewRedemption(session.latestRedemption);
    } else {
      clearPreviewRedemption();
    }
  }

  function renderPreviewRedemption(redemption) {
    if (!redemption) {
      clearPreviewRedemption();
      return;
    }

    previewViewer.textContent = redemption.displayName || redemption.userName || 'Viewer';
    previewRewardTitle.textContent = redemption.rewardTitle || 'Reward';

    const previewBadge = document.getElementById('previewBadge');
    if (previewBadge) {
      if (redemption.isFirst) {
        previewBadge.textContent = '👑 1ST REDEEMER';
        previewBadge.style.color = '#fbbf24';
      } else {
        previewBadge.textContent = 'CHANNEL POINT REDEEM';
        previewBadge.style.color = '';
      }
    }

    const date = redemption.redeemedAt ? new Date(redemption.redeemedAt) : new Date();
    previewTimestamp.textContent = date.toLocaleTimeString();

    previewEmpty.classList.add('hidden');
    previewContent.classList.remove('hidden');
    previewCard.classList.remove('empty');
  }

  function clearPreviewRedemption() {
    previewEmpty.classList.remove('hidden');
    previewContent.classList.add('hidden');
    previewCard.classList.add('empty');
  }

  // Action Event Listeners

  // Copy Overlay URL
  copyOverlayBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(overlayUrl);
      copyOverlayText.textContent = 'Copied!';
      showToast('Overlay URL copied to clipboard!');
      setTimeout(() => {
        copyOverlayText.textContent = 'Copy Overlay URL';
      }, 2000);
    } catch {
      // Fallback
      prompt('Copy this OBS Browser Source URL:', overlayUrl);
    }
  });

  // Reconnect Twitch
  reconnectTwitchBtn.addEventListener('click', async () => {
    try {
      reconnectTwitchBtn.disabled = true;
      showToast('Reconnecting Twitch EventSub...');
      const res = await fetch('/api/twitch/reconnect', { method: 'POST' });
      const data = await res.json();
      if (!data.success) {
        showToast(`Twitch Reconnect: ${data.error || 'Failed'}`);
      }
    } catch (err) {
      showToast(`Error: ${err.message}`);
    } finally {
      reconnectTwitchBtn.disabled = false;
    }
  });

  // Disconnect Twitch
  disconnectTwitchBtn.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to disconnect your Twitch account?')) return;
    try {
      await fetch('/api/twitch/disconnect', { method: 'POST' });
      showToast('Twitch account disconnected.');
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
  });

  // Reconnect OBS
  reconnectObsBtn.addEventListener('click', async () => {
    try {
      reconnectObsBtn.disabled = true;
      showToast('Connecting to OBS WebSocket...');
      const res = await fetch('/api/obs/reconnect', { method: 'POST' });
      const data = await res.json();
      if (!data.success) {
        showToast(`OBS Reconnect: ${data.error || 'Failed'}`);
      }
    } catch (err) {
      showToast(`Error: ${err.message}`);
    } finally {
      reconnectObsBtn.disabled = false;
    }
  });

  // Toggle OBS Settings Panel
  toggleObsConfigBtn.addEventListener('click', () => {
    obsConfigPanel.classList.toggle('hidden');
  });

  // Save OBS Settings
  obsConfigForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = obsUrlInput.value.trim();
    const password = obsPasswordInput.value;

    try {
      showToast('Saving OBS settings & reconnecting...');
      const res = await fetch('/api/obs/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, password }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('OBS configuration updated!');
        obsConfigPanel.classList.add('hidden');
      } else {
        showToast(`Error: ${data.error}`);
      }
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
  });

  // Reset Overlay
  resetOverlayBtn.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/reset-overlay', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('Overlay display cleared (session remains active).');
      }
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
  });

  // Test Redemption Form
  testRedeemForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userName = testViewerInput.value.trim();
    const rewardTitle = testRewardInput.value.trim();

    if (!userName || !rewardTitle) return;

    try {
      const res = await fetch('/api/test-redemption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName, rewardTitle }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Test redemption sent: ${userName} - "${rewardTitle}"`);
      }
    } catch (err) {
      showToast(`Error sending test: ${err.message}`);
    }
  });

  // Quick Preset Buttons
  const quickTestFirst1Btn = document.getElementById('quickTestFirst1Btn');
  const quickTestFirst2Btn = document.getElementById('quickTestFirst2Btn');
  const quickTestFirst3Btn = document.getElementById('quickTestFirst3Btn');

  if (quickTestFirst1Btn) {
    quickTestFirst1Btn.addEventListener('click', () => {
      testViewerInput.value = 'สมชายสายเปย์';
      testRewardInput.value = 'รักแรกมันแยกยาก';
      testRedeemForm.requestSubmit();
    });
  }

  if (quickTestFirst2Btn) {
    quickTestFirst2Btn.addEventListener('click', () => {
      testViewerInput.value = 'น้องแมวน้ำตัวแรก';
      testRewardInput.value = 'คนแรกเลยล่ะ';
      testRedeemForm.requestSubmit();
    });
  }

  if (quickTestFirst3Btn) {
    quickTestFirst3Btn.addEventListener('click', () => {
      testViewerInput.value = 'ท่านลอร์ดคนแรก';
      testRewardInput.value = 'กระผมมาเป็นคนแรกเลยนะ';
      testRedeemForm.requestSubmit();
    });
  }

  // Initial Fetch of Status
  fetch('/api/status')
    .then((res) => res.json())
    .then((data) => {
      updateTwitchUI(data.twitch);
      updateObsUI(data.obs);
      updateSessionUI(data.session);
    })
    .catch((err) => {
      console.warn('[Dashboard] Initial status fetch error:', err);
    });

  // Start WebSocket
  connectWebSocket();
})();

