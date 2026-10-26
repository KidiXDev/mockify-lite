/// <reference types="bun-types/test" />
import { expect, test } from 'bun:test';

import { interpolate, isFullUrl } from './compose';
import { decodeJwt, toCurl, toFetch, toPowerShell } from './format';
import {
  applyBody,
  type Config,
  findRule,
  isValidSite,
  mergePatch,
  newRule,
  normalizeRule,
  rewriteUrl,
  siteMatches,
  urlMatches,
} from './rules';

test('urlMatches', () => {
  const url = 'https://api.app.com/v1/users/42?x=1';
  expect(urlMatches('/users/42', 'contains', url)).toBe(true);
  expect(urlMatches('/orders', 'contains', url)).toBe(false);
  expect(urlMatches('', 'contains', url)).toBe(false);
  expect(urlMatches('*/users/*', 'wildcard', url)).toBe(true);
  expect(urlMatches('*/users', 'wildcard', url)).toBe(false);
  expect(urlMatches('https://api.app.com/v1/users/42?x=1', 'wildcard', url)).toBe(true);
  expect(urlMatches('/users/\\d+', 'regex', url)).toBe(true);
  expect(urlMatches('/users/(', 'regex', url)).toBe(false);
});

test('findRule', () => {
  const a = newRule({ url: '/users', method: 'POST' });
  const b = newRule({ url: '/users', group: 'Errors' });
  const c = newRule({ url: '/users' });
  const config: Config = { enabled: true, rules: [a, b, c], disabledGroups: [] };
  expect(findRule(config, 'post', '/api/users')).toBe(a);
  expect(findRule(config, 'GET', '/api/users')).toBe(b);
  expect(findRule({ ...config, disabledGroups: ['Errors'] }, 'GET', '/api/users')).toBe(c);
  expect(findRule({ ...config, enabled: false }, 'GET', '/api/users')).toBeUndefined();
  c.enabled = false;
  expect(findRule({ ...config, disabledGroups: ['Errors'] }, 'GET', '/api/users')).toBeUndefined();
});

test('rewriteUrl', () => {
  const url = 'https://api.prod.com/v1/users/42';
  expect(
    rewriteUrl(newRule({ url: 'api.prod.com', request: { url: 'api.staging.com' } }), url),
  ).toBe('https://api.staging.com/v1/users/42');
  expect(rewriteUrl(newRule({ url: 'prod', request: { url: '$&-x' } }), url)).toBe(
    'https://api.$&-x.com/v1/users/42',
  );
  expect(
    rewriteUrl(
      newRule({ url: 'users/(\\d+)', matchType: 'regex', request: { url: 'people/$1' } }),
      url,
    ),
  ).toBe('https://api.prod.com/v1/people/42');
  expect(
    rewriteUrl(
      newRule({ url: '*', matchType: 'wildcard', request: { url: 'http://localhost/x' } }),
      url,
    ),
  ).toBe('http://localhost/x');
  expect(rewriteUrl(newRule({ url: 'prod' }), url)).toBe(url);
});

test('mergePatch and applyBody', () => {
  expect(mergePatch({ a: 1, b: { c: 2, d: 3 }, e: [1] }, { a: null, b: { c: 9 }, e: [2] })).toEqual(
    {
      b: { c: 9, d: 3 },
      e: [2],
    },
  );
  expect(mergePatch({ a: 1 }, [1])).toEqual([1]);
  expect(applyBody('{"status":"ok","n":1}', 'merge', '{"status":"pending"}')).toBe(
    '{"status":"pending","n":1}',
  );
  expect(applyBody('not json', 'merge', '{"a":1}')).toBe('not json');
  expect(applyBody('{"a":1}', 'merge', 'bad')).toBe('{"a":1}');
  expect(applyBody('anything', 'replace', 'new')).toBe('new');
  expect(applyBody('keep', 'none', 'new')).toBe('keep');
});

test('normalizeRule', () => {
  expect(normalizeRule(null)).toBeNull();
  expect(normalizeRule({ name: 'no url' })).toBeNull();
  const rule = normalizeRule({
    url: '/x',
    method: 'BREW',
    delay: -5,
    response: {
      status: 99,
      headers: [{ name: 'a', value: 'b' }, { name: 1 }, 'junk'],
      mode: 'nope',
    },
  })!;
  expect(rule.method).toBe('ANY');
  expect(rule.delay).toBe(0);
  expect(rule.response.status).toBe(200);
  expect(normalizeRule({ url: '', response: { status: 0 } })!.response.status).toBe(0);
  expect(rule.response.mode).toBe('mock');
  expect(rule.response.headers).toEqual([{ name: 'a', value: 'b' }]);
  expect(rule.request.bodyMode).toBe('none');
});

