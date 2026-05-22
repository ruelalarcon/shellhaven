<script lang="ts">
  import Terminal from "./Terminal.svelte";
  import type { ServiceState } from "../lib/types";
  import { Trash2, Terminal as TerminalIcon, Circle, Cpu } from "@lucide/svelte";

  let { ids, selectedId, services }: {
    ids: string[];
    selectedId: string;
    services: ServiceState[];
  } = $props();

  let termRefs = $state<Record<string, Terminal>>({});

  function getStatus(id: string): string {
    if (id === "shell") return "running";
    return services.find((s) => s.id === id)?.status ?? "stopped";
  }

  function getRestartPolicy(id: string): string {
    if (id === "shell") return "";
    return services.find((s) => s.id === id)?.restartPolicy ?? "";
  }
</script>

<div class="pane">
  <!-- Toolbar -->
  <div class="toolbar">
    <div class="toolbar-left">
      <span class="toolbar-icon">
        {#if selectedId === "shell"}
          <TerminalIcon size={14} />
        {:else}
          <Cpu size={14} />
        {/if}
      </span>
      <span class="terminal-name">{selectedId}</span>
      {#if selectedId !== "shell"}
        {@const status = getStatus(selectedId)}
        {@const policy = getRestartPolicy(selectedId)}
        <span class="status-pill {status}">
          <Circle size={6} class="pill-dot" />
          {status}
        </span>
        {#if policy}
          <span class="policy-tag">{policy}</span>
        {/if}
      {/if}
    </div>
    <div class="toolbar-right">
      <button class="toolbar-btn" onclick={() => termRefs[selectedId]?.clear()} title="Clear terminal">
        <Trash2 size={13} />
        <span>clear</span>
      </button>
    </div>
  </div>

  <!-- Terminals -->
  <div class="terminal-area">
    {#each ids as id (id)}
      <div class="term-slot" style:display={id === selectedId ? "block" : "none"}>
        <Terminal {id} visible={id === selectedId} bind:this={termRefs[id]} />
      </div>
    {/each}
  </div>
</div>

<style>
  .pane {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #0d0d0f;
    min-width: 0;
  }

  /* Toolbar */
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 14px;
    height: 46px;
    background: #111114;
    border-bottom: 1px solid #1e1e24;
    flex-shrink: 0;
    gap: 12px;
  }

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    flex: 1;
  }

  .toolbar-icon {
    display: flex;
    align-items: center;
    color: #c9d1e0;
    flex-shrink: 0;
  }

  .terminal-name {
    font-size: 0.85rem;
    font-weight: 600;
    color: #c9d1e0;
    letter-spacing: 0.04em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .status-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 0.68rem;
    padding: 2px 8px;
    border-radius: 4px;
    letter-spacing: 0.04em;
    flex-shrink: 0;
    font-weight: 500;
  }

  :global(.pill-dot) { flex-shrink: 0; }

  .status-pill.running { background: #0d2018; color: #5af78e; }
  :global(.status-pill.running .pill-dot) { color: #5af78e; fill: #5af78e; }

  .status-pill.crashed { background: #200d0d; color: #ff6b6b; }
  :global(.status-pill.crashed .pill-dot) { color: #ff6b6b; fill: #ff6b6b; }

  .status-pill.stopped { background: #18181e; color: #4a4a62; }
  :global(.status-pill.stopped .pill-dot) { color: #3d3d52; fill: #3d3d52; }

  .policy-tag {
    font-size: 0.65rem;
    color: #3a3a52;
    border: 1px solid #1e1e2c;
    padding: 1px 6px;
    border-radius: 3px;
    flex-shrink: 0;
  }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .toolbar-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background: transparent;
    border: 1px solid #1e1e28;
    color: #3d3d52;
    cursor: pointer;
    padding: 5px 10px;
    font-family: inherit;
    font-size: 0.75rem;
    border-radius: 5px;
    transition: all 0.15s;
    white-space: nowrap;
  }

  .toolbar-btn:hover {
    border-color: #3a2020;
    color: #ff6b6b;
    background: #1a0f0f;
  }

  /* Terminal area */
  .terminal-area {
    flex: 1;
    overflow: hidden;
    position: relative;
    background: #0d0d0f;
  }

  .term-slot {
    position: absolute;
    inset: 0;
    padding: 8px;
  }
</style>
