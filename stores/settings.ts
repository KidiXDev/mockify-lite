import { defineStore } from 'pinia';

import { useStorageItem } from '@/composables/useStorageItem';
import { siteMatches } from '@/lib/rules';
import { settingsItem } from '@/lib/storage';

export const useSettingsStore = defineStore('settings', () => {
  const { state: settings, ready } = useStorageItem(settingsItem);

  function isSiteEnabled(host: string) {
    return settings.value.sites.some((site) => siteMatches(site, host));
  }

  function setSite(host: string, enabled: boolean) {
    const others = settings.value.sites.filter((site) => !siteMatches(site, host));
    settings.value.sites = enabled ? [...others, host] : others;
  }

  function isGroupEnabled(group: string) {
    return !settings.value.disabledGroups.includes(group);
  }

  function setGroup(group: string, enabled: boolean) {
    const others = settings.value.disabledGroups.filter((g) => g !== group);
    settings.value.disabledGroups = enabled ? others : [...others, group];
  }

  return { settings, ready, isSiteEnabled, setSite, isGroupEnabled, setGroup };
});
