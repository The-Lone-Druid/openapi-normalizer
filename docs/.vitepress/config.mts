import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'OpenAPI Normalizer',
  description:
    'Convert Postman Collections to OpenAPI 3.x and normalize bloated Postman-exported specs — correlated examples, inferred schemas, zero dependencies.',
  base: '/openapi-normalizer/',

  head: [['link', { rel: 'icon', href: '/openapi-normalizer/favicon.ico' }]],

  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'API', link: '/api/' },
      {
        text: 'v1.0.0',
        items: [
          {
            text: 'Changelog',
            link: 'https://github.com/The-Lone-Druid/openapi-normalizer/releases',
          },
          {
            text: 'npm',
            link: 'https://www.npmjs.com/package/openapi-normalizer',
          },
        ],
      },
    ],

    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Getting Started', link: '/guide/getting-started' },
          { text: 'Normalizer', link: '/guide/normalizer' },
          { text: 'Converter', link: '/guide/converter' },
          { text: 'CLI', link: '/guide/cli' },
          { text: 'Use Cases', link: '/guide/use-cases' },
        ],
      },
      {
        text: 'API Reference',
        items: [
          { text: 'normalize()', link: '/api/' },
          { text: 'convertCollection()', link: '/api/convert-collection' },
          { text: 'Types', link: '/api/types' },
        ],
      },
    ],

    socialLinks: [
      {
        icon: 'github',
        link: 'https://github.com/The-Lone-Druid/openapi-normalizer',
      },
      {
        icon: 'npm',
        link: 'https://www.npmjs.com/package/openapi-normalizer',
      },
    ],

    search: {
      provider: 'local',
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026-present',
    },
  },
});
