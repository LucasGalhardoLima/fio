# Fio Landing + Docs Site Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the incomplete Fumadocs/Next.js docs package with an Astro + Starlight site that serves a custom landing page at `/` and documentation at `/docs/*`.

**Architecture:** Single Astro app in `packages/docs/`. Starlight integration handles docs routing, search, dark mode, and sidebar. Custom `.astro` pages handle the landing page. Tailwind CSS v4 for landing page styling. Existing MDX content migrated with Starlight frontmatter.

**Tech Stack:** Astro 5, @astrojs/starlight, Tailwind CSS v4, @tailwindcss/vite, @astrojs/starlight-tailwind

---

### Task 1: Replace package.json and install dependencies

**Files:**
- Modify: `packages/docs/package.json`

**Step 1: Rewrite package.json**

Replace the entire contents of `packages/docs/package.json` with:

```json
{
  "name": "@fio-pay/docs",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview"
  },
  "dependencies": {
    "astro": "^5.18.0",
    "@astrojs/starlight": "^0.37.6",
    "@astrojs/starlight-tailwind": "^4.0.2",
    "sharp": "^0.33.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.2.1",
    "tailwindcss": "^4.2.1",
    "typescript": "^5.7.0"
  }
}
```

**Step 2: Delete old config files no longer needed**

```bash
rm -f packages/docs/tsconfig.json
```

**Step 3: Install dependencies**

```bash
cd packages/docs && pnpm install
```

Expected: dependencies install without errors.

**Step 4: Commit**

```bash
git add packages/docs/package.json pnpm-lock.yaml
git rm --cached packages/docs/tsconfig.json 2>/dev/null || true
git commit -m "chore(docs): replace fumadocs with astro + starlight dependencies"
```

---

### Task 2: Create Astro config and content collection

**Files:**
- Create: `packages/docs/astro.config.mjs`
- Create: `packages/docs/src/content.config.ts`
- Create: `packages/docs/tsconfig.json`

**Step 1: Create astro.config.mjs**

```javascript
import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  integrations: [
    starlight({
      title: 'Fio',
      defaultLocale: 'root',
      locales: {
        root: { label: 'Português', lang: 'pt-BR' },
      },
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/LucasGalhardoLima/fio',
        },
      ],
      sidebar: [
        {
          label: 'Início',
          items: [{ slug: 'docs/quickstart' }],
        },
        {
          label: 'Guias',
          items: [
            { slug: 'docs/guides/subscription-billing' },
            { slug: 'docs/webhooks' },
          ],
        },
        {
          label: 'Referência da API',
          collapsed: false,
          autogenerate: { directory: 'docs/api' },
        },
      ],
      customCss: ['./src/styles/global.css'],
      head: [
        {
          tag: 'meta',
          attrs: {
            property: 'og:type',
            content: 'website',
          },
        },
      ],
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
})
```

**Step 2: Create content collection config**

Create `packages/docs/src/content.config.ts`:

```typescript
import { defineCollection } from 'astro:content'
import { docsLoader } from '@astrojs/starlight/loaders'
import { docsSchema } from '@astrojs/starlight/schema'

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
}
```

**Step 3: Create tsconfig.json for Astro**

Create `packages/docs/tsconfig.json`:

```json
{
  "extends": "astro/tsconfigs/strict"
}
```

**Step 4: Commit**

```bash
git add packages/docs/astro.config.mjs packages/docs/src/content.config.ts packages/docs/tsconfig.json
git commit -m "feat(docs): add astro + starlight configuration"
```

---

### Task 3: Migrate MDX content to Starlight structure

**Files:**
- Move: `packages/docs/content/*.mdx` → `packages/docs/src/content/docs/docs/*.mdx`
- Modify: all MDX files (add Starlight frontmatter)

MDX files must be nested under `src/content/docs/docs/` so Starlight routes them at `/docs/*`. The double `docs/` is intentional — the first is Starlight's content root, the second becomes the URL prefix.

**Step 1: Create directory structure and move files**

