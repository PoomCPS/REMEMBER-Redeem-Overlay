# Repository Agent Guidelines

## Agent skills

### Issue tracker

GitHub issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical triage label vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context (`GLOSSARY.md` + `docs/adr/`). See `docs/agents/domain.md`.

## Design system guidelines

All frontend UI code (HTML, CSS, JS, SVG, and templates) in this repository must strictly adhere to the 1980s Analog Media / VHS Packaging design system.

See:
- Detailed Design System Specification: `.agent/design.md`
- AI Operational Rules: `.agent/rules/design-system.md`
- Core CSS Variables: `design/theme.css`
- Design Tokens: `design/tokens.json`

### Core AI Design Rules:
1. **Zero Softness:** `border-radius: 0px` globally on all elements (buttons, inputs, cards, pills, badges, modals).
2. **No Soft Shadows or Blurs:** `box-shadow: none`, `backdrop-filter: none`. Use solid crisp borders (`1px solid #1A1A1A` or `2px solid #1A1A1A`) and optional solid hard drop shadows (`2px 2px 0px #1A1A1A`).
3. **Print & Magnetic Tape Palette:** Canvas is warm paper (`#F4F1EA`), sleeve gray (`#E2DFD7`), or tape black (`#121212`). Accents (`#E63946`, `#F77F00`, `#FCBF49`, `#0096C7`, `#2A9D8F`) must only appear as stepped, hard-edged multi-stripe color bars or micro-badges. Never blend colors or use smooth gradients.
4. **Mechanical Interactions:** Transitions are instant (`0ms` or `75ms steps(1)`). Button hover states invert ink/canvas colors.
5. **Swiss Grid & Utilitarian Metadata:** Monospace uppercase tags (`[ STEREO ]`, `[ TYPE-II ]`, `[ 60 MIN ]`, `[ 👑 1ST REDEEM ]`) paired with high-density information grids.


