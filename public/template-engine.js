/**
 * REMEMBER Redeem Overlay - Template Engine & CSS Scoper
 * Lightweight, safe template interpolation and CSS scoping for Manual CodeMirror 6 mode.
 */

export const DEFAULT_VHS_STARTER_HTML = `<!-- 1980s Retro VHS Tape Overlay -->
<div class="custom-vhs-card">
  <!-- Left Rotated Accent Badge -->
  <div class="custom-left-block">
    <span class="custom-badge-text">{{badge}}</span>
  </div>

  <!-- Center Tape Body -->
  <div class="custom-body">
    <div class="custom-meta-row">
      <span class="custom-meta-tag">[ 👑 1ST REDEEM ]</span>
      <span class="custom-meta-tag">[ SP 120 ]</span>
    </div>
    <div class="custom-username-row">
      <span class="custom-username" id="viewerName">{{viewer}}</span>
    </div>
    <div class="custom-reward-row">
      <span class="custom-reward" id="rewardTitle">{{reward}}</span>
    </div>
  </div>

  <!-- Right Stepped Analog Color Stripes -->
  <div class="custom-stripes">
    <span class="stripe s-red"></span>
    <span class="stripe s-orange"></span>
    <span class="stripe s-yellow"></span>
    <span class="stripe s-blue"></span>
    <span class="stripe s-green"></span>
  </div>
</div>`;

export const DEFAULT_VHS_STARTER_CSS = `/* Scoped to custom overlay container */
.custom-vhs-card {
  display: flex;
  align-items: stretch;
  background-color: #121212;
  border: 2px solid #1A1A1A;
  box-shadow: 2px 2px 0px #1A1A1A;
  color: #F4F1EA;
  font-family: 'Kanit', sans-serif;
  height: 80px;
  max-width: 480px;
  position: relative;
  overflow: hidden;
}

.custom-left-block {
  width: 44px;
  background-color: #00A896;
  color: #10111A;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 800;
  font-size: 0.85rem;
  letter-spacing: 0.1em;
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  border-right: 2px solid #1A1A1A;
}

.custom-body {
  flex: 1;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
}

.custom-meta-row {
  display: flex;
  gap: 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.65rem;
  color: #FCBF49;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.custom-username-row {
  font-size: 1.35rem;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #FFFFFF;
}

.custom-reward-row {
  font-size: 0.75rem;
  color: #A09E96;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.custom-stripes {
  width: 14px;
  display: flex;
  flex-direction: column;
}

.custom-stripes .stripe {
  flex: 1;
}

.s-red { background-color: #E63946; }
.s-orange { background-color: #F77F00; }
.s-yellow { background-color: #FCBF49; }
.s-blue { background-color: #0096C7; }
.s-green { background-color: #2A9D8F; }`;

/**
 * Replace placeholders like {{viewer}}, {{reward}}, {{badge}} with redemption data.
 */
export function renderCustomTemplate(html, data = {}) {
  if (!html) return '';

  const viewer = data.displayName || data.userName || 'Viewer';
  const reward = data.rewardTitle || 'Reward';
  let badge = data.badgeText || '1ST';
  badge = badge.replace(/[👑\[\]]/g, '').trim() || '1ST';

  return html
    .replace(/\{\{\s*(?:viewer|displayName|userName|user)\s*\}\}/gi, escapeHtml(viewer))
    .replace(/\{\{\s*(?:reward|rewardTitle)\s*\}\}/gi, escapeHtml(reward))
    .replace(/\{\{\s*(?:badge|badgeText)\s*\}\}/gi, escapeHtml(badge))
    .replace(/\{\{\s*(?:order)\s*\}\}/gi, String(data.order || 1));
}

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Scope CSS rules to a specific container ID or class selector.
 * Safely prepends the rootSelector to each CSS rule block (ignoring @keyframes, @media headers).
 */
export function scopeCss(css, rootSelector = '#customOverlayRoot') {
  if (!css || typeof css !== 'string') return '';
  const clean = css.trim();
  if (!clean) return '';

  // Use simple regex-based scoping for standard rule blocks
  return clean.replace(/(^|(?:\}\s*))([^{@]+)(\{)/g, (match, prefix, selectors, suffix) => {
    // If it's a keyframe step like 0%, 50%, from, to
    if (selectors.trim().match(/^(?:from|to|\d+%)$/)) {
      return match;
    }

    const scopedSelectors = selectors
      .split(',')
      .map(sel => {
        const s = sel.trim();
        if (!s) return '';
        if (s.startsWith(':root') || s.startsWith('html') || s.startsWith('body')) {
          return `${rootSelector}`;
        }
        return `${rootSelector} ${s}`;
      })
      .filter(Boolean)
      .join(', ');

    return `${prefix}${scopedSelectors} ${suffix}`;
  });
}

/**
 * Find semantic elements in container (#viewerName, .viewer-name, etc.) and update their textContent.
 */
export function populateDomHooks(container, data = {}) {
  if (!container) return;

  const viewer = data.displayName || data.userName || 'Viewer';
  const reward = data.rewardTitle || 'Reward';
  let badge = data.badgeText || '1ST';
  badge = badge.replace(/[👑\[\]]/g, '').trim() || '1ST';

  const viewerEls = container.querySelectorAll('#viewerName, .viewer-name, .custom-username');
  viewerEls.forEach(el => { el.textContent = viewer; });

  const rewardEls = container.querySelectorAll('#rewardTitle, .reward-title, .custom-reward');
  rewardEls.forEach(el => { el.textContent = reward; });

  const badgeEls = container.querySelectorAll('#indicatorLabel, .badge-text, .custom-badge-text');
  badgeEls.forEach(el => { el.textContent = badge; });
}
