<script setup lang="ts">
import { json } from '@codemirror/lang-json';
import { syntaxHighlighting } from '@codemirror/language';
import { Compartment, EditorState } from '@codemirror/state';
import { oneDarkHighlightStyle } from '@codemirror/theme-one-dark';
import { EditorView, placeholder as placeholderExt } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { computed, onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue';

import { Button } from '@/components/ui/button';
import { useTheme } from '@/composables/useTheme';
import { formatJson, isJson } from '@/lib/format';

const {
  readonly = false,
  placeholder = '',
  strict = true,
} = defineProps<{ readonly?: boolean; placeholder?: string; strict?: boolean }>();
const model = defineModel<string>({ required: true });

const { isDark } = useTheme();
const el = useTemplateRef('el');
const highlight = new Compartment();
let view: EditorView | undefined;

const invalid = computed(() => model.value.trim() !== '' && !isJson(model.value));
const canFormat = computed(() => model.value.trim() !== '' && !invalid.value);

const theme = EditorView.theme({
  '&': { fontSize: '12px', backgroundColor: 'transparent', maxHeight: '320px' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--font-mono, ui-monospace, monospace)', lineHeight: '1.5' },
  '.cm-content': { caretColor: 'var(--foreground)', minHeight: '88px' },
  '.cm-cursor': { borderLeftColor: 'var(--foreground)' },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    color: 'var(--muted-foreground)',
    border: 'none',
  },
  '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'transparent' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'color-mix(in oklab, var(--ring) 35%, transparent) !important',
  },
  '.cm-placeholder': { color: 'var(--muted-foreground)' },
});

onMounted(() => {
  view = new EditorView({
    parent: el.value!,
    state: EditorState.create({
      doc: model.value,
      extensions: [
        basicSetup,
        json(),
        theme,
        EditorView.lineWrapping,
        EditorState.readOnly.of(readonly),
        placeholderExt(placeholder),
        highlight.of(isDark.value ? syntaxHighlighting(oneDarkHighlightStyle) : []),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) model.value = update.state.doc.toString();
        }),
      ],
    }),
  });
});

onBeforeUnmount(() => view?.destroy());

watch(model, (value) => {
  if (view && value !== view.state.doc.toString()) {
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
  }
});

watch(isDark, (dark) => {
  view?.dispatch({
    effects: highlight.reconfigure(dark ? syntaxHighlighting(oneDarkHighlightStyle) : []),
  });
});
</script>

<template>
  <div class="bg-background dark:bg-input/30 overflow-hidden rounded-md border">
    <div ref="el" />
    <div v-if="!readonly" class="flex h-7 items-center justify-between border-t px-2 text-xs">
      <span class="text-amber-600 dark:text-amber-400">{{
        strict && invalid ? 'Not JSON' : ''
      }}</span>
      <Button variant="ghost" size="xs" :disabled="!canFormat" @click="model = formatJson(model)">
        Format
      </Button>
    </div>
  </div>
</template>
