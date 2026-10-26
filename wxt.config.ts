import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    name: 'Mockify Lite',
    description: 'Mock and modify API requests, inspect traffic, edit storage.',
    permissions: ['storage', 'scripting', 'cookies', 'browsingData', 'sidePanel'],
    host_permissions: ['<all_urls>'],
    action: { default_title: 'Mockify' },
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
