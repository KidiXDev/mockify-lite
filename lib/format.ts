import { type Header, isObject, METHODS, type Rule } from './rules';

export const METHOD_OPTIONS = ['ANY', ...METHODS] as const;

export const STATUS_TEXT: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  204: 'No Content',
  301: 'Moved Permanently',
  302: 'Found',
  304: 'Not Modified',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  410: 'Gone',
  413: 'Payload Too Large',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

export function formatJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

export function isJson(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

const shellQuote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

export function toCurl(req: {
  method: string;
  url: string;
  headers: Header[];
  body?: string;
}): string {
  const parts = ['curl', shellQuote(req.url)];
  if (req.method !== 'GET') parts.push('-X', req.method);
  for (const h of req.headers) parts.push('-H', shellQuote(`${h.name}: ${h.value}`));
  if (req.body) parts.push('--data-raw', shellQuote(req.body));
  return parts.join(' ');
}

function decodeSegment(segment: string): unknown {
  const binary = atob(segment.replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0))));
}

export function decodeJwt(token: string) {
  const match = token.trim().match(/^(?:Bearer\s+)?([\w-]+)\.([\w-]+)\.[\w-]*$/);
  if (!match) return null;
  try {
    const header = decodeSegment(match[1]!);
    const payload = decodeSegment(match[2]!);
    if (!isObject(header) || !isObject(payload)) return null;
    const exp = typeof payload.exp === 'number' ? payload.exp * 1000 : undefined;
    return { header, payload, exp };
  } catch {
    return null;
  }
}

export function methodClass(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':
      return 'text-emerald-600 dark:text-emerald-400';
    case 'POST':
      return 'text-sky-600 dark:text-sky-400';
    case 'PUT':
    case 'PATCH':
      return 'text-amber-600 dark:text-amber-400';
    case 'DELETE':
      return 'text-red-600 dark:text-red-400';
    default:
      return 'text-muted-foreground';
  }
}

export function statusClass(status: number): string {
  if (status === 0 || status >= 500) return 'text-red-600 dark:text-red-400';
  if (status >= 400) return 'text-amber-600 dark:text-amber-400';
  if (status >= 300) return 'text-sky-600 dark:text-sky-400';
  return 'text-emerald-600 dark:text-emerald-400';
}

export function formatMs(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${+(ms / 1000).toFixed(1)}s`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${+(bytes / 1024).toFixed(1)} KB`;
  return `${+(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ruleSummary(rule: Rule): string {
  const { mode, status } = rule.response;
  const request = rule.request;
  const parts: string[] = [];
  if (mode === 'mock') parts.push(`Mock ${status || 200}`);
  else if (mode === 'modify') parts.push(status ? `Modify → ${status}` : 'Modify');
  else if (mode === 'error') parts.push('Network error');
  if (request.url || request.headers.length || request.bodyMode !== 'none')
    parts.push('Edit request');
  if (rule.delay) parts.push(`+${formatMs(rule.delay)}`);
  return parts.join(' · ') || 'No changes';
}
