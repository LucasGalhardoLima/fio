# Dashboard Dark Theme Reskin

**Goal:** Align the dashboard's visual identity with the landing page and docs site — dark background, green accent, Satoshi font — creating a cohesive brand experience across all Fio surfaces.

**Approach:** CSS-variables-first. Define design tokens in `globals.css` via Tailwind's `@theme` directive, then update every component to reference those tokens. Dark-only (no light mode toggle).

---

## Design Tokens

Defined in `packages/dashboard/src/app/globals.css` via `@theme`:

| Token | Value | Replaces |
|-------|-------|----------|
| `--font-sans` | `'Satoshi', system-ui, sans-serif` | System default |
| `--font-mono` | `'JetBrains Mono', monospace` | — |
| `--color-bg` | `#030712` | `bg-gray-50` |
| `--color-surface` | `rgba(255, 255, 255, 0.05)` | `bg-white` |
| `--color-surface-hover` | `rgba(255, 255, 255, 0.08)` | `bg-gray-50` hover |
| `--color-border` | `rgba(255, 255, 255, 0.10)` | `border-gray-200` |
| `--color-border-subtle` | `rgba(34, 197, 94, 0.12)` | `border-gray-100` |
| `--color-accent` | `#22c55e` | `indigo-600` |
| `--color-accent-hover` | `#4ade80` | `indigo-700` |
| `--color-accent-muted` | `rgba(34, 197, 94, 0.15)` | `indigo-50` |
| `--color-text-primary` | `#f3f4f6` | `text-gray-900` |
| `--color-text-secondary` | `#9ca3af` | `text-gray-500`/`text-gray-700` |
| `--color-text-tertiary` | `#6b7280` | `text-gray-400` |

Font imports via `@import url(...)` in `globals.css`: Satoshi (400, 500, 700) from Fontshare CDN, JetBrains Mono from Google Fonts — matching the landing page.

---

## Component Mapping

### Sidebar (`sidebar.tsx`)

| Element | Before | After |
|---------|--------|-------|
| Container | `bg-white border-r border-gray-200` | `bg-bg border-r border-border` |
| Logo | `text-indigo-600` | `text-accent` |
| Active link | `bg-indigo-50 text-indigo-700` | `bg-accent-muted text-accent` |
| Inactive link | `text-gray-700 hover:bg-gray-50` | `text-text-secondary hover:bg-surface-hover` |
| Footer border | `border-t border-gray-200` | `border-t border-border` |
| Logout | `text-gray-700 hover:bg-gray-50` | `text-text-secondary hover:bg-surface-hover` |

### StatCard (`stat-card.tsx`)

| Element | Before | After |
|---------|--------|-------|
| Card | `border-gray-200 bg-white` | `border-border bg-surface` |
| Label | `text-gray-500` | `text-text-secondary` |
| Value | implicit dark | `text-text-primary` |
| Detail | `text-gray-400` | `text-text-tertiary` |

### DataTable (`data-table.tsx`)

| Element | Before | After |
|---------|--------|-------|
| Wrapper | `border-gray-200 bg-white` | `border-border bg-surface` |
| Empty state | `border-gray-200 bg-white text-gray-500` | `border-border bg-surface text-text-secondary` |
| Thead | `bg-gray-50` | `bg-surface-hover` |
| Th | `text-gray-500` | `text-text-tertiary` |
| Tbody | `divide-gray-200` | `divide-border` |
| Tr hover | `hover:bg-gray-50` | `hover:bg-surface-hover` |
| Td | `text-gray-700` | `text-text-secondary` |

### EventTimeline (`event-timeline.tsx`)

| Element | Before | After |
|---------|--------|-------|
| Card | `border-gray-100` | `border-border` |
| Dot | `bg-indigo-400` | `bg-accent` |
| Event type | `text-gray-900` | `text-text-primary` |
| Agent badge | `bg-purple-100 text-purple-700` | `bg-purple-500/15 text-purple-400` |
| Entity info | `text-gray-500` | `text-text-tertiary` |
| Timestamp | `text-gray-400` | `text-text-tertiary` |

### Status Badges (across pages)

All badges follow the pattern `inline-block rounded-full px-2 py-0.5 text-xs font-medium`:

| Status | Before | After |
|--------|--------|-------|
| active / paid / delivered | `bg-green-100 text-green-700` | `bg-green-500/15 text-green-400` |
| trialing / test env | `bg-blue-100 text-blue-700` | `bg-blue-500/15 text-blue-400` |
| past_due / pending | `bg-yellow-100 text-yellow-700` | `bg-yellow-500/15 text-yellow-400` |
| canceled / failed | `bg-red-100 text-red-700` | `bg-red-500/15 text-red-400` |
| paused / expired / live env | `bg-gray-100 text-gray-700` | `bg-white/10 text-text-secondary` |
| refunded | `bg-purple-100 text-purple-700` | `bg-purple-500/15 text-purple-400` |
| partially_refunded | `bg-purple-50 text-purple-600` | `bg-purple-500/10 text-purple-300` |
| revoked | `bg-red-100 text-red-700` | `bg-red-500/15 text-red-400` |

