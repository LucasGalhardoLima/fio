# Dashboard Dark Theme Reskin — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin the Fio dashboard from light/indigo to dark/green, matching the landing page and docs site identity.

**Architecture:** CSS-variables-first — define design tokens in `globals.css` via Tailwind v4's `@theme` directive, then update each component's Tailwind classes to use the new tokens. Pure visual reskin, no structural or logic changes.

**Tech Stack:** Next.js 15, Tailwind CSS v4, Satoshi font (Fontshare), JetBrains Mono (Google Fonts)

**Spec:** `docs/superpowers/specs/2026-03-12-dashboard-dark-theme-reskin.md`

---

## Chunk 1: Foundation — Tokens, Layout, and Shared Components

### Task 1: Design tokens and font imports

**Files:**
- Modify: `packages/dashboard/src/app/globals.css`

- [ ] **Step 1: Replace globals.css with font imports and @theme tokens**

```css
@import url('https://api.fontshare.com/v2/css?f[]=satoshi@700,500,400&display=swap');
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap');
@import 'tailwindcss';

@theme {
  --font-sans: 'Satoshi', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  --color-bg: #030712;
  --color-surface: rgba(255, 255, 255, 0.05);
  --color-surface-hover: rgba(255, 255, 255, 0.08);
  --color-border: rgba(255, 255, 255, 0.10);
  --color-border-subtle: rgba(34, 197, 94, 0.12);

  --color-accent: #22c55e;
  --color-accent-hover: #4ade80;
  --color-accent-muted: rgba(34, 197, 94, 0.15);

  --color-text-primary: #f3f4f6;
  --color-text-secondary: #9ca3af;
  --color-text-tertiary: #6b7280;
}
```

- [ ] **Step 2: Verify the dev server starts without errors**

Run: `cd packages/dashboard && npx next dev --port 3001`
Expected: Compiles without CSS errors. The page will look broken (body still has old classes) — that's expected.

- [ ] **Step 3: Commit**

```bash
git add packages/dashboard/src/app/globals.css
git commit -m "style(dashboard): add dark theme design tokens and font imports"
```

---

### Task 2: Root layout and auth layout

**Files:**
- Modify: `packages/dashboard/src/app/layout.tsx`
- Modify: `packages/dashboard/src/app/(auth)/layout.tsx`

- [ ] **Step 1: Update root layout body classes**

In `packages/dashboard/src/app/layout.tsx`, change:
```
bg-gray-50 text-gray-900 antialiased
```
to:
```
bg-bg text-text-primary antialiased font-sans
```

- [ ] **Step 2: Update auth layout card and branding**

In `packages/dashboard/src/app/(auth)/layout.tsx`, apply these changes:

| Old | New |
|-----|-----|
| `border border-gray-200 bg-white` | `border border-border bg-surface` |
| `text-indigo-600` (logo) | `text-accent` |
| `text-gray-500` (subtitle) | `text-text-secondary` |

Full file after changes:
```tsx
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-border bg-surface p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-accent">Fio</h1>
          <p className="mt-1 text-sm text-text-secondary">Billing para PIX</p>
        </div>
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify visually — auth layout should now be dark with green logo**

Run: Visit `http://localhost:3001/login`
Expected: Dark background, dark card surface, green "Fio" logo. Form inputs still look wrong (will fix in Task 5).

- [ ] **Step 4: Commit**

```bash
git add packages/dashboard/src/app/layout.tsx packages/dashboard/src/app/\(auth\)/layout.tsx
git commit -m "style(dashboard): apply dark theme to root and auth layouts"
```

---

### Task 3: Sidebar

**Files:**
- Modify: `packages/dashboard/src/components/sidebar.tsx`

- [ ] **Step 1: Apply dark theme to sidebar**

Changes to make in `packages/dashboard/src/components/sidebar.tsx`:

