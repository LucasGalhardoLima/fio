# Docs & Landing Page Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite the landing page to match the SuperDesign draft and customize Starlight docs via CSS to create a cohesive visual identity.

**Architecture:** Landing page is a standalone Astro page (`index.astro` + `landing.css`) — full rewrite. Docs pages use Starlight — CSS-only overrides in `global.css` targeting Starlight variables and selectors. No MDX, config, or component changes.

**Tech Stack:** Astro, Starlight, Tailwind CSS v4, Satoshi font (Fontshare), Iconify (landing only), JetBrains Mono

**Design references:**
- Landing: https://p.superdesign.dev/draft/9e36a416-90d5-4bf0-9a6d-c9a256b17845
- Docs index: https://p.superdesign.dev/draft/d69bce4f-0f37-4722-a43c-e4e0082dd57c
- Quickstart: https://p.superdesign.dev/draft/a7803639-ed35-45d9-b6fe-977182911d63
- API reference: https://p.superdesign.dev/draft/c7b05610-497f-4fb0-93b3-48417844936e

---

### Task 1: Rewrite landing.css

**Files:**
- Rewrite: `packages/docs/src/styles/landing.css`

**Step 1: Rewrite the full landing.css**

Replace the entire file with the new styles. Key changes: Satoshi font import, grid pattern background, thread container, updated nav (fixed, h-20, blur-xl), terminal-style code blocks, staggered feature layout, expanded footer, scrollbar hiding.

```css
/* ──────────────────────────────────────────────
   Fio Landing Page — landing.css
   All custom styles for /index.astro
   ────────────────────────────────────────────── */

@import "tailwindcss";
@import url('https://api.fontshare.com/v2/css?f[]=satoshi@700,500,400&display=swap');

/* Reset & base */
* { margin: 0; padding: 0; box-sizing: border-box; }
html { scroll-behavior: smooth; }

body {
  font-family: 'Satoshi', system-ui, -apple-system, sans-serif;
  background-color: #030712;
}

.font-mono {
  font-family: 'JetBrains Mono', ui-monospace, 'Cascadia Code', monospace;
}

/* ── Hide scrollbar ──────────────────────────── */
html { scrollbar-width: none; }
html::-webkit-scrollbar { display: none; }

/* ── Gradient text ───────────────────────────── */
.gradient-text {
  background: linear-gradient(135deg, #22c55e 0%, #4ade80 50%, #86efac 100%);
  background-size: 200% 200%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: gradient-shift 6s ease infinite;
}

@keyframes gradient-shift {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

/* ── Hero headline shimmer ───────────────────── */
.hero-headline {
  background: linear-gradient(90deg, #fff 0%, #fff 40%, #22c55e 50%, #fff 60%, #fff 100%);
  background-size: 200% 100%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: shimmer 8s ease-in-out infinite;
}

@keyframes shimmer {
  0%, 100% { background-position: 100% 0; }
  50% { background-position: -100% 0; }
}

/* ── Grid pattern background ─────────────────── */
.grid-pattern {
  background-image:
    linear-gradient(rgba(34, 197, 94, 0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(34, 197, 94, 0.02) 1px, transparent 1px);
  background-size: 64px 64px;
}

/* ── Flowing thread container ────────────────── */
.thread-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}

/* ── Code glow border ────────────────────────── */
.code-glow {
  position: relative;
}

.code-glow::after {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: 0.75rem;
  padding: 1px;
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.3) 0%, transparent 50%, rgba(34, 197, 94, 0.2) 100%);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask-composite: exclude;
  pointer-events: none;
}

/* ── Mobile nav ──────────────────────────────── */
.nav-links {
  display: flex;
  align-items: center;
  gap: 2rem;
}

.hamburger {
  display: none;
  flex-direction: column;
  gap: 5px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  z-index: 60;
}

.hamburger span {
  display: block;
  width: 22px;
  height: 2px;
  background: #d1d5db;
  border-radius: 2px;
  transition: transform 0.3s ease, opacity 0.3s ease;
}

@media (max-width: 767px) {
  .hamburger { display: flex; }

  .nav-links {
    position: fixed;
    inset: 0;
    flex-direction: column;
    justify-content: center;
    gap: 2rem;
    background: rgba(3, 7, 18, 0.97);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
    z-index: 55;
  }

  .nav-links a { font-size: 1.25rem; }

  [data-menu-open="true"] .nav-links {
    opacity: 1;
    pointer-events: auto;
  }

  [data-menu-open="true"] .hamburger span:nth-child(1) {
    transform: rotate(45deg) translate(5px, 5px);
  }
  [data-menu-open="true"] .hamburger span:nth-child(2) { opacity: 0; }
  [data-menu-open="true"] .hamburger span:nth-child(3) {
    transform: rotate(-45deg) translate(5px, -5px);
  }
}

/* ── Scroll reveal ───────────────────────────── */
.reveal {
  opacity: 0;
  transform: translateY(24px);
}

.reveal.visible {
  animation: reveal-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes reveal-up {
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
}
```

