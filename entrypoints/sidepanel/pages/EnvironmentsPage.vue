<script setup lang="ts">
import { PlusIcon, Trash2Icon, VariableIcon } from '@lucide/vue';
import { onMounted } from 'vue';
import { toast } from 'vue-sonner';

import EmptyState from '@/components/EmptyState.vue';
import HeadersEditor from '@/components/HeadersEditor.vue';
import PageBar from '@/components/PageBar.vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useComposerStore } from '@/stores/composer';

const composer = useComposerStore();

onMounted(composer.refreshPage);

function toggle(id: string) {
  composer.workspace.activeEnv = composer.workspace.activeEnv === id ? '' : id;
}

function remove(id: string) {
  const undo = composer.removeEnvironment(id);
  toast('Environment deleted', { action: { label: 'Undo', onClick: undo } });
}
</script>

<template>
  <PageBar back="/compose" title="Environments">
    <template #actions>
      <Button size="sm" @click="composer.addEnvironment()"><PlusIcon /> New</Button>
    </template>
  </PageBar>

  <EmptyState
    v-if="!composer.workspace.environments.length"
    :icon="VariableIcon"
    title="No environments"
  />

  <section
    v-for="env in composer.workspace.environments"
    :key="env.id"
    class="space-y-2 border-b p-3"
  >
    <div class="flex items-center gap-1.5">
      <Input
        v-model="env.name"
        placeholder="Untitled"
        aria-label="Environment name"
        class="h-8 text-xs font-medium"
      />
      <Button
        size="sm"
        :variant="composer.workspace.activeEnv === env.id ? 'secondary' : 'outline'"
        :aria-pressed="composer.workspace.activeEnv === env.id"
        @click="toggle(env.id)"
      >
        {{ composer.workspace.activeEnv === env.id ? 'Active' : 'Use' }}
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        :aria-label="`Delete ${env.name || 'environment'}`"
        @click="remove(env.id)"
      >
        <Trash2Icon />
      </Button>
    </div>
    <HeadersEditor v-model="env.vars" noun="Variable" :macros="composer.macroSource" />
  </section>
</template>
