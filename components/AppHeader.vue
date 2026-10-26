<script setup lang="ts">
import {
  ActivityIcon,
  DatabaseIcon,
  EllipsisIcon,
  FlaskConicalIcon,
  GlobeIcon,
  ListChecksIcon,
  PowerIcon,
  RotateCwIcon,
  SendIcon,
  Settings2Icon,
  Trash2Icon,
} from '@lucide/vue';
import { computed, shallowRef } from 'vue';
import { useRoute } from 'vue-router';
import { toast } from 'vue-sonner';
import { browser } from 'wxt/browser';

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
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useActiveTab } from '@/composables/useActiveTab';
import { useLogStore } from '@/stores/log';
import { useSettingsStore } from '@/stores/settings';

const NAV = [
  { to: '/rules', label: 'Rules', icon: ListChecksIcon },
  { to: '/log', label: 'Log', icon: ActivityIcon },
  { to: '/compose', label: 'Compose', icon: SendIcon },
  { to: '/storage', label: 'Storage', icon: DatabaseIcon },
  { to: '/settings', label: 'Settings', icon: Settings2Icon },
];

const route = useRoute();
const store = useSettingsStore();
const log = useLogStore();
const { tab, host, origin } = useActiveTab();
const confirmClear = shallowRef(false);

const enabledHere = computed({
  get: () => !!host.value && store.isSiteEnabled(host.value),
  set: (enabled) => store.setSite(host.value, enabled),
});
const needsReload = computed(
  () => !!host.value && tab.value?.status === 'complete' && enabledHere.value !== log.connected,
);

function reload() {
  if (tab.value?.id !== undefined) void browser.tabs.reload(tab.value.id);
}

async function clearSiteData() {
  const tabId = tab.value?.id;
  if (tabId === undefined || !origin.value) return;
  await browser.scripting
    .executeScript({ target: { tabId }, func: () => sessionStorage.clear() })
    .catch(() => {});
  await browser.browsingData.remove(
    { origins: [origin.value] },
    {
      cache: true,
      cacheStorage: true,
      cookies: true,
      fileSystems: true,
      indexedDB: true,
      localStorage: true,
      serviceWorkers: true,
    },
  );
  await browser.tabs.reload(tabId, { bypassCache: true });
  toast.success('Site data cleared');
}
</script>

<template>
  <header class="bg-background shrink-0 border-b">
    <div class="flex h-11 items-center gap-2 px-3">
      <FlaskConicalIcon class="size-4" />
      <span class="font-semibold tracking-tight">Mockify</span>
      <span
        v-if="!store.settings.enabled"
        class="rounded-sm bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400"
      >
        Paused
      </span>
      <div class="ml-auto flex items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon-sm"
              :aria-label="store.settings.enabled ? 'Pause all' : 'Resume'"
              :class="
                store.settings.enabled
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-muted-foreground'
              "
              @click="store.settings.enabled = !store.settings.enabled"
            >
              <PowerIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ store.settings.enabled ? 'Pause all' : 'Resume' }}</TooltipContent>
        </Tooltip>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="ghost" size="icon-sm" aria-label="More"><EllipsisIcon /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem :disabled="!host" @select="reload"
              ><RotateCwIcon /> Reload tab</DropdownMenuItem
            >
            <DropdownMenuItem :disabled="!host" variant="destructive" @select="confirmClear = true">
              <Trash2Icon /> Clear site data
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>

    <div class="bg-muted/40 flex h-9 items-center gap-2 border-t px-3 text-xs">
      <GlobeIcon class="text-muted-foreground size-3.5 shrink-0" />
      <span class="min-w-0 flex-1 truncate font-mono" :class="{ 'text-muted-foreground': !host }">
        {{ host || 'Unavailable here' }}
      </span>
      <Button v-if="needsReload" size="xs" variant="outline" @click="reload"
        ><RotateCwIcon /> Reload</Button
      >
      <Switch v-model="enabledHere" :disabled="!host" aria-label="Active on this site" />
    </div>

    <nav class="grid grid-cols-5 border-t">
      <RouterLink
        v-for="item in NAV"
        :key="item.to"
        :to="item.to"
        class="flex flex-col items-center gap-0.5 py-1.5 text-[11px] transition-colors"
        :class="
          route.path.startsWith(item.to)
            ? 'text-foreground shadow-[inset_0_-2px_0_var(--foreground)]'
            : 'text-muted-foreground hover:text-foreground'
        "
      >
        <component :is="item.icon" class="size-4" />
        {{ item.label }}
      </RouterLink>
    </nav>
  </header>

  <AlertDialog v-model:open="confirmClear">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Clear site data?</AlertDialogTitle>
        <AlertDialogDescription>
          Deletes storage and cache for {{ host }} and cookies for its whole domain.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction @click="clearSiteData">Clear</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