| Line | Old | New |
|------|-----|-----|
| 21 | `border-r border-gray-200 bg-white` | `border-r border-border bg-bg` |
| 22 | `border-b border-gray-200` | `border-b border-border` |
| 23 | `text-indigo-600` | `text-accent` |
| 34 | `bg-indigo-50 text-indigo-700` | `bg-accent-muted text-accent` |
| 35 | `text-gray-700 hover:bg-gray-50` | `text-text-secondary hover:bg-surface-hover` |
| 43 | `border-t border-gray-200` | `border-t border-border` |
| 46 | `text-gray-700 hover:bg-gray-50` | `text-text-secondary hover:bg-surface-hover` |

- [ ] **Step 2: Verify — sidebar should be dark with green accents**

Run: Visit `http://localhost:3001/overview` (must be logged in)
Expected: Dark sidebar, green "Fio" logo, green active nav highlight, gray inactive links.

- [ ] **Step 3: Commit**

```bash
git add packages/dashboard/src/components/sidebar.tsx
git commit -m "style(dashboard): apply dark theme to sidebar"
```

---

### Task 4: Shared components — StatCard, DataTable, EventTimeline

**Files:**
- Modify: `packages/dashboard/src/components/stat-card.tsx`
- Modify: `packages/dashboard/src/components/data-table.tsx`
- Modify: `packages/dashboard/src/components/event-timeline.tsx`

- [ ] **Step 1: Update StatCard**

In `packages/dashboard/src/components/stat-card.tsx`:

| Old | New |
|-----|-----|
| `border border-gray-200 bg-white p-6` | `border border-border bg-surface p-6` |
| `text-sm text-gray-500` | `text-sm text-text-secondary` |
| `mt-1 text-2xl font-semibold` | `mt-1 text-2xl font-semibold text-text-primary` |
| `mt-1 text-xs text-gray-400` | `mt-1 text-xs text-text-tertiary` |

- [ ] **Step 2: Update DataTable**

In `packages/dashboard/src/components/data-table.tsx`:

| Line | Old | New |
|------|-----|-----|
| 22 | `border border-gray-200 bg-white p-8 text-center text-sm text-gray-500` | `border border-border bg-surface p-8 text-center text-sm text-text-secondary` |
| 29 | `border border-gray-200 bg-white` | `border border-border bg-surface` |
| 30 | `divide-y divide-gray-200` | `divide-y divide-border` |
| 31 | `bg-gray-50` | `bg-surface-hover` |
| 36 | `text-gray-500` | `text-text-tertiary` |
| 43 | `divide-y divide-gray-200` | `divide-y divide-border` |
| 45 | `hover:bg-gray-50` | `hover:bg-surface-hover` |
| 47 | `text-gray-700` | `text-text-secondary` |

- [ ] **Step 3: Update EventTimeline**

In `packages/dashboard/src/components/event-timeline.tsx`:

| Line | Old | New |
|------|-----|-----|
| 20 | `text-sm text-gray-500` | `text-sm text-text-secondary` |
| 29 | `border border-gray-100` | `border border-border` |
| 30 | `bg-indigo-400` | `bg-accent` |
| 33 | `text-gray-900` | `text-text-primary` |
| 37 | `bg-purple-100 ... text-purple-700` | `bg-purple-500/15 ... text-purple-400` |
| 42 | `text-gray-500` | `text-text-tertiary` |
| 45 | `text-gray-400` | `text-text-tertiary` |

- [ ] **Step 4: Verify — overview page should now look fully dark**

Run: Visit `http://localhost:3001/overview`
Expected: Dark stat cards with green-tinted borders, secondary text in muted gray. Data tables on other pages should also be dark.

- [ ] **Step 5: Commit**

```bash
git add packages/dashboard/src/components/stat-card.tsx \
  packages/dashboard/src/components/data-table.tsx \
  packages/dashboard/src/components/event-timeline.tsx
git commit -m "style(dashboard): apply dark theme to shared components"
```

---

## Chunk 2: Auth Pages

### Task 5: Login page

**Files:**
- Modify: `packages/dashboard/src/app/(auth)/login/page.tsx`

- [ ] **Step 1: Apply dark theme to login page**