**Step 2: Verify build**

Run: `cd packages/docs && pnpm build 2>&1 | tail -5`
Expected: Build succeeds (CSS-only change, no breakage)

**Step 3: Commit**

```bash
git add packages/docs/src/styles/landing.css
git commit -m "style(docs): rewrite landing.css with Satoshi font, grid pattern, thread motif"
```

---

### Task 2: Rewrite index.astro (landing page HTML)

**Files:**
- Rewrite: `packages/docs/src/pages/index.astro`

**Step 1: Rewrite the full landing page**

Replace the entire file. Key structural changes: centered hero (single column), staggered feature cards (flex column with self-align), terminal-style code blocks with traffic-light dots, expanded footer with social icons, SVG flowing thread, Iconify icons.

Read the current file first, then rewrite:

```astro
---
import '../styles/landing.css'
---
<html lang="pt-BR" class="dark scroll-smooth">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Fio — Cobranca recorrente via PIX pra devs</title>
  <meta name="description" content="Integre assinaturas PIX no seu SaaS em minutos. SDK TypeScript, webhooks, sandbox completo." />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="Fio — Cobranca recorrente via PIX pra devs" />
  <meta property="og:description" content="Integre assinaturas PIX no seu SaaS em minutos. SDK TypeScript, webhooks, sandbox completo." />
  <meta property="og:image" content="https://fiopay-docs.vercel.app/og-image.png" />
  <meta property="og:url" content="https://fiopay-docs.vercel.app/" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Fio — Cobranca recorrente via PIX pra devs" />
  <meta name="twitter:description" content="Integre assinaturas PIX no seu SaaS em minutos." />
  <meta name="twitter:image" content="https://fiopay-docs.vercel.app/og-image.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <script src="https://code.iconify.design/iconify-icon/1.0.7/iconify-icon.min.js"></script>
</head>
<body class="antialiased selection:bg-green-500/30 selection:text-green-200">
  <div class="min-h-screen relative bg-[#030712] text-gray-100 grid-pattern">

    <!-- Flowing Thread SVG -->
    <div class="thread-container">
      <svg width="100%" height="100%" viewBox="0 0 1440 6000" fill="none" preserveAspectRatio="xMidYMin slice" class="opacity-30">
        <path d="M80 40 C80 300, 720 150, 720 600 C 720 1200, 1200 1300, 1100 1800 C 1000 2300, 300 2400, 400 3000 C 500 3600, 1200 3700, 720 4400 C 240 5100, 720 5400, 720 5900"
              stroke="url(#thread-gradient)"
              stroke-width="1.5"
              stroke-linecap="round" />
        <defs>
          <linearGradient id="thread-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#22c55e" stop-opacity="0" />
            <stop offset="5%" stop-color="#22c55e" stop-opacity="0.6" />
            <stop offset="50%" stop-color="#22c55e" stop-opacity="0.4" />
            <stop offset="95%" stop-color="#22c55e" stop-opacity="0.8" />
            <stop offset="100%" stop-color="#22c55e" stop-opacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </div>

    <!-- Navigation -->
    <nav class="fixed top-0 left-0 right-0 z-50 bg-[#030712]/70 backdrop-blur-xl border-b border-white/5" id="main-nav">
      <div class="max-w-[1152px] mx-auto px-6 h-20 flex items-center justify-between">
        <div class="flex items-center gap-12">
          <a href="/" class="text-2xl font-bold text-white tracking-tighter relative z-[60]">Fio</a>
          <div class="nav-links" id="nav-links">
            <a href="/docs/" class="text-sm font-medium text-gray-400 hover:text-white transition-colors">Docs</a>
            <a href="#pricing" class="text-sm font-medium text-gray-400 hover:text-white transition-colors">Precos</a>
            <a href="https://github.com/LucasGalhardoLima/fio" target="_blank" rel="noopener" class="text-sm font-medium text-gray-400 hover:text-white transition-colors">GitHub</a>
          </div>
        </div>
        <div class="flex items-center gap-4">
          <a href="/docs/quickstart/" class="bg-[#22c55e] text-[#030712] px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#4ade80] transition-all hover:-translate-y-0.5 shadow-lg shadow-green-500/20">Comece agora</a>
          <button class="hamburger md:hidden" id="menu-toggle" aria-label="Abrir menu">
            <span></span><span></span><span></span>
          </button>
        </div>
      </div>
    </nav>

    <!-- Main Content -->
    <main class="relative z-10">

      <!-- Hero Section (Centered) -->
      <section class="max-w-[1152px] mx-auto px-6 pt-40 pb-48">
        <div class="max-w-4xl mx-auto text-center flex flex-col items-center space-y-12">
          <div class="space-y-8">
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-green-500/20 bg-green-500/10 text-xs font-semibold text-[#4ade80] tracking-wide uppercase reveal">
              <span class="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
              Em desenvolvimento
            </div>
            <h1 class="text-5xl lg:text-7xl font-bold leading-[1.05] tracking-tight reveal">
              <span class="hero-headline text-white">Cobranca recorrente via PIX</span><br/>
              <span class="gradient-text">pra devs</span>
            </h1>
            <p class="text-lg text-gray-400 leading-relaxed max-w-2xl mx-auto reveal">
              Integre assinaturas PIX no seu SaaS em minutos. SDK TypeScript nativo, webhooks em tempo real e sandbox completo para testes ilimitados.
            </p>
            <div class="flex flex-wrap justify-center gap-4 reveal">
              <a href="/docs/quickstart/" class="bg-[#22c55e] text-[#030712] px-8 py-3.5 rounded-lg font-bold hover:bg-[#4ade80] transition-all hover:scale-[1.02] shadow-xl shadow-green-500/10">Comece agora</a>
              <a href="/docs/" class="border border-gray-700 text-gray-300 px-8 py-3.5 rounded-lg font-bold hover:border-gray-500 hover:text-white transition-all">Documentacao</a>
            </div>
          </div>

          <!-- Hero Code Block (Centered below) -->
          <div class="w-full max-w-2xl code-glow bg-[#0a0f1a] rounded-xl border border-white/10 p-6 shadow-2xl relative overflow-hidden text-left reveal">
            <div class="flex items-center gap-2 mb-6 border-b border-white/5 pb-4">
              <div class="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/40"></div>
              <div class="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/40"></div>
              <div class="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/40"></div>
              <span class="ml-2 text-xs text-gray-500 font-mono">subscription.ts</span>
            </div>
            <pre class="font-mono text-[14px] leading-7 overflow-x-auto"><span class="text-green-400">import</span> {'{'} Fio {'}'} <span class="text-green-400">from</span> <span class="text-green-200">'@fio-pay/sdk'</span>

<span class="text-gray-500">// Initialize the client</span>
<span class="text-green-400">const</span> fio = <span class="text-green-400">new</span> <span class="text-white">Fio</span>({'{'} apiKey: <span class="text-green-200">'fio_test_...'</span> {'}'})

<span class="text-gray-500">// Create recurring subscription</span>
<span class="text-green-400">const</span> sub = <span class="text-green-400">await</span> fio.subscriptions.<span class="text-white">create</span>({'{'}
  customer_id: <span class="text-green-200">'cus_abc123'</span>,
  plan_id: <span class="text-green-200">'plan_gold'</span>,
{'}'})

<span class="text-white">console</span>.<span class="text-white">log</span>(sub.status) <span class="text-gray-500">// "active"</span></pre>
          </div>
        </div>
      </section>

      <!-- Features Section (Staggered) -->
      <section class="max-w-[1152px] mx-auto px-6 py-48">
        <div class="mb-32 text-center max-w-2xl mx-auto reveal">
          <h2 class="text-3xl md:text-5xl font-bold text-white tracking-tight mb-6">Como funciona</h2>
          <p class="text-gray-400">Tres passos para cobrar seus clientes com a infraestrutura PIX mais moderna do mercado.</p>
        </div>
        <div class="flex flex-col gap-32">
          <div class="max-w-md w-full md:self-start md:ml-12 group bg-white/5 border border-white/10 rounded-2xl p-8 hover:bg-white/[0.08] hover:-translate-y-2 transition-all duration-300 hover:border-green-500/30 reveal">
            <div class="w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400 text-2xl mb-6 group-hover:scale-110 transition-transform">
              <iconify-icon icon="lucide:layers"></iconify-icon>
            </div>
            <h3 class="text-xl font-bold text-white mb-3">Crie planos e assinaturas</h3>
            <p class="text-gray-400 leading-relaxed">Defina preco, intervalo e periodo de trial. A Fio cuida do ciclo de faturamento e tentativas automaticas.</p>
          </div>
          <div class="max-w-md w-full md:self-end md:mr-12 md:-mt-24 group bg-white/5 border border-white/10 rounded-2xl p-8 hover:bg-white/[0.08] hover:-translate-y-2 transition-all duration-300 hover:border-green-500/30 reveal">
            <div class="w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400 text-2xl mb-6 group-hover:scale-110 transition-transform">
              <iconify-icon icon="lucide:zap"></iconify-icon>
            </div>
            <h3 class="text-xl font-bold text-white mb-3">Receba via PIX</h3>
            <p class="text-gray-400 leading-relaxed">QR Codes dinamicos gerados em milissegundos. Pagamentos confirmados instantaneamente via Webhook.</p>
          </div>
          <div class="max-w-md w-full self-center group bg-white/5 border border-white/10 rounded-2xl p-8 hover:bg-white/[0.08] hover:-translate-y-2 transition-all duration-300 hover:border-green-500/30 reveal">
            <div class="w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400 text-2xl mb-6 group-hover:scale-110 transition-transform">
              <iconify-icon icon="lucide:code-2"></iconify-icon>
            </div>
            <h3 class="text-xl font-bold text-white mb-3">Gerencie tudo por API</h3>
            <p class="text-gray-400 leading-relaxed">Pause, cancele ou retome assinaturas. Metricas de MRR e churn disponiveis diretamente via endpoints.</p>
          </div>
        </div>
      </section>

      <!-- Code Example Section -->
      <section class="py-48">
        <div class="max-w-[1152px] mx-auto px-6">
          <div class="text-center mb-16 reveal">
            <h2 class="text-3xl md:text-5xl font-bold text-white tracking-tight mb-6">Sua primeira cobranca em 6 linhas</h2>
            <p class="text-gray-400">Pule a burocracia dos gateways tradicionais. Comece a testar agora mesmo no sandbox.</p>
          </div>
          <div class="max-w-3xl mx-auto code-glow bg-[#0a0f1a] rounded-xl border border-white/10 p-8 shadow-2xl relative overflow-hidden reveal">
            <div class="absolute top-4 right-4 text-xs font-mono text-gray-600">TypeScript</div>
            <pre class="font-mono text-sm leading-8 overflow-x-auto"><span class="text-green-400">const</span> customer = <span class="text-green-400">await</span> fio.customers.<span class="text-white">create</span>({'{'}
  name: <span class="text-green-200">'Joao Silva'</span>,
  email: <span class="text-green-200">'joao@email.com'</span>,
  tax_id: <span class="text-green-200">'123.456.789-00'</span>
{'}'})

<span class="text-green-400">const</span> charge = <span class="text-green-400">await</span> fio.charges.<span class="text-white">create</span>({'{'}
  customer_id: customer.id,
  amount: <span class="text-green-200">4990</span>, <span class="text-gray-500">// R$ 49,90</span>
{'}'})

<span class="text-white">console</span>.<span class="text-white">log</span>(charge.pix_qr_code) <span class="text-gray-500">// Pronto pra pagar</span>

<span class="text-gray-500">// Simule o pagamento no sandbox</span>
<span class="text-green-400">await</span> fio.test.<span class="text-white">simulatePayment</span>(charge.id)</pre>
          </div>
        </div>
      </section>

      <!-- Pricing Section -->
      <section id="pricing" class="max-w-[1152px] mx-auto px-6 py-48">
        <div class="text-center mb-24 reveal">
          <h2 class="text-3xl md:text-5xl font-bold text-white tracking-tight mb-6">Simples e transparente</h2>
          <p class="text-gray-400">Foque no seu produto, nos cuidamos da infraestrutura de cobranca.</p>
        </div>
        <div class="max-w-md mx-auto reveal">
          <div class="bg-white/5 border border-white/10 rounded-3xl p-10 text-center relative overflow-hidden hover:border-green-500/40 transition-colors">
            <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-green-500 to-transparent opacity-50"></div>
            <div class="text-sm font-semibold text-green-400 uppercase tracking-widest mb-6">Standard Plan</div>
            <div class="mb-4">
              <span class="text-6xl md:text-7xl font-bold gradient-text">1,49%</span>
            </div>
            <p class="text-gray-400 mb-10">por cobranca PIX liquidada</p>
            <ul class="text-left space-y-5 mb-12">
              <li class="flex items-center gap-3 text-gray-300">
                <iconify-icon icon="lucide:check" class="text-green-400"></iconify-icon>
                <span>Sandbox gratis e ilimitado</span>
              </li>
              <li class="flex items-center gap-3 text-gray-300">
                <iconify-icon icon="lucide:check" class="text-green-400"></iconify-icon>
                <span>Sem limite de transacoes</span>
              </li>
              <li class="flex items-center gap-3 text-gray-300">
                <iconify-icon icon="lucide:check" class="text-green-400"></iconify-icon>
                <span>Webhooks inclusos</span>
              </li>
              <li class="flex items-center gap-3 text-gray-300">
                <iconify-icon icon="lucide:check" class="text-green-400"></iconify-icon>
                <span>SDK TypeScript completo</span>
              </li>
              <li class="flex items-center gap-3 text-gray-300">
                <iconify-icon icon="lucide:check" class="text-green-400"></iconify-icon>
                <span>Suporte via Discord</span>
              </li>
            </ul>
            <a href="/docs/quickstart/" class="block w-full bg-[#22c55e] text-[#030712] py-4 rounded-xl font-bold text-lg hover:bg-[#4ade80] transition-all shadow-xl shadow-green-500/10">Comece agora &mdash; gratis no sandbox</a>
          </div>
        </div>
      </section>

      <!-- Footer -->
      <footer class="border-t border-white/5 pt-48">
        <div class="max-w-[1152px] mx-auto px-6 pb-24">
          <div class="text-center space-y-12 reveal">
            <h2 class="text-4xl md:text-6xl font-bold text-white tracking-tighter">Sua primeira cobranca PIX em 5 minutos</h2>
            <p class="text-gray-400 text-lg max-w-xl mx-auto">Junte-se a desenvolvedores que ja estao automatizando suas cobrancas.</p>
            <div class="flex flex-col items-center gap-8">
              <a href="/docs/quickstart/" class="bg-[#22c55e] text-[#030712] px-12 py-5 rounded-xl font-bold text-xl hover:bg-[#4ade80] transition-all hover:scale-105 shadow-2xl shadow-green-500/20">Criar conta gratuita</a>
              <div class="flex items-center gap-12 text-sm font-medium">
                <a href="/docs/" class="text-gray-500 hover:text-white transition-colors">Documentacao</a>
                <a href="https://github.com/LucasGalhardoLima/fio" target="_blank" rel="noopener" class="text-gray-500 hover:text-white transition-colors">GitHub</a>
              </div>
            </div>
            <div class="pt-24 flex flex-col md:flex-row items-center justify-between gap-6 border-t border-white/5">
              <div class="text-2xl font-bold text-white tracking-tighter">Fio</div>
              <div class="text-sm text-gray-600">&copy; 2026 Fio Payments. Todos os direitos reservados.</div>
              <div class="flex items-center gap-6">
                <a href="https://github.com/LucasGalhardoLima/fio" target="_blank" rel="noopener" class="text-gray-600 hover:text-white text-xl transition-colors"><iconify-icon icon="mdi:github"></iconify-icon></a>
              </div>
            </div>
          </div>
        </div>
      </footer>

    </main>
  </div>

  <script>
    const toggle = document.getElementById('menu-toggle');
    const nav = document.getElementById('main-nav');
    if (toggle && nav) {
      toggle.addEventListener('click', () => {
        const open = nav.getAttribute('data-menu-open') === 'true';
        nav.setAttribute('data-menu-open', open ? 'false' : 'true');
      });
      document.querySelectorAll('#nav-links a').forEach(link => {
        link.addEventListener('click', () => nav.setAttribute('data-menu-open', 'false'));
      });
    }
    const reveals = document.querySelectorAll('.reveal');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(el => observer.observe(el));
  </script>
</body>
</html>
```

