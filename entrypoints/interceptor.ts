import { isJson, STATUS_TEXT } from '@/lib/format';
import {
  applyBody,
  type Config,
  findRule,
  type Header,
  type LogEntry,
  rewriteUrl,
  type Rule,
} from '@/lib/rules';

const TAG = '__mockify';
const BODY_LIMIT = 256 * 1024;
const TEXTUAL = /json|text\/(?!event-stream)|xml|javascript|graphql|urlencoded/;
const NULL_BODY_STATUS = [204, 205, 304];
const FAKE_XHR_KEYS = [
  'readyState',
  'status',
  'statusText',
  'response',
  'responseText',
  'responseURL',
  'getResponseHeader',
  'getAllResponseHeaders',
  'abort',
];

export default defineUnlistedScript(() => {
  let config: Config = { enabled: false, rules: [], disabledGroups: [] };
  let isReady = false;
  let markReady!: () => void;
  const ready = new Promise<void>((resolve) => {
    markReady = () => {
      isReady = true;
      resolve();
    };
    setTimeout(markReady, 500);
  });

  window.addEventListener('message', (event) => {
    if (event.source !== window || event.data?.[TAG] !== 'config') return;
    config = event.data.config;
    markReady();
  });
  window.postMessage({ [TAG]: 'hello' }, '*');

  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!isReady) await ready;
    const request = new Request(input, init);
    return handle(request, findRule(config, request.method, request.url), 'fetch');
  };

  async function handle(
    original: Request,
    rule: Rule | undefined,
    type: LogEntry['type'],
  ): Promise<Response> {
    const started = performance.now();
    const entry: LogEntry = {
      id: crypto.randomUUID(),
      type,
      time: Date.now(),
      method: original.method,
      url: original.url,
      status: 0,
      statusText: '',
      duration: 0,
      credentials: original.credentials,
      ruleId: rule?.id,
      reqHeaders: [],
      resHeaders: [],
    };
    try {
      const request = rule ? await rewriteRequest(original, rule) : original;
      entry.url = request.url;
      entry.reqHeaders = headerList(request.headers);
      entry.reqBody = await readText(request);
      if (rule?.delay) await sleep(rule.delay, request.signal);

      const response = await respond(request, rule);
      entry.status = response.status;
      entry.statusText = response.statusText;
      entry.resHeaders = headerList(response.headers);
      entry.duration = Math.round(performance.now() - started);
      void readText(response).then((body) => emit({ ...entry, resBody: body }));
      return response;
    } catch (error) {
      entry.duration = Math.round(performance.now() - started);
      emit({ ...entry, error: String(error) });
      throw error;
    }
  }

  async function respond(request: Request, rule: Rule | undefined): Promise<Response> {
    switch (rule?.response.mode) {
      case 'error':
        throw new TypeError('Failed to fetch');
      case 'mock': {
        const headers = new Headers();
        if (isJson(rule.response.body)) headers.set('content-type', 'application/json');
        setHeaders(headers, rule.response.headers);
        return buildResponse(rule.response.status || 200, rule.response.body, headers, request.url);
      }
      case 'modify': {
        const real = await nativeFetch(request);
        const headers = new Headers(real.headers);
        setHeaders(headers, rule.response.headers);
        const body = applyBody(await real.text(), rule.response.bodyMode, rule.response.body);
        return buildResponse(rule.response.status || real.status, body, headers, real.url);
      }
      default:
        return nativeFetch(request);
    }
  }

  function emit(entry: LogEntry) {
    window.postMessage({ [TAG]: 'log', entry }, '*');
  }

  interface XhrMeta {
    method: string;
    url: string;
    async: boolean;
    headers: Headers;
  }

  const proto = XMLHttpRequest.prototype;
  const nativeOpen = proto.open;
  const nativeSend = proto.send;
  const nativeSetRequestHeader = proto.setRequestHeader;
  const xhrMeta = new WeakMap<XMLHttpRequest, XhrMeta>();

  proto.open = function (
    this: XMLHttpRequest,
    ...args: [string, string | URL, boolean?, string?, string?]
  ) {
    for (const key of FAKE_XHR_KEYS) Reflect.deleteProperty(this, key);
    const [method, url, async = true] = args;
    xhrMeta.set(this, {
      method: method.toUpperCase(),
      url: absoluteUrl(url),
      async,
      headers: new Headers(),
    });
    return nativeOpen.apply(this, args as [string, string | URL, boolean]);
  };

  proto.setRequestHeader = function (this: XMLHttpRequest, name: string, value: string) {
    try {
      xhrMeta.get(this)?.headers.append(name, value);
    } catch {}
    return nativeSetRequestHeader.call(this, name, value);
  };

  proto.send = function (this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
    const meta = xhrMeta.get(this);
    // Sync XHR can't wait for an async rule engine, so it always goes straight to the network.
    if (!meta?.async) return nativeSend.call(this, body);
    const run = () => {
      const rule = findRule(config, meta.method, meta.url);
      if (rule) void fakeSend(this, meta, rule, body);
      else {
        logNativeXhr(this, meta, body);
        nativeSend.call(this, body);
      }
    };
    if (isReady) run();
    else void ready.then(run);
  };

  function logNativeXhr(xhr: XMLHttpRequest, meta: XhrMeta, body: unknown) {
    const started = performance.now();
    xhr.addEventListener(
      'loadend',
      () => {
        const textual = xhr.responseType === '' || xhr.responseType === 'text';
        emit({
          id: crypto.randomUUID(),
          type: 'xhr',
          time: Date.now(),
          method: meta.method,
          url: meta.url,
          status: xhr.status,
          statusText: xhr.statusText,
          duration: Math.round(performance.now() - started),
          credentials: xhr.withCredentials ? 'include' : 'same-origin',
          reqHeaders: headerList(meta.headers),
          reqBody: typeof body === 'string' ? cap(body) : undefined,
          resHeaders: parseRawHeaders(xhr.getAllResponseHeaders()),
          resBody: textual
            ? cap(xhr.responseText)
            : xhr.responseType === 'json'
              ? cap(JSON.stringify(xhr.response))
              : undefined,
          error: xhr.status === 0 ? 'Network error' : undefined,
        });
      },
      { once: true },
    );
  }

  async function fakeSend(
    xhr: XMLHttpRequest,
    meta: XhrMeta,
    rule: Rule,
    body: Document | XMLHttpRequestBodyInit | null | undefined,
  ) {
    const controller = new AbortController();
    let readyState = 1;
    let status = 0;
    let statusText = '';
    let responseURL = '';
    let responseText = '';
    let response: unknown = '';
    let headers = new Headers();

    Object.defineProperties(xhr, {
      readyState: { get: () => readyState, configurable: true },
      status: { get: () => status, configurable: true },
      statusText: { get: () => statusText, configurable: true },
      responseURL: { get: () => responseURL, configurable: true },
      responseText: { get: () => responseText, configurable: true },
      response: { get: () => response, configurable: true },
      getResponseHeader: {
        value: (name: string) => (readyState >= 2 ? headers.get(name) : null),
        configurable: true,
      },
      getAllResponseHeaders: {
        value: () =>
          readyState >= 2 ? [...headers].map(([k, v]) => `${k}: ${v}\r\n`).join('') : '',
        configurable: true,
      },
      abort: { value: () => controller.abort(), configurable: true },
    });

    const fire = (type: string) =>
      xhr.dispatchEvent(type === 'readystatechange' ? new Event(type) : new ProgressEvent(type));
    const timer =
      xhr.timeout > 0 ? setTimeout(() => controller.abort('timeout'), xhr.timeout) : undefined;

    fire('loadstart');
    try {
      const hasBody = meta.method !== 'GET' && meta.method !== 'HEAD';
      const request = new Request(meta.url, {
        method: meta.method,
        headers: meta.headers,
        body: hasBody
          ? body instanceof Document
            ? new XMLSerializer().serializeToString(body)
            : body
          : undefined,
        credentials: xhr.withCredentials ? 'include' : 'same-origin',
        signal: controller.signal,
      });
      const res = await handle(request, rule, 'xhr');
      status = res.status;
      statusText = res.statusText;
      responseURL = res.url;
      headers = res.headers;
      readyState = 2;
      fire('readystatechange');

      switch (xhr.responseType) {
        case 'json':
          response = await res.json().catch(() => null);
          break;
        case 'blob':
          response = await res.blob();
          break;
        case 'arraybuffer':
          response = await res.arrayBuffer();
          break;
        case 'document':
          response = new DOMParser().parseFromString(await res.text(), 'text/html');
          break;
        default:
          responseText = await res.text();
          response = responseText;
      }
      readyState = 3;
      fire('readystatechange');
      readyState = 4;
      fire('readystatechange');
      fire('load');
    } catch {
      status = 0;
      readyState = 4;
      fire('readystatechange');
      fire(
        controller.signal.reason === 'timeout'
          ? 'timeout'
          : controller.signal.aborted
            ? 'abort'
            : 'error',
      );
    } finally {
      clearTimeout(timer);
      fire('loadend');
    }
  }
});

