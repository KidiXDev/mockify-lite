import type { Browser } from 'wxt/browser';

import { hostOf, siteMatches } from '@/lib/rules';
import { rulesItem, settingsItem } from '@/lib/storage';

const INTERCEPTOR_ID = 'mockify-interceptor';
const BRIDGE_ID = 'mockify-bridge';

export default defineBackground(() => {
  void browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  void browser.action.setBadgeBackgroundColor({ color: '#d97706' });

  // Serialized so rapid setting changes can't race into duplicate script ids.
  let queue = Promise.resolve();
  const syncScripts = () => {
    queue = queue
      .then(registerScripts)
      .catch((error) => console.error('Mockify: script registration failed', error));
  };

  browser.runtime.onInstalled.addListener(syncScripts);
  browser.runtime.onStartup.addListener(syncScripts);
  settingsItem.watch((next, prev) => {
    if (next.sites.join() !== prev?.sites.join()) syncScripts();
    void updateBadges();
  });
  rulesItem.watch(() => void updateBadges());
  browser.tabs.onUpdated.addListener((_id, info, tab) => {
    if (info.url || info.status === 'loading') void updateBadge(tab);
  });
});

async function registerScripts() {
  const { sites } = await settingsItem.getValue();
  const existing = await browser.scripting.getRegisteredContentScripts({
    ids: [INTERCEPTOR_ID, BRIDGE_ID],
  });
  if (existing.length)
    await browser.scripting.unregisterContentScripts({ ids: existing.map((s) => s.id) });
  if (!sites.length) return;

  const matches = sites.map((site) => `*://${site}/*`);
  await browser.scripting.registerContentScripts([
    { id: INTERCEPTOR_ID, js: ['interceptor.js'], matches, runAt: 'document_start', world: 'MAIN' },
    { id: BRIDGE_ID, js: ['bridge.js'], matches, runAt: 'document_start' },
  ]);
}

async function updateBadge(tab: Browser.tabs.Tab) {
  if (tab.id === undefined) return;
  const [settings, rules] = await Promise.all([settingsItem.getValue(), rulesItem.getValue()]);
  const host = hostOf(tab.url);
  const active =
    settings.enabled && host && settings.sites.some((site) => siteMatches(site, host))
      ? rules.filter((r) => r.enabled && !settings.disabledGroups.includes(r.group)).length
      : 0;
  await browser.action
    .setBadgeText({ tabId: tab.id, text: active ? String(active) : '' })
    .catch(() => {});
}

async function updateBadges() {
  const tabs = await browser.tabs.query({});
  await Promise.all(tabs.map(updateBadge));
}
