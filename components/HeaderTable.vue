<script setup lang="ts">
import type { Header } from '@/lib/rules';

const { headers } = defineProps<{ headers: Header[] }>();
</script>

<template>
  <dl v-if="headers.length" class="divide-y rounded-md border font-mono text-xs">
    <div
      v-for="(header, i) in headers"
      :key="i"
      class="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 px-2.5 py-1.5"
    >
      <dt class="text-muted-foreground truncate" :title="header.name">{{ header.name }}</dt>
      <dd class="break-all">{{ header.value }}</dd>
    </div>
  </dl>
  <p v-else class="text-muted-foreground text-xs">None</p>
</template>
