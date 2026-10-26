<script setup lang="ts">
import { PlusIcon, XIcon } from '@lucide/vue';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Header } from '@/lib/rules';

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
        aria-label="Header name"
        class="h-8 min-w-0 flex-2 font-mono text-xs"
        @update:model-value="update(i, { name: String($event) })"
      />
      <Input
        :model-value="header.value"
        placeholder="Value"
        aria-label="Header value"
        class="h-8 min-w-0 flex-3 font-mono text-xs"
        @update:model-value="update(i, { value: String($event) })"
      />
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Remove header"
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
      <PlusIcon /> Header
    </Button>
  </div>
</template>
