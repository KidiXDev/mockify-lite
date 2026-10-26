<script setup lang="ts">
import { PlusIcon, XIcon } from '@lucide/vue';

import MacroInput from '@/components/MacroInput.vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { MacroSource } from '@/lib/macro-editor';
import type { Header } from '@/lib/rules';

const { noun = 'Header', macros } = defineProps<{ noun?: string; macros?: MacroSource }>();
const headers = defineModel<Header[]>({ required: true });

function update(index: number, patch: Partial<Header>) {
  headers.value = headers.value.map((h, i) => (i === index ? { ...h, ...patch } : h));
}
</script>

<template>
  <div class="space-y-1.5">
    <div v-for="(header, i) in headers" :key="i" class="flex gap-1.5">
      <Input
        :model-value="header.name"
        placeholder="Name"
        :aria-label="`${noun} name`"
        class="h-8 min-w-0 flex-2 font-mono text-xs"
        @update:model-value="update(i, { name: String($event) })"
      />
      <MacroInput
        v-if="macros"
        :model-value="header.value"
        :source="macros"
        placeholder="Value"
        :label="`${noun} value`"
        class="flex-3"
        @update:model-value="update(i, { value: $event })"
      />
      <Input
        v-else
        :model-value="header.value"
        placeholder="Value"
        :aria-label="`${noun} value`"
        class="h-8 min-w-0 flex-3 font-mono text-xs"
        @update:model-value="update(i, { value: String($event) })"
      />
      <Button
        variant="ghost"
        size="icon-sm"
        :aria-label="`Remove ${noun.toLowerCase()}`"
        @click="headers = headers.filter((_, j) => j !== i)"
      >
        <XIcon />
      </Button>
    </div>
    <Button
      variant="ghost"
      size="xs"
      class="text-muted-foreground"
      @click="headers = [...headers, { name: '', value: '' }]"
    >
      <PlusIcon /> {{ noun }}
    </Button>
  </div>
</template>
