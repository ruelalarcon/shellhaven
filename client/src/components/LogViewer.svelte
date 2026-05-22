<script lang="ts">
  import { onMount } from "svelte";

  let { serviceId, filename }: {
    serviceId: string;
    filename: string;
  } = $props();

  let content = $state("");
  let loading = $state(true);
  let error = $state("");
  let container: HTMLPreElement;

  onMount(async () => {
    loading = true;
    error = "";
    try {
      const res = await fetch(`/api/services/${serviceId}/logs/${encodeURIComponent(filename)}`);
      if (!res.ok) { error = `Failed to load: ${res.status}`; return; }
      content = await res.text();
    } catch {
      error = "Failed to load log file.";
    } finally {
      loading = false;
    }
  });

  $effect(() => {
    if (!loading && container) {
      container.scrollTop = container.scrollHeight;
    }
  });
</script>

<div class="viewer">
  {#if loading}
    <div class="empty">loading…</div>
  {:else if error}
    <div class="empty error">{error}</div>
  {:else}
    <pre class="content" bind:this={container}>{content}</pre>
  {/if}
</div>

<style>
  .viewer {
    width: 100%;
    height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .empty {
    color: #3a3a52;
    font-size: 0.8rem;
    padding: 24px;
  }

  .empty.error { color: #ff8585; }

  .content {
    flex: 1;
    margin: 0;
    padding: 16px 24px;
    overflow-y: auto;
    font-family: inherit;
    font-size: 0.82rem;
    line-height: 1.6;
    color: #8b95a8;
    white-space: pre-wrap;
    word-break: break-all;
    background: transparent;
  }

  .content::-webkit-scrollbar { width: 6px; }
  .content::-webkit-scrollbar-track { background: transparent; }
  .content::-webkit-scrollbar-thumb { background: #2a2a38; border-radius: 3px; }

  @media (max-width: 767px) {
    .content { font-size: 0.75rem; padding: 12px 16px; }
  }
</style>
