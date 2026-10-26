import { createPinia } from 'pinia';
import { createApp } from 'vue';

import 'vue-sonner/style.css';
import { useRulesStore } from '@/stores/rules';
import { useSettingsStore } from '@/stores/settings';

import './style.css';
import App from './App.vue';
import { router } from './router';

const pinia = createPinia();
const app = createApp(App).use(pinia).use(router);

void Promise.all([useRulesStore(pinia).ready, useSettingsStore(pinia).ready]).then(() =>
  app.mount('#app'),
);
