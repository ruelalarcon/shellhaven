<script lang="ts">
  import Terminal from "./Terminal.svelte";
  import LogBrowser from "./LogBrowser.svelte";
  import LogViewer from "./LogViewer.svelte";
  import type { ShellState, PaneView } from "../lib/types";
  import {
    Trash2,
    Terminal as TerminalIcon,
    Circle,
    Cpu,
    Activity,
    ScrollText,
    ChevronRight,
    Download,
  } from "@lucide/svelte";

  let { ids, selectedId, shells, view, onviewchange }: {
    ids: string[];
    selectedId: string;
    shells: ShellState[];
    view: PaneView;
    onviewchange: (v: PaneView) => void;
  } = $props();

  let termRefs = $state<Record<string, Terminal>>({});

  function getStatus(id: string): string {
    if (id === "shell") return "running";
    return shells.find((s) => s.id === id)?.status ?? "stopped";
  }

  function getRestartPolicy(id: string): string {
    if (id === "shell") return "";
    return shells.find((s) => s.id === id)?.restartPolicy ?? "";
  }

  let isManagedShell = $derived(selectedId !== "shell" && selectedId !== "btop");

  function downloadUrl(filename: string): string {
    return `/api/shells/${selectedId}/logs/${encodeURIComponent(filename)}`;
  }
</script>

<div class="pane">
  <!-- Toolbar -->
  <div class="toolbar">
    <div class="toolbar-left">
      <!-- Icon -->
      <span class="toolbar-icon">
        {#if selectedId === "shell"}
          <TerminalIcon size={14} />
        {:else if selectedId === "btop"}
          <Activity size={14} />
        {:else}
          <Cpu size={14} />
        {/if}
      </span>

      <!-- Breadcrumb -->
      {#if view.type === "terminal"}
        <span class="crumb-current">{selectedId}</span>
        {#if isManagedShell}
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
      {:else if view.type === "logs"}
        <button class="crumb" onclick={() => onviewchange({ type: "terminal" })}>{selectedId}</button>
        <ChevronRight size={10} class="crumb-sep" />
        <span class="crumb-current">logs</span>
      {:else if view.type === "log-file"}
        <button class="crumb" onclick={() => onviewchange({ type: "terminal" })}>{selectedId}</button>
        <ChevronRight size={10} class="crumb-sep" />
        <button class="crumb" onclick={() => onviewchange({ type: "logs" })}>logs</button>
        <ChevronRight size={10} class="crumb-sep" />
        <span class="crumb-current">{view.filename}</span>
      {/if}
    </div>

    <!-- Actions -->
    <div class="toolbar-right">
      {#if view.type === "terminal"}
        {#if selectedId !== "btop"}
          <button class="toolbar-btn" onclick={() => termRefs[selectedId]?.clear()}>
            <Trash2 size={13} /><span>clear</span>
          </button>
        {/if}
      {:else if view.type === "logs"}
        <!-- no action -->
      {:else if view.type === "log-file"}
        <a class="toolbar-btn" href={downloadUrl(view.filename)} download={view.filename}>
          <Download size={13} /><span>download</span>
        </a>
      {/if}
    </div>
  </div>

  <!-- Content -->
  <div class="content-area">
    <!-- Terminals — always mounted, hidden when not active -->
    {#each ids as id (id)}
      <div class="slot" style:display={view.type === "terminal" && id === selectedId ? "block" : "none"}>
        <Terminal {id} visible={view.type === "terminal" && id === selectedId} bind:this={termRefs[id]} />
      </div>
    {/each}

    <!-- Log browser -->
    {#if view.type === "logs" && isManagedShell}
      <div class="slot">
        <LogBrowser
          shellId={selectedId}
          onopen={(filename) => onviewchange({ type: "log-file", filename })}
        />
      </div>
    {/if}

    <!-- Log file viewer -->
    {#if view.type === "log-file" && isManagedShell}
      <div class="slot">
        <LogViewer shellId={selectedId} filename={view.filename} />
      </div>
    {/if}
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
    gap: 8px;
    min-width: 0;
    flex: 1;
    overflow: hidden;
  }

  .toolbar-icon {
    display: flex;
    align-items: center;
    color: #c9d1e0;
    flex-shrink: 0;
  }

  .crumb {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: 600;
    color: #4a4a62;
    letter-spacing: 0.04em;
    white-space: nowrap;
    transition: color 0.12s;
    flex-shrink: 0;
  }

  .crumb:hover { color: #8b95a8; }

  .crumb-current {
    font-size: 0.85rem;
    font-weight: 600;
    color: #c9d1e0;
    letter-spacing: 0.04em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  :global(.crumb-sep) { color: #2e2e3e; flex-shrink: 0; }

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
    text-decoration: none;
  }

  .toolbar-btn:hover {
    border-color: #3a2020;
    color: #ff6b6b;
    background: #1a0f0f;
  }

  a.toolbar-btn:hover {
    border-color: #1e3a4a;
    color: #61afef;
    background: #0d1520;
  }

  @media (max-width: 767px) {
    .toolbar { padding: 0 10px; height: 42px; }
    .toolbar-btn span { display: none; }
    .toolbar-btn { padding: 6px 8px; }
    .crumb-current { font-size: 0.8rem; }
    .crumb { font-size: 0.8rem; }
  }

  /* Content */
  .content-area {
    flex: 1;
    overflow: hidden;
    position: relative;
    background: #0d0d0f;
  }

  .slot {
    position: absolute;
    inset: 0;
    padding: 8px;
  }

  /* log browser/viewer don't need the 8px pad */
  .slot:has(> :global(.browser)),
  .slot:has(> :global(.viewer)) {
    padding: 0;
  }
</style>
