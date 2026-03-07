import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  site: 'https://fiopay-docs.vercel.app',
  redirects: {
    '/docs/': '/docs/quickstart/',
    '/docs': '/docs/quickstart/',
  },
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
        {
          tag: 'meta',
          attrs: {
            property: 'og:image',
            content: 'https://fiopay-docs.vercel.app/og-image.png',
          },
        },
      ],
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
})
