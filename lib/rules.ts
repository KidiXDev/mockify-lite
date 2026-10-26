export const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;
export const MATCH_TYPES = ['contains', 'wildcard', 'regex'] as const;
export const RESPONSE_MODES = ['passthrough', 'mock', 'modify', 'error'] as const;

export type HttpMethod = (typeof METHODS)[number];
export type MatchType = (typeof MATCH_TYPES)[number];
export type ResponseMode = (typeof RESPONSE_MODES)[number];
export type BodyMode = 'none' | 'replace' | 'merge';

export interface Header {
  name: string;
  value: string;
}

export interface Rule {
  id: string;
  name: string;
  enabled: boolean;
  group: string;
  url: string;
  matchType: MatchType;
  method: 'ANY' | HttpMethod;
  delay: number;
  request: {
    url: string;
    headers: Header[];
    bodyMode: BodyMode;
    body: string;
  };
  response: {
    mode: ResponseMode;
    status: number;
    headers: Header[];
    bodyMode: BodyMode;
    body: string;
  };
}

export interface Settings {
  enabled: boolean;
  sites: string[];
  disabledGroups: string[];
  theme: 'auto' | 'light' | 'dark';
}

export interface Config {
  enabled: boolean;
  rules: Rule[];
  disabledGroups: string[];
}

export interface LogEntry {
  id: string;
  type: 'fetch' | 'xhr';
  time: number;
  method: string;
  url: string;
  status: number;
  statusText: string;
  duration: number;
  credentials?: RequestCredentials;
  ruleId?: string;
  error?: string;
  reqHeaders: Header[];
  reqBody?: string;
  resHeaders: Header[];
  resBody?: string;
}

type RuleInit = Partial<Omit<Rule, 'request' | 'response'>> & {
  request?: Partial<Rule['request']>;
  response?: Partial<Rule['response']>;
};

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const str = (value: unknown, fallback = '') => (typeof value === 'string' ? value : fallback);

function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

function int(value: unknown, fallback: number, min: number, max: number) {
  return Number.isInteger(value) ? Math.min(max, Math.max(min, value as number)) : fallback;
}

const BODY_MODES: readonly BodyMode[] = ['none', 'replace', 'merge'];

function headers(value: unknown): Header[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (h): h is Header => isObject(h) && typeof h.name === 'string' && typeof h.value === 'string',
    )
    .map(({ name, value }) => ({ name, value }));
}

export function normalizeRule(input: unknown): Rule | null {
  if (!isObject(input) || typeof input.url !== 'string') return null;
  const req = isObject(input.request) ? input.request : {};
  const res = isObject(input.response) ? input.response : {};
  const status = int(res.status, 200, 0, 599);
  return {
    id: crypto.randomUUID(),
    name: str(input.name),
    enabled: input.enabled !== false,
    group: str(input.group).trim(),
    url: input.url,
    matchType: oneOf(input.matchType, MATCH_TYPES, 'contains'),
    method: oneOf(input.method, ['ANY', ...METHODS], 'ANY'),
    delay: int(input.delay, 0, 0, 600_000),
    request: {
      url: str(req.url),
      headers: headers(req.headers),
      bodyMode: oneOf(req.bodyMode, BODY_MODES, 'none'),
      body: str(req.body),
    },
    response: {
      mode: oneOf(res.mode, RESPONSE_MODES, 'mock'),
      status: status > 0 && status < 200 ? 200 : status,
      headers: headers(res.headers),
      bodyMode: oneOf(res.bodyMode, BODY_MODES, 'replace'),
      body: str(res.body, '{}'),
    },
  };
}

export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export function newRule(init: RuleInit = {}): Rule {
  return normalizeRule({ url: '', ...init })!;
}

const escapeRe = (s: string) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

function toRegExp(pattern: string, type: MatchType): RegExp | null {
  try {
    if (type === 'regex') return new RegExp(pattern);
    return new RegExp(`^${pattern.split('*').map(escapeRe).join('.*')}$`);
  } catch {
    return null;
  }
}

export function urlMatches(pattern: string, type: MatchType, url: string): boolean {
  if (!pattern) return false;
  if (type === 'contains') return url.includes(pattern);
  return toRegExp(pattern, type)?.test(url) ?? false;
}

export function findRule(config: Config, method: string, url: string): Rule | undefined {
  if (!config.enabled) return undefined;
  const m = method.toUpperCase();
  return config.rules.find(
    (r) =>
      r.enabled &&
      !config.disabledGroups.includes(r.group) &&
      (r.method === 'ANY' || r.method === m) &&
      urlMatches(r.url, r.matchType, url),
  );
}

export function rewriteUrl(rule: Rule, url: string): string {
  const target = rule.request.url;
  if (!target) return url;
  if (rule.matchType === 'contains') return url.replace(rule.url, () => target);
  if (rule.matchType === 'regex') return url.replace(toRegExp(rule.url, 'regex')!, target);
  return target;
}

export function mergePatch(target: unknown, patch: unknown): unknown {
  if (!isObject(patch)) return patch;
  const out: Record<string, unknown> = isObject(target) ? { ...target } : {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete out[key];
    else out[key] = mergePatch(out[key], value);
  }
  return out;
}

export function applyBody(original: string, mode: BodyMode, body: string): string {
  if (mode === 'none') return original;
  if (mode === 'replace') return body;
  try {
    return JSON.stringify(mergePatch(JSON.parse(original), JSON.parse(body)));
  } catch {
    return original;
  }
}

export function hostOf(url: string | undefined): string {
  try {
    const u = new URL(url ?? '');
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.hostname : '';
  } catch {
    return '';
  }
}

export function isValidSite(site: string): boolean {
  return /^(\*\.)?[a-z0-9-]+(\.[a-z0-9-]+)*$/i.test(site);
}

export function siteMatches(site: string, host: string): boolean {
  if (!site.startsWith('*.')) return site === host;
  const domain = site.slice(2);
  return host === domain || host.endsWith(`.${domain}`);
}