**Step 2: Verify build**

Run: `cd packages/docs && pnpm build 2>&1 | tail -5`
Expected: Build succeeds

**Step 3: Verify locally**

Run: `cd packages/docs && pnpm dev`
Check: Open `http://localhost:4321/` — verify centered hero, staggered features, thread SVG, terminal code blocks, expanded footer.

**Step 4: Commit**

```bash
git add packages/docs/src/pages/index.astro
git commit -m "feat(docs): rewrite landing page with centered hero, staggered features, thread motif"
```

---

### Task 3: Expand global.css with Starlight overrides

**Files:**
- Modify: `packages/docs/src/styles/global.css`

**Step 1: Read current file then expand with Starlight overrides**

Add comprehensive CSS overrides below the existing Starlight color variables. These target Starlight's built-in class names and elements to approximate the design.

```css
@layer base, starlight, theme, components, utilities;
@import '@astrojs/starlight-tailwind';
@import 'tailwindcss/theme.css' layer(theme);
@import 'tailwindcss/utilities.css' layer(utilities);
@import url('https://api.fontshare.com/v2/css?f[]=satoshi@700,500,400&display=swap');

/* ── Fio brand colors ────────────────────────── */
:root {
  --sl-color-accent-low: #052e16;
  --sl-color-accent: #22c55e;
  --sl-color-accent-high: #bbf7d0;
  --sl-color-text-accent: #4ade80;

  --sl-font: 'Satoshi', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --sl-font-system-mono: 'JetBrains Mono', ui-monospace, 'Cascadia Code', monospace;
}

:root[data-theme='dark'] {
  --sl-color-accent-low: #052e16;
  --sl-color-accent: #22c55e;
  --sl-color-accent-high: #dcfce7;
  --sl-color-text-accent: #86efac;
}

/* ── Hide scrollbar ──────────────────────────── */
html { scrollbar-width: none; }
html::-webkit-scrollbar { display: none; }

/* ── Grid pattern background ─────────────────── */
:root[data-theme='dark'] body {
  background-image:
    linear-gradient(rgba(34, 197, 94, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(34, 197, 94, 0.03) 1px, transparent 1px);
  background-size: 48px 48px;
}

/* ── Header/nav styling ──────────────────────── */
:root[data-theme='dark'] header.header {
  border-bottom-color: rgba(34, 197, 94, 0.1);
}

/* ── Sidebar section labels ──────────────────── */
:root[data-theme='dark'] .sidebar-content summary,
:root[data-theme='dark'] starlight-menu-button + nav details > summary {
  text-transform: uppercase;
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  color: rgba(34, 197, 94, 0.6);
}

/* ── Sidebar active link ─────────────────────── */
:root[data-theme='dark'] nav a[aria-current="page"] {
  color: #22c55e;
  border-right: 2px solid #22c55e;
  background: linear-gradient(90deg, transparent, rgba(34, 197, 94, 0.05));
  font-weight: 600;
}

/* ── Sidebar border ──────────────────────────── */
:root[data-theme='dark'] .sidebar-pane {
  border-right-color: rgba(34, 197, 94, 0.1);
}

/* ── Thread line at sidebar edge ─────────────── */
:root[data-theme='dark'] .sidebar-pane::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 1px;
  background: linear-gradient(180deg, transparent, rgba(34, 197, 94, 0.2) 20%, rgba(34, 197, 94, 0.2) 80%, transparent);
  pointer-events: none;
}

/* ── Code blocks ─────────────────────────────── */
:root[data-theme='dark'] .expressive-code,
:root[data-theme='dark'] pre:not(.expressive-code pre) {
  background: #0a0f1a !important;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 0.75rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}

:root[data-theme='dark'] .expressive-code .frame {
  border-radius: 0.75rem;
  overflow: hidden;
}

:root[data-theme='dark'] .expressive-code pre {
  background: #0a0f1a !important;
  border: none !important;
}

:root[data-theme='dark'] .expressive-code .frame::before {
  display: none;
}

/* ── Content typography ──────────────────────── */
:root[data-theme='dark'] .content-panel h1,
:root[data-theme='dark'] .content-panel h2,
:root[data-theme='dark'] .content-panel h3 {
  letter-spacing: -0.025em;
}

:root[data-theme='dark'] .content-panel h1 {
  font-size: 2.5rem;
  font-weight: 700;
}

:root[data-theme='dark'] .content-panel p,
:root[data-theme='dark'] .content-panel li {
  color: #9ca3af;
}

/* ── Tables ──────────────────────────────────── */
:root[data-theme='dark'] table {
  border-collapse: collapse;
}

:root[data-theme='dark'] table th {
  text-transform: uppercase;
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  color: #6b7280;
}

:root[data-theme='dark'] table td,
:root[data-theme='dark'] table th {
  border-color: rgba(255, 255, 255, 0.05);
}

/* ── Links ───────────────────────────────────── */
:root[data-theme='dark'] .content-panel a:not([class]) {
  color: #4ade80;
}

:root[data-theme='dark'] .content-panel a:not([class]):hover {
  color: #86efac;
}

/* ── Pagination links ────────────────────────── */
:root[data-theme='dark'] .pagination-links a {
  border-color: rgba(255, 255, 255, 0.05);
  background: rgba(255, 255, 255, 0.02);
}

:root[data-theme='dark'] .pagination-links a:hover {
  border-color: rgba(34, 197, 94, 0.3);
  background: rgba(255, 255, 255, 0.04);
}
```

