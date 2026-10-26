import { type Browser, browser } from 'wxt/browser';

import { clone, type Header } from './rules';

export interface PageRequest {
  method: string;
  url: string;
  headers: Header[];
  body?: string;
  credentials: RequestCredentials;
}

export interface PageResponse {
  status: number;
  statusText: string;
  headers: Header[];
  body: string;
  duration: number;
  error?: string;
}

export type WebStorageArea = 'localStorage' | 'sessionStorage';

async function run<A extends unknown[], R>(
  tabId: number,
  func: (...args: A) => R | Promise<R>,
  args: A,
  world: 'ISOLATED' | 'MAIN' = 'ISOLATED',
): Promise<R> {
  // Reactive proxies don't survive executeScript's arg serialization.
  const [frame] = await browser.scripting.executeScript({
    target: { tabId },
    world,
    func,
    args: clone(args),
  });
  return frame?.result as R;
}

// Runs in the page's own world so cookies, origin and CORS match the app's real requests.
export function fetchInPage(tabId: number, request: PageRequest) {
  return run(
    tabId,
    async (req: PageRequest): Promise<PageResponse> => {
      const started = performance.now();
      try {
        const res = await fetch(req.url, {
          method: req.method,
          headers: req.headers
            .filter((h) => h.name)
            .map((h): [string, string] => [h.name, h.value]),
          body: req.body,
          credentials: req.credentials,
        });
        const body = await res.text();
        return {
          status: res.status,
          statusText: res.statusText,
          headers: [...res.headers].map(([name, value]) => ({ name, value })),
          body,
          duration: Math.round(performance.now() - started),
        };
      } catch (error) {
        return {
          status: 0,
          statusText: '',
          headers: [],
          body: '',
          duration: Math.round(performance.now() - started),
          error: String(error),
        };
      }
    },
    [request],
    'MAIN',
  );
}

export function readWebStorage(tabId: number, area: WebStorageArea) {
  return run(
    tabId,
    (a: WebStorageArea) => {
      const store = window[a];
      return Array.from({ length: store.length }, (_, i) => {
        const key = store.key(i) ?? '';
        return { key, value: store.getItem(key) ?? '' };
      });
    },
    [area],
  );
}

export function writeWebStorage(
  tabId: number,
  area: WebStorageArea,
  key: string,
  value: string | null,
) {
  return run(
    tabId,
    (a: WebStorageArea, k: string, v: string | null) => {
      if (v === null) window[a].removeItem(k);
      else window[a].setItem(k, v);
    },
    [area, key, value],
  );
}

export function clearWebStorage(tabId: number, area: WebStorageArea) {
  return run(tabId, (a: WebStorageArea) => window[a].clear(), [area]);
}

function cookieUrl(cookie: Browser.cookies.Cookie) {
  return `${cookie.secure ? 'https' : 'http'}://${cookie.domain.replace(/^\./, '')}${cookie.path}`;
}

export function saveCookie(
  pageUrl: string,
  name: string,
  value: string,
  base?: Browser.cookies.Cookie,
) {
  if (!base)
    return browser.cookies.set({ url: new URL('/', pageUrl).href, name, value, path: '/' });
  return browser.cookies.set({
    url: cookieUrl(base),
    name,
    value,
    domain: base.hostOnly ? undefined : base.domain,
    path: base.path,
    secure: base.secure,
    httpOnly: base.httpOnly,
    sameSite: base.sameSite,
    expirationDate: base.session ? undefined : base.expirationDate,
    storeId: base.storeId,
  });
}

export function removeCookie(cookie: Browser.cookies.Cookie) {
  return browser.cookies.remove({
    url: cookieUrl(cookie),
    name: cookie.name,
    storeId: cookie.storeId,
  });
}
