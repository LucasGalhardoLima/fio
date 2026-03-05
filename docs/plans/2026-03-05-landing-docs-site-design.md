# Fio Landing Page + Documentation Site — Design

## Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Site structure | Single package (landing + docs) | Simpler to build, deploy, maintain. Matches Polar model. |
| Framework | Astro + Starlight | Zero JS, purpose-built for docs, blazing fast. Starting from scratch anyway. |
| Language & tone | Portuguese, casual | Target audience is Brazilian indie devs. Code stays in English (TypeScript). |
| Landing sections | 5 (minimal) | Hero + How it works + Code example + Pricing + Footer CTA. Ship fast, iterate. |
| Domain | fiopay.dev (recommended) | Developer signal + unique. Configure later, build now. |

---

## Architecture

```
packages/docs/           (rewrite from Next.js/Fumadocs to Astro/Starlight)
├── astro.config.mjs
├── package.json
├── src/
│   ├── content/
│   │   └── docs/        (existing MDX content, restructured)
│   │       ├── quickstart.mdx
│   │       ├── guides/
│   │       │   └── subscription-billing.mdx
│   │       ├── api/
│   │       │   ├── customers.mdx
│   │       │   ├── plans.mdx
│   │       │   ├── subscriptions.mdx
│   │       │   ├── charges.mdx
│   │       │   └── invoices.mdx
│   │       └── webhooks.mdx
│   ├── pages/
│   │   └── index.astro   (landing page)
│   ├── components/
│   │   ├── Hero.astro
│   │   ├── HowItWorks.astro
│   │   ├── CodeExample.astro
│   │   ├── Pricing.astro
│   │   └── FooterCTA.astro
│   └── styles/
│       └── landing.css
├── public/
│   └── llms.txt          (keep existing)
└── tests/
    └── examples.test.ts  (keep existing, adjust paths)
```

### Key changes from current setup

1. Replace `fumadocs-*` dependencies with `astro` + `@astrojs/starlight`
2. Move MDX content from `content/` to `src/content/docs/`
3. Remove unused Next.js config (tsconfig.json jsx:preserve, next plugins)
4. Create landing page as `src/pages/index.astro`
5. Starlight handles `/docs/*` routing automatically

---

## Landing Page Design

### Section 1: Hero

```
┌─────────────────────────────────────────────────────┐
│  Nav: [Fio]  Docs  Preços  GitHub  [Comece agora]   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Cobrança recorrente         ┌───────────────────┐  │
│  via PIX pra devs            │ import { Fio }     │  │
│                              │   from '@fio-pay/… │  │
│  Integre assinaturas PIX     │                    │  │
│  no seu SaaS em minutos.     │ const fio = new …  │  │
│  SDK TypeScript, webhooks,   │ const sub = await  │  │
│  sandbox completo.           │   fio.subscript…   │  │
│                              │                    │  │
│  [Comece agora]  [Ver docs]  └───────────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

- Headline: "Cobrança recorrente via PIX pra devs"
- Subheadline: "Integre assinaturas PIX no seu SaaS em minutos. SDK TypeScript, webhooks, sandbox completo."
- Primary CTA: "Comece agora" → `/docs/quickstart`
- Secondary CTA: "Ver docs" → `/docs`
- Code snippet: Real 6-line subscription creation with `@fio-pay/sdk`

### Section 2: How It Works (3 pillars)

```
┌─────────────────────────────────────────────────────┐
│  Como funciona                                      │
│                                                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │  Crie       │ │  Receba     │ │  Gerencie   │   │
│  │  planos e   │ │  via PIX    │ │  tudo por   │   │
│  │  assinaturas│ │             │ │  API        │   │
│  │             │ │  QR code    │ │             │   │
│  │  Preço,     │ │  gerado     │ │  Dunning,   │   │
│  │  intervalo, │ │  automatica-│ │  pausar,    │   │
│  │  trial.     │ │  mente.     │ │  cancelar,  │   │
│  │  A API      │ │  Pagamentos │ │  métricas.  │   │
│  │  cuida do   │ │  confirmados│ │             │   │
│  │  ciclo.     │ │  por webhook│ │             │   │
│  └─────────────┘ └─────────────┘ └─────────────┘   │
└─────────────────────────────────────────────────────┘
```

### Section 3: Code Example (full happy path)

Tabbed code block with 3 tabs:
1. **Criar assinatura** — Create customer + plan + subscription
2. **Cobrar via PIX** — Create charge + simulate payment
3. **Receber webhook** — Verify signature + handle event

Uses real `@fio-pay/sdk` TypeScript code from the quickstart.

### Section 4: Pricing

```
┌─────────────────────────────────────────────────────┐
│  Simples e transparente                             │
│                                                     │
│  R$ X,XX por cobrança PIX                           │
│                                                     │
│  Sem mensalidade. Sem setup. Sem surpresa.          │
│  Sandbox grátis e ilimitado.                        │
│                                                     │
│  [Comece agora — é grátis no sandbox]               │
└─────────────────────────────────────────────────────┘
```

Flat per-transaction fee, shown directly on the page. No "fale conosco."

### Section 5: Footer CTA + Links

```
┌─────────────────────────────────────────────────────┐
│  Sua primeira cobrança PIX em 5 minutos             │
│  [Comece agora]                                     │
│                                                     │
│  Docs · GitHub · Status · @fiopay                   │
│  © 2026 Fio                                         │
└─────────────────────────────────────────────────────┘
```

---

## Docs Structure (Starlight)

Starlight sidebar configuration:

```
Início
├── Quickstart (primeira cobrança em 5 min)

Guias
├── Assinaturas e cobrança recorrente
├── Eventos e webhooks

Referência da API
├── Clientes
├── Planos
├── Assinaturas
├── Cobranças
├── Faturas
```

Features from Starlight (zero config):
- Full-text search (Pagefind, built-in)
- Dark/light mode
- Sidebar navigation
- Mobile responsive
- Table of contents per page
- "Edit this page" links (optional)

---

## Visual Direction

- Clean, minimal design inspired by Polar and AbacatePay
- Dark mode default (developer audience prefers it)
- Monospace font for code, Inter/system font for prose
- Accent color: Fio brand color (to be defined, suggest a vibrant green or blue)
- No stock photos, no illustrations — just code, typography, and whitespace
- Code blocks with syntax highlighting (Shiki, built into Starlight)

---

## Migration Plan

1. Replace package.json dependencies (remove fumadocs/next/react, add astro/starlight)
2. Move `content/*.mdx` → `src/content/docs/*.mdx` (add Starlight frontmatter)
3. Create `src/pages/index.astro` (landing page)
4. Create 5 landing page components
5. Configure Starlight sidebar in `astro.config.mjs`
6. Update `tests/examples.test.ts` to reference new content paths
7. Update `llms.txt` if URLs change
8. Verify all 15 docs tests still pass
