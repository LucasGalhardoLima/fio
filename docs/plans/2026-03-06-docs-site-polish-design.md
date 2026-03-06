# Fio Docs Site Polish — Design

## Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Landing page approach | Redesign with frontend-design skill | Production-grade polish, animations, better UX |
| Code highlighting | Astro built-in Shiki | Replace manual `<span>` classes with proper syntax highlighting |
| Mobile nav | Hamburger menu with slide-out | Standard pattern, works with standalone page |
| Favicon | Simple "F" glyph in Fio green | Minimal, recognizable, matches brand |
| OG image | Static 1200x630 PNG | Social sharing preview for Twitter/LinkedIn |
| Site URL | fiopay-docs.vercel.app | Current Vercel URL, custom domain later |
| Docs content | Minor fixes only | Content is sufficient for MVP |
| Deployment | Add vercel.json | Proper monorepo config for packages/docs |

---

## Work Stream 1: Landing Page Redesign

### Current Issues

- No mobile navigation (links overflow on small screens)
- Manual syntax highlighting with `<span>` classes (fragile, verbose)
- No scroll animations or visual polish
- Basic spacing/typography — functional but not distinctive
- Code snippets use Unicode escapes for Portuguese characters

### Design Direction

Dark-first, developer-focused design inspired by Vercel/Linear aesthetic:

- **Hero**: Animated gradient text, subtle glow effect on headline
- **Code blocks**: Use Astro's `<Code>` component with Shiki for real syntax highlighting
- **Scroll animations**: Fade-in/slide-up on section entry (CSS-only, no JS library)
- **Mobile nav**: Hamburger icon that reveals a full-screen overlay menu
- **Typography**: Better vertical rhythm, larger section spacing
- **Hover effects**: Subtle scale/glow on cards and buttons
- **Smooth scrolling**: CSS `scroll-behavior: smooth` for anchor links

### Sections (same 5, redesigned)

1. **Nav**: Sticky, backdrop-blur, hamburger on mobile
2. **Hero**: Two-column (text + code), animated gradient, prominent CTAs
3. **How it works**: Three cards with icons, hover lift effect
4. **Code example**: Full code block with Shiki highlighting, line numbers optional
5. **Pricing**: Single card, gradient accent, checkmark list
6. **Footer CTA + links**: Final conversion push

### Technical Approach

- Keep as standalone Astro page (`src/pages/index.astro`)
- Use `<Code>` component from `astro:components` for syntax highlighting
- CSS animations via `@keyframes` + `IntersectionObserver` (minimal JS)
- Mobile menu state via CSS `:checked` hack or tiny inline script
- All custom styles in `src/styles/landing.css`

---

## Work Stream 2: SEO & Meta

### Favicon

- Generate a simple favicon: letter "F" in white on Fio green (#22c55e) background
- Provide as SVG (scalable) + PNG fallback (32x32, 180x180 for Apple touch)
- Place in `public/` directory

### OpenGraph Tags

```html
<meta property="og:type" content="website" />
<meta property="og:title" content="Fio — Cobrança recorrente via PIX pra devs" />
<meta property="og:description" content="Integre assinaturas PIX no seu SaaS em minutos. SDK TypeScript, webhooks, sandbox completo." />
<meta property="og:image" content="https://fiopay-docs.vercel.app/og-image.png" />
<meta property="og:url" content="https://fiopay-docs.vercel.app/" />
<meta name="twitter:card" content="summary_large_image" />
```

### OG Image

- Static 1200x630 PNG with:
  - Dark background (#030712)
  - "Fio" logo text in white
  - Tagline "Cobrança recorrente via PIX pra devs" in gradient green
  - Subtle code snippet preview
- Generated as a static asset (no dynamic generation needed)

### Site Configuration

- Add `site: 'https://fiopay-docs.vercel.app'` to `astro.config.mjs`
- This fixes the sitemap warning and enables proper canonical URLs

---

## Work Stream 3: Deployment Config

### vercel.json

```json
{
  "buildCommand": "pnpm --filter @fio-pay/docs build",
  "outputDirectory": "packages/docs/dist",
  "installCommand": "pnpm install"
}
```

Note: If Vercel is already configured via the dashboard with root directory
set to `packages/docs`, a `vercel.json` may not be needed. Only add if
there are routing issues.

### Build Warning Fix

The "Entry docs → 404 was not found" warning comes from Starlight expecting
a `404.mdx` page. Create `src/content/docs/docs/404.mdx` or configure
Starlight to suppress it.

---

## Work Stream 4: Docs Polish

- Verify all sidebar links resolve correctly on Vercel
- Check that search (Pagefind) works on deployed site
- Fix any formatting issues in MDX content
- Ensure code examples render with proper highlighting
- Test dark/light mode toggle

---

## Out of Scope

- Custom domain setup (deferred)
- Analytics integration
- Full API reference documentation rewrite
- Blog/changelog section
- i18n/English version