**Step 2: Verify build**

Run: `cd packages/docs && pnpm build 2>&1 | tail -5`
Expected: Build succeeds

**Step 3: Verify locally**

Run: `cd packages/docs && pnpm dev`
Check:
- Open `http://localhost:4321/docs/quickstart/` — verify Satoshi font, grid pattern, green sidebar active state, dark code blocks, thread line.
- Open `http://localhost:4321/docs/api/customers/` — verify tables have uppercase headers, code blocks match.
- Open `http://localhost:4321/docs/webhooks/` — verify same styling consistency.

**Step 4: Commit**

```bash
git add packages/docs/src/styles/global.css
git commit -m "style(docs): add Starlight CSS overrides for Fio brand consistency

Satoshi font, grid pattern background, green thread lines, dark code
blocks, sidebar active states, uppercase section labels, typography
refinements."
```

---

### Task 4: Final build verification

**Step 1: Full build**

Run: `cd packages/docs && pnpm build 2>&1 | tail -10`
Expected: Clean build, no warnings about missing assets or CSS issues.

**Step 2: Verify all pages**

Start dev server and check these pages:
- `/` — Landing: centered hero, staggered features, thread, code blocks with dots
- `/docs/` — Docs index: Fio branding, Satoshi font, grid pattern
- `/docs/quickstart/` — Quickstart: green sidebar active, dark code blocks
- `/docs/api/customers/` — API ref: table styling, code blocks
- `/docs/webhooks/` — Webhooks: consistent with other pages

**Step 3: Check responsive**

Resize browser to test breakpoints:
- 1440px (full width)
- 1024px (tablet landscape)
- 768px (tablet)
- 375px (mobile)

Verify: no horizontal overflow, features stack on mobile, hamburger nav works, code blocks scroll horizontally.
