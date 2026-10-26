import { createRouter, createWebHashHistory } from 'vue-router';

import CollectionsPage from './pages/CollectionsPage.vue';
import ComposePage from './pages/ComposePage.vue';
import EnvironmentsPage from './pages/EnvironmentsPage.vue';
import LogDetailPage from './pages/LogDetailPage.vue';
import LogPage from './pages/LogPage.vue';
import RuleEditPage from './pages/RuleEditPage.vue';
import RulesPage from './pages/RulesPage.vue';
import SettingsPage from './pages/SettingsPage.vue';
import StoragePage from './pages/StoragePage.vue';

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/rules' },
    { path: '/rules', component: RulesPage },
    { path: '/rules/:id', component: RuleEditPage, props: true },
    { path: '/log', component: LogPage },
    { path: '/log/:id', component: LogDetailPage, props: true },
    { path: '/compose', component: ComposePage },
    { path: '/compose/collections', component: CollectionsPage },
    { path: '/compose/environments', component: EnvironmentsPage },
    { path: '/storage', component: StoragePage },
    { path: '/settings', component: SettingsPage },
  ],
});
