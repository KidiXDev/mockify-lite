import { createSharedComposable } from '@vueuse/core';
import { computed, onScopeDispose, shallowRef } from 'vue';
import { type Browser, browser } from 'wxt/browser';

import { hostOf } from '@/lib/rules';

export const useActiveTab = createSharedComposable(() => {
  const tab = shallowRef<Browser.tabs.Tab>();

  async function refresh() {
    [tab.value] = await browser.tabs.query({ active: true, currentWindow: true });
  }
  const onUpdated = (id: number, _info: unknown, updated: Browser.tabs.Tab) => {
    if (id === tab.value?.id) tab.value = updated;
  };

  void refresh();
  browser.tabs.onActivated.addListener(refresh);
  browser.tabs.onUpdated.addListener(onUpdated);
  onScopeDispose(() => {
    browser.tabs.onActivated.removeListener(refresh);
    browser.tabs.onUpdated.removeListener(onUpdated);
  });

  const host = computed(() => hostOf(tab.value?.url));
  const origin = computed(() => (host.value ? new URL(tab.value!.url!).origin : ''));

  return { tab, host, origin };
});
