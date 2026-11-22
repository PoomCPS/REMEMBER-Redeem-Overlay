# DESIGN SYSTEM: 1980s Analog Media / VHS Packaging Aesthetic

## 1. Core Philosophy & Layout (Swiss Grid)
- **Strict Modular Grid:** Structure the entire UI using visible 1px or 2px solid black (`#111111`) borders. Treat every section, card, and navigation item like a physical cassette sleeve label.
- **Zero Softness:** `border-radius: 0px` globally. No drop shadows, no glassmorphism, no blur effects, no gradients (except hard-edged, stepped retro color bands).
- **High-Density Information:** Embrace utilitarian metadata. Display technical specs, timestamps, version numbers, and category codes (`TYPE-II`, `CH-01`, `60 MIN`) in small uppercase labels alongside main content.

## 2. Color Palette (Print & Magnetic Tape)
- **Primary Canvas (Paper/Cardstock):** Warm Off-White / Cream (`#F4F1EA`) and Pure Matte Black (`#121212`).
- **Ink & Borders:** Deep Charcoal (`#1A1A1A`).
- **Retro Accent Stripes (Use in hard-edged multi-stripe bands):**
  - Signal Red: `#E63946`
  - Analog Orange: `#F77F00`
  - Tape Yellow: `#FCBF49`
  - Cyan / Ferric Blue: `#0096C7`
  - VHS Green: `#2A9D8F`
- **Color Rule:** Never blend colors smoothly. Place accent colors side-by-side in thick horizontal, vertical, or 45-degree diagonal stripes.

## 3. Typography
- **Primary Headings:** Heavy, tight-tracking Neo-Grotesque Sans-Serif (`Helvetica Neue`, `Inter`, `Archivo Black`, or `Space Grotesk`). Use massive, bold display sizes for primary titles (e.g., `T-120` style hero text).
- **Technical Specs & Metadata:** Monospace font (`JetBrains Mono`, `Space Mono`, or `IBM Plex Mono`), uppercase, with wide letter-spacing (`tracking-widest`).
- **Hierarchy:** Contrast oversized bold titles directly against tiny, dense technical print specs.

## 4. Signature Visual Motifs (CSS/SVG Elements)
- **Multi-Stripe Bands:** Decorate headers, footers, or card dividers with 3 to 5 parallel color bars (e.g., Red -> Orange -> Yellow -> Green).
- **Geometric Dot Grids / Halftones:** Use CSS radial-gradients or crisp SVG arrays of solid circles/squares as decorative data blocks.
- **Thumb-Notch Cutouts:** Occasionally add a semi-circular or angled notch on the right edge of cards (mimicking the finger cutout on a VHS slipcase).
- **Micro-Badges:** Frame short tags inside tight rectangular boxes with 1px borders (e.g., `[ STEREO ]`, `[ HI-FI ]`, `[ BETA ]`).

## 5. Interactive States (Tactile & Mechanical)
- **Hover Effects:** Instant, snappy transitions (`duration-75` or `0ms`). Invert background and text colors (e.g., `#F4F1EA` background becomes `#121212` with `#F4F1EA` text) or shift a stripe band.
- **Buttons:** Rectangular, flat, solid borders, uppercase bold text, feeling like physical mechanical deck keys (`PLAY`, `REC`, `EJECT`).