import { type Header, isObject, type LogEntry, METHODS, type Rule } from './rules';

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

interface HttpRequest {
  method: string;
  url: string;
  headers: Header[];
  body?: string;
  credentials?: RequestCredentials;
}

const bashQuote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

// Matches Chrome DevTools: backslashes for the MS C runtime, then carets for cmd.exe.
const cmdQuote = (s: string) =>
  `^"${s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/[^\w\s\-:=+~'/.,?;()*`]/g, '^$&')
    .replace(/%(?=\w)/g, '%^')
    .replace(/\r?\n/g, '^\n\n')}^"`;

const psQuote = (s: string) => `"${s.replace(/[`$"]/g, '`$&')}"`;

export function toCurl(req: HttpRequest, shell: 'bash' | 'cmd' = 'bash'): string {
  const quote = shell === 'bash' ? bashQuote : cmdQuote;
  const parts = [`curl ${quote(req.url)}`];
  if (req.method !== 'GET') parts.push(`-X ${req.method}`);
  for (const h of req.headers) parts.push(`-H ${quote(`${h.name}: ${h.value}`)}`);
  if (req.body) parts.push(`--data-raw ${quote(req.body)}`);
  return parts.join(shell === 'bash' ? ' \\\n  ' : ' ^\n  ');
}

export function toPowerShell(req: HttpRequest): string {
  const contentType = req.headers.find((h) => h.name.toLowerCase() === 'content-type');
  const headers = req.headers.filter((h) => h !== contentType);
  const parts = [`Invoke-WebRequest -UseBasicParsing -Uri ${psQuote(req.url)}`];
  if (req.method !== 'GET') parts.push(`-Method ${psQuote(req.method)}`);
  if (headers.length) {
    const lines = headers.map((h) => `  ${psQuote(h.name)}=${psQuote(h.value)}`);
    parts.push(`-Headers @{\n${lines.join('\n')}\n}`);
  }
  if (contentType) parts.push(`-ContentType ${psQuote(contentType.value)}`);
  if (req.body) parts.push(`-Body ${psQuote(req.body)}`);
  return parts.join(' `\n');
}

export function toFetch(req: HttpRequest, node = false): string {
  const init: Record<string, unknown> = {
    method: req.method,
    headers: Object.fromEntries(req.headers.map((h) => [h.name, h.value])),
  };
  if (req.body) init.body = req.body;
  if (!node && req.credentials) init.credentials = req.credentials;
  return `fetch(${JSON.stringify(req.url)}, ${JSON.stringify(init, null, 2)});`;
}

const requestOf = (e: LogEntry): HttpRequest => ({
  method: e.method,
  url: e.url,
  headers: e.reqHeaders,
  body: e.reqBody,
  credentials: e.credentials,
});

const headerLines = (headers: Header[]) => headers.map((h) => `${h.name}: ${h.value}`).join('\n');

export const COPY_MENU: { label: string; text: (entry: LogEntry) => string | undefined }[][] = [
  [{ label: 'URL', text: (e) => e.url }],
  [
    { label: 'cURL (bash)', text: (e) => toCurl(requestOf(e)) },
    { label: 'cURL (cmd)', text: (e) => toCurl(requestOf(e), 'cmd') },
    { label: 'PowerShell', text: (e) => toPowerShell(requestOf(e)) },
    { label: 'fetch', text: (e) => toFetch(requestOf(e)) },
    { label: 'fetch (Node.js)', text: (e) => toFetch(requestOf(e), true) },
  ],
  [
    { label: 'Response', text: (e) => e.resBody },
    { label: 'Request headers', text: (e) => headerLines(e.reqHeaders) },
    { label: 'Response headers', text: (e) => headerLines(e.resHeaders) },
  ],
];

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

export function formatTime(time: number): string {
  return new Date(time).toLocaleTimeString([], { hour12: false });
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
