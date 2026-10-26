<script setup lang="ts">
import { ClipboardCopyIcon, SearchXIcon, SendIcon, WandSparklesIcon } from '@lucide/vue';
import { useClipboard } from '@vueuse/core';
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { toast } from 'vue-sonner';

import EmptyState from '@/components/EmptyState.vue';
import FormField from '@/components/FormField.vue';
import HeaderTable from '@/components/HeaderTable.vue';
import JsonEditor from '@/components/JsonEditor.vue';
import PageBar from '@/components/PageBar.vue';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatJson, formatMs, methodClass, statusClass, toCurl } from '@/lib/format';
import { useComposerStore } from '@/stores/composer';
import { useLogStore } from '@/stores/log';
import { useRulesStore } from '@/stores/rules';

const { id } = defineProps<{ id: string }>();
const router = useRouter();
const log = useLogStore();
const rules = useRulesStore();
const composer = useComposerStore();
const { copy } = useClipboard({ legacy: true });

const entry = computed(() => log.get(id));
const rule = computed(() => (entry.value?.ruleId ? rules.get(entry.value.ruleId) : undefined));
const reqBody = computed(() => formatJson(entry.value?.reqBody ?? ''));
const resBody = computed(() => formatJson(entry.value?.resBody ?? ''));

async function copyCurl() {
  const e = entry.value!;
  await copy(toCurl({ method: e.method, url: e.url, headers: e.reqHeaders, body: e.reqBody }));
  toast.success('Copied');
}

function resend() {
  composer.load(entry.value!);
  void router.push('/compose');
}
</script>

<template>
  <PageBar back="/log">
    <template v-if="entry">
      <span class="font-mono text-xs font-semibold" :class="methodClass(entry.method)">{{
        entry.method
      }}</span>
      <span class="font-mono text-xs" :class="statusClass(entry.status)">
        {{ entry.status ? `${entry.status} ${entry.statusText}` : 'Failed' }}
      </span>
    </template>
    <template v-if="entry" #actions>
      <Tooltip>
        <TooltipTrigger as-child>
          <Button variant="ghost" size="icon-sm" aria-label="Copy as cURL" @click="copyCurl"
            ><ClipboardCopyIcon
          /></Button>
        </TooltipTrigger>
        <TooltipContent>Copy cURL</TooltipContent>
      </Tooltip>
      <Button variant="outline" size="sm" @click="resend"><SendIcon /> Resend</Button>
      <Button size="sm" as-child>
        <RouterLink :to="{ path: '/rules/new', query: { from: entry.id } }"
          ><WandSparklesIcon /> Mock</RouterLink
        >
      </Button>
    </template>
  </PageBar>

  <EmptyState v-if="!entry" :icon="SearchXIcon" title="Request not found" />

  <div v-else class="space-y-3 p-3">
    <p class="bg-muted rounded-md px-2.5 py-2 font-mono text-xs break-all">{{ entry.url }}</p>
    <div class="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-xs">
      <span class="uppercase">{{ entry.type }}</span>
      <span>{{ formatMs(entry.duration) }}</span>
      <span>{{ new Date(entry.time).toLocaleTimeString() }}</span>
      <RouterLink
        v-if="rule"
        :to="`/rules/${rule.id}`"
        class="text-amber-700 hover:underline dark:text-amber-400"
      >
        {{ rule.name || 'Rule' }} applied
      </RouterLink>
    </div>
    <p v-if="entry.error" class="bg-destructive/10 text-destructive rounded-md px-2.5 py-2 text-xs">
      {{ entry.error }}
    </p>

    <Tabs default-value="response">
      <TabsList class="w-full">
        <TabsTrigger value="response">Response</TabsTrigger>
        <TabsTrigger value="request">Request</TabsTrigger>
      </TabsList>
      <TabsContent value="response" class="space-y-4 pt-2">
        <FormField label="Body">
          <JsonEditor v-if="entry.resBody !== undefined" :model-value="resBody" readonly />
          <p v-else class="text-muted-foreground text-xs">Not captured</p>
        </FormField>
        <FormField label="Headers">
          <HeaderTable :headers="entry.resHeaders" />
        </FormField>
      </TabsContent>
      <TabsContent value="request" class="space-y-4 pt-2">
        <FormField label="Body">
          <JsonEditor v-if="entry.reqBody" :model-value="reqBody" readonly />
          <p v-else class="text-muted-foreground text-xs">None</p>
        </FormField>
        <FormField label="Headers">
          <HeaderTable :headers="entry.reqHeaders" />
        </FormField>
      </TabsContent>
    </Tabs>
  </div>
</template>
