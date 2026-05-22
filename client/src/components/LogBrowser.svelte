<script lang="ts">
  import { onMount } from "svelte";
  import type { LogEntry } from "../lib/types";
  import { FileText, FileArchive, RefreshCw } from "@lucide/svelte";

  let { shellId, onopen }: {
    shellId: string;
    onopen: (filename: string) => void;
  } = $props();

  let logs = $state<LogEntry[]>([]);
  let loading = $state(true);
  let error = $state("");

  async function load() {
    loading = true;
    error = "";
    try {
      const res = await fetch(`/api/shells/${shellId}/logs`);
      logs = await res.json();
    } catch {
      error = "Failed to load logs.";
    } finally {
      loading = false;
    }
  }

  onMount(load);

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatDate(mtime: number): string {
    return new Date(mtime).toLocaleString(undefined, {
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  }
</script>

<div class="browser">
  {#if loading}
    <div class="empty">loading…</div>
  {:else if error}
    <div class="empty error">{error}</div>
  {:else if logs.length === 0}
    <div class="empty">no logs yet</div>
  {:else}
    <div class="list">
      {#each logs as log (log.name)}
        <button class="row" onclick={() => onopen(log.name)}>
          <span class="row-icon">
            {#if log.name.endsWith(".gz")}
              <FileArchive size={13} />
            {:else}
              <FileText size={13} />
            {/if}
          </span>
          <span class="row-name">{log.name}</span>
          <span class="row-meta">{formatSize(log.size)}</span>
          <span class="row-meta muted">{formatDate(log.mtime)}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .browser {
    width: 100%;
    height: 100%;
    overflow-y: auto;
    padding: 20px 24px;
    font-family: inherit;
  }

  .browser::-webkit-scrollbar { width: 6px; }
  .browser::-webkit-scrollbar-track { background: transparent; }
  .browser::-webkit-scrollbar-thumb { background: #2a2a38; border-radius: 3px; }

  .empty {
    color: #3a3a52;
    font-size: 0.8rem;
    padding: 8px 0;
  }

  .empty.error { color: #ff8585; }

  .list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 5px;
    color: #8b95a8;
    cursor: pointer;
    padding: 8px 10px;
    font-family: inherit;
    font-size: 0.82rem;
    text-align: left;
    transition: all 0.12s;
  }

  .row:hover {
    background: #16161c;
    border-color: #1e1e28;
    color: #c9d1e0;
  }

  .row-icon {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    color: #3d3d52;
  }

  .row:hover .row-icon { color: #6b7280; }

  .row-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .row-meta {
    font-size: 0.75rem;
    color: #3d3d52;
    flex-shrink: 0;
    white-space: nowrap;
  }

  .row-meta.muted { color: #2e2e42; }

  @media (max-width: 767px) {
    .browser { padding: 12px 16px; }
    .row { padding: 12px 10px; font-size: 0.88rem; }
    /* hide the date on small screens, keep name + size */
    .row-meta.muted { display: none; }
  }
</style>
