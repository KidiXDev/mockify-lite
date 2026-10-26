<script setup lang="ts">
import { DownloadIcon, PlusIcon, UploadIcon, XIcon } from '@lucide/vue';
import { useFileDialog } from '@vueuse/core';
import { computed, shallowRef } from 'vue';
import { toast } from 'vue-sonner';

import FormField from '@/components/FormField.vue';
import PageBar from '@/components/PageBar.vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { isValidSite } from '@/lib/rules';
import { useRulesStore } from '@/stores/rules';
import { useSettingsStore } from '@/stores/settings';

const store = useSettingsStore();
const rules = useRulesStore();
const newSite = shallowRef('');

const candidate = computed(() => newSite.value.trim().toLowerCase());
const siteError = computed(() => candidate.value !== '' && !isValidSite(candidate.value));
const canAdd = computed(
  () => isValidSite(candidate.value) && !store.settings.sites.includes(candidate.value),
);

function addSite() {
  if (!canAdd.value) return;
  store.settings.sites = [...store.settings.sites, candidate.value];
  newSite.value = '';
}

function removeSite(site: string) {
  store.settings.sites = store.settings.sites.filter((s) => s !== site);
}

function exportRules() {
  const url = URL.createObjectURL(new Blob([rules.exportJson()], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `mockify-rules-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const { open: openFile, onChange } = useFileDialog({
  accept: '.json,application/json',
  multiple: false,
  reset: true,
});
onChange(async (files) => {
  const file = files?.[0];
  if (!file) return;
  try {
    const count = rules.importJson(await file.text());
    toast.success(`Imported ${count} ${count === 1 ? 'rule' : 'rules'}`);
  } catch {
    toast.error('Invalid file');
  }
});
</script>

<template>
  <PageBar title="Settings" />

  <div class="space-y-6 p-3">
    <FormField v-slot="{ id }" label="Active sites">
      <ul v-if="store.settings.sites.length" class="divide-y rounded-md border">
        <li
          v-for="site in store.settings.sites"
          :key="site"
          class="flex items-center gap-2 py-1 pr-1 pl-2.5"
        >
          <span class="min-w-0 flex-1 truncate font-mono text-xs">{{ site }}</span>
          <Button
            variant="ghost"
            size="icon-sm"
            :aria-label="`Remove ${site}`"
            @click="removeSite(site)"
          >
            <XIcon />
          </Button>
        </li>
      </ul>
      <form class="flex gap-1.5" @submit.prevent="addSite">
        <Input
          :id="id"
          v-model="newSite"
          placeholder="localhost or *.example.com"
          :aria-invalid="siteError || undefined"
          class="h-8 font-mono text-xs"
        />
        <Button type="submit" size="sm" variant="outline" :disabled="!canAdd"
          ><PlusIcon /> Add</Button
        >
      </form>
      <p v-if="siteError" class="text-destructive text-xs">Host only, no scheme or port</p>
    </FormField>

    <FormField label="Theme">
      <Tabs v-model="store.settings.theme">
        <TabsList class="h-8 w-full">
          <TabsTrigger value="auto" class="text-xs">System</TabsTrigger>
          <TabsTrigger value="light" class="text-xs">Light</TabsTrigger>
          <TabsTrigger value="dark" class="text-xs">Dark</TabsTrigger>
        </TabsList>
      </Tabs>
    </FormField>

    <FormField label="Rules">
      <div class="flex gap-1.5">
        <Button size="sm" variant="outline" :disabled="!rules.rules.length" @click="exportRules">
          <DownloadIcon /> Export
        </Button>
        <Button size="sm" variant="outline" @click="openFile()"><UploadIcon /> Import</Button>
      </div>
    </FormField>
  </div>
</template>
