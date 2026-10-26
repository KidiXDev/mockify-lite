import type { CompletionContext } from '@codemirror/autocomplete';
import { EditorState, StateEffect } from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  hoverTooltip,
  MatchDecorator,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view';

import { interpolate, type Lookup, MACRO } from './compose';

export interface MacroSource {
  lookup: Lookup;
  options: { label: string; section: string }[];
}

export const refreshMacros = StateEffect.define<null>();

const SCOPE_LABELS: Record<string, string> = {
  env: 'Environment',
  local: 'localStorage',
  session: 'sessionStorage',
  cookie: 'Cookie',
};

function resolve(macro: string, lookup: Lookup) {
  const missing = new Set<string>();
  const value = interpolate(macro, lookup, missing);
  return { value, missing: [...missing] };
}

const truncate = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max)}…` : text;

const okMark = Decoration.mark({ class: 'cm-macro cm-macro-ok' });
const badMark = Decoration.mark({ class: 'cm-macro cm-macro-bad' });

function decorations(get: () => MacroSource) {
  const decorator = new MatchDecorator({
    regexp: new RegExp(MACRO.source, 'g'),
    decoration: (match) => (resolve(match[0], get().lookup).missing.length ? badMark : okMark),
  });
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = decorator.createDeco(view);
      }
      update(update: ViewUpdate) {
        const refresh = update.transactions.some((tr) =>
          tr.effects.some((e) => e.is(refreshMacros)),
        );
        this.decorations = refresh
          ? decorator.createDeco(update.view)
          : decorator.updateDeco(update, this.decorations);
      }
    },
    { decorations: (plugin) => plugin.decorations },
  );
}

function tooltip(get: () => MacroSource) {
  return hoverTooltip((view, pos) => {
    const line = view.state.doc.lineAt(pos);
    for (const match of line.text.matchAll(new RegExp(MACRO.source, 'g'))) {
      const from = line.from + match.index;
      const to = from + match[0].length;
      if (pos < from || pos > to) continue;
      const { value, missing } = resolve(match[0], get().lookup);
      const scope = match[1]!.split('.')[0]!;
      return {
        pos: from,
        end: to,
        above: true,
        create: () => {
          const dom = document.createElement('div');
          dom.className = 'cm-macro-tip';
          const label = dom.appendChild(document.createElement('div'));
          label.className = 'cm-macro-tip-label';
          label.textContent = SCOPE_LABELS[scope] ?? 'Dynamic';
          const body = dom.appendChild(document.createElement('div'));
          body.className = missing.length ? 'cm-macro-tip-bad' : 'cm-macro-tip-value';
          body.textContent = missing.length
            ? `Not found: ${missing.join(', ')}`
            : truncate(value, 300) || 'Empty';
          return { dom };
        },
      };
    }
    return null;
  });
}

function completions(get: () => MacroSource) {
  return (context: CompletionContext) => {
    const before = context.matchBefore(/\{\{\s*[^{}\s]*$/);
    if (!before) return null;
    const closed = context.state.sliceDoc(context.pos, context.pos + 2) === '}}';
    const { lookup, options } = get();
    return {
      from: before.from + before.text.match(/^\{\{\s*/)![0].length,
      validFor: /^[^{}\s]*$/,
      options: options.map(({ label, section }) => ({
        label,
        section,
        detail: truncate(resolve(`{{${label}}}`, lookup).value, 24),
        apply: closed ? label : `${label}}}`,
      })),
    };
  };
}

const theme = EditorView.theme({
  '.cm-macro': { borderRadius: '3px' },
  '.cm-macro-ok': {
    color: 'var(--macro-ok)',
    backgroundColor: 'color-mix(in oklab, var(--macro-ok) 14%, transparent)',
  },
  '.cm-macro-ok *': { color: 'var(--macro-ok)' },
  '.cm-macro-bad': {
    color: 'var(--destructive)',
    backgroundColor: 'color-mix(in oklab, var(--destructive) 14%, transparent)',
  },
  '.cm-macro-bad *': { color: 'var(--destructive)' },
  '.cm-tooltip': {
    backgroundColor: 'var(--popover)',
    color: 'var(--popover-foreground)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgb(0 0 0 / 0.15)',
    overflow: 'hidden',
  },
  '.cm-macro-tip': { maxWidth: '280px', padding: '6px 8px', fontSize: '12px' },
  '.cm-macro-tip-label': { color: 'var(--muted-foreground)', fontSize: '11px' },
  '.cm-macro-tip-value': {
    fontFamily: 'var(--font-mono, ui-monospace, monospace)',
    wordBreak: 'break-all',
  },
  '.cm-macro-tip-bad': { color: 'var(--destructive)', wordBreak: 'break-all' },
  '.cm-tooltip-autocomplete > ul': {
    fontFamily: 'var(--font-mono, ui-monospace, monospace)',
    fontSize: '12px',
  },
  '.cm-tooltip-autocomplete > ul > li': { padding: '3px 8px' },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    backgroundColor: 'var(--accent)',
    color: 'var(--accent-foreground)',
  },
  '.cm-tooltip-autocomplete completion-section': {
    color: 'var(--muted-foreground)',
    fontSize: '11px',
    padding: '4px 8px 2px',
    border: 'none',
  },
  '.cm-completionDetail': {
    color: 'var(--muted-foreground)',
    fontStyle: 'normal',
    marginLeft: '12px',
  },
});

export function macros(get: () => MacroSource) {
  return [
    decorations(get),
    tooltip(get),
    EditorState.languageData.of(() => [{ autocomplete: completions(get) }]),
    theme,
  ];
}
