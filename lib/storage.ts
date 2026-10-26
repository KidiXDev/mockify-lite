import { storage } from 'wxt/utils/storage';

import type { Rule, Settings } from './rules';

export const rulesItem = storage.defineItem<Rule[]>('local:rules', { fallback: [] });

export const settingsItem = storage.defineItem<Settings>('local:settings', {
  fallback: { enabled: true, sites: ['localhost', '127.0.0.1'], disabledGroups: [], theme: 'auto' },
});
