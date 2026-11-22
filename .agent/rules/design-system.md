# AI Design System Rule: 1980s Analog Media & VHS Packaging Aesthetic

This rule is mandatory for all agents and code changes touching frontend UI, templates, styles, and graphics across this repository.

Related reference files:
- Specification: `.agent/design.md`
- CSS Custom Properties: `design/theme.css`
- Design Tokens: `design/tokens.json`

---

## 1. Absolute Constraints (Zero Tolerance Violations)

1. **Zero Softness (`border-radius: 0px` globally)**
   - NEVER use rounded corners on any element (`border-radius` must strictly be `0px` or `var(--radius-none)`).
   - This applies to cards, buttons, inputs, pills, dropdowns, tooltips, modals, avatars, badges, and alerts.

2. **No Soft Lighting or Blur Effects**
   - NEVER use `box-shadow` with soft blur radii (`box-shadow: none` is required).
   - Hard drop shadows (e.g. `2px 2px 0px #1A1A1A`) are permitted ONLY if crisp and solid without blur.
   - NEVER use `backdrop-filter: blur(...)`, glassmorphism, or translucent fog backgrounds.

3. **No Smooth Gradient Blends**
   - NEVER use smooth linear or radial gradients between colors.
   - Backgrounds are solid paper/cardstock (`#F4F1EA`), sleeve gray (`#E2DFD7`), or tape black (`#121212`).
   - Accent colors must be displayed strictly as hard-edged, stepped color stripes placed directly side-by-side.

4. **Instant Mechanical Transitions**
   - NEVER use slow, smooth cubic-bezier transitions (`0.3s ease`, `0.5s all`).
   - Motion must feel mechanical and tactile: `transition-duration: 0ms` or `75ms steps(1)`.
   - Hover states should trigger instant color inversions (e.g. paper canvas flips to black ink, black flips to paper).

---

## 2. Grid & Layout (Swiss Graphic Grid)

- **Grid Borders:** All layout divisions, cards, sidebars, and panels must be defined with visible 1px or 2px solid dark charcoal borders (`#1A1A1A` or `var(--border-grid)` / `var(--border-heavy)`).
- **Cassette Sleeve Anatomy:** Design every card or container as if it were a physical VHS slipcase, magnetic tape cassette, or audio equipment front panel.
- **Utilitarian Metadata:** Frame content with technical readouts, channel codes, and tape metadata:
  - Examples: `[ TYPE-II / CHROME ]`, `[ HIGH BIAS 70µs ]`, `[ CH-01 ]`, `[ T-120 ]`, `[ STEREO / HI-FI ]`.
  - Micro-badges must be framed in tight 1px rectangular borders with monospace uppercase text.

---

## 3. Color Palette & Tape Stripes

```css
/* Core Canvas & Ink */
--bg-paper: #F4F1EA;       /* Warm Off-White / Cardstock */
--bg-black: #121212;       /* Matte Magnetic Tape Black */
--bg-gray:  #E2DFD7;       /* Cassette Sleeve Inner Gray */
--text-primary: #1A1A1A;   /* Deep Charcoal Ink */
--text-muted:   #5C5A54;   /* Printed Label Muted Ink */
--text-inverse: #F4F1EA;   /* High Contrast White Ink */

/* Stepped Multi-Stripe Accents */
--stripe-red:    #E63946;  /* Signal Red */
--stripe-orange: #F77F00;  /* Analog Orange */
--stripe-yellow: #FCBF49;  /* Tape Yellow */
--stripe-blue:   #0096C7;  /* Ferric Blue */
--stripe-green:  #2A9D8F;  /* VHS Green */
```

- **Multi-Stripe Bands:** Decorative header/divider elements must feature 3 to 5 parallel color bars placed edge-to-edge without gaps or blurs.
- **Maximum Accents per Card:** At most 4 accent colors per card/widget (per `design/tokens.json`).

---

## 4. Typography Hierarchy

- **Display / Hero Titles:** Heavy, tight-tracking Neo-Grotesque Sans-Serif (`'Archivo Black'`, `'Helvetica Neue'`, `'Space Grotesk'`).
- **Body & Controls:** Crisp Sans-Serif (`'Inter'`, sans-serif).
- **Technical Specs & Micro-Badges:** Monospace (`'JetBrains Mono'`, `'Space Mono'`, monospace) in uppercase with wide letter-spacing (`letter-spacing: 0.1em`).
- Always contrast massive bold headlines directly against tiny, compact technical metadata.

---

## 5. OBS Overlay Widget Specifications

- The OBS stream overlay represents an authentic **1980s magnetic cassette spine sticker / tape label**.
- Must maintain a compact single-row pill/label structure:
  - Monospace or bold label frame with solid 1px/2px borders.
  - Micro-badge: `[ 👑 1ST REDEEM ]` or `[ 👑 FIRST ]`.
  - Streamer info: `@ViewerName #RewardTitle`.
  - Hard stepped color accent stripe anchor.
- **Preserve Resilience:** Never remove the WebSocket keepalive (15s PING), watchdog reconnect (35s), initial HTTP fetch, or background fallback sync (6s) from `public/overlay.js`.
