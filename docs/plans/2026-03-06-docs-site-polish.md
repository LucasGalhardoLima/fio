# Docs Site Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Polish the Fio docs site with a redesigned landing page, proper SEO/meta infrastructure, and deployment configuration.

**Architecture:** The landing page (`src/pages/index.astro`) is a standalone Astro page separate from the Starlight docs. It will be fully rewritten using the `frontend-design` skill for production-grade polish — CSS animations, mobile hamburger nav, and Astro's built-in `<Code>` component for syntax highlighting. SEO assets (favicon, OG image, meta tags) go into `public/`. The Astro config gets a `site` property to fix sitemap generation.

**Tech Stack:** Astro 5, Starlight, Tailwind CSS v4, Astro `<Code>` component (Shiki)

---

## Task 1: Add site URL to Astro config

**Files:**
- Modify: `packages/docs/astro.config.mjs:5`

**Step 1: Add site property**

Add `site` to the `defineConfig` call in `packages/docs/astro.config.mjs`:

```javascript
export default defineConfig({
  site: 'https://fiopay-docs.vercel.app',
  integrations: [
    // ... rest unchanged
```

This fixes the `[@astrojs/sitemap] The Sitemap integration requires the 'site' astro.config option. Skipping.` build warning.

**Step 2: Verify build**

Run:
```bash
cd /Users/lucasgalhardo/Documents/Projects/fio
pnpm --filter @fio-pay/docs build 2>&1 | tail -5
```
Expected: Build completes without the sitemap warning.

**Step 3: Commit**

```bash
git add packages/docs/astro.config.mjs
git commit -m "fix(docs): add site URL to astro config for sitemap generation"
```

---

## Task 2: Create favicon

**Files:**
- Create: `packages/docs/public/favicon.svg`
- Modify: `packages/docs/src/pages/index.astro` (add favicon link)
- Modify: `packages/docs/astro.config.mjs` (add favicon to Starlight head)

**Step 1: Create the SVG favicon**

