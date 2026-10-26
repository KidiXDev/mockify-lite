import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';
import { browser } from 'wxt/browser';

import { useStorageItem } from '@/composables/useStorageItem';
import { interpolate, isFullUrl, type Lookup, macroScopes, type SavedRequest } from '@/lib/compose';
import { formatJson } from '@/lib/format';
import { fetchInPage, type PageRequest, type PageResponse, readWebStorage } from '@/lib/page';
import { clone, type LogEntry } from '@/lib/rules';
import { workspaceItem } from '@/lib/storage';

const blank = (): SavedRequest => ({
  id: '',
  name: '',
  collection: '',
  method: 'GET',
  url: '',
  headers: [],
  body: '',
  withCookies: true,
});

const toMap = (items: { key: string; value: string }[]) =>
  new Map(items.map((i) => [i.key, i.value]));

export const useComposerStore = defineStore('composer', () => {
  const { state: workspace, ready } = useStorageItem(workspaceItem);
  const draft = ref(blank());
  const response = shallowRef<PageResponse>();
  const sending = shallowRef(false);

  const collections = computed(() =>
    [...new Set(workspace.value.requests.map((r) => r.collection).filter(Boolean))].sort(),
  );
  const saved = computed(() => workspace.value.requests.find((r) => r.id === draft.value.id));
  const dirty = computed(
    () => !saved.value || JSON.stringify(saved.value) !== JSON.stringify(draft.value),
  );
  const environment = computed(() =>
    workspace.value.environments.find((e) => e.id === workspace.value.activeEnv),
  );
  const envVars = computed(
    () => new Map(environment.value?.vars.filter((v) => v.name).map((v) => [v.name, v.value])),
  );

  function load(entry: LogEntry) {
    draft.value = {
      ...blank(),
      method: entry.method,
      url: entry.url,
      headers: entry.reqHeaders,
      body: formatJson(entry.reqBody ?? ''),
      withCookies: entry.credentials === 'include',
    };
    response.value = undefined;
  }

  function open(id: string) {
    const request = workspace.value.requests.find((r) => r.id === id);
    if (!request) return;
    draft.value = clone(request);
    response.value = undefined;
  }

  function reset() {
    draft.value = blank();
    response.value = undefined;
  }

  function save() {
    if (!draft.value.id) draft.value.id = crypto.randomUUID();
    const index = workspace.value.requests.findIndex((r) => r.id === draft.value.id);
    if (index === -1) workspace.value.requests.unshift(clone(draft.value));
    else workspace.value.requests[index] = clone(draft.value);
  }

  function remove(id: string) {
    const before = workspace.value.requests;
    workspace.value.requests = before.filter((r) => r.id !== id);
    return () => {
      workspace.value.requests = before;
    };
  }

  function duplicate(id: string) {
    const index = workspace.value.requests.findIndex((r) => r.id === id);
    const source = workspace.value.requests[index];
    if (!source) return;
    workspace.value.requests.splice(index + 1, 0, {
      ...clone(source),
      id: crypto.randomUUID(),
      name: `${source.name || 'Request'} copy`,
    });
  }

  function addEnvironment() {
    const env = { id: crypto.randomUUID(), name: '', vars: [{ name: 'BASE_URL', value: '' }] };
    workspace.value.environments.push(env);
    if (!workspace.value.activeEnv) workspace.value.activeEnv = env.id;
  }

  function removeEnvironment(id: string) {
    const { environments, activeEnv } = workspace.value;
    workspace.value.environments = environments.filter((e) => e.id !== id);
    if (activeEnv === id) workspace.value.activeEnv = '';
    return () => {
      workspace.value.environments = environments;
      workspace.value.activeEnv = activeEnv;
    };
  }

  async function lookupFor(tabId: number, pageUrl: string, texts: string[]): Promise<Lookup> {
    const scopes = macroScopes([...texts, ...envVars.value.values()].join('\n'));
    const [local, session, cookies] = await Promise.all([
      scopes.has('local') ? readWebStorage(tabId, 'localStorage').then(toMap) : undefined,
      scopes.has('session') ? readWebStorage(tabId, 'sessionStorage').then(toMap) : undefined,
      scopes.has('cookie')
        ? browser.cookies
            .getAll({ url: pageUrl })
            .then((list) => toMap(list.map((c) => ({ key: c.name, value: c.value }))))
        : undefined,
    ]);
    return (scope, key) => {
      switch (scope) {
        case 'env':
          return envVars.value.get(key);
        case 'local':
          return local?.get(key);
        case 'session':
          return session?.get(key);
        case 'cookie':
          return cookies?.get(key);
        case '$uuid':
          return crypto.randomUUID();
        case '$timestamp':
          return String(Math.floor(Date.now() / 1000));
      }
    };
  }

  async function send(tabId: number, pageUrl: string) {
    const { method, url, headers, body, withCookies } = draft.value;
    const payload = method === 'GET' || method === 'HEAD' ? undefined : body;
    sending.value = true;
    try {
      const texts = [url, ...headers.flatMap((h) => [h.name, h.value]), payload ?? ''];
      const lookup = await lookupFor(tabId, pageUrl, texts);
      const missing = new Set<string>();
      const resolve = (text: string) => interpolate(text, lookup, missing);
      const request: PageRequest = {
        method,
        url: resolve(url),
        headers: headers.map((h) => ({ name: resolve(h.name), value: resolve(h.value) })),
        body: payload === undefined ? undefined : resolve(payload),
        credentials: withCookies ? 'include' : 'same-origin',
      };
      if (missing.size) throw new Error(`Unresolved ${[...missing].join(', ')}`);
      if (!isFullUrl(request.url)) throw new Error(`Not a full URL: ${request.url}`);
      response.value = await fetchInPage(tabId, request);
    } catch (error) {
      response.value = {
        status: 0,
        statusText: '',
        headers: [],
        body: '',
        duration: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      sending.value = false;
    }
  }

  return {
    workspace,
    ready,
    draft,
    response,
    sending,
    collections,
    saved,
    dirty,
    environment,
    envVars,
    load,
    open,
    reset,
    save,
    remove,
    duplicate,
    addEnvironment,
    removeEnvironment,
    send,
  };
});