Changes in `packages/dashboard/src/app/(auth)/login/page.tsx`:

| Line | Old | New |
|------|-----|-----|
| 51 | `text-gray-900` | `text-text-primary` |
| 53 | `bg-red-50 p-2 text-sm text-red-600` | `bg-red-500/10 border border-red-500/20 p-2 text-sm text-red-400` |
| 56 | `text-gray-700` | `text-text-secondary` |
| 62 | `border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500` | `border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent` |
| 66 | `text-gray-700` | `text-text-secondary` |
| 72 | same input changes as line 62 | same |
| 78 | `bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700` | `bg-accent px-4 py-2 text-sm font-medium text-bg hover:bg-accent-hover` |
| 82 | `text-gray-500` | `text-text-secondary` |
| 84 | `text-indigo-600 hover:underline` | `text-accent hover:underline` |

- [ ] **Step 2: Verify login page**

Run: Visit `http://localhost:3001/login`
Expected: Dark inputs, green submit button with dark text, green link, muted labels.

- [ ] **Step 3: Commit**

```bash
git add packages/dashboard/src/app/\(auth\)/login/page.tsx
git commit -m "style(dashboard): apply dark theme to login page"
```

---

### Task 6: Register page

**Files:**
- Modify: `packages/dashboard/src/app/(auth)/register/page.tsx`

- [ ] **Step 1: Apply dark theme to register page**

Changes in `packages/dashboard/src/app/(auth)/register/page.tsx`:

**Success state (lines 42-67):**

| Line | Old | New |
|------|-----|-----|
| 43 | `text-gray-900` | `text-text-primary` |
| 44 | `text-gray-600` | `text-text-secondary` |
| 49 | `text-gray-500` | `text-text-tertiary` |
| 50 | `bg-gray-100 p-2 text-xs` | `bg-surface-hover p-2 text-xs text-text-primary` |
| 55 | `text-gray-500` | `text-text-tertiary` |
| 56 | `bg-gray-100 p-2 text-xs` | `bg-surface-hover p-2 text-xs text-text-primary` |
| 63 | `bg-indigo-600 ... text-white hover:bg-indigo-700` | `bg-accent ... text-bg hover:bg-accent-hover` |

**Form state (lines 71-121):**

| Line | Old | New |
|------|-----|-----|
| 73 | `text-gray-900` | `text-text-primary` |
| 75 | `bg-red-50 p-2 text-sm text-red-600` | `bg-red-500/10 border border-red-500/20 p-2 text-sm text-red-400` |
| 78 | `text-gray-700` | `text-text-secondary` |
| 84 | `border border-gray-300 ... focus:border-indigo-500 ... focus:ring-indigo-500` | `border border-border bg-surface ... text-text-primary focus:border-accent ... focus:ring-accent` |
| 88 | `text-gray-700` | `text-text-secondary` |
| 94 | same input changes | same |
| 98 | `text-gray-700` | `text-text-secondary` |
| 105 | same input changes | same |
| 111 | `bg-indigo-600 ... text-white hover:bg-indigo-700` | `bg-accent ... text-bg hover:bg-accent-hover` |
| 115 | `text-gray-500` | `text-text-secondary` |
| 117 | `text-indigo-600 hover:underline` | `text-accent hover:underline` |

- [ ] **Step 2: Verify register page**

Run: Visit `http://localhost:3001/register`
Expected: Dark form, green buttons, dark code blocks for API keys in success state.

- [ ] **Step 3: Commit**

```bash
git add packages/dashboard/src/app/\(auth\)/register/page.tsx
git commit -m "style(dashboard): apply dark theme to register page"
```

---

## Chunk 3: Dashboard Data Pages

### Task 7: Overview and Customers pages

**Files:**
- Modify: `packages/dashboard/src/app/(dashboard)/overview/page.tsx`
- Modify: `packages/dashboard/src/app/(dashboard)/customers/page.tsx`

- [ ] **Step 1: Update overview page**

