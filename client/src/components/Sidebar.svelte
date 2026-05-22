<script lang="ts">
  import type { ShellState, ShellStats } from "../lib/types";
  import ShellItem from "./ShellItem.svelte";
  import {
    TerminalSquare,
    Play,
    Square,
    RotateCw,
    LogOut,
    Wifi,
    WifiOff,
    ChevronRight,
    Search,
    Activity,
    ScrollText,
    ScanSearch,
  } from "@lucide/svelte";
  import { push } from "svelte-spa-router";

  let { shells, selectedId, connected, btop, stats, onselect, openLogs }: {
    shells: ShellState[];
    selectedId: string;
    connected: boolean;
    btop: boolean;
    stats: Record<string, ShellStats>;
    onselect: (id: string) => void;
    openLogs: (id: string) => void;
  } = $props();

  function formatMem(bytes: number): string {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}K`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}G`;
  }

  let query = $state("");
  let collapsedGroups = $state(new Set<string>());

  function toggleGroup(group: string) {
    const next = new Set(collapsedGroups);
    if (next.has(group)) next.delete(group);
    else next.add(group);
    collapsedGroups = next;
  }

  // Filter shells by query, then bucket into groups
  let filtered = $derived(
    query.trim()
      ? shells.filter((s) => s.id.toLowerCase().includes(query.trim().toLowerCase()))
      : shells
  );

  // [ [groupName | undefined, shells[]] ]
  let grouped = $derived.by(() => {
    const map = new Map<string, ShellState[]>();
    for (const svc of filtered) {
      const key = svc.group ?? "";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(svc);
    }
    // ungrouped first, then named groups alphabetically
    const entries: [string, ShellState[]][] = [];
    if (map.has("")) entries.push(["", map.get("")!]);
    for (const [k, v] of [...map.entries()].filter(([k]) => k !== "").sort(([a], [b]) => a.localeCompare(b))) {
      entries.push([k, v]);
    }
    return entries;
  });

  async function apiCall(url: string) {
    await fetch(url, { method: "POST" });
  }

  async function logout() {
    await fetch("/logout", { method: "POST" });
    push("/login");
  }

  let selectedShell = $derived(shells.find((s) => s.id === selectedId));

  let shellVisible = $derived(
    !query.trim() || "shell".includes(query.trim().toLowerCase())
  );

  let btopVisible = $derived(
    btop && (!query.trim() || "btop".includes(query.trim().toLowerCase()))
  );
</script>

