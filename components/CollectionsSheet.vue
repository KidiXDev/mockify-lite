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
import { toast } from 'vue-sonner';

import EmptyState from '@/components/EmptyState.vue';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { methodClass } from '@/lib/format';
import { useComposerStore } from '@/stores/composer';

const open = defineModel<boolean>('open', { required: true });
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

function load(id: string) {
  composer.open(id);
  open.value = false;
}

function create() {
  composer.reset();
  open.value = false;
}

function remove(id: string) {
  const undo = composer.remove(id);
  toast('Request deleted', { action: { label: 'Undo', onClick: undo } });
}
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent side="left" class="w-[85%] gap-0 p-0">
      <SheetHeader class="h-12 flex-row items-center border-b px-3 py-0">
        <SheetTitle class="text-sm">Collections</SheetTitle>
        <SheetDescription class="sr-only">Saved requests</SheetDescription>
      </SheetHeader>

      <div class="flex gap-1.5 border-b p-2">
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
        <Button size="sm" @click="create"><PlusIcon /> New</Button>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto">
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
          <CollapsibleTrigger
            v-if="section.name"
            class="group/trigger bg-muted/40 hover:bg-muted/70 flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-xs font-medium"
          >
            <ChevronRightIcon
              class="size-3.5 shrink-0 transition-transform group-data-[state=open]/trigger:rotate-90"
            />
            <span class="truncate">{{ section.name }}</span>
            <span class="text-muted-foreground">{{ section.requests.length }}</span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul class="divide-y">
              <li
                v-for="request in section.requests"
                :key="request.id"
                class="hover:bg-muted/50 flex items-center gap-2 py-2 pr-1.5 pl-3"
                :class="{ 'bg-muted/60': request.id === composer.draft.id }"
              >
                <button type="button" class="min-w-0 flex-1 text-left" @click="load(request.id)">
                  <div class="flex items-baseline gap-1.5">
                    <span
                      class="w-12 shrink-0 font-mono text-[11px] font-semibold"
                      :class="methodClass(request.method)"
                    >
                      {{ request.method }}
                    </span>
                    <span class="truncate text-xs font-medium">{{
                      request.name || 'Untitled'
                    }}</span>
                  </div>
                  <div class="text-muted-foreground truncate pl-13.5 font-mono text-[11px]">
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
      </div>
    </SheetContent>
  </Sheet>
</template>
