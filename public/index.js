(() => {
  // Elements
  const guestView = document.getElementById('guestView');
  const dashboardView = document.getElementById('dashboardView');
  const toastEl = document.getElementById('toast');

  // User meta
  const userAvatar = document.getElementById('userAvatar');
  const userDisplayName = document.getElementById('userDisplayName');
  const userLogin = document.getElementById('userLogin');
  const logoutBtn = document.getElementById('logoutBtn');

  // Overlay URL
  const overlayUrlInput = document.getElementById('overlayUrlInput');
  const copyUrlBtn = document.getElementById('copyUrlBtn');
  const copyUrlText = document.getElementById('copyUrlText');
  const openOverlayLink = document.getElementById('openOverlayLink');
  const regenerateTokenBtn = document.getElementById('regenerateTokenBtn');

  // Settings
  const settingsForm = document.getElementById('settingsForm');
  const badgeTextInput = document.getElementById('badgeTextInput');
  const badgeColorPicker = document.getElementById('badgeColorPicker');
  const cardThemeSelect = document.getElementById('cardThemeSelect');
  const soundToggle = document.getElementById('soundToggle');
  const whitelistTagsContainer = document.getElementById('whitelistTagsContainer');
  const newTagInput = document.getElementById('newTagInput');
  const addTagBtn = document.getElementById('addTagBtn');

  // Preview elements
  const previewCard = document.getElementById('previewCard');
  const previewLiveIndicator = document.getElementById('previewLiveIndicator');
  const previewIndicatorLabel = document.getElementById('previewIndicatorLabel');
  const previewViewer = document.getElementById('previewViewer');
  const previewRewardTitle = document.getElementById('previewRewardTitle');
  const resetOverlayBtn = document.getElementById('resetOverlayBtn');
  const sendTestRedeemBtn = document.getElementById('sendTestRedeemBtn');

  let currentUser = null;
  let currentWhitelist = [];
  let toastTimer = null;

  function showToast(message, duration = 3000) {
    if (toastTimer) clearTimeout(toastTimer);
    toastEl.textContent = message;
    toastEl.classList.remove('hidden');
    toastTimer = setTimeout(() => {
      toastEl.classList.add('hidden');
    }, duration);
  }

  // Initial load
  async function checkAuth() {
    try {
      const res = await fetch('/api/me');
      if (res.ok) {
        const data = await res.json();
        currentUser = data.user;
        currentWhitelist = data.user.whitelistWords || [];
        renderDashboard();
      } else {
        renderGuest();
      }
    } catch {
      renderGuest();
    }
  }

  function renderGuest() {
    guestView.classList.remove('hidden');
    dashboardView.classList.add('hidden');
  }

  function renderDashboard() {
    guestView.classList.add('hidden');
    dashboardView.classList.remove('hidden');

    userAvatar.src = currentUser.profileImageUrl || 'https://static-cdn.jtvnw.net/user-default-pictures-uv/75305d54-c7cc-40d1-bbbb-6a3f15440b54-profile_image-70x70.png';
    userDisplayName.textContent = currentUser.displayName;
    userLogin.textContent = `@${currentUser.login}`;

    updateOverlayUrl(currentUser.overlayToken);

    badgeTextInput.value = currentUser.badgeText || '👑 1ST REDEEMER';
    badgeColorPicker.value = currentUser.badgeColor || '#fbbf24';
    cardThemeSelect.value = currentUser.cardTheme || 'purple';
    soundToggle.checked = Boolean(currentUser.soundEnabled);

    renderTags();
    updateLivePreview();
  }

  function updateOverlayUrl(token) {
    const url = `${window.location.origin}/overlay.html?token=${token}`;
    overlayUrlInput.value = url;
    openOverlayLink.href = url;
  }

  function renderTags() {
    whitelistTagsContainer.innerHTML = '';
    if (currentWhitelist.length === 0) {
      whitelistTagsContainer.innerHTML = '<span style="color: var(--text-subtle); font-size: 0.85rem;">ยังไม่มีรายการแต้ม (อนุญาตให้แสดงทุกแต้ม)</span>';
      return;
    }

    currentWhitelist.forEach((word, index) => {
      const tag = document.createElement('div');
      tag.className = 'tag-item';

      const text = document.createElement('span');
      text.textContent = word;

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'tag-remove-btn';
      removeBtn.innerHTML = '&times;';
      removeBtn.addEventListener('click', () => {
        currentWhitelist.splice(index, 1);
        renderTags();
        updateLivePreview();
      });

      tag.appendChild(text);
      tag.appendChild(removeBtn);
      whitelistTagsContainer.appendChild(tag);
    });
  }

  function addTag() {
    const word = newTagInput.value.trim();
    if (!word) return;
    if (!currentWhitelist.includes(word)) {
      currentWhitelist.push(word);
      renderTags();
      updateLivePreview();
    }
    newTagInput.value = '';
  }

  addTagBtn.addEventListener('click', addTag);
  newTagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  });

  // Color chips
  document.querySelectorAll('.color-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const color = chip.getAttribute('data-color');
      badgeColorPicker.value = color;
      updateLivePreview();
    });
  });

  // Real-time preview updates
  badgeTextInput.addEventListener('input', updateLivePreview);
  badgeColorPicker.addEventListener('input', updateLivePreview);
  cardThemeSelect.addEventListener('change', updateLivePreview);

  function updateLivePreview() {
    const badgeText = badgeTextInput.value.trim() || '👑 1ST REDEEMER';
    const badgeColor = badgeColorPicker.value || '#fbbf24';
    const theme = cardThemeSelect.value || 'purple';

    previewIndicatorLabel.textContent = badgeText;
    previewIndicatorLabel.style.color = badgeColor;
    previewLiveIndicator.style.borderColor = badgeColor;

    previewCard.className = `redeem-card theme-${theme}`;

    if (currentWhitelist.length > 0) {
      previewRewardTitle.textContent = currentWhitelist[0];
    } else {
      previewRewardTitle.textContent = 'รักแรกมันแยกยาก';
    }
  }

  // Copy Overlay URL
  copyUrlBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(overlayUrlInput.value);
      copyUrlText.textContent = 'Copied!';
      showToast('คัดลอก Overlay URL เรียบร้อยแล้ว!');
      setTimeout(() => {
        copyUrlText.textContent = 'Copy URL';
      }, 2000);
    } catch {
      prompt('Copy your OBS Overlay URL:', overlayUrlInput.value);
    }
  });

  // Regenerate Token
  regenerateTokenBtn.addEventListener('click', async () => {
    if (!confirm('ยืนยันสร้าง Overlay Token ใหม่? (คุณจะต้องนำลิงก์ใหม่ไปเปลี่ยนใน OBS Studio ด้วย)')) return;

    try {
      const res = await fetch('/api/regenerate-token', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        currentUser.overlayToken = data.overlayToken;
        updateOverlayUrl(data.overlayToken);
        showToast('สร้าง Token ใหม่สำเร็จ! อย่าลืมอัปเดตใน OBS');
      }
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
  });

  // Save Settings
  settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const payload = {
      badgeText: badgeTextInput.value.trim(),
      badgeColor: badgeColorPicker.value,
      cardTheme: cardThemeSelect.value,
      soundEnabled: soundToggle.checked,
      whitelistWords: currentWhitelist,
    };

    try {
      showToast('กำลังบันทึกการตั้งค่า...');
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        showToast('บันทึกการตั้งค่าสำเร็จ! หน้าจอ OBS จะอัปเดตทันที');
      } else {
        showToast(`บันทึกไม่สำเร็จ: ${data.error}`);
      }
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
  });

  // Test Redemption
  sendTestRedeemBtn.addEventListener('click', async () => {
    try {
      showToast('กำลังส่งทดสอบแต้ม...');
      const sampleReward = currentWhitelist.length > 0 ? currentWhitelist[0] : 'รักแรกมันแยกยาก';
      const res = await fetch('/api/test-redemption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userName: 'สมชายสายเปย์',
          displayName: 'สมชายสายเปย์',
          rewardTitle: sampleReward,
        }),
      });

      const data = await res.json();
      if (data.success) {
        previewViewer.textContent = data.redemption.displayName;
        previewRewardTitle.textContent = data.redemption.rewardTitle;
        showToast(`ส่งทดสอบสำเร็จ: ${data.redemption.displayName} (${data.redemption.rewardTitle})`);
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
        previewViewer.textContent = 'ViewerName';
        previewRewardTitle.textContent = currentWhitelist[0] || 'Reward Title';
        showToast('ล้างหน้าจอ Overlay สำเร็จ');
      }
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
  });

  // Logout
  logoutBtn.addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.reload();
  });

  // Start
  checkAuth();
})();

