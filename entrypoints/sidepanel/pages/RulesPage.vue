<script setup lang="ts">
import {
  ChevronRightIcon,
  CopyIcon,
  EllipsisVerticalIcon,
  ListChecksIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
} from '@lucide/vue';
import { computed, shallowRef } from 'vue';
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
import { Switch } from '@/components/ui/switch';
import { methodClass, ruleSummary } from '@/lib/format';
import { useRulesStore } from '@/stores/rules';
import { useSettingsStore } from '@/stores/settings';

const store = useRulesStore();
const settings = useSettingsStore();
const query = shallowRef('');

const sections = computed(() => {
  const q = query.value.trim().toLowerCase();
  const visible = store.rules.filter(
    (r) => !q || [r.url, r.name, r.group].some((field) => field.toLowerCase().includes(q)),
  );
  return ['', ...store.groups]
    .map((name) => ({ name, rules: visible.filter((r) => r.group === name) }))
    .filter((section) => section.rules.length);
});

function remove(id: string) {
  const undo = store.remove(id);
  toast('Rule deleted', { action: { label: 'Undo', onClick: undo } });
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
        placeholder="Filter rules"
        aria-label="Filter rules"
        class="h-8 pl-8 text-xs"
      />
    </div>
    <template #actions>
      <Button size="sm" as-child>
        <RouterLink to="/rules/new"><PlusIcon /> New</RouterLink>
      </Button>
    </template>
  </PageBar>

  <EmptyState v-if="!store.rules.length" :icon="ListChecksIcon" title="No rules">
    <Button size="sm" variant="outline" as-child>
      <RouterLink to="/rules/new"><PlusIcon /> New rule</RouterLink>
    </Button>
  </EmptyState>
  <EmptyState v-else-if="!sections.length" :icon="SearchIcon" title="No matches" />

  <Collapsible
    v-for="section in sections"
    :key="section.name"
    :default-open="true"
    class="border-b last:border-b-0"
  >
    <div v-if="section.name" class="bg-muted/40 flex items-center gap-2 px-3 py-1.5">
      <CollapsibleTrigger
        class="group/trigger flex min-w-0 flex-1 items-center gap-1.5 text-left text-xs font-medium"
      >
        <ChevronRightIcon
          class="size-3.5 shrink-0 transition-transform group-data-[state=open]/trigger:rotate-90"
        />
        <span class="truncate">{{ section.name }}</span>
        <span class="text-muted-foreground">{{ section.rules.length }}</span>
      </CollapsibleTrigger>
      <Switch
        :model-value="settings.isGroupEnabled(section.name)"
        :aria-label="`Scenario ${section.name}`"
        @update:model-value="settings.setGroup(section.name, $event)"
      />
    </div>
    <CollapsibleContent>
      <ul class="divide-y">
        <li
          v-for="rule in section.rules"
          :key="rule.id"
          class="hover:bg-muted/50 flex items-center gap-2.5 px-3 py-2"
          :class="{ 'opacity-50': !settings.isGroupEnabled(rule.group) }"
        >
          <Switch
            :model-value="rule.enabled"
            :aria-label="`Enable ${rule.name || rule.url}`"
            @update:model-value="store.setEnabled(rule.id, $event)"
          />
          <RouterLink
            :to="`/rules/${rule.id}`"
            class="min-w-0 flex-1"
            :class="{ 'opacity-60': !rule.enabled }"
          >
            <div class="flex items-baseline gap-1.5">
              <span
                class="shrink-0 font-mono text-[11px] font-semibold"
                :class="methodClass(rule.method)"
              >
                {{ rule.method === 'ANY' ? '*' : rule.method }}
              </span>
              <span class="truncate font-mono text-xs">{{ rule.url }}</span>
            </div>
            <div class="text-muted-foreground truncate text-xs">
              <template v-if="rule.name">{{ rule.name }} · </template>{{ ruleSummary(rule) }}
            </div>
          </RouterLink>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button variant="ghost" size="icon-sm" aria-label="Rule actions"
                ><EllipsisVerticalIcon
              /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem @select="store.duplicate(rule.id)"
                ><CopyIcon /> Duplicate</DropdownMenuItem
              >
              <DropdownMenuItem variant="destructive" @select="remove(rule.id)"
                ><Trash2Icon /> Delete</DropdownMenuItem
              >
            </DropdownMenuContent>
          </DropdownMenu>
        </li>
      </ul>
    </CollapsibleContent>
  </Collapsible>
</template>
