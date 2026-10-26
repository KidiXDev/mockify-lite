import { defineStore } from 'pinia';
import { computed } from 'vue';

import { useStorageItem } from '@/composables/useStorageItem';
import { clone, normalizeRule, type Rule } from '@/lib/rules';
import { rulesItem } from '@/lib/storage';

export const useRulesStore = defineStore('rules', () => {
  const { state: rules, ready } = useStorageItem(rulesItem);

  const groups = computed(() =>
    [...new Set(rules.value.map((r) => r.group).filter(Boolean))].sort(),
  );

  function get(id: string) {
    return rules.value.find((r) => r.id === id);
  }

  function save(rule: Rule) {
    const index = rules.value.findIndex((r) => r.id === rule.id);
    if (index === -1) rules.value.unshift(clone(rule));
    else rules.value[index] = clone(rule);
  }

  function setEnabled(id: string, enabled: boolean) {
    const rule = get(id);
    if (rule) rule.enabled = enabled;
  }

  function remove(id: string) {
    const before = rules.value;
    rules.value = before.filter((r) => r.id !== id);
    return () => {
      rules.value = before;
    };
  }

  function duplicate(id: string) {
    const index = rules.value.findIndex((r) => r.id === id);
    const source = rules.value[index];
    if (!source) return;
    rules.value.splice(index + 1, 0, {
      ...clone(source),
      id: crypto.randomUUID(),
      name: `${source.name || 'Rule'} copy`,
    });
  }

  function exportJson() {
    return JSON.stringify({ version: 1, rules: rules.value }, null, 2);
  }

  function importJson(text: string): number {
    const data: unknown = JSON.parse(text);
    const list = Array.isArray(data) ? data : (data as { rules?: unknown })?.rules;
    if (!Array.isArray(list)) throw new Error('Invalid file');
    const imported = list.map(normalizeRule).filter((r): r is Rule => r !== null);
    rules.value.push(...imported);
    return imported.length;
  }

  return { rules, ready, groups, get, save, setEnabled, remove, duplicate, exportJson, importJson };
});