```bash
mkdir -p packages/docs/src/content/docs/docs/api
mkdir -p packages/docs/src/content/docs/docs/guides

# Move content
mv packages/docs/content/quickstart.mdx packages/docs/src/content/docs/docs/quickstart.mdx
mv packages/docs/content/webhooks.mdx packages/docs/src/content/docs/docs/webhooks.mdx
mv packages/docs/content/guides/subscription-billing.mdx packages/docs/src/content/docs/docs/guides/subscription-billing.mdx
mv packages/docs/content/api/customers.mdx packages/docs/src/content/docs/docs/api/customers.mdx
mv packages/docs/content/api/charges.mdx packages/docs/src/content/docs/docs/api/charges.mdx
mv packages/docs/content/api/plans.mdx packages/docs/src/content/docs/docs/api/plans.mdx
mv packages/docs/content/api/subscriptions.mdx packages/docs/src/content/docs/docs/api/subscriptions.mdx
mv packages/docs/content/api/invoices.mdx packages/docs/src/content/docs/docs/api/invoices.mdx

# Remove empty old directories
rm -rf packages/docs/content
```

**Step 2: Update MDX frontmatter for Starlight**

Each MDX file needs Starlight-compatible frontmatter. The existing `title` and `description` fields are already correct. Just verify each file has at minimum:

```yaml
---
title: <existing title>
description: <existing description>
---
```

For the API reference files, add sidebar ordering so they appear in a logical order. Edit each API file's frontmatter:

`docs/api/customers.mdx` — add `sidebar: { order: 1 }`
`docs/api/plans.mdx` — add `sidebar: { order: 2 }`
`docs/api/subscriptions.mdx` — add `sidebar: { order: 3 }`
`docs/api/charges.mdx` — add `sidebar: { order: 4 }`
`docs/api/invoices.mdx` — add `sidebar: { order: 5 }`

Example edit for `customers.mdx`:

```yaml
---
title: Clientes
description: Crie e gerencie clientes com CPF/CNPJ
sidebar:
  order: 1
---
```

**Step 3: Create docs index page**

Create `packages/docs/src/content/docs/docs/index.mdx`:

```mdx
---
title: Documentação
description: Tudo que você precisa pra integrar o Fio no seu SaaS
template: splash
hero:
  title: Documentação Fio
  tagline: SDK TypeScript, webhooks, sandbox completo. Integre cobrança recorrente via PIX em minutos.
  actions:
    - text: Quickstart
      link: /docs/quickstart/
      icon: right-arrow
      variant: primary
    - text: Referência da API
      link: /docs/api/customers/
      icon: external
      variant: minimal
---
```

**Step 4: Commit**

```bash
git add packages/docs/src/content/docs/
git rm -r --cached packages/docs/content/ 2>/dev/null || true
git commit -m "feat(docs): migrate MDX content to starlight structure"
```

---

### Task 4: Create global CSS with Tailwind + Starlight theming

**Files:**
- Create: `packages/docs/src/styles/global.css`

**Step 1: Create the CSS file**

Create `packages/docs/src/styles/global.css`:

```css
@layer base, starlight, theme, components, utilities;
@import '@astrojs/starlight-tailwind';
@import 'tailwindcss/theme.css' layer(theme);
@import 'tailwindcss/utilities.css' layer(utilities);

/* Fio brand colors — vibrant green accent on dark backgrounds */
:root {
  --sl-color-accent-low: #052e16;
  --sl-color-accent: #22c55e;
  --sl-color-accent-high: #bbf7d0;
  --sl-color-text-accent: #4ade80;

  --sl-font: system-ui, -apple-system, 'Segoe UI', sans-serif;
  --sl-font-system-mono: 'JetBrains Mono', ui-monospace, 'Cascadia Code', monospace;
}

:root[data-theme='dark'] {
  --sl-color-accent-low: #052e16;
  --sl-color-accent: #22c55e;
  --sl-color-accent-high: #dcfce7;
  --sl-color-text-accent: #86efac;
}
```

**Step 2: Commit**

```bash
git add packages/docs/src/styles/global.css
git commit -m "feat(docs): add global CSS with fio brand colors"
```

---

### Task 5: Create the landing page

**Files:**
- Create: `packages/docs/src/pages/index.astro`

**Step 1: Create the landing page**

Create `packages/docs/src/pages/index.astro`:

