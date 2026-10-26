import { createSharedComposable, useColorMode } from '@vueuse/core';
import { computed } from 'vue';

import { useSettingsStore } from '@/stores/settings';

export const useTheme = createSharedComposable(() => {
  const store = useSettingsStore();
  const mode = useColorMode({
    storageRef: computed({
      get: () => store.settings.theme,
      set: (theme) => (store.settings.theme = theme),
    }),
  });
  return { isDark: computed(() => mode.state.value === 'dark') };
});
