<script setup lang="ts">
import {
  CopyIcon,
  DatabaseIcon,
  EllipsisIcon,
  GlobeLockIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  Trash2Icon,
} from '@lucide/vue';
import { useClipboard, useTimeAgo } from '@vueuse/core';
import { computed, ref, shallowRef, watch } from 'vue';
import { toast } from 'vue-sonner';
import type { Browser } from 'wxt/browser';
import { browser } from 'wxt/browser';

import EmptyState from '@/components/EmptyState.vue';
import FormField from '@/components/FormField.vue';
import JsonEditor from '@/components/JsonEditor.vue';
import PageBar from '@/components/PageBar.vue';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useActiveTab } from '@/composables/useActiveTab';
import { decodeJwt } from '@/lib/format';
import {
  clearWebStorage,
  readWebStorage,
  removeCookie,
  saveCookie,
  writeWebStorage,
} from '@/lib/page';

type Area = 'localStorage' | 'sessionStorage' | 'cookies';

interface Item {
  key: string;
  value: string;
  cookie?: Browser.cookies.Cookie;
  jwt?: boolean;
}

const AREAS: { value: Area; label: string }[] = [
  { value: 'localStorage', label: 'Local' },
  { value: 'sessionStorage', label: 'Session' },
  { value: 'cookies', label: 'Cookies' },
];

const { tab, host } = useActiveTab();
const area = shallowRef<Area>('localStorage');
const items = shallowRef<Item[]>([]);
const query = shallowRef('');
const editing = ref<{ original?: Item; key: string; value: string }>();
const confirmClear = shallowRef(false);
const target = shallowRef<Item>();
const menuOpen = shallowRef(false);
const { copy } = useClipboard({ legacy: true });

const areaLabel = computed(() => AREAS.find((a) => a.value === area.value)!.label.toLowerCase());
const visible = computed(() => {
  const q = query.value.trim().toLowerCase();
  return items.value.filter(
    (i) => !q || i.key.toLowerCase().includes(q) || i.value.toLowerCase().includes(q),
  );
});

const dialogOpen = shallowRef(false);
const jwt = computed(() => (editing.value ? decodeJwt(editing.value.value) : null));
const jwtPayload = computed(() => (jwt.value ? JSON.stringify(jwt.value.payload, null, 2) : ''));
const expiresAgo = useTimeAgo(() => jwt.value?.exp ?? Date.now());
const expired = computed(() => !!jwt.value?.exp && jwt.value.exp < Date.now());
const cookieMeta = computed(() => {
  const c = editing.value?.original?.cookie;
  if (!c) return '';
  return [
    c.domain + c.path,
    c.httpOnly && 'HttpOnly',
    c.secure && 'Secure',
    c.sameSite !== 'unspecified' && `SameSite=${c.sameSite}`,
    c.session
      ? 'Session'
      : c.expirationDate && `Expires ${new Date(c.expirationDate * 1000).toLocaleString()}`,
  ]
    .filter(Boolean)
    .join(' · ');
});

async function load() {
  const { id, url } = tab.value ?? {};
  if (id === undefined || !url || !host.value) {
    items.value = [];
    return;
  }
  try {
    const list =
      area.value === 'cookies'
        ? (await browser.cookies.getAll({ url })).map((cookie) => ({
            key: cookie.name,
            value: cookie.value,
            cookie,
          }))
        : await readWebStorage(id, area.value);
    items.value = list
      .map((item) => ({ ...item, jwt: !!decodeJwt(item.value) }))
      .sort((a, b) => a.key.localeCompare(b.key));
  } catch {
    items.value = [];
  }
}

watch([area, () => tab.value?.id, () => tab.value?.url, () => tab.value?.status], load, {
  immediate: true,
});

function pick(event: MouseEvent) {
  const index = (event.target as Element).closest<HTMLElement>('[data-index]')?.dataset.index;
  target.value = index === undefined ? undefined : visible.value[Number(index)];
}

async function copyText(text: string) {
  await copy(text);
  toast.success('Copied');
}

function copyJwtPayload(item: Item) {
  void copyText(JSON.stringify(decodeJwt(item.value)?.payload, null, 2));
}

function edit(item?: Item) {
  editing.value = { original: item, key: item?.key ?? '', value: item?.value ?? '' };
  dialogOpen.value = true;
}

async function write(item: Item | undefined, key: string, value: string | null) {
  const { id, url } = tab.value!;
  if (area.value !== 'cookies') {
    if (item && item.key !== key) await writeWebStorage(id!, area.value, item.key, null);
    await writeWebStorage(id!, area.value, key, value);
  } else if (value === null) {
    if (item?.cookie) await removeCookie(item.cookie);
  } else {
    if (item?.cookie && item.key !== key) await removeCookie(item.cookie);
    await saveCookie(url!, key, value, item?.cookie);
  }
}

async function save() {
  const e = editing.value;
  if (!e?.key) return;
  try {
    await write(e.original, e.key, e.value);
    dialogOpen.value = false;
    toast.success('Saved');
  } catch (error) {
    toast.error(String(error));
  }
  await load();
}

async function remove(item: Item) {
  await write(item, item.key, null);
  dialogOpen.value = false;
  toast('Deleted');
  await load();
}

