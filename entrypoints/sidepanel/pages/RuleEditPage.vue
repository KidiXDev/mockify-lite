<script setup lang="ts">
import { Trash2Icon } from '@lucide/vue';
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { toast } from 'vue-sonner';

import FormField from '@/components/FormField.vue';
import HeadersEditor from '@/components/HeadersEditor.vue';
import JsonEditor from '@/components/JsonEditor.vue';
import PageBar from '@/components/PageBar.vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatJson, formatMs, METHOD_OPTIONS, STATUS_TEXT } from '@/lib/format';
import {
  type BodyMode,
  clone,
  type MatchType,
  newRule,
  normalizeRule,
  type ResponseMode,
  type Rule,
  urlMatches,
} from '@/lib/rules';
import { useLogStore } from '@/stores/log';
import { useRulesStore } from '@/stores/rules';

const STATUSES = [200, 201, 204, 400, 401, 403, 404, 409, 422, 429, 500, 502, 503, 504];
const DELAYS = [0, 500, 1000, 3000, 10000];
const MODES: { value: ResponseMode; label: string }[] = [
  { value: 'mock', label: 'Mock' },
  { value: 'modify', label: 'Modify' },
  { value: 'error', label: 'Error' },
  { value: 'passthrough', label: 'Pass' },
];
const BODY_MODES: { value: BodyMode; label: string }[] = [
  { value: 'none', label: 'Keep' },
  { value: 'replace', label: 'Replace' },
  { value: 'merge', label: 'Merge patch' },
];
const URL_PLACEHOLDER: Record<MatchType, string> = {
  contains: '/api/users',
  wildcard: '*/api/users/*',
  regex: '/users/(\\d+)$',
};
const REWRITE_PLACEHOLDER: Record<MatchType, string> = {
  contains: 'Replace the matched text',
  wildcard: 'Full URL',
  regex: 'Replacement, $1 for groups',
};

const { id } = defineProps<{ id: string }>();
const route = useRoute();
const router = useRouter();
const store = useRulesStore();
const log = useLogStore();

const existing = store.get(id);
const draft = ref<Rule>(existing ? clone(existing) : fromLog());

function fromLog(): Rule {
  const entry = typeof route.query.from === 'string' ? log.get(route.query.from) : undefined;
  if (!entry) return newRule();
  const { pathname } = new URL(entry.url);
  return newRule({
    url: pathname === '/' ? entry.url : pathname,
    method: entry.method as Rule['method'],
    response: { status: entry.status || 200, body: formatJson(entry.resBody ?? '') },
  });
}

const regexError = computed(() => {
  if (draft.value.matchType !== 'regex') return false;
  try {
    new RegExp(draft.value.url);
    return false;
  } catch {
    return true;
  }
});
const matchCount = computed(() => {
  const { url, matchType, method } = draft.value;
  if (!url) return 0;
  return log.entries.filter(
    (e) => (method === 'ANY' || e.method === method) && urlMatches(url, matchType, e.url),
  ).length;
});
const showStatus = computed(() => ['mock', 'modify'].includes(draft.value.response.mode));
const statuses = computed(() =>
  draft.value.response.mode === 'modify' ? [0, ...STATUSES] : STATUSES,
);
const canSave = computed(() => draft.value.url.trim() !== '' && !regexError.value);

function save() {
  store.save({ ...normalizeRule(draft.value)!, id: draft.value.id });
  toast.success('Saved');
  void router.push('/rules');
}

function remove() {
  const undo = store.remove(id);
  toast('Rule deleted', { action: { label: 'Undo', onClick: undo } });
  void router.push('/rules');
}
</script>

