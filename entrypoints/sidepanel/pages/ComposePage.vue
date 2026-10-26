<script setup lang="ts">
import {
  ChevronDownIcon,
  FolderIcon,
  LoaderCircleIcon,
  PencilIcon,
  PlusIcon,
  SendIcon,
  Settings2Icon,
  VariableIcon,
} from '@lucide/vue';
import { useEventListener } from '@vueuse/core';
import { computed, onMounted, ref, shallowRef } from 'vue';
import { useRouter } from 'vue-router';
import { toast } from 'vue-sonner';

import CollectionsSheet from '@/components/CollectionsSheet.vue';
import FormField from '@/components/FormField.vue';
import HeadersEditor from '@/components/HeadersEditor.vue';
import HeaderTable from '@/components/HeaderTable.vue';
import JsonEditor from '@/components/JsonEditor.vue';
import MacroInput from '@/components/MacroInput.vue';
import PageBar from '@/components/PageBar.vue';
import { Button } from '@/components/ui/button';
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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useActiveTab } from '@/composables/useActiveTab';
import { interpolate, isFullUrl } from '@/lib/compose';
import { formatBytes, formatJson, formatMs, statusClass } from '@/lib/format';
import { METHODS } from '@/lib/rules';
import { useComposerStore } from '@/stores/composer';

const router = useRouter();
const composer = useComposerStore();
const { host } = useActiveTab();
const details = ref({ name: '', collection: '' });
const detailsOpen = shallowRef(false);
const collectionsOpen = shallowRef(false);
const mod = /Mac/.test(navigator.userAgent) ? '⌘' : 'Ctrl';

const url = computed(() => composer.draft.url.trim());
const preview = computed(() => interpolate(url.value, composer.macroSource.lookup));
const urlError = computed(
  () => url.value !== '' && !isFullUrl(preview.value) && !preview.value.startsWith('{{'),
);
const hasBody = computed(() => !['GET', 'HEAD'].includes(composer.draft.method));
const canSend = computed(
  () => !!host.value && url.value !== '' && !urlError.value && !composer.sending,
);
const canSave = computed(() => composer.dirty && url.value !== '');
const body = computed(() => formatJson(composer.response?.body ?? ''));
const size = computed(() => formatBytes(new Blob([composer.response?.body ?? '']).size));

function send() {
  if (canSend.value) void composer.send();
}

function editDetails() {
  details.value = { name: composer.draft.name, collection: composer.draft.collection };
  detailsOpen.value = true;
}

function save() {
  if (!canSave.value) return;
  if (!composer.saved) return editDetails();
  composer.save();
  toast.success('Saved');
}

function saveDetails() {
  composer.draft.name = details.value.name.trim();
  composer.draft.collection = details.value.collection.trim();
  composer.save();
  detailsOpen.value = false;
  toast.success('Saved');
}

onMounted(composer.refreshPage);

// Capture phase so the shortcuts win over CodeMirror's own Mod-Enter binding.
useEventListener(
  window,
  'keydown',
  (event: KeyboardEvent) => {
    if (!(event.ctrlKey || event.metaKey) || detailsOpen.value || collectionsOpen.value) return;
    const key = event.key.toLowerCase();
    if (key !== 'enter' && key !== 's') return;
    event.preventDefault();
    event.stopPropagation();
    if (key === 'enter') send();
    else save();
  },
  { capture: true },
);
</script>

