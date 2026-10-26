import { useWindowFocus } from '@vueuse/core';
import { defineStore } from 'pinia';
import { computed, ref, shallowRef, watch } from 'vue';
import { browser } from 'wxt/browser';

import { useActiveTab } from '@/composables/useActiveTab';
import { useStorageItem } from '@/composables/useStorageItem';
import { interpolate, isFullUrl, type Lookup, type SavedRequest } from '@/lib/compose';
import { formatJson } from '@/lib/format';
import type { MacroSource } from '@/lib/macro-editor';
import { fetchInPage, type PageRequest, type PageResponse, readWebStorage } from '@/lib/page';
import { clone, hostOf, type LogEntry } from '@/lib/rules';
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

type Values = Map<string, string>;

const toMap = (items: { key: string; value: string }[]): Values =>
  new Map(items.map((i) => [i.key, i.value]));

const PAGE_SCOPES = [
  ['local', 'localStorage'],
  ['session', 'sessionStorage'],
  ['cookie', 'Cookies'],
] as const;

export const useComposerStore = defineStore('composer', () => {
  const { state: workspace, ready } = useStorageItem(workspaceItem);
  const { tab } = useActiveTab();
  const draft = ref(blank());
  const page = shallowRef<Partial<Record<'local' | 'session' | 'cookie', Values>>>({});
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

  const lookup = computed<Lookup>(() => {
    const env = envVars.value;
    const { local, session, cookie } = page.value;
    return (scope, key) => {
      switch (scope) {
        case 'env':
          return env.get(key);
        case 'local':
          return local?.get(key);
        case 'session':
          return session?.get(key);
        case 'cookie':
          return cookie?.get(key);
        case '$uuid':
          return crypto.randomUUID();
        case '$timestamp':
          return String(Math.floor(Date.now() / 1000));
      }
    };
  });

  const macroSource = computed<MacroSource>(() => ({
    lookup: lookup.value,
    options: [
      ...[...envVars.value.keys()].map((key) => ({ label: `env.${key}`, section: 'Environment' })),
      ...PAGE_SCOPES.flatMap(([scope, section]) =>
        [...(page.value[scope]?.keys() ?? [])].map((key) => ({
          label: `${scope}.${key}`,
          section,
        })),
      ),
      { label: '$uuid', section: 'Dynamic' },
      { label: '$timestamp', section: 'Dynamic' },
    ],
  }));

  async function refreshPage() {
    const { id, url } = tab.value ?? {};
    if (id === undefined || !hostOf(url)) {
      page.value = {};
      return;
    }
    const settle = <T>(promise: Promise<T>) => promise.catch(() => undefined);
    const [local, session, cookie] = await Promise.all([
      settle(readWebStorage(id, 'localStorage').then(toMap)),
      settle(readWebStorage(id, 'sessionStorage').then(toMap)),
      settle(
        browser.cookies
          .getAll({ url })
          .then((list) => toMap(list.map((c) => ({ key: c.name, value: c.value })))),
      ),
    ]);
    page.value = { local, session, cookie };
  }

  watch(() => [tab.value?.id, tab.value?.url, tab.value?.status], refreshPage, { immediate: true });
  watch(useWindowFocus(), (focused) => focused && refreshPage());

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

  async function send() {
    const tabId = tab.value?.id;
    if (tabId === undefined) return;
    const { method, url, headers, body, withCookies } = draft.value;
    const payload = method === 'GET' || method === 'HEAD' ? undefined : body;
    sending.value = true;
    try {
      await refreshPage();
      const missing = new Set<string>();
      const resolve = (text: string) => interpolate(text, lookup.value, missing);
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
    macroSource,
    refreshPage,
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