In `packages/dashboard/src/app/(dashboard)/overview/page.tsx`:

| Line | Old | New |
|------|-----|-----|
| 37 | `rounded-md bg-red-50 p-4 text-sm text-red-600` | `rounded-md bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400` |
| 43 | `mb-6 text-xl font-semibold` | `mb-6 text-xl font-semibold text-text-primary` |

- [ ] **Step 2: Update customers page**

In `packages/dashboard/src/app/(dashboard)/customers/page.tsx`:

| Line | Old | New |
|------|-----|-----|
| 35 | `rounded-md bg-red-50 p-4 text-sm text-red-600` | `rounded-md bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400` |
| 40 | `mb-6 text-xl font-semibold` | `mb-6 text-xl font-semibold text-text-primary` |

- [ ] **Step 3: Commit**

```bash
git add packages/dashboard/src/app/\(dashboard\)/overview/page.tsx \
  packages/dashboard/src/app/\(dashboard\)/customers/page.tsx
git commit -m "style(dashboard): apply dark theme to overview and customers pages"
```

---

### Task 8: Subscriptions and Charges pages (badges)

**Files:**
- Modify: `packages/dashboard/src/app/(dashboard)/subscriptions/page.tsx`
- Modify: `packages/dashboard/src/app/(dashboard)/charges/page.tsx`

- [ ] **Step 1: Update subscriptions page**

In `packages/dashboard/src/app/(dashboard)/subscriptions/page.tsx`:

Replace the `statusColors` object (lines 22-28):
```typescript
const statusColors: Record<string, string> = {
  active: 'bg-green-500/15 text-green-400',
  trialing: 'bg-blue-500/15 text-blue-400',
  past_due: 'bg-yellow-500/15 text-yellow-400',
  canceled: 'bg-red-500/15 text-red-400',
  paused: 'bg-white/10 text-text-secondary',
}
```

Update error and heading:

| Line | Old | New |
|------|-----|-----|
| 44 | `rounded-md bg-red-50 p-4 text-sm text-red-600` | `rounded-md bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400` |
| 49 | `mb-6 text-xl font-semibold` | `mb-6 text-xl font-semibold text-text-primary` |

- [ ] **Step 2: Update charges page**

In `packages/dashboard/src/app/(dashboard)/charges/page.tsx`:

Replace the `statusColors` object (lines 28-35):
```typescript
const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/15 text-yellow-400',
  paid: 'bg-green-500/15 text-green-400',
  failed: 'bg-red-500/15 text-red-400',
  expired: 'bg-white/10 text-text-secondary',
  refunded: 'bg-purple-500/15 text-purple-400',
  partially_refunded: 'bg-purple-500/10 text-purple-300',
}
```

Update error and heading:

| Line | Old | New |
|------|-----|-----|
| 51 | `rounded-md bg-red-50 p-4 text-sm text-red-600` | `rounded-md bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400` |
| 56 | `mb-6 text-xl font-semibold` | `mb-6 text-xl font-semibold text-text-primary` |

- [ ] **Step 3: Commit**

```bash
git add packages/dashboard/src/app/\(dashboard\)/subscriptions/page.tsx \
  packages/dashboard/src/app/\(dashboard\)/charges/page.tsx
git commit -m "style(dashboard): apply dark theme to subscriptions and charges pages"
```

---

### Task 9: Webhooks page

**Files:**
- Modify: `packages/dashboard/src/app/(dashboard)/webhooks/page.tsx`

- [ ] **Step 1: Update webhooks page**

In `packages/dashboard/src/app/(dashboard)/webhooks/page.tsx`:

Replace the `statusColors` object (lines 24-28):
```typescript
const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/15 text-yellow-400',
  delivered: 'bg-green-500/15 text-green-400',
  failed: 'bg-red-500/15 text-red-400',
}
```

Update error and heading:

| Line | Old | New |
|------|-----|-----|
| 44 | `rounded-md bg-red-50 p-4 text-sm text-red-600` | `rounded-md bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400` |
| 49 | `mb-6 text-xl font-semibold` | `mb-6 text-xl font-semibold text-text-primary` |