async function rewriteRequest(req: Request, rule: Rule): Promise<Request> {
  const { url, headers, bodyMode, body } = rule.request;
  if (!url && !headers.length && bodyMode === 'none') return req;

  const nextHeaders = new Headers(req.headers);
  setHeaders(nextHeaders, headers);
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  // Re-buffer instead of passing req.body: Chrome rejects streaming uploads over HTTP/1.1.
  const nextBody = !hasBody
    ? undefined
    : bodyMode === 'none'
      ? await req.clone().arrayBuffer()
      : applyBody(await req.clone().text(), bodyMode, body);

  return new Request(rewriteUrl(rule, req.url), {
    method: req.method,
    headers: nextHeaders,
    body: nextBody,
    mode: req.mode,
    credentials: req.credentials,
    cache: req.cache,
    redirect: req.redirect,
    referrer: req.referrer,
    referrerPolicy: req.referrerPolicy,
    integrity: req.integrity,
    keepalive: req.keepalive,
    signal: req.signal,
  });
}

function buildResponse(status: number, body: string, headers: Headers, url: string): Response {
  const response = new Response(NULL_BODY_STATUS.includes(status) ? null : body, {
    status,
    statusText: STATUS_TEXT[status] ?? '',
    headers,
  });
  Object.defineProperty(response, 'url', { value: url });
  return response;
}

