<script setup lang="ts">
import { ActivityIcon, PlugZapIcon, SearchIcon, Trash2Icon, WandSparklesIcon } from '@lucide/vue';
import { computed, shallowRef } from 'vue';

import EmptyState from '@/components/EmptyState.vue';
import PageBar from '@/components/PageBar.vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useActiveTab } from '@/composables/useActiveTab';
import { formatMs, methodClass, statusClass } from '@/lib/format';
import { useLogStore } from '@/stores/log';

const log = useLogStore();
const { host } = useActiveTab();
const query = shallowRef('');

const rows = computed(() => {
  const q = query.value.trim().toLowerCase();
  return log.entries
    .filter(
      (e) =>
        !q ||
        e.url.toLowerCase().includes(q) ||
        String(e.status).startsWith(q) ||
        e.method.toLowerCase() === q,
    )
    .toReversed()
    .map((e) => ({ ...e, display: displayUrl(e.url) }));
});

function displayUrl(url: string) {
  try {
    const u = new URL(url);
    const path = u.pathname + u.search;
    return u.hostname === host.value ? path : u.host + path;
  } catch {
    return url;
  }
}
</script>

<template>
  <PageBar>
    <div class="relative flex-1">
      <SearchIcon
        class="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
      />
      <Input
        v-model="query"
        placeholder="Filter URL, status, method"
        aria-label="Filter requests"
        class="h-8 pl-8 text-xs"
      />
    </div>
    <template #actions>
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Clear log"
            :disabled="!log.entries.length"
            @click="log.clear()"
          >
            <Trash2Icon />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Clear</TooltipContent>
      </Tooltip>
    </template>
  </PageBar>

  <EmptyState v-if="!log.connected" :icon="PlugZapIcon" title="Not active on this page" />
  <EmptyState v-else-if="!log.entries.length" :icon="ActivityIcon" title="No requests yet" />
  <EmptyState v-else-if="!rows.length" :icon="SearchIcon" title="No matches" />

  <ul v-else class="divide-y">
    <li v-for="entry in rows" :key="entry.id">
      <RouterLink
        :to="`/log/${entry.id}`"
        class="hover:bg-muted/50 flex items-center gap-2 px-3 py-1.5"
      >
        <span
          class="w-11 shrink-0 font-mono text-[11px] font-semibold"
          :class="methodClass(entry.method)"
        >
          {{ entry.method }}
        </span>
        <span class="min-w-0 flex-1 truncate font-mono text-xs" :title="entry.url">{{
          entry.display
        }}</span>
        <WandSparklesIcon
          v-if="entry.ruleId"
          class="size-3.5 shrink-0 text-amber-600 dark:text-amber-400"
          aria-label="Rule applied"
        />
        <span class="w-8 shrink-0 text-right font-mono text-xs" :class="statusClass(entry.status)">
          {{ entry.status || 'ERR' }}
        </span>
        <span class="text-muted-foreground w-11 shrink-0 text-right text-[11px] tabular-nums">
          {{ formatMs(entry.duration) }}
        </span>
      </RouterLink>
    </li>
  </ul>
</template>