```astro
---
// Custom landing page — not managed by Starlight
---
<html lang="pt-BR" class="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Fio — Cobrança recorrente via PIX pra devs</title>
  <meta name="description" content="Integre assinaturas PIX no seu SaaS em minutos. SDK TypeScript, webhooks, sandbox completo." />
  <style>
    @import 'tailwindcss';

    /* ---- Base resets ---- */
    * { margin: 0; padding: 0; box-sizing: border-box; }

    /* ---- Custom utilities ---- */
    .gradient-text {
      background: linear-gradient(135deg, #22c55e 0%, #4ade80 50%, #86efac 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .code-block {
      background: #0a0a0a;
      border: 1px solid #1f2937;
      border-radius: 0.75rem;
      padding: 1.5rem;
      font-family: 'JetBrains Mono', ui-monospace, monospace;
      font-size: 0.875rem;
      line-height: 1.7;
      overflow-x: auto;
    }
    .code-block .kw { color: #c084fc; }
    .code-block .fn { color: #60a5fa; }
    .code-block .str { color: #4ade80; }
    .code-block .cm { color: #6b7280; }
    .code-block .num { color: #fb923c; }
  </style>
</head>
<body class="bg-[#030712] text-gray-100 antialiased">

  <!-- Nav -->
  <nav class="max-w-6xl mx-auto flex items-center justify-between px-6 py-5">
    <a href="/" class="text-xl font-bold text-white">Fio</a>
    <div class="flex items-center gap-6 text-sm">
      <a href="/docs/" class="text-gray-400 hover:text-white transition-colors">Docs</a>
      <a href="#pricing" class="text-gray-400 hover:text-white transition-colors">Preços</a>
      <a href="https://github.com/LucasGalhardoLima/fio" target="_blank" rel="noopener" class="text-gray-400 hover:text-white transition-colors">GitHub</a>
      <a href="/docs/quickstart/" class="bg-green-500 hover:bg-green-400 text-black font-medium px-4 py-2 rounded-lg transition-colors">Comece agora</a>
    </div>
  </nav>

  <!-- Hero -->
  <section class="max-w-6xl mx-auto px-6 pt-20 pb-24">
    <div class="grid md:grid-cols-2 gap-12 items-center">
      <div>
        <h1 class="text-4xl sm:text-5xl font-bold leading-tight">
          Cobrança recorrente via PIX <span class="gradient-text">pra devs</span>
        </h1>
        <p class="mt-6 text-lg text-gray-400 leading-relaxed">
          Integre assinaturas PIX no seu SaaS em minutos. SDK TypeScript, webhooks, sandbox completo.
        </p>
        <div class="mt-8 flex gap-4">
          <a href="/docs/quickstart/" class="bg-green-500 hover:bg-green-400 text-black font-semibold px-6 py-3 rounded-lg transition-colors">Comece agora</a>
          <a href="/docs/" class="border border-gray-700 hover:border-gray-500 text-gray-300 font-medium px-6 py-3 rounded-lg transition-colors">Ver docs</a>
        </div>
      </div>
      <div class="code-block">
        <pre><span class="kw">import</span> { Fio } <span class="kw">from</span> <span class="str">'@fio-pay/sdk'</span>

<span class="kw">const</span> fio = <span class="kw">new</span> <span class="fn">Fio</span>({ apiKey: <span class="str">'fio_test_...'</span> })

<span class="kw">const</span> sub = <span class="kw">await</span> fio.subscriptions.<span class="fn">create</span>({
  customer_id: <span class="str">'cus_abc123'</span>,
  plan_id: <span class="str">'plan_xyz789'</span>,
})

console.<span class="fn">log</span>(sub.status) <span class="cm">// "trialing"</span></pre>
      </div>
    </div>
  </section>

  <!-- How it works -->
  <section class="max-w-6xl mx-auto px-6 py-20 border-t border-gray-800">
    <h2 class="text-3xl font-bold text-center mb-16">Como funciona</h2>
    <div class="grid md:grid-cols-3 gap-8">
      <div class="bg-gray-900/50 border border-gray-800 rounded-xl p-8">
        <div class="text-3xl mb-4">📋</div>
        <h3 class="text-xl font-semibold mb-3">Crie planos e assinaturas</h3>
        <p class="text-gray-400 leading-relaxed">Defina preço, intervalo e período de trial. A API cuida do ciclo de cobrança automaticamente.</p>
      </div>
      <div class="bg-gray-900/50 border border-gray-800 rounded-xl p-8">
        <div class="text-3xl mb-4">⚡</div>
        <h3 class="text-xl font-semibold mb-3">Receba via PIX</h3>
        <p class="text-gray-400 leading-relaxed">QR code gerado automaticamente. Pagamentos confirmados por webhook em tempo real.</p>
      </div>
      <div class="bg-gray-900/50 border border-gray-800 rounded-xl p-8">
        <div class="text-3xl mb-4">🔧</div>
        <h3 class="text-xl font-semibold mb-3">Gerencie tudo por API</h3>
        <p class="text-gray-400 leading-relaxed">Dunning automático, pausar/cancelar/retomar assinaturas, métricas de MRR e churn.</p>
      </div>
    </div>
  </section>

  <!-- Code example -->
  <section class="max-w-6xl mx-auto px-6 py-20 border-t border-gray-800">
    <h2 class="text-3xl font-bold text-center mb-4">Sua primeira cobrança em 6 linhas</h2>
    <p class="text-gray-400 text-center mb-12 max-w-2xl mx-auto">Do SDK instalado ao pagamento confirmado — tudo no sandbox, sem cadastro de gateway.</p>
    <div class="max-w-3xl mx-auto code-block">
      <pre><span class="kw">import</span> { Fio } <span class="kw">from</span> <span class="str">'@fio-pay/sdk'</span>

<span class="kw">const</span> fio = <span class="kw">new</span> <span class="fn">Fio</span>({ apiKey: <span class="str">'fio_test_sua_chave'</span> })

<span class="cm">// 1. Crie um cliente</span>
<span class="kw">const</span> customer = <span class="kw">await</span> fio.customers.<span class="fn">create</span>({
  name: <span class="str">'João Silva'</span>,
  email: <span class="str">'joao@example.com'</span>,
  tax_id: <span class="str">'52998224725'</span>,
  tax_id_type: <span class="str">'cpf'</span>,
})

<span class="cm">// 2. Gere uma cobrança PIX</span>
<span class="kw">const</span> charge = <span class="kw">await</span> fio.charges.<span class="fn">create</span>({
  customer_id: customer.id,
  amount: <span class="num">4990</span>, <span class="cm">// R$ 49,90</span>
  expires_in: <span class="num">3600</span>,
})

console.<span class="fn">log</span>(charge.pix_qr_code) <span class="cm">// Copia-e-cola do PIX</span>

<span class="cm">// 3. (Sandbox) Simule o pagamento</span>
<span class="kw">await</span> fio.test.<span class="fn">simulatePayment</span>(charge.id)

<span class="kw">const</span> paid = <span class="kw">await</span> fio.charges.<span class="fn">get</span>(charge.id)
console.<span class="fn">log</span>(paid.status) <span class="cm">// "paid" ✅</span></pre>
    </div>
  </section>

  <!-- Pricing -->
  <section id="pricing" class="max-w-6xl mx-auto px-6 py-20 border-t border-gray-800">
    <h2 class="text-3xl font-bold text-center mb-4">Simples e transparente</h2>
    <p class="text-gray-400 text-center mb-12">Sem mensalidade. Sem setup. Sem surpresa.</p>
    <div class="max-w-md mx-auto bg-gray-900/50 border border-gray-800 rounded-xl p-10 text-center">
      <div class="text-5xl font-bold gradient-text mb-2">1,49%</div>
      <div class="text-gray-400 mb-6">por cobrança PIX</div>
      <ul class="text-left text-gray-300 space-y-3 mb-8">
        <li class="flex items-center gap-2"><span class="text-green-400">✓</span> Sandbox grátis e ilimitado</li>
        <li class="flex items-center gap-2"><span class="text-green-400">✓</span> Sem limite de transações</li>
        <li class="flex items-center gap-2"><span class="text-green-400">✓</span> Webhooks inclusos</li>
        <li class="flex items-center gap-2"><span class="text-green-400">✓</span> SDK TypeScript completo</li>
        <li class="flex items-center gap-2"><span class="text-green-400">✓</span> Suporte por Discord</li>
      </ul>
      <a href="/docs/quickstart/" class="block w-full bg-green-500 hover:bg-green-400 text-black font-semibold px-6 py-3 rounded-lg transition-colors">Comece agora — grátis no sandbox</a>
    </div>
  </section>

  <!-- Footer -->
  <footer class="max-w-6xl mx-auto px-6 py-12 border-t border-gray-800">
    <div class="text-center">
      <h2 class="text-2xl font-bold mb-4">Sua primeira cobrança PIX em 5 minutos</h2>
      <a href="/docs/quickstart/" class="inline-block bg-green-500 hover:bg-green-400 text-black font-semibold px-8 py-3 rounded-lg transition-colors mb-8">Comece agora</a>
      <div class="flex items-center justify-center gap-6 text-sm text-gray-500">
        <a href="/docs/" class="hover:text-gray-300 transition-colors">Docs</a>
        <a href="https://github.com/LucasGalhardoLima/fio" target="_blank" rel="noopener" class="hover:text-gray-300 transition-colors">GitHub</a>
      </div>
      <p class="text-gray-600 text-sm mt-6">© 2026 Fio</p>
    </div>
  </footer>

</body>
</html>
```