### Buttons

| Variant | Before | After |
|---------|--------|-------|
| Primary | `bg-indigo-600 text-white hover:bg-indigo-700 rounded-md` | `bg-accent text-bg font-medium hover:bg-accent-hover rounded-lg` |
| Secondary | `bg-gray-800 text-white hover:bg-gray-900 rounded-md` | `border border-border text-text-secondary hover:bg-surface-hover rounded-lg` |
| Danger text | `text-red-600 hover:underline` | `text-red-400 hover:underline` |
| Link | `text-indigo-600 hover:underline` | `text-accent hover:underline` |

### Form Inputs (auth pages)

| Element | Before | After |
|---------|--------|-------|
| Input | `border-gray-300 focus:border-indigo-500 focus:ring-indigo-500` | `bg-surface border-border text-text-primary focus:border-accent focus:ring-accent` |
| Label | `text-gray-700` | `text-text-secondary` |

### Alerts

| Type | Before | After |
|------|--------|-------|
| Error | `bg-red-50 text-red-600` | `bg-red-500/10 border border-red-500/20 text-red-400` |
| Success | `bg-green-50 text-green-800` | `bg-green-500/10 border border-green-500/20 text-green-400` |
| Success code | `text-green-700` | `text-green-300` |
| Success button | `text-green-600 underline` | `text-green-400 underline` |

### Layouts

| Layout | Element | Before | After |
|--------|---------|--------|-------|
| Root | Body | `bg-gray-50 text-gray-900` | `bg-bg text-text-primary font-sans` |
| Auth | Card | `border-gray-200 bg-white` | `border-border bg-surface` |
| Auth | Logo | `text-indigo-600` | `text-accent` |
| Auth | Subtitle | `text-gray-500` | `text-text-secondary` |

### Page Headings (all dashboard pages)

| Element | Before | After |
|---------|--------|-------|
| H1 | `text-xl font-semibold` (inherits dark) | `text-xl font-semibold text-text-primary` |

### Settings Page (specific elements)

| Element | Before | After |
|---------|--------|-------|
| Section card | `border-gray-200 bg-white` | `border-border bg-surface` |
| Key item | `border-gray-100` | `border-border-subtle` |

### Error Alerts (all dashboard pages)

All dashboard data pages (overview, customers, subscriptions, charges, webhooks, settings) share this error pattern:

| Element | Before | After |
|---------|--------|-------|
| Error block | `rounded-md bg-red-50 p-4 text-sm text-red-600` | `rounded-md bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400` |

### EventTimeline empty state

| Element | Before | After |
|---------|--------|-------|
| Empty message | `text-sm text-gray-500` | `text-sm text-text-secondary` |

### Register Page success state (specific elements)

| Element | Before | After |
|---------|--------|-------|
| Success heading | `text-lg font-semibold text-gray-900` | `text-lg font-semibold text-text-primary` |
| Description text | `text-sm text-gray-600` | `text-sm text-text-secondary` |
| Key labels | `text-xs font-medium text-gray-500` | `text-xs font-medium text-text-tertiary` |
| Key code block | `bg-gray-100 text-xs` | `bg-surface-hover text-xs text-text-primary` |

---

## Scope

**16 files modified, 0 files created:**

1. `globals.css` — font imports + `@theme` tokens
2. `layout.tsx` (root) — body classes
3. `(auth)/layout.tsx` — dark card
4. `(auth)/login/page.tsx` — dark inputs, green button, dark alerts
5. `(auth)/register/page.tsx` — dark inputs, green button, dark code blocks
6. `sidebar.tsx` — dark bg, green accents
7. `stat-card.tsx` — dark surface
8. `data-table.tsx` — dark surface, dark headers
9. `event-timeline.tsx` — dark card, green dot
10. `overview/page.tsx` — heading color + error alert
11. `customers/page.tsx` — heading color + error alert
12. `subscriptions/page.tsx` — heading + badges + error alert
13. `charges/page.tsx` — heading + badges + error alert
14. `webhooks/page.tsx` — heading + badges + error alert
15. `settings/page.tsx` — heading + badges + buttons + alerts + key items
16. `(dashboard)/layout.tsx` — no changes needed (inherits bg/text from root)

**Not changed:**
- `session-provider.tsx` — no UI
- Data fetching logic — untouched
- Component props/interfaces — untouched
- Navigation structure — same 6 routes
- Layout structure — same sidebar + main pattern

---

## Design Principles

1. **Same palette as landing/docs**: `#030712` bg, `#22c55e` accent, Satoshi font
2. **Calm, not flashy**: No grid patterns, gradient animations, or shimmer effects — those are for marketing
3. **Functional dark**: Sufficient contrast for data readability, subtle surfaces for depth
4. **Green-tinted borders**: `rgba(34, 197, 94, 0.12)` for subtle brand presence in borders
5. **Token-driven**: All colors reference CSS variables — future light mode is a variable swap away
