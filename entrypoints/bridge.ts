import { type Config, isObject, type LogEntry } from '@/lib/rules';
import { rulesItem, settingsItem } from '@/lib/storage';

const TAG = '__mockify';
const MAX_ENTRIES = 300;

export default defineUnlistedScript(() => {
  const log: LogEntry[] = [];

  async function sendConfig() {
    const [rules, settings] = await Promise.all([rulesItem.getValue(), settingsItem.getValue()]);
    const config: Config = {
      enabled: settings.enabled,
      rules,
      disabledGroups: settings.disabledGroups,
    };
    window.postMessage({ [TAG]: 'config', config }, '*');
  }

  void sendConfig();
  rulesItem.watch(sendConfig);
  settingsItem.watch(sendConfig);

  // The page shares this channel, so only accept messages that can't change extension state.
  window.addEventListener('message', (event) => {
    if (event.source !== window || !isObject(event.data)) return;
    const { [TAG]: kind, entry } = event.data;
    if (kind === 'hello') void sendConfig();
    else if (kind === 'log' && isLogEntry(entry)) {
      log.push(entry);
      if (log.length > MAX_ENTRIES) log.shift();
      browser.runtime.sendMessage({ type: 'log:entry', entry }).catch(() => {});
    }
  });

  browser.runtime.onMessage.addListener((message: { type?: string }, _sender, sendResponse) => {
    if (message?.type === 'log:get') sendResponse(log);
    else if (message?.type === 'log:clear') {
      log.length = 0;
      sendResponse(true);
    }
  });
});

function isLogEntry(value: unknown): value is LogEntry {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.url === 'string' &&
    typeof value.method === 'string' &&
    typeof value.status === 'number' &&
    Array.isArray(value.reqHeaders) &&
    Array.isArray(value.resHeaders)
  );
}