**Step 2: Verify the landing page renders**

```bash
cd packages/docs && pnpm dev
```

Open `http://localhost:4321/` in a browser. You should see the full landing page. Press `Ctrl+C` to stop.

**Step 3: Commit**

```bash
git add packages/docs/src/pages/index.astro
git commit -m "feat(docs): add landing page with hero, features, code example, pricing"
```

---

### Task 6: Update docs test to use new content path

**Files:**
- Modify: `packages/docs/tests/examples.test.ts`

**Step 1: Update CONTENT_DIR path**

The MDX files moved from `packages/docs/content/` to `packages/docs/src/content/docs/docs/`. Update the constant in `packages/docs/tests/examples.test.ts`:

Change line 13 from:
```typescript
const CONTENT_DIR = join(import.meta.dirname, '..', 'content')
```
to:
```typescript
const CONTENT_DIR = join(import.meta.dirname, '..', 'src', 'content', 'docs', 'docs')
```

**Step 2: Run the docs tests**

```bash
pnpm vitest run packages/docs/tests
```

Expected: 15+ tests pass (one per code block across all MDX files).

**Step 3: Commit**

```bash
git add packages/docs/tests/examples.test.ts
git commit -m "fix(docs): update test content path for starlight structure"
```

---

### Task 7: Verify full build and test suite

