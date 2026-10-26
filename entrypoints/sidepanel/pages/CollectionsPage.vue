<script setup lang="ts">
import {
  ChevronRightIcon,
  CopyIcon,
  EllipsisVerticalIcon,
  FolderIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
} from '@lucide/vue';
import { computed, shallowRef } from 'vue';
import { useRouter } from 'vue-router';
import { toast } from 'vue-sonner';

import EmptyState from '@/components/EmptyState.vue';
import PageBar from '@/components/PageBar.vue';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { methodClass } from '@/lib/format';
import { useComposerStore } from '@/stores/composer';

const router = useRouter();
const composer = useComposerStore();
const query = shallowRef('');

const sections = computed(() => {
  const q = query.value.trim().toLowerCase();
  const visible = composer.workspace.requests.filter(
    (r) => !q || [r.name, r.url, r.collection].some((field) => field.toLowerCase().includes(q)),
  );
  return ['', ...composer.collections]
    .map((name) => ({ name, requests: visible.filter((r) => r.collection === name) }))
    .filter((section) => section.requests.length);
});

function open(id: string) {
  composer.open(id);
  void router.push('/compose');
}

function create() {
  composer.reset();
  void router.push('/compose');
}

function remove(id: string) {
  const undo = composer.remove(id);
  toast('Request deleted', { action: { label: 'Undo', onClick: undo } });
}
</script>

<template>
  <PageBar back="/compose">
    <div class="relative flex-1">
      <SearchIcon
        class="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
      />
      <Input
        v-model="query"
        placeholder="Filter requests"
        aria-label="Filter requests"
        class="h-8 pl-8 text-xs"
      />
    </div>
    <template #actions>
      <Button size="sm" @click="create"><PlusIcon /> New</Button>
    </template>
  </PageBar>

  <EmptyState
    v-if="!composer.workspace.requests.length"
    :icon="FolderIcon"
    title="No saved requests"
  />
  <EmptyState v-else-if="!sections.length" :icon="SearchIcon" title="No matches" />

  <Collapsible
    v-for="section in sections"
    :key="section.name"
    :default-open="true"
    class="border-b last:border-b-0"
  >
    <div v-if="section.name" class="bg-muted/40 flex items-center px-3 py-1.5">
      <CollapsibleTrigger
        class="group/trigger flex min-w-0 flex-1 items-center gap-1.5 text-left text-xs font-medium"
      >
        <ChevronRightIcon
          class="size-3.5 shrink-0 transition-transform group-data-[state=open]/trigger:rotate-90"
        />
        <span class="truncate">{{ section.name }}</span>
        <span class="text-muted-foreground">{{ section.requests.length }}</span>
      </CollapsibleTrigger>
    </div>
    <CollapsibleContent>
      <ul class="divide-y">
        <li
          v-for="request in section.requests"
          :key="request.id"
          class="hover:bg-muted/50 flex items-center gap-2 py-2 pr-1.5 pl-3"
          :class="{ 'bg-muted/50': request.id === composer.draft.id }"
        >
          <button type="button" class="min-w-0 flex-1 text-left" @click="open(request.id)">
            <div class="flex items-baseline gap-1.5">
              <span
                class="w-12 shrink-0 font-mono text-[11px] font-semibold"
                :class="methodClass(request.method)"
              >
                {{ request.method }}
              </span>
              <span class="truncate text-xs font-medium">{{ request.name || 'Untitled' }}</span>
            </div>
            <div class="text-muted-foreground truncate font-mono text-[11px]">
              {{ request.url }}
            </div>
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button variant="ghost" size="icon-sm" aria-label="Request actions"
                ><EllipsisVerticalIcon
              /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem @select="composer.duplicate(request.id)"
                ><CopyIcon /> Duplicate</DropdownMenuItem
              >
              <DropdownMenuItem variant="destructive" @select="remove(request.id)"
                ><Trash2Icon /> Delete</DropdownMenuItem
              >
            </DropdownMenuContent>
          </DropdownMenu>
        </li>
      </ul>
    </CollapsibleContent>
  </Collapsible>
</template>
