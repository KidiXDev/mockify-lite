<script setup lang="ts">
import { autocompletion, completionStatus } from '@codemirror/autocomplete';
import { ChangeSet, EditorState, Prec } from '@codemirror/state';
import { EditorView, keymap, placeholder as placeholderExt } from '@codemirror/view';
import { minimalSetup } from 'codemirror';
import { onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue';

import { type MacroSource, macros, refreshMacros } from '@/lib/macro-editor';

const {
  source,
  placeholder = '',
  label,
  invalid = false,
} = defineProps<{ source: MacroSource; placeholder?: string; label?: string; invalid?: boolean }>();
const model = defineModel<string>({ required: true });
const emit = defineEmits<{ submit: [] }>();

const el = useTemplateRef('el');
let view: EditorView | undefined;

// Pasted newlines are stripped instead of rejecting the whole paste.
const singleLine = EditorState.transactionFilter.of((tr) => {
  if (!tr.docChanged || tr.newDoc.lines === 1) return tr;
  const specs: { from: number; to: number; insert: string }[] = [];
  tr.changes.iterChanges((from, to, _fromB, _toB, inserted) =>
    specs.push({ from, to, insert: inserted.toString().replace(/[\r\n]+/g, '') }),
  );
  const changes = ChangeSet.of(specs, tr.startState.doc.length);
  return { changes, selection: tr.startState.selection.map(changes, 1) };
});

const theme = EditorView.theme({
  '&': { fontSize: '12px', height: '100%', backgroundColor: 'transparent' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    fontFamily: 'var(--font-mono, ui-monospace, monospace)',
    lineHeight: '30px',
    overflowY: 'hidden',
    scrollbarWidth: 'none',
  },
  '.cm-content': { padding: '0', caretColor: 'var(--foreground)' },
  '.cm-line': { padding: '0' },
  '.cm-cursor': { borderLeftColor: 'var(--foreground)' },
  '.cm-placeholder': { color: 'var(--muted-foreground)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'color-mix(in oklab, var(--ring) 35%, transparent) !important',
  },
});

onMounted(() => {
  view = new EditorView({
    parent: el.value!,
    state: EditorState.create({
      doc: model.value,
      extensions: [
        Prec.highest(
          keymap.of([
            {
              key: 'Enter',
              run: (v) => {
                if (completionStatus(v.state) === 'active') return false;
                emit('submit');
                return true;
              },
            },
          ]),
        ),
        minimalSetup,
        autocompletion({ icons: false }),
        singleLine,
        theme,
        placeholderExt(placeholder),
        label ? EditorView.contentAttributes.of({ 'aria-label': label }) : [],
        macros(() => source),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) model.value = update.state.doc.toString();
        }),
      ],
    }),
  });
});

onBeforeUnmount(() => view?.destroy());

function focus() {
  view?.focus();
}

watch(model, (value) => {
  if (view && value !== view.state.doc.toString()) {
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
  }
});

watch(
  () => source,
  () => view?.dispatch({ effects: refreshMacros.of(null) }),
);
</script>

<template>
  <div
    ref="el"
    :aria-invalid="invalid || undefined"
    class="border-input dark:bg-input/30 focus-within:border-ring focus-within:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 h-8 min-w-0 cursor-text rounded-md border bg-transparent px-3 shadow-xs transition-[color,box-shadow] focus-within:ring-3"
    @mousedown.self.prevent="focus"
  />
</template>
