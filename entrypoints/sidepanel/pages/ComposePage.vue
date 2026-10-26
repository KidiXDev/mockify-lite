<script setup lang="ts">
import { LoaderCircleIcon, SendIcon } from '@lucide/vue';
import { computed } from 'vue';

import FormField from '@/components/FormField.vue';
import HeadersEditor from '@/components/HeadersEditor.vue';
import HeaderTable from '@/components/HeaderTable.vue';
import JsonEditor from '@/components/JsonEditor.vue';
import PageBar from '@/components/PageBar.vue';
import { Button } from '@/components/ui/button';
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
import { useActiveTab } from '@/composables/useActiveTab';
import { formatBytes, formatJson, formatMs, statusClass } from '@/lib/format';
import { METHODS } from '@/lib/rules';
import { useComposerStore } from '@/stores/composer';

const composer = useComposerStore();
const { tab, host } = useActiveTab();

const url = computed(() => composer.draft.url.trim());
const validUrl = computed(() => /^https?:\/\/[^/\s]/i.test(url.value));
const urlError = computed(() => url.value !== '' && !validUrl.value);
const hasBody = computed(() => !['GET', 'HEAD'].includes(composer.draft.method));
const canSend = computed(() => !!host.value && validUrl.value && !composer.sending);
const body = computed(() => formatJson(composer.response?.body ?? ''));
const size = computed(() => formatBytes(new Blob([composer.response?.body ?? '']).size));

function send() {
  if (canSend.value && tab.value?.id !== undefined) void composer.send(tab.value.id);
}
</script>

<template>
  <PageBar title="Compose" />

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
      <Input
        v-model="composer.draft.url"
        placeholder="https://api.example.com/users"
        aria-label="URL"
        :aria-invalid="urlError || undefined"
        class="h-8 min-w-0 flex-1 font-mono text-xs"
      />
    </div>
    <p v-if="urlError" class="text-destructive text-xs">Full URL required</p>
    <div class="flex items-center gap-2">
      <Switch id="with-cookies" v-model="composer.draft.withCookies" />
      <Label for="with-cookies" class="text-xs font-normal">Send cookies</Label>
      <Button type="submit" size="sm" class="ml-auto" :disabled="!canSend">
        <LoaderCircleIcon v-if="composer.sending" class="animate-spin" />
        <SendIcon v-else />
        Send
      </Button>
    </div>

    <Tabs :default-value="hasBody ? 'body' : 'headers'">
      <TabsList class="w-full">
        <TabsTrigger value="body" :disabled="!hasBody">Body</TabsTrigger>
        <TabsTrigger value="headers">Headers {{ composer.draft.headers.length || '' }}</TabsTrigger>
      </TabsList>
      <TabsContent value="body" class="pt-2">
        <JsonEditor v-model="composer.draft.body" placeholder="{}" />
      </TabsContent>
      <TabsContent value="headers" class="pt-2">
        <HeadersEditor v-model="composer.draft.headers" />
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
      class="bg-destructive/10 text-destructive rounded-md px-2.5 py-2 text-xs"
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
</template>
