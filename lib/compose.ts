import type { Header } from './rules';

export interface SavedRequest {
  id: string;
  name: string;
  collection: string;
  method: string;
  url: string;
  headers: Header[];
  body: string;
  withCookies: boolean;
}

export interface Environment {
  id: string;
  name: string;
  vars: Header[];
}

export interface Workspace {
  requests: SavedRequest[];
  environments: Environment[];
  activeEnv: string;
}

export type Lookup = (scope: string, key: string) => string | undefined;

export const MACRO = /\{\{\s*([^{}]+?)\s*\}\}/g;

function replaceOnce(text: string, lookup: Lookup, missing?: Set<string>) {
  return text.replace(MACRO, (match, expr: string) => {
    const dot = expr.indexOf('.');
    const value = dot === -1 ? lookup(expr, '') : lookup(expr.slice(0, dot), expr.slice(dot + 1));
    if (value === undefined) missing?.add(match);
    return value ?? match;
  });
}

// The second pass resolves macros inside values, e.g. an env var set to {{local.token}}.
export function interpolate(text: string, lookup: Lookup, missing?: Set<string>): string {
  return replaceOnce(replaceOnce(text, lookup), lookup, missing);
}

export const isFullUrl = (url: string) => /^https?:\/\/[^/\s]/i.test(url.trim());
