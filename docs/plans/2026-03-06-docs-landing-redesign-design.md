# Design: Docs & Landing Page Redesign

**Date**: 2026-03-06
**Branch**: `001-subscription-billing-mvp`
**Status**: Approved

## Context

The landing page has responsive misalignment issues at various widths. The docs pages (Starlight) look generic compared to the landing page's polished dark-first design. SuperDesign drafts were created for both:

- Landing: https://p.superdesign.dev/draft/9e36a416-90d5-4bf0-9a6d-c9a256b17845
- Docs index: https://p.superdesign.dev/draft/d69bce4f-0f37-4722-a43c-e4e0082dd57c
- Quickstart: https://p.superdesign.dev/draft/a7803639-ed35-45d9-b6fe-977182911d63
- API reference: https://p.superdesign.dev/draft/c7b05610-497f-4fb0-93b3-48417844936e

## Decision

- **Landing page**: Full rewrite to match design 1:1 (standalone Astro page, full control)
- **Docs pages**: Keep Starlight, heavily customize via CSS overrides in `global.css`

## Landing Page Changes

| Element | Current | New |
|---------|---------|-----|
| Font | system-ui | Satoshi (Fontshare) |
| Hero layout | 2-col grid (text left, code right) | Centered single column (text, then code below) |
| Features | 3-col equal grid | Staggered layout (left/right/center, vertical flex) |
| Thread motif | None | SVG flowing thread down the full page (opacity 0.3) |
| Background | Plain #030712 | Subtle grid pattern (64px green lines at 0.02 opacity) |
| Nav | Sticky, rgba bg | Fixed, #030712/70 backdrop-blur-xl, border-white/5, h-20 |
| Code blocks | Shiki Code component | Terminal-style with traffic-light dots + filename |
| Badge | Static dot | Uppercase tracking, pulse animation on dot |
| Buttons | Current sizes | CTA gets shadow-lg shadow-green-500/20 |
| Pricing card | rounded-xl p-2.5rem | rounded-3xl p-10, "Standard Plan" label |
| Footer | Simple centered | Expanded: social icons, Status link, copyright bar |
| Icons | Inline SVG | Iconify web components (lucide set) |

Preserved: colors, gradient-text animation, shimmer headline, hover lifts.

## Docs CSS Customization

All changes in `global.css` targeting Starlight's CSS variables and selectors.

**Achievable:**
- Satoshi font (match landing)
- Grid pattern background (48px green lines at 0.03 opacity)
- Vertical green thread lines at sidebar/content boundaries (pseudo-elements)
- Code blocks: #0a0f1a surface, border-white/5, rounded-xl, shadow-2xl
- Sidebar: uppercase tracking section labels, green active state with border-right + gradient bg
- Nav: border-green-500/10 bottom border
- Content typography: Satoshi, tighter tracking on headings, gray-400 body
- Hidden scrollbar

**Compromised (Starlight limitations):**
- 12-col grid layout: use Starlight's own sidebar/content split
- Custom nav with inline search: restyle Starlight's built-in search
- Sidebar icons per item: not supported, use color/weight instead
- View transitions: skip to avoid Starlight conflicts
- "Duvidas?" card in sidebar: skip
- Step progress line / API timeline dots: achievable via MDX custom CSS

## Files Changed

| File | Action |
|------|--------|
| `packages/docs/src/pages/index.astro` | Rewrite |
| `packages/docs/src/styles/landing.css` | Rewrite |
| `packages/docs/src/styles/global.css` | Expand with Starlight overrides |

## What's NOT Changing

- No MDX content changes
- No Starlight config changes (sidebar, head, social)
- No new Astro components
- No JS changes beyond landing page scripts