<aside class="sidebar">
  <!-- Header -->
  <div class="header">
    <div class="brand">
      <TerminalSquare size={16} class="brand-icon" />
      <span class="brand-name">shellhaven</span>
    </div>
    <div class="conn-indicator" class:connected>
      {#if connected}
        <Wifi size={12} />
      {:else}
        <WifiOff size={12} />
      {/if}
    </div>
  </div>

  <!-- Search -->
  <div class="search-wrap">
    <Search size={12} class="search-icon" />
    <input
      class="search"
      type="text"
      placeholder="search"
      bind:value={query}
    />
    {#if query}
      <button class="clear-search" onclick={() => (query = "")}>×</button>
    {/if}
  </div>

  <!-- Shell list -->
  <nav class="service-list">
    <!-- Shell always first, filtered by query -->
    {#if shellVisible}
      <ShellItem
        service={{ id: "shell", status: "running", restartPolicy: "always" }}
        selected={selectedId === "shell"}
        onclick={() => onselect("shell")}
        stats={undefined}
      />
    {/if}

    <!-- btop if available -->
    {#if btopVisible}
      <button
        class="item btop-item"
        class:selected={selectedId === "btop"}
        onclick={() => onselect("btop")}
      >
        <span class="icon-wrap"><Activity size={13} /></span>
        <span class="name">btop</span>
      </button>
    {/if}

    <!-- Grouped shells -->
    {#each grouped as [group, svcs]}
      {#if group === ""}
        <!-- Ungrouped: render flat -->
        {#each svcs as svc (svc.id)}
          <ShellItem
            service={svc}
            selected={selectedId === svc.id}
            onclick={() => onselect(svc.id)}
            stats={stats[svc.id]}
          />
        {/each}
      {:else}
        <!-- Named group with collapsible header -->
        <div class="group">
          <button
            class="group-header"
            onclick={() => toggleGroup(group)}
          >
            <ChevronRight
              size={10}
              class="chevron {collapsedGroups.has(group) ? '' : 'open'}"
            />
            <span class="group-name">{group}</span>
            <span class="group-count">{svcs.length}</span>
          </button>
          {#if !collapsedGroups.has(group)}
            <div class="group-items">
              {#each svcs as svc (svc.id)}
                <ShellItem
                  service={svc}
                  selected={selectedId === svc.id}
                  onclick={() => onselect(svc.id)}
                  stats={stats[svc.id]}
                />
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    {/each}

    {#if !shellVisible && filtered.length === 0}
      <div class="empty">no results</div>
    {/if}
  </nav>

  <!-- Selected shell controls -->
  {#if selectedId !== "shell" && selectedShell}
    <div class="control-section">
      <div class="control-label">
        <ChevronRight size={10} />
        {selectedId}
      </div>
      {#if stats[selectedId]}
        {@const s = stats[selectedId]}
        <div class="stats-row">
          <span class="stat-item">
            <span class="stat-label">cpu</span>
            <span class="stat-value">{s.cpu.toFixed(1)}%</span>
          </span>
          <span class="stat-divider"></span>
          <span class="stat-item">
            <span class="stat-label">mem</span>
            <span class="stat-value">{formatMem(s.mem)}</span>
          </span>
        </div>
      {/if}
      <div class="control-buttons">
        <button class="ctrl-btn logs" onclick={() => openLogs(selectedId)}>
          <ScrollText size={12} /><span>logs</span>
        </button>
        <button class="ctrl-btn start" onclick={() => apiCall(`/api/shells/${selectedId}/start`)}>
          <Play size={12} /><span>start</span>
        </button>
        <button class="ctrl-btn stop" onclick={() => apiCall(`/api/shells/${selectedId}/stop`)}>
          <Square size={12} /><span>stop</span>
        </button>
        <button class="ctrl-btn restart" onclick={() => apiCall(`/api/shells/${selectedId}/restart`)}>
          <RotateCw size={12} /><span>restart</span>
        </button>
      </div>
    </div>
  {/if}

  <div class="spacer"></div>

  <!-- Bottom actions -->
  <div class="bottom-section">
    <div class="global-actions">
      <button class="ghost-btn" onclick={() => apiCall("/api/shells/start-all")}>
        <Play size={11} /><span>start all</span>
      </button>
      <button class="ghost-btn" onclick={() => apiCall("/api/shells/stop-all")}>
        <Square size={11} /><span>stop all</span>
      </button>
      <button class="ghost-btn rescan" onclick={() => apiCall("/api/shells/rescan")} title="Rescan ~/shells/ for added, removed, or changed scripts">
        <ScanSearch size={11} /><span>rescan</span>
      </button>
    </div>
    <div class="logout-row">
      <button class="logout-btn" onclick={logout}>
        <LogOut size={12} /><span>logout</span>
      </button>
    </div>
  </div>
</aside>

<style>
  .sidebar {
    width: 220px;
    flex-shrink: 0;
    background: #111114;
    border-right: 1px solid #1e1e24;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    font-family: inherit;
  }

  /* Header */
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 14px;
    height: 46px;
    border-bottom: 1px solid #1e1e24;
    flex-shrink: 0;
  }

  .brand { display: flex; align-items: center; gap: 8px; }

  :global(.brand-icon) { color: #c9d1e0; }

  .brand-name {
    font-size: 0.8rem;
    font-weight: 600;
    color: #c9d1e0;
    letter-spacing: 0.08em;
  }

  .conn-indicator { display: flex; align-items: center; color: #3d3d4a; transition: color 0.3s; }
  .conn-indicator.connected { color: #5af78e; }

  /* Search */
  .search-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-bottom: 1px solid #1a1a20;
    flex-shrink: 0;
  }

  :global(.search-icon) { color: #3d3d52; flex-shrink: 0; }

  .search {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: #c9d1e0;
    font-family: inherit;
    font-size: 0.8rem;
    padding: 0;
    min-width: 0;
  }

  .search::placeholder { color: #3a3a52; }

  .clear-search {
    background: none;
    border: none;
    color: #3d3d52;
    cursor: pointer;
    padding: 0;
    font-size: 0.9rem;
    line-height: 1;
    flex-shrink: 0;
    transition: color 0.15s;
  }

  .clear-search:hover { color: #6b7280; }

  /* Shell list */
  .service-list {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .service-list::-webkit-scrollbar { width: 4px; }
  .service-list::-webkit-scrollbar-track { background: transparent; }
  .service-list::-webkit-scrollbar-thumb { background: #1e1e28; border-radius: 2px; }

  /* Groups */
  .group { display: flex; flex-direction: column; }

  .group-header {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    background: none;
    border: none;
    padding: 5px 12px 5px 10px;
    cursor: pointer;
    color: #3d3d52;
    font-family: inherit;
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    transition: color 0.15s;
  }

  .group-header:hover { color: #6b7280; }

  :global(.chevron) { transition: transform 0.15s; flex-shrink: 0; }
  :global(.chevron.open) { transform: rotate(90deg); }

  .group-name { flex: 1; text-align: left; }

  .group-count {
    font-size: 0.6rem;
    background: #1a1a22;
    color: #3d3d52;
    padding: 1px 5px;
    border-radius: 3px;
  }

  .group-items { display: flex; flex-direction: column; }

  .empty {
    padding: 12px 14px;
    font-size: 0.75rem;
    color: #3a3a52;
  }

  .item {
    display: flex;
    align-items: center;
    gap: 9px;
    width: 100%;
    background: none;
    border: none;
    border-left: 2px solid transparent;
    color: #4a4a62;
    cursor: pointer;
    padding: 6px 12px;
    font-family: inherit;
    font-size: 0.82rem;
    text-align: left;
    transition: all 0.12s;
    line-height: 1;
  }

  .item:hover { background: #16161c; color: #8b95a8; border-left-color: #2e2e3e; }
  .item.selected { background: #15151c; color: #c9d1e0; border-left-color: #c9d1e0; }

  .icon-wrap {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    width: 16px;
    justify-content: center;
  }

  .item.selected .icon-wrap { color: #c9d1e0; }

  .name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Controls */
  .control-section {
    background: #0f0f13;
    border-top: 1px solid #1a1a20;
    padding: 8px 0 6px;
    flex-shrink: 0;
  }

  .stats-row {
    display: flex;
    align-items: center;
    gap: 0;
    padding: 0 14px 6px;
  }

  .stat-item {
    display: flex;
    align-items: baseline;
    gap: 4px;
  }

  .stat-label {
    font-size: 0.6rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #3d3d52;
  }

  .stat-value {
    font-size: 0.72rem;
    font-weight: 600;
    color: #6b7280;
    font-variant-numeric: tabular-nums;
  }

  .stat-divider {
    width: 1px;
    height: 10px;
    background: #1e1e28;
    margin: 0 10px;
    flex-shrink: 0;
  }

  .control-label {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 14px 6px;
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #3d3d52;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .control-buttons {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 0 10px;
  }

  .ctrl-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    background: transparent;
    border: 1px solid #1e1e28;
    color: #6b7280;
    cursor: pointer;
    padding: 5px 10px;
    font-family: inherit;
    font-size: 0.78rem;
    border-radius: 5px;
    transition: all 0.15s;
  }

  .ctrl-btn:hover { border-color: #2e2e3e; color: #a1aab8; background: #18181e; }
  .ctrl-btn.logs:hover { border-color: #2e3a2e; color: #c9d1e0; background: #131a13; }
  .ctrl-btn.start:hover { border-color: #1e4a2e; color: #5af78e; background: #0d1f15; }
  .ctrl-btn.stop:hover { border-color: #4a1e1e; color: #ff6b6b; background: #1f0d0d; }
  .ctrl-btn.restart:hover { border-color: #2e3a4a; color: #61afef; background: #0d1520; }

  .spacer { flex: 0; }

  /* Bottom */
  .bottom-section {
    border-top: 1px solid #1a1a20;
    padding: 8px 0;
    flex-shrink: 0;
  }

  .global-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 4px 10px 8px;
  }

  .ghost-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    background: transparent;
    border: 1px solid #1e1e28;
    color: #454558;
    cursor: pointer;
    padding: 5px 6px;
    font-family: inherit;
    font-size: 0.72rem;
    border-radius: 5px;
    transition: all 0.15s;
  }

  .ghost-btn:hover { border-color: #2e2e3e; color: #7c8494; background: #18181e; }
  .ghost-btn.rescan:hover { border-color: #3a2e4a; color: #b08cda; background: #18121e; }

  .logout-row { padding: 0 10px 2px; }

  .logout-btn {
    display: flex;
    align-items: center;
    gap: 7px;
    width: 100%;
    background: transparent;
    border: none;
    color: #3a3a4a;
    cursor: pointer;
    padding: 5px 4px;
    font-family: inherit;
    font-size: 0.75rem;
    border-radius: 4px;
    transition: color 0.15s;
  }

  .logout-btn:hover { color: #6b7280; }

  @media (max-width: 767px) {
    .sidebar {
      width: 100%;
      border-right: none;
      border-radius: 12px 12px 0 0;
      max-height: 75vh;
      overflow-y: auto;
    }

    .service-list { max-height: none; }

    /* Larger touch targets */
    .item { padding: 10px 16px; font-size: 0.9rem; }
    .ctrl-btn { padding: 10px 14px; font-size: 0.85rem; }
    .ghost-btn { padding: 10px 8px; font-size: 0.8rem; }
    .group-header { padding: 8px 16px 8px 14px; }
  }
</style>
