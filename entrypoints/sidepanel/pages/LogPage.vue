<script setup lang="ts">
import {
  ActivityIcon,
  CopyIcon,
  ExternalLinkIcon,
  PlugZapIcon,
  SearchIcon,
  SendIcon,
  Trash2Icon,
  WandSparklesIcon,
} from '@lucide/vue';
import { useClipboard } from '@vueuse/core';
import { computed, shallowRef } from 'vue';
import { useRouter } from 'vue-router';
import { toast } from 'vue-sonner';
import { browser } from 'wxt/browser';

import EmptyState from '@/components/EmptyState.vue';
import PageBar from '@/components/PageBar.vue';
import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useActiveTab } from '@/composables/useActiveTab';
import { COPY_MENU, formatMs, formatTime, methodClass, statusClass } from '@/lib/format';
import type { LogEntry } from '@/lib/rules';
import { useComposerStore } from '@/stores/composer';
import { useLogStore } from '@/stores/log';

const router = useRouter();
const log = useLogStore();
const composer = useComposerStore();
const { host } = useActiveTab();
const { copy } = useClipboard({ legacy: true });
const query = shallowRef('');
const target = shallowRef<LogEntry>();
const menuOpen = shallowRef(false);

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

function pick(event: MouseEvent) {
  const id = (event.target as Element).closest<HTMLElement>('[data-id]')?.dataset.id;
  target.value = id ? log.get(id) : undefined;
}

async function copyAs(text: (entry: LogEntry) => string | undefined) {
  await copy(text(target.value!) ?? '');
  toast.success('Copied');
}

function resend() {
  composer.load(target.value!);
  void router.push('/compose');
}

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

  <ContextMenu v-else v-model:open="menuOpen">
    <ContextMenuTrigger as-child>
      <ul class="divide-y" @contextmenu.capture="pick">
        <li v-for="entry in rows" :key="entry.id" :data-id="entry.id">
          <RouterLink
            :to="`/log/${entry.id}`"
            class="hover:bg-muted/50 flex gap-2 px-3 py-1.5"
            :class="{ 'bg-muted/70': menuOpen && entry.id === target?.id }"
          >
            <span
              class="w-11 shrink-0 font-mono text-[11px] leading-5 font-semibold"
              :class="methodClass(entry.method)"
            >
              {{ entry.method }}
            </span>
            <div class="min-w-0 flex-1">
              <div class="truncate font-mono text-xs leading-5" :title="entry.url">
                {{ entry.display }}
              </div>
              <div class="text-muted-foreground flex items-center gap-1.5 text-[11px] tabular-nums">
                <span>{{ formatTime(entry.time) }}</span>
                <span aria-hidden="true">·</span>
                <span>{{ formatMs(entry.duration) }}</span>
                <span
                  v-if="entry.ruleId"
                  class="flex items-center gap-1 text-amber-600 dark:text-amber-400"
                >
                  <WandSparklesIcon class="size-3" /> Rule
                </span>
              </div>
            </div>
            <span
              class="shrink-0 font-mono text-xs leading-5 font-medium"
              :class="statusClass(entry.status)"
            >
              {{ entry.status || 'ERR' }}
            </span>
          </RouterLink>
        </li>
      </ul>
    </ContextMenuTrigger>
    <ContextMenuContent v-if="target" class="w-48">
      <ContextMenuItem @select="resend"><SendIcon /> Resend</ContextMenuItem>
      <ContextMenuItem @select="router.push({ path: '/rules/new', query: { from: target!.id } })">
        <WandSparklesIcon /> Mock
      </ContextMenuItem>
      <ContextMenuItem
        :disabled="target.method !== 'GET'"
        @select="browser.tabs.create({ url: target!.url })"
      >
        <ExternalLinkIcon /> Open in new tab
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuSub>
        <ContextMenuSubTrigger class="gap-2"><CopyIcon /> Copy</ContextMenuSubTrigger>
        <ContextMenuSubContent class="w-44">
          <template v-for="(group, i) in COPY_MENU" :key="i">
            <ContextMenuSeparator v-if="i" />
            <ContextMenuItem
              v-for="item in group"
              :key="item.label"
              :disabled="!item.text(target)"
              @select="copyAs(item.text)"
            >
              {{ item.label }}
            </ContextMenuItem>
          </template>
        </ContextMenuSubContent>
      </ContextMenuSub>
      <ContextMenuSeparator />
      <ContextMenuItem variant="destructive" @select="log.clear()">
        <Trash2Icon /> Clear log
      </ContextMenuItem>
    </ContextMenuContent>
  </ContextMenu>
</template>
