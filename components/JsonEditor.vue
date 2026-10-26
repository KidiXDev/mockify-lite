<script setup lang="ts">
import { json } from '@codemirror/lang-json';
import { syntaxHighlighting } from '@codemirror/language';
import { Compartment, EditorState } from '@codemirror/state';
import { oneDarkHighlightStyle } from '@codemirror/theme-one-dark';
import { EditorView, placeholder as placeholderExt } from '@codemirror/view';
import { CopyIcon } from '@lucide/vue';
import { useClipboard } from '@vueuse/core';
import { basicSetup } from 'codemirror';
import { computed, onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue';
import { toast } from 'vue-sonner';

import { Button } from '@/components/ui/button';
import { useTheme } from '@/composables/useTheme';
import { MACRO } from '@/lib/compose';
import { formatJson, isJson } from '@/lib/format';
import { type MacroSource, macros as macroExtensions, refreshMacros } from '@/lib/macro-editor';

const {
  readonly = false,
  placeholder = '',
  strict = true,
  macros,
} = defineProps<{
  readonly?: boolean;
  placeholder?: string;
  strict?: boolean;
  macros?: MacroSource;
}>();
const model = defineModel<string>({ required: true });

const { isDark } = useTheme();
const { copy } = useClipboard({ legacy: true });
const el = useTemplateRef('el');
const highlight = new Compartment();
let view: EditorView | undefined;

// Macros stand in for any JSON value, so a placeholder number keeps the check meaningful.
const invalid = computed(
  () =>
    model.value.trim() !== '' && !isJson(macros ? model.value.replace(MACRO, '0') : model.value),
);
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
        macros ? macroExtensions(() => macros) : [],
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

async function copyAll() {
  await copy(model.value);
  toast.success('Copied');
}

watch(
  () => macros,
  () => view?.dispatch({ effects: refreshMacros.of(null) }),
);

watch(isDark, (dark) => {
  view?.dispatch({
    effects: highlight.reconfigure(dark ? syntaxHighlighting(oneDarkHighlightStyle) : []),
  });
});
</script>

<template>
  <div class="bg-background dark:bg-input/30 group relative overflow-hidden rounded-md border">
    <div ref="el" />
    <Button
      v-if="readonly && model"
      variant="outline"
      size="icon-xs"
      aria-label="Copy"
      class="absolute top-1.5 right-1.5 z-10 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
      @click="copyAll"
    >
      <CopyIcon />
    </Button>
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