test('copy formats', () => {
  const req = {
    method: 'POST',
    url: 'https://x.com/a?q=1&b=%20',
    headers: [
      { name: 'Content-Type', value: 'application/json' },
      { name: 'X-Price', value: '$5' },
    ],
    body: `{"name":"O'Brien"}`,
    credentials: 'include' as const,
  };
  expect(toCurl(req)).toBe(
    [
      `curl 'https://x.com/a?q=1&b=%20'`,
      `-X POST`,
      `-H 'Content-Type: application/json'`,
      `-H 'X-Price: $5'`,
      `--data-raw '{"name":"O'\\''Brien"}'`,
    ].join(' \\\n  '),
  );
  expect(toCurl({ method: 'GET', url: 'https://x.com', headers: [] })).toBe(`curl 'https://x.com'`);
  expect(toCurl(req, 'cmd')).toBe(
    [
      `curl ^"https://x.com/a?q=1^&b=^%^20^"`,
      `-X POST`,
      `-H ^"Content-Type: application/json^"`,
      `-H ^"X-Price: ^$5^"`,
      `--data-raw ^"^{^\\^"name^\\^":^\\^"O'Brien^\\^"^}^"`,
    ].join(' ^\n  '),
  );
  expect(toPowerShell(req)).toBe(
    [
      `Invoke-WebRequest -UseBasicParsing -Uri "https://x.com/a?q=1&b=%20"`,
      `-Method "POST"`,
      `-Headers @{\n  "X-Price"="\`$5"\n}`,
      `-ContentType "application/json"`,
      `-Body "{\`"name\`":\`"O'Brien\`"}"`,
    ].join(' `\n'),
  );
  const fetchInit = (code: string) => JSON.parse(code.slice(code.indexOf(', ') + 2, -2));
  expect(fetchInit(toFetch(req))).toEqual({
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Price': '$5' },
    body: req.body,
    credentials: 'include',
  });
  expect(fetchInit(toFetch(req, true)).credentials).toBeUndefined();
});

test('decodeJwt', () => {
  const b64 = (o: object) =>
    btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const token = `${b64({ alg: 'HS256' })}.${b64({ sub: 'ñ', exp: 1700000000 })}.sig`;
  const jwt = decodeJwt(`Bearer ${token}`)!;
  expect(jwt.header).toEqual({ alg: 'HS256' });
  expect(jwt.exp).toBe(1700000000000);
  expect(decodeJwt('abc')).toBeNull();
  expect(decodeJwt('a.b.c')).toBeNull();
});

test('sites', () => {
  expect(isValidSite('localhost')).toBe(true);
  expect(isValidSite('*.staging.app.com')).toBe(true);
  expect(isValidSite('localhost:5173')).toBe(false);
  expect(isValidSite('https://app.com')).toBe(false);
  expect(isValidSite('a.*.com')).toBe(false);
  expect(siteMatches('localhost', 'localhost')).toBe(true);
  expect(siteMatches('*.app.com', 'x.app.com')).toBe(true);
  expect(siteMatches('*.app.com', 'app.com')).toBe(true);
  expect(siteMatches('*.app.com', 'evilapp.com')).toBe(false);
});

test('interpolate', () => {
  const vars: Record<string, Record<string, string>> = {
    env: { BASE_URL: 'https://api.app.com', TOKEN: '{{local.auth.token}}' },
    local: { 'auth.token': 'abc$&' },
  };
  const lookup = (scope: string, key: string) =>
    Object.hasOwn(vars, scope) && Object.hasOwn(vars[scope]!, key) ? vars[scope]![key] : undefined;
  const missing = new Set<string>();
  expect(interpolate('{{env.BASE_URL}}/users', lookup)).toBe('https://api.app.com/users');
  expect(interpolate('Bearer {{ env.TOKEN }}', lookup)).toBe('Bearer abc$&');
  expect(interpolate('{{cookie.sid}} {{env.constructor}}', lookup, missing)).toBe(
    '{{cookie.sid}} {{env.constructor}}',
  );
  expect([...missing]).toEqual(['{{cookie.sid}}', '{{env.constructor}}']);
  expect(isFullUrl('https://api.app.com/x')).toBe(true);
  expect(isFullUrl('/api/x')).toBe(false);
  expect(isFullUrl('localhost:8000/x')).toBe(false);
});
