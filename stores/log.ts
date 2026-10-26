import { defineStore } from 'pinia';
import { onScopeDispose, shallowRef, watch } from 'vue';
import { browser, type Browser } from 'wxt/browser';

import { useActiveTab } from '@/composables/useActiveTab';
import type { LogEntry } from '@/lib/rules';

const MAX_ENTRIES = 300;

export const useLogStore = defineStore('log', () => {
  const { tab } = useActiveTab();
  const entries = shallowRef<LogEntry[]>([]);
  const connected = shallowRef(false);

  async function refresh() {
    const id = tab.value?.id;
    try {
      if (id === undefined) throw new Error('No tab');
      entries.value = await browser.tabs.sendMessage(id, { type: 'log:get' });
      connected.value = true;
    } catch {
      entries.value = [];
      connected.value = false;
    }
  }

  async function clear() {
    entries.value = [];
    if (tab.value?.id !== undefined)
      await browser.tabs.sendMessage(tab.value.id, { type: 'log:clear' }).catch(() => {});
  }

  function get(id: string) {
    return entries.value.find((e) => e.id === id);
  }

  const onMessage = (
    message: { type?: string; entry?: LogEntry },
    sender: Browser.runtime.MessageSender,
  ) => {
    if (message?.type !== 'log:entry' || !message.entry || sender.tab?.id !== tab.value?.id) return;
    entries.value = [...entries.value, message.entry].slice(-MAX_ENTRIES);
  };
  browser.runtime.onMessage.addListener(onMessage);
  onScopeDispose(() => browser.runtime.onMessage.removeListener(onMessage));

  watch(() => [tab.value?.id, tab.value?.url, tab.value?.status], refresh, { immediate: true });

  return { entries, connected, refresh, clear, get };
});
