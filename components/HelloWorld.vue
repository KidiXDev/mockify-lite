<script lang="ts" setup>
import { ref } from 'vue';
import { Button } from '@/components/ui/button';

defineProps({
  msg: String,
});

const count = ref(0);
</script>

<template>
  <h1 class="text-3xl font-bold">{{ msg }}</h1>

  <div class="space-y-4 p-8">
    <Button type="button" @click="count++">count is {{ count }}</Button>
    <p>
      Edit
      <code>components/HelloWorld.vue</code> to test HMR
    </p>
  </div>

  <p>
    Install
    <a href="https://github.com/vuejs/language-tools" target="_blank">Volar</a>
    in your IDE for a better DX
  </p>
  <p class="text-muted-foreground">Click on the WXT and Vue logos to learn more</p>
</template>