async function clearAll() {
  const id = tab.value?.id;
  if (id === undefined) return;
  if (area.value === 'cookies')
    await Promise.all(items.value.map((i) => i.cookie && removeCookie(i.cookie)));
  else await clearWebStorage(id, area.value);
  toast('Cleared');
  await load();
}
</script>

<template>
  <PageBar>
    <Tabs v-model="area">
      <TabsList class="h-8">
        <TabsTrigger v-for="a in AREAS" :key="a.value" :value="a.value" class="px-2.5 text-xs">{{
          a.label
        }}</TabsTrigger>
      </TabsList>
    </Tabs>
    <template #actions>
      <Button variant="ghost" size="icon-sm" aria-label="Refresh" :disabled="!host" @click="load">
        <RefreshCwIcon />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Add item"
        :disabled="!host"
        @click="edit()"
      >
        <PlusIcon />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="icon-sm" aria-label="More" :disabled="!items.length"
            ><EllipsisIcon
          /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem variant="destructive" @select="confirmClear = true"
            ><Trash2Icon /> Clear all</DropdownMenuItem
          >
        </DropdownMenuContent>
      </DropdownMenu>
    </template>
  </PageBar>

  <EmptyState v-if="!host" :icon="GlobeLockIcon" title="Unavailable on this page" />
  <template v-else>
    <div v-if="items.length" class="border-b p-2">
      <div class="relative">
        <SearchIcon
          class="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
        />
        <Input
          v-model="query"
          placeholder="Filter keys and values"
          aria-label="Filter"
          class="h-8 pl-8 text-xs"
        />
      </div>
    </div>
    <EmptyState v-if="!items.length" :icon="DatabaseIcon" title="Empty" />
    <EmptyState v-else-if="!visible.length" :icon="SearchIcon" title="No matches" />
    <ContextMenu v-else v-model:open="menuOpen">
      <ContextMenuTrigger as-child>
        <ul class="divide-y" @contextmenu.capture="pick">
          <li
            v-for="(item, i) in visible"
            :key="item.key + (item.cookie?.domain ?? '') + (item.cookie?.path ?? '')"
            :data-index="i"
          >
            <button
              type="button"
              class="hover:bg-muted/50 w-full px-3 py-2 text-left"
              :class="{ 'bg-muted/70': menuOpen && item === target }"
              @click="edit(item)"
            >
              <div class="flex items-center gap-1.5">
                <span class="truncate font-mono text-xs font-medium">{{ item.key }}</span>
                <Badge v-if="item.jwt" variant="secondary" class="px-1.5 py-0 text-[10px]"
                  >JWT</Badge
                >
                <Badge
                  v-if="item.cookie?.httpOnly"
                  variant="outline"
                  class="px-1.5 py-0 text-[10px]"
                  >HttpOnly</Badge
                >
              </div>
              <div class="text-muted-foreground truncate font-mono text-[11px]">
                {{ item.value || '""' }}
              </div>
            </button>
          </li>
        </ul>
      </ContextMenuTrigger>
      <ContextMenuContent v-if="target" class="w-44">
        <ContextMenuItem @select="edit(target)"><PencilIcon /> Edit</ContextMenuItem>
        <ContextMenuItem @select="copyText(target!.key)"><CopyIcon /> Copy key</ContextMenuItem>
        <ContextMenuItem @select="copyText(target!.value)"><CopyIcon /> Copy value</ContextMenuItem>
        <ContextMenuItem v-if="target.jwt" @select="copyJwtPayload(target!)">
          <CopyIcon /> Copy JWT payload
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" @select="remove(target!)">
          <Trash2Icon /> Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  </template>

  <Dialog v-model:open="dialogOpen">
    <DialogContent v-if="editing" class="max-h-[90vh] gap-3 overflow-y-auto p-4">
      <DialogHeader>
        <DialogTitle>{{
          editing.original ? editing.original.key : `New ${area === 'cookies' ? 'cookie' : 'item'}`
        }}</DialogTitle>
        <DialogDescription class="sr-only">Edit {{ areaLabel }} value</DialogDescription>
      </DialogHeader>
      <FormField v-slot="{ id }" label="Key">
        <Input :id="id" v-model="editing.key" class="h-8 font-mono text-xs" />
      </FormField>
      <FormField label="Value">
        <JsonEditor v-model="editing.value" :strict="false" />
      </FormField>
      <p v-if="cookieMeta" class="text-muted-foreground text-xs break-all">{{ cookieMeta }}</p>
      <FormField v-if="jwt" label="JWT payload">
        <template #aside>
          <span
            v-if="jwt.exp"
            class="text-xs"
            :class="expired ? 'text-destructive' : 'text-muted-foreground'"
          >
            {{ expired ? 'Expired' : 'Expires' }} {{ expiresAgo }}
          </span>
        </template>
        <JsonEditor :model-value="jwtPayload" readonly />
      </FormField>
      <DialogFooter class="flex-row justify-end gap-2">
        <Button
          v-if="editing.original"
          variant="ghost"
          size="sm"
          class="text-destructive mr-auto"
          @click="remove(editing.original)"
        >
          Delete
        </Button>
        <Button size="sm" :disabled="!editing.key" @click="save">Save</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <AlertDialog v-model:open="confirmClear">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Clear {{ areaLabel }}?</AlertDialogTitle>
        <AlertDialogDescription
          >Deletes {{ items.length }} items for {{ host }}.</AlertDialogDescription
        >
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction @click="clearAll">Clear</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