**Step 1: Build the docs site**

```bash
cd packages/docs && pnpm build
```

Expected: Astro build succeeds, outputs static files to `dist/`.

**Step 2: Preview the built site**

```bash
cd packages/docs && pnpm preview
```

Open `http://localhost:4321/` — landing page should render. Navigate to `/docs/` — Starlight docs should render with sidebar, search, dark mode. Press `Ctrl+C`.

**Step 3: Run full test suite**

```bash
DATABASE_URL="..." REDIS_URL="..." pnpm vitest run
```

Expected: all tests pass (144 API/SDK tests + 15+ docs tests).

**Step 4: Commit any fixes and push**

```bash
git push
```

---

### Task 8: Update llms.txt and CI workflow

**Files:**
- Modify: `packages/docs/public/llms.txt`
- Modify: `.github/workflows/ci.yml`

**Step 1: Update llms.txt URLs**

Update `packages/docs/public/llms.txt` to reflect the new URL structure. Change `docs.fio.com.br` references to path-based URLs (e.g., `fiopay.dev/docs/quickstart`).

**Step 2: Update CI workflow for Astro build**

Add a docs build step to `.github/workflows/ci.yml` in the `docs-examples` job, after the test step:

```yaml
      - name: Build docs site
        run: pnpm --filter @fio-pay/docs build
```

**Step 3: Commit**

```bash
git add packages/docs/public/llms.txt .github/workflows/ci.yml
git commit -m "chore(docs): update llms.txt URLs and add docs build to CI"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Replace dependencies (Fumadocs → Astro+Starlight) | `package.json` |
| 2 | Astro config + content collection + tsconfig | `astro.config.mjs`, `content.config.ts`, `tsconfig.json` |
| 3 | Migrate MDX content to Starlight structure | `src/content/docs/docs/**/*.mdx` |
| 4 | Global CSS with Tailwind + Fio brand colors | `src/styles/global.css` |
| 5 | Landing page (hero, features, code, pricing, footer) | `src/pages/index.astro` |
| 6 | Update docs test content path | `tests/examples.test.ts` |
| 7 | Full build + test verification | — |
| 8 | Update llms.txt + CI workflow | `public/llms.txt`, `.github/workflows/ci.yml` |
