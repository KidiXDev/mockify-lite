import { defineStore } from 'pinia';
import { ref, shallowRef } from 'vue';

import { formatJson } from '@/lib/format';
import { fetchInPage, type PageResponse } from '@/lib/page';
import type { Header, LogEntry } from '@/lib/rules';

export const useComposerStore = defineStore('composer', () => {
  const draft = ref({
    method: 'GET',
    url: '',
    headers: [] as Header[],
    body: '',
    withCookies: true,
  });
  const response = shallowRef<PageResponse>();
  const sending = shallowRef(false);

  function load(entry: LogEntry) {
    draft.value = {
      method: entry.method,
      url: entry.url,
      headers: entry.reqHeaders,
      body: formatJson(entry.reqBody ?? ''),
      withCookies: entry.credentials === 'include',
    };
    response.value = undefined;
  }

  async function send(tabId: number) {
    const { method, url, headers, body, withCookies } = draft.value;
    sending.value = true;
    try {
      response.value = await fetchInPage(tabId, {
        method,
        url,
        headers,
        body: method === 'GET' || method === 'HEAD' ? undefined : body,
        credentials: withCookies ? 'include' : 'same-origin',
      });
    } catch (error) {
      response.value = {
        status: 0,
        statusText: '',
        headers: [],
        body: '',
        duration: 0,
        error: String(error),
      };
    } finally {
      sending.value = false;
    }
  }

  return { draft, response, sending, load, send };
});
