<script lang="ts">
  import type { ServiceState } from "../lib/types";
  import ServiceItem from "./ServiceItem.svelte";
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
  } from "@lucide/svelte";
  import { push } from "svelte-spa-router";

  let { services, selectedId, connected, onselect }: {
    services: ServiceState[];
    selectedId: string;
    connected: boolean;
    onselect: (id: string) => void;
  } = $props();

  let query = $state("");
  let collapsedGroups = $state(new Set<string>());

  function toggleGroup(group: string) {
    const next = new Set(collapsedGroups);
    if (next.has(group)) next.delete(group);
    else next.add(group);
    collapsedGroups = next;
  }

  // Filter services by query, then bucket into groups
  let filtered = $derived(
    query.trim()
      ? services.filter((s) => s.id.toLowerCase().includes(query.trim().toLowerCase()))
      : services
  );

  // [ [groupName | undefined, services[]] ]
  let grouped = $derived.by(() => {
    const map = new Map<string, ServiceState[]>();
    for (const svc of filtered) {
      const key = svc.group ?? "";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(svc);
    }
    // ungrouped first, then named groups alphabetically
    const entries: [string, ServiceState[]][] = [];
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

  let selectedService = $derived(services.find((s) => s.id === selectedId));

  // Whether shell matches the search
  let shellVisible = $derived(
    !query.trim() || "shell".includes(query.trim().toLowerCase())
  );
</script>

<aside class="sidebar">
  <!-- Header -->
  <div class="header">
    <div class="brand">
      <TerminalSquare size={16} class="brand-icon" />
      <span class="brand-name">services</span>
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

  <!-- Service list -->
  <nav class="service-list">
    <!-- Shell always first, filtered by query -->
    {#if shellVisible}
      <ServiceItem
        service={{ id: "shell", status: "running", restartPolicy: "always" }}
        selected={selectedId === "shell"}
        onclick={() => onselect("shell")}
      />
    {/if}

    <!-- Grouped services -->
    {#each grouped as [group, svcs]}
      {#if group === ""}
        <!-- Ungrouped: render flat -->
        {#each svcs as svc (svc.id)}
          <ServiceItem
            service={svc}
            selected={selectedId === svc.id}
            onclick={() => onselect(svc.id)}
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
                <ServiceItem
                  service={svc}
                  selected={selectedId === svc.id}
                  onclick={() => onselect(svc.id)}
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

  <!-- Selected service controls -->
  {#if selectedId !== "shell" && selectedService}
    <div class="control-section">
      <div class="control-label">
        <ChevronRight size={10} />
        {selectedId}
      </div>
      <div class="control-buttons">
        <button class="ctrl-btn start" onclick={() => apiCall(`/api/services/${selectedId}/start`)}>
          <Play size={12} /><span>start</span>
        </button>
        <button class="ctrl-btn stop" onclick={() => apiCall(`/api/services/${selectedId}/stop`)}>
          <Square size={12} /><span>stop</span>
        </button>
        <button class="ctrl-btn restart" onclick={() => apiCall(`/api/services/${selectedId}/restart`)}>
          <RotateCw size={12} /><span>restart</span>
        </button>
      </div>
    </div>
  {/if}

  <div class="spacer"></div>

  <!-- Bottom actions -->
  <div class="bottom-section">
    <div class="global-actions">
      <button class="ghost-btn" onclick={() => apiCall("/api/services/start-all")}>
        <Play size={11} /><span>start all</span>
      </button>
      <button class="ghost-btn" onclick={() => apiCall("/api/services/stop-all")}>
        <Square size={11} /><span>stop all</span>
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

  /* Service list */
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

  /* Controls */
  .control-section {
    background: #0f0f13;
    border-top: 1px solid #1a1a20;
    padding: 8px 0 6px;
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
</style>