<template>
  <PageBar>
    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon-sm"
          class="-ml-1.5"
          aria-label="Collections"
          @click="collectionsOpen = true"
        >
          <FolderIcon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Collections</TooltipContent>
    </Tooltip>
    <button
      type="button"
      class="hover:bg-accent dark:hover:bg-accent/50 -ml-1 flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1"
      @click="editDetails"
    >
      <span class="truncate font-medium">{{ composer.draft.name || 'Untitled' }}</span>
      <span v-if="composer.draft.collection" class="text-muted-foreground truncate text-xs">{{
        composer.draft.collection
      }}</span>
      <span
        v-if="composer.saved && composer.dirty"
        class="bg-foreground size-1.5 shrink-0 rounded-full"
      >
        <span class="sr-only">Unsaved changes</span>
      </span>
      <PencilIcon v-else class="text-muted-foreground size-3 shrink-0" />
    </button>
    <template #actions>
      <Tooltip>
        <TooltipTrigger as-child>
          <Button variant="ghost" size="icon-sm" aria-label="New request" @click="composer.reset()">
            <PlusIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent>New</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger as-child>
          <Button size="sm" :disabled="!canSave" @click="save">Save</Button>
        </TooltipTrigger>
        <TooltipContent>{{ mod }} S</TooltipContent>
      </Tooltip>
    </template>
  </PageBar>

  <form class="space-y-3 p-3" @submit.prevent="send">
    <div class="flex gap-1.5">
      <Select v-model="composer.draft.method">
        <SelectTrigger size="sm" class="w-24 font-mono text-xs" aria-label="Method"
          ><SelectValue
        /></SelectTrigger>
        <SelectContent>
          <SelectItem v-for="m in METHODS" :key="m" :value="m" class="font-mono text-xs">{{
            m
          }}</SelectItem>
        </SelectContent>
      </Select>
      <MacroInput
        v-model="composer.draft.url"
        :source="composer.macroSource"
        placeholder="{{env.BASE_URL}}/users"
        label="URL"
        :invalid="urlError"
        class="flex-1"
        @submit="send"
      />
    </div>
    <p v-if="urlError" class="text-destructive text-xs">Full URL required</p>
    <p
      v-else-if="preview !== url"
      class="text-muted-foreground truncate font-mono text-xs"
      :title="preview"
    >
      {{ preview }}
    </p>
    <div class="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="outline" size="sm" class="min-w-0 shrink text-xs">
            <VariableIcon />
            <span class="truncate" :class="{ 'text-muted-foreground': !composer.environment }">{{
              composer.environment ? composer.environment.name || 'Untitled' : 'No environment'
            }}</span>
            <ChevronDownIcon class="opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuRadioGroup v-model="composer.workspace.activeEnv">
            <DropdownMenuRadioItem value="" class="text-xs">No environment</DropdownMenuRadioItem>
            <DropdownMenuRadioItem
              v-for="env in composer.workspace.environments"
              :key="env.id"
              :value="env.id"
              class="text-xs"
              >{{ env.name || 'Untitled' }}</DropdownMenuRadioItem
            >
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem class="text-xs" @select="router.push('/compose/environments')"
            ><Settings2Icon /> Manage</DropdownMenuItem
          >
        </DropdownMenuContent>
      </DropdownMenu>
      <Switch id="with-cookies" v-model="composer.draft.withCookies" />
      <Label for="with-cookies" class="text-xs font-normal whitespace-nowrap">Send cookies</Label>
      <Tooltip>
        <TooltipTrigger as-child>
          <Button type="submit" size="sm" class="ml-auto" :disabled="!canSend">
            <LoaderCircleIcon v-if="composer.sending" class="animate-spin" />
            <SendIcon v-else />
            Send
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ mod }} Enter</TooltipContent>
      </Tooltip>
    </div>

    <Tabs :default-value="hasBody ? 'body' : 'headers'">
      <TabsList class="w-full">
        <TabsTrigger value="body" :disabled="!hasBody">Body</TabsTrigger>
        <TabsTrigger value="headers">Headers {{ composer.draft.headers.length || '' }}</TabsTrigger>
      </TabsList>
      <TabsContent value="body" class="pt-2">
        <JsonEditor v-model="composer.draft.body" placeholder="{}" :macros="composer.macroSource" />
      </TabsContent>
      <TabsContent value="headers" class="pt-2">
        <HeadersEditor v-model="composer.draft.headers" :macros="composer.macroSource" />
      </TabsContent>
    </Tabs>
  </form>

  <section v-if="composer.response" class="space-y-3 border-t p-3">
    <div class="flex items-baseline gap-3 text-xs">
      <span class="font-mono font-semibold" :class="statusClass(composer.response.status)">
        {{
          composer.response.status
            ? `${composer.response.status} ${composer.response.statusText}`
            : 'Failed'
        }}
      </span>
      <span class="text-muted-foreground">{{ formatMs(composer.response.duration) }}</span>
      <span class="text-muted-foreground">{{ size }}</span>
    </div>
    <p
      v-if="composer.response.error"
      class="bg-destructive/10 text-destructive rounded-md px-2.5 py-2 text-xs break-all"
    >
      {{ composer.response.error }}
    </p>
    <Tabs v-else default-value="body">
      <TabsList class="w-full">
        <TabsTrigger value="body">Body</TabsTrigger>
        <TabsTrigger value="headers">Headers</TabsTrigger>
      </TabsList>
      <TabsContent value="body" class="pt-2">
        <JsonEditor :model-value="body" readonly />
      </TabsContent>
      <TabsContent value="headers" class="pt-2">
        <FormField label="Response headers">
          <HeaderTable :headers="composer.response.headers" />
        </FormField>
      </TabsContent>
    </Tabs>
  </section>

  <CollectionsSheet v-model:open="collectionsOpen" />

  <Dialog v-model:open="detailsOpen">
    <DialogContent class="gap-3 p-4">
      <DialogHeader>
        <DialogTitle>Save request</DialogTitle>
        <DialogDescription class="sr-only">Name and collection</DialogDescription>
      </DialogHeader>
      <form class="space-y-3" @submit.prevent="saveDetails">
        <FormField v-slot="{ id }" label="Name">
          <Input :id="id" v-model="details.name" placeholder="Untitled" class="h-8 text-xs" />
        </FormField>
        <FormField v-slot="{ id }" label="Collection">
          <Input
            :id="id"
            v-model="details.collection"
            list="collections"
            placeholder="None"
            class="h-8 text-xs"
          />
          <datalist id="collections">
            <option v-for="name in composer.collections" :key="name" :value="name" />
          </datalist>
        </FormField>
        <DialogFooter class="flex-row justify-end">
          <Button type="submit" size="sm">Save</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
