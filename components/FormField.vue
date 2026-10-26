<script setup lang="ts">
import { useId } from 'vue';

const { label } = defineProps<{ label: string }>();
const id = useId();
</script>

<template>
  <div class="space-y-1.5">
    <div class="flex min-h-5 items-center justify-between gap-2">
      <label :for="id" class="text-muted-foreground text-xs font-medium">{{ label }}</label>
      <slot name="aside" />
    </div>
    <slot :id="id" />
  </div>
</template>
