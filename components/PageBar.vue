<script setup lang="ts">
import { ArrowLeftIcon } from '@lucide/vue';

import { Button } from '@/components/ui/button';

const { title, back } = defineProps<{ title?: string; back?: string }>();
</script>

<template>
  <div
    class="bg-background/95 sticky top-0 z-10 flex h-11 items-center gap-1.5 border-b px-3 backdrop-blur"
  >
    <Button v-if="back" variant="ghost" size="icon-sm" class="-ml-1.5" as-child>
      <RouterLink :to="back" aria-label="Back"><ArrowLeftIcon /></RouterLink>
    </Button>
    <div class="flex min-w-0 flex-1 items-center gap-2">
      <slot>
        <h1 class="truncate font-medium">{{ title }}</h1>
      </slot>
    </div>
    <div class="flex shrink-0 items-center gap-1">
      <slot name="actions" />
    </div>
  </div>
</template>
