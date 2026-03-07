# Docs Polish Design

**Goal:** Make Starlight docs visually consistent with the Fio landing page and fix UX issues.

## Changes

1. **Redirect `/docs/` to `/docs/quickstart/`** — Delete splash index page, add redirect in astro.config.mjs
2. **Fix dark theme colors** — Override Starlight CSS variables to use `#030712` background, green-tinted borders, eliminate default blue/indigo tint
3. **Fix duplicate title** — Remove manual `# h1` from quickstart.mdx (Starlight renders frontmatter title automatically)
4. **Frosted nav** — Add backdrop-blur to Starlight header matching landing page
