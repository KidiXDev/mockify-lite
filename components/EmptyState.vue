<script setup lang="ts">
import type { Component } from 'vue';

const { icon, title } = defineProps<{ icon: Component; title: string }>();
</script>

<template>
  <div class="flex flex-col items-center gap-3 px-6 py-16 text-center">
    <div class="bg-muted flex size-10 items-center justify-center rounded-full">
      <component :is="icon" class="text-muted-foreground size-5" />
    </div>
    <p class="text-muted-foreground">{{ title }}</p>
    <slot />
  </div>
</template>