Create `packages/docs/public/favicon.svg` — a simple "F" letter in white on a rounded green (#22c55e) background:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="#22c55e"/>
  <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle"
        font-family="system-ui, sans-serif" font-weight="700" font-size="20" fill="white">F</text>
</svg>
```

**Step 2: Add favicon to Starlight config**

In `packages/docs/astro.config.mjs`, add a favicon entry to the Starlight `head` array:

```javascript
head: [
  {
    tag: 'link',
    attrs: {
      rel: 'icon',
      type: 'image/svg+xml',
      href: '/favicon.svg',
    },
  },
  {
    tag: 'meta',
    attrs: {
      property: 'og:type',
      content: 'website',
    },
  },
],
```

**Step 3: Add favicon to landing page**

In `packages/docs/src/pages/index.astro`, add inside `<head>`:

```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
```

**Step 4: Verify build**

```bash
pnpm --filter @fio-pay/docs build 2>&1 | tail -5
```
Expected: Build succeeds. Favicon file copied to dist.

**Step 5: Commit**

```bash
git add packages/docs/public/favicon.svg packages/docs/astro.config.mjs packages/docs/src/pages/index.astro
git commit -m "feat(docs): add SVG favicon with Fio brand"
```

---

## Task 3: Create OG image and add meta tags

**Files:**
- Create: `packages/docs/public/og-image.png`
- Modify: `packages/docs/src/pages/index.astro` (add OG meta tags)
- Modify: `packages/docs/astro.config.mjs` (add OG meta to Starlight head)

**Step 1: Generate the OG image**

Create a 1200x630 PNG OG image. Use a Node.js script with `sharp` (already in dependencies) to generate it programmatically. Create a temporary script:

```bash
cd /Users/lucasgalhardo/Documents/Projects/fio
node -e "
const sharp = require('sharp');

const svg = \`
<svg width=\"1200\" height=\"630\" xmlns=\"http://www.w3.org/2000/svg\">
  <rect width=\"1200\" height=\"630\" fill=\"#030712\"/>
  <text x=\"600\" y=\"240\" text-anchor=\"middle\" font-family=\"system-ui, sans-serif\" font-weight=\"800\" font-size=\"96\" fill=\"white\">Fio</text>
  <text x=\"600\" y=\"340\" text-anchor=\"middle\" font-family=\"system-ui, sans-serif\" font-weight=\"500\" font-size=\"32\" fill=\"#4ade80\">Cobrança recorrente via PIX pra devs</text>
  <text x=\"600\" y=\"420\" text-anchor=\"middle\" font-family=\"system-ui, sans-serif\" font-weight=\"400\" font-size=\"22\" fill=\"#9ca3af\">SDK TypeScript · Webhooks · Sandbox completo</text>
  <rect x=\"420\" y=\"520\" width=\"360\" height=\"50\" rx=\"8\" fill=\"#22c55e\"/>
  <text x=\"600\" y=\"552\" text-anchor=\"middle\" font-family=\"system-ui, sans-serif\" font-weight=\"600\" font-size=\"18\" fill=\"#030712\">Comece agora</text>
</svg>
\`;

sharp(Buffer.from(svg)).png().toFile('packages/docs/public/og-image.png')
  .then(() => console.log('OG image created'))
  .catch(err => console.error(err));
"
```

Note: If the `require('sharp')` approach doesn't work in the monorepo (ESM), use this alternative:

```bash
cd /Users/lucasgalhardo/Documents/Projects/fio/packages/docs
node --input-type=module -e "
import sharp from 'sharp';
// ... same SVG generation code with import instead of require
"
```

**Step 2: Add OG meta tags to landing page**

In `packages/docs/src/pages/index.astro`, add inside `<head>` after the description meta:

```html
<meta property="og:type" content="website" />
<meta property="og:title" content="Fio — Cobrança recorrente via PIX pra devs" />
<meta property="og:description" content="Integre assinaturas PIX no seu SaaS em minutos. SDK TypeScript, webhooks, sandbox completo." />
<meta property="og:image" content="https://fiopay-docs.vercel.app/og-image.png" />
<meta property="og:url" content="https://fiopay-docs.vercel.app/" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Fio — Cobrança recorrente via PIX pra devs" />
<meta name="twitter:description" content="Integre assinaturas PIX no seu SaaS em minutos." />
<meta name="twitter:image" content="https://fiopay-docs.vercel.app/og-image.png" />
```

**Step 3: Add OG meta to Starlight config**

In `packages/docs/astro.config.mjs`, add to the `head` array:

```javascript
{
  tag: 'meta',
  attrs: {
    property: 'og:image',
    content: 'https://fiopay-docs.vercel.app/og-image.png',
  },
},
```

**Step 4: Verify build**

```bash
pnpm --filter @fio-pay/docs build 2>&1 | tail -5
```
Expected: Build succeeds. og-image.png copied to dist.

**Step 5: Commit**

```bash
git add packages/docs/public/og-image.png packages/docs/src/pages/index.astro packages/docs/astro.config.mjs
git commit -m "feat(docs): add OG image and social meta tags"
```

---

## Task 4: Redesign landing page

> **IMPORTANT:** Use the `frontend-design` skill for this task. The landing page should be distinctive and production-grade, not generic.

**Files:**
- Rewrite: `packages/docs/src/pages/index.astro`
- Rewrite: `packages/docs/src/styles/landing.css`

**Context for the implementer:**

The current landing page at `packages/docs/src/pages/index.astro` works but needs visual polish. It's a standalone Astro page (not managed by Starlight) for the Fio product — a subscription billing API for PIX targeting Brazilian developers.

**Requirements:**

1. **Keep all existing content and sections** (nav, hero, how it works, code example, pricing, footer). Don't change the copy — it's in Portuguese and already approved.

2. **Mobile hamburger nav**: The current nav links overflow on mobile. Add a hamburger menu icon that opens a full-screen or slide-out overlay on small screens. Use a minimal inline `<script>` (toggle a class/data-attribute) or CSS-only `:checked` pattern.

3. **Replace manual `<span>` syntax highlighting**: Use Astro's built-in `<Code>` component for code blocks. Import it from `astro:components`. This gives proper Shiki syntax highlighting without hand-crafted HTML spans.

   ```astro
   ---
   import { Code } from 'astro:components'

   const heroCodeString = `import { Fio } from '@fio-pay/sdk'

   const fio = new Fio({ apiKey: 'fio_test_...' })

   const sub = await fio.subscriptions.create({
     customer_id: 'cus_abc123',
     plan_id: 'plan_xyz789',
   })

   console.log(sub.status) // "trialing"`
   ---
   <Code code={heroCodeString} lang="typescript" theme="github-dark" />
   ```

   The `<Code>` component renders at build time (zero JS shipped). Use `theme="github-dark"` or another dark theme that fits the design.

4. **CSS scroll animations**: Sections should fade-in/slide-up as they enter the viewport. Use CSS `@keyframes` + a small `IntersectionObserver` script. Keep the JS minimal (< 15 lines).

5. **Visual polish:**
   - Sticky nav with `backdrop-blur` effect
   - Animated gradient on hero text (subtle shimmer or color shift)
   - Hover lift effect on feature cards (translateY + shadow)
   - Better spacing between sections (py-24 or py-32 instead of py-20)
   - Smooth scroll for anchor links (`scroll-behavior: smooth`)

6. **Keep existing meta tags**: The `<head>` already has favicon, OG tags, and description from Tasks 2 and 3. Preserve them.

7. **Tailwind classes are available**: The `@tailwindcss/vite` plugin processes all files. Tailwind utility classes work in this standalone page.

8. **CSS goes in `packages/docs/src/styles/landing.css`**: Import it in the frontmatter with `import '../styles/landing.css'`. Don't put CSS in `<style>` tags (esbuild issues with Astro).

9. **Curly braces in template**: Remember that `{` and `}` in the Astro template are parsed as expressions. The `<Code>` component handles this internally so it's not an issue when using it. But if you need literal braces in HTML, use `{'{'}`  or `set:html`.

**Step 1: Rewrite index.astro and landing.css**

Use the `frontend-design` skill to create a polished, distinctive landing page following all requirements above. The result must build successfully with Astro.

**Step 2: Verify build**

```bash
pnpm --filter @fio-pay/docs build 2>&1 | tail -10
```
Expected: Build completes. Landing page renders at `/index.html`.

**Step 3: Verify docs tests still pass**

```bash
pnpm vitest run --reporter=verbose packages/docs/tests 2>&1 | tail -5
```
Expected: All 15 tests pass. (Landing page changes don't affect docs content tests.)

**Step 4: Commit**

```bash
git add packages/docs/src/pages/index.astro packages/docs/src/styles/landing.css
git commit -m "feat(docs): redesign landing page with polish and mobile nav"
```

---

## Task 5: Verify deployment and fix docs issues

**Files:**
- Possibly modify: various MDX files if formatting issues found
- Possibly create: `packages/docs/src/content/docs/docs/404.mdx` (if needed)

**Step 1: Check for the 404 build warning**

Run the build and check for the "Entry docs → 404 was not found" warning:

```bash
pnpm --filter @fio-pay/docs build 2>&1 | grep -i "404"
```

If present, the warning is cosmetic (Starlight expects a 404 page). It can be silenced by creating `packages/docs/src/content/docs/docs/404.mdx`:

```mdx
---
title: Página não encontrada
template: splash
---

A página que você procura não existe.

[Voltar para a documentação](/docs/)
```

**Step 2: Verify all pages build**

```bash
pnpm --filter @fio-pay/docs build 2>&1 | grep "page(s) built"
```
Expected: 11+ pages built (landing + docs index + quickstart + 5 API + 2 guides + webhooks + 404).

**Step 3: Run full test suite**

```bash
pnpm vitest run --reporter=verbose packages/docs/tests 2>&1 | tail -5
pnpm vitest run --reporter=verbose packages/api/tests/unit packages/sdk/tests packages/shared/tests 2>&1 | tail -5
```
Expected: All tests pass. No regressions.

**Step 4: Commit if changes were made**

```bash
git add -A packages/docs/src/content/docs/
git commit -m "fix(docs): add 404 page and fix docs formatting issues"
```

**Step 5: Push all commits**

```bash
git push
```
Expected: All commits pushed to `001-subscription-billing-mvp`.

---

## Task Summary

| Task | Description | Depends On |
|------|-------------|------------|
| 1 | Add site URL to Astro config | — |
| 2 | Create favicon | — |
| 3 | Create OG image and meta tags | — |
| 4 | Redesign landing page (frontend-design skill) | 2, 3 (needs favicon/OG in head) |
| 5 | Verify deployment and fix docs issues | 1, 2, 3, 4 |

Tasks 1, 2, and 3 can run in parallel. Task 4 depends on 2 and 3 (the head tags). Task 5 is the final verification.