- [ ] **Step 2: Commit**

```bash
git add packages/dashboard/src/app/\(dashboard\)/webhooks/page.tsx
git commit -m "style(dashboard): apply dark theme to webhooks page"
```

---

### Task 10: Settings page

**Files:**
- Modify: `packages/dashboard/src/app/(dashboard)/settings/page.tsx`

- [ ] **Step 1: Apply dark theme to settings page**

In `packages/dashboard/src/app/(dashboard)/settings/page.tsx`:

| Line | Old | New |
|------|-----|-----|
| 61 | `mb-6 text-xl font-semibold` | `mb-6 text-xl font-semibold text-text-primary` |
| 63 | `border border-gray-200 bg-white p-6` | `border border-border bg-surface p-6` |
| 64 | `text-lg font-medium` | `text-lg font-medium text-text-primary` |
| 67 | `bg-red-50 p-2 text-sm text-red-600` | `bg-red-500/10 border border-red-500/20 p-2 text-sm text-red-400` |
| 71 | `bg-green-50 p-4` | `bg-green-500/10 border border-green-500/20 p-4` |
| 72 | `text-green-800` | `text-green-400` |
| 75 | `text-green-700` | `text-green-300` |
| 78 | `text-green-600 underline` | `text-green-400 underline` |
| 88 | `bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700` | `bg-accent px-3 py-1.5 text-sm text-bg hover:bg-accent-hover` |
| 94 | `bg-gray-800 px-3 py-1.5 text-sm text-white hover:bg-gray-900` | `border border-border px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-hover` |
| 104 | `border border-gray-100 p-3` | `border border-border-subtle p-3` |
| 107 | `text-sm` (on `<code>`) | `text-sm text-text-primary` |
| 108-109 | `bg-blue-100 text-blue-700` / `bg-gray-100 text-gray-700` | `bg-blue-500/15 text-blue-400` / `bg-white/10 text-text-secondary` |
| 114 | `bg-red-100 ... text-red-700` | `bg-red-500/15 ... text-red-400` |
| 119 | `text-gray-500` | `text-text-tertiary` |
| 125 | `text-red-600 hover:underline` | `text-red-400 hover:underline` |

- [ ] **Step 2: Verify settings page**

Run: Visit `http://localhost:3001/settings`
Expected: Dark card, green primary button, outline secondary button, dark key items with subtle green borders, correct badge colors.

- [ ] **Step 3: Commit**

```bash
git add packages/dashboard/src/app/\(dashboard\)/settings/page.tsx
git commit -m "style(dashboard): apply dark theme to settings page"
```

---

## Chunk 4: Verification

### Task 11: Full visual walkthrough

- [ ] **Step 1: Start the dashboard dev server**

Run: `cd packages/dashboard && npx next dev --port 3001`

- [ ] **Step 2: Walk through every page and verify**

Check each page against the spec. Confirm:
- [ ] `/login` — dark bg, dark inputs, green button, green link
- [ ] `/register` — dark form, dark code blocks for API keys
- [ ] `/overview` — dark stat cards, correct heading color
- [ ] `/customers` — dark table, muted headers
- [ ] `/subscriptions` — dark table, correct badge colors for all states
- [ ] `/charges` — dark table, correct badge colors for all states
- [ ] `/webhooks` — dark table, correct badge colors
- [ ] `/settings` — dark section card, green/outline buttons, correct alert colors, correct badge/key styling
- [ ] Satoshi font is loading (check Network tab or visually compare with landing page)

- [ ] **Step 3: Fix any visual issues found**

If anything doesn't match the spec, fix it. Common issues:
- Missing `text-text-primary` on elements that were inheriting dark color from `text-gray-900`
- Borders that were `gray-100` variants not caught in the mapping

- [ ] **Step 4: Final commit (if fixes were needed)**

```bash
git add -A
git commit -m "style(dashboard): fix visual issues from dark theme walkthrough"
```
