import { onScopeDispose, type Ref, ref, watch } from 'vue';
import type { WxtStorageItem } from 'wxt/utils/storage';

import { clone } from '@/lib/rules';

export function useStorageItem<T>(item: WxtStorageItem<T, Record<string, unknown>>) {
  const state = ref(clone(item.fallback)) as Ref<T>;
  // Echo guard: storage.onChanged fires for our own writes too.
  let last = JSON.stringify(state.value);

  const apply = (value: T) => {
    last = JSON.stringify(value);
    state.value = JSON.parse(last);
  };
  const ready = item.getValue().then(apply);
  onScopeDispose(item.watch(apply));

  watch(
    state,
    (value) => {
      const json = JSON.stringify(value);
      if (json === last) return;
      last = json;
      void item.setValue(JSON.parse(json));
    },
    { deep: true },
  );

  return { state, ready };
}