function setHeaders(target: Headers, headers: Header[]) {
  for (const { name, value } of headers) {
    try {
      if (name) target.set(name, value);
    } catch {}
  }
}

function headerList(headers: Headers): Header[] {
  return [...headers].map(([name, value]) => ({ name, value }));
}

function parseRawHeaders(raw: string): Header[] {
  return raw
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const i = line.indexOf(':');
      return { name: line.slice(0, i).trim(), value: line.slice(i + 1).trim() };
    });
}

function absoluteUrl(url: string | URL): string {
  try {
    return new URL(url, location.href).href;
  } catch {
    return String(url);
  }
}

function cap(text: string): string {
  return text.length > BODY_LIMIT ? `${text.slice(0, BODY_LIMIT)}\n…truncated` : text;
}

async function readText(source: Request | Response): Promise<string | undefined> {
  const type = source.headers.get('content-type') ?? '';
  if (type && !TEXTUAL.test(type)) return undefined;
  const reader = source.clone().body?.getReader();
  if (!reader) return undefined;
  const decoder = new TextDecoder();
  let text = '';
  try {
    while (text.length <= BODY_LIMIT) {
      const { done, value } = await reader.read();
      if (done) return text + decoder.decode();
      text += decoder.decode(value, { stream: true });
    }
    void reader.cancel();
    return cap(text);
  } catch {
    return text || undefined;
  }
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}