<template>
  <PageBar back="/rules" :title="existing ? 'Edit rule' : 'New rule'">
    <template #actions>
      <Button
        v-if="existing"
        variant="ghost"
        size="icon-sm"
        aria-label="Delete rule"
        @click="remove"
      >
        <Trash2Icon />
      </Button>
      <Button size="sm" :disabled="!canSave" @click="save">Save</Button>
    </template>
  </PageBar>

  <form class="space-y-4 p-3" @submit.prevent="canSave && save()">
    <FormField v-slot="{ id: fieldId }" label="Match">
      <div class="grid grid-cols-2 gap-3">
        <Select v-model="draft.method">
          <SelectTrigger size="sm" class="w-full font-mono text-xs" aria-label="Method"
            ><SelectValue
          /></SelectTrigger>
          <SelectContent>
            <SelectItem v-for="m in METHOD_OPTIONS" :key="m" :value="m" class="font-mono text-xs">{{
              m
            }}</SelectItem>
          </SelectContent>
        </Select>
        <Select v-model="draft.matchType">
          <SelectTrigger size="sm" class="w-full text-xs" aria-label="Match type"
            ><SelectValue
          /></SelectTrigger>
          <SelectContent>
            <SelectItem value="contains">Contains</SelectItem>
            <SelectItem value="wildcard">Wildcard</SelectItem>
            <SelectItem value="regex">Regex</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Input
        :id="fieldId"
        v-model="draft.url"
        :placeholder="URL_PLACEHOLDER[draft.matchType]"
        :aria-invalid="regexError || undefined"
        class="h-8 font-mono text-xs"
        autofocus
      />
      <p v-if="regexError" class="text-destructive text-xs">Invalid regex</p>
      <p v-else-if="matchCount" class="text-muted-foreground text-xs">
        Matches {{ matchCount }} logged {{ matchCount === 1 ? 'request' : 'requests' }}
      </p>
    </FormField>

    <div class="grid grid-cols-2 gap-3">
      <FormField v-slot="{ id: fieldId }" label="Name">
        <Input :id="fieldId" v-model="draft.name" placeholder="Untitled" class="h-8 text-xs" />
      </FormField>
      <FormField v-slot="{ id: fieldId }" label="Scenario">
        <Input
          :id="fieldId"
          v-model="draft.group"
          list="scenarios"
          placeholder="None"
          class="h-8 text-xs"
        />
        <datalist id="scenarios">
          <option v-for="group in store.groups" :key="group" :value="group" />
        </datalist>
      </FormField>
    </div>

    <FormField label="Delay">
      <div class="flex flex-wrap gap-1">
        <Button
          v-for="ms in DELAYS"
          :key="ms"
          type="button"
          size="xs"
          :variant="draft.delay === ms ? 'default' : 'outline'"
          @click="draft.delay = ms"
        >
          {{ ms ? formatMs(ms) : 'None' }}
        </Button>
        <Input
          v-model.number="draft.delay"
          type="number"
          min="0"
          step="100"
          aria-label="Delay in milliseconds"
          class="h-6 w-20 px-2 text-xs"
        />
      </div>
    </FormField>

    <Tabs default-value="response">
      <TabsList class="w-full">
        <TabsTrigger value="response">Response</TabsTrigger>
        <TabsTrigger value="request">Request</TabsTrigger>
      </TabsList>

      <TabsContent value="response" class="space-y-4 pt-2">
        <Tabs v-model="draft.response.mode">
          <TabsList class="h-8 w-full">
            <TabsTrigger v-for="m in MODES" :key="m.value" :value="m.value" class="text-xs">{{
              m.label
            }}</TabsTrigger>
          </TabsList>
        </Tabs>

        <FormField v-if="showStatus" label="Status">
          <template #aside>
            <span class="text-muted-foreground text-xs">{{
              STATUS_TEXT[draft.response.status]
            }}</span>
          </template>
          <template #default="{ id: fieldId }">
            <div class="flex flex-wrap gap-1">
              <Button
                v-for="code in statuses"
                :key="code"
                type="button"
                size="xs"
                class="font-mono"
                :variant="draft.response.status === code ? 'default' : 'outline'"
                @click="draft.response.status = code"
              >
                {{ code || 'Keep' }}
              </Button>
              <Input
                :id="fieldId"
                v-model.number="draft.response.status"
                type="number"
                min="200"
                max="599"
                class="h-6 w-16 px-2 font-mono text-xs"
              />
            </div>
          </template>
        </FormField>

        <FormField v-if="draft.response.mode === 'mock'" label="Body">
          <JsonEditor v-model="draft.response.body" placeholder="{}" />
        </FormField>
        <FormField v-else-if="draft.response.mode === 'modify'" label="Body">
          <template #aside>
            <Select v-model="draft.response.bodyMode">
              <SelectTrigger size="sm" class="h-6! w-28 text-xs" aria-label="Body mode"
                ><SelectValue
              /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="m in BODY_MODES" :key="m.value" :value="m.value">{{
                  m.label
                }}</SelectItem>
              </SelectContent>
            </Select>
          </template>
          <JsonEditor
            v-if="draft.response.bodyMode !== 'none'"
            v-model="draft.response.body"
            :placeholder="
              draft.response.bodyMode === 'merge'
                ? '{ &quot;status&quot;: &quot;pending&quot; }'
                : ''
            "
          />
        </FormField>

        <FormField v-if="showStatus" label="Headers">
          <HeadersEditor v-model="draft.response.headers" />
        </FormField>
      </TabsContent>

      <TabsContent value="request" class="space-y-4 pt-2">
        <FormField v-slot="{ id: fieldId }" label="Rewrite URL">
          <Input
            :id="fieldId"
            v-model="draft.request.url"
            :placeholder="REWRITE_PLACEHOLDER[draft.matchType]"
            class="h-8 font-mono text-xs"
          />
        </FormField>
        <FormField label="Headers">
          <HeadersEditor v-model="draft.request.headers" />
        </FormField>
        <FormField label="Body">
          <template #aside>
            <Select v-model="draft.request.bodyMode">
              <SelectTrigger size="sm" class="h-6! w-28 text-xs" aria-label="Body mode"
                ><SelectValue
              /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="m in BODY_MODES" :key="m.value" :value="m.value">{{
                  m.label
                }}</SelectItem>
              </SelectContent>
            </Select>
          </template>
          <JsonEditor
            v-if="draft.request.bodyMode !== 'none'"
            v-model="draft.request.body"
            :placeholder="
              draft.request.bodyMode === 'merge'
                ? '{ &quot;email&quot;: &quot;test@example.com&quot; }'
                : ''
            "
          />
        </FormField>
      </TabsContent>
    </Tabs>
  </form>
</template>
