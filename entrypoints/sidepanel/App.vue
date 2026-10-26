<script setup lang="ts">
import AppHeader from '@/components/AppHeader.vue';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useTheme } from '@/composables/useTheme';

const { isDark } = useTheme();
</script>

<template>
  <TooltipProvider :delay-duration="300">
    <div class="flex h-full flex-col text-sm">
      <AppHeader />
      <main class="min-h-0 flex-1 overflow-y-auto">
        <RouterView :key="$route.fullPath" />
      </main>
    </div>
    <Toaster position="bottom-center" :theme="isDark ? 'dark' : 'light'" />
  </TooltipProvider>
</template>
