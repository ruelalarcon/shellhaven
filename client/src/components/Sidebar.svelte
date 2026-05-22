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
  } from "@lucide/svelte";

  let { services, selectedId, connected, onselect }: {
    services: ServiceState[];
    selectedId: string;
    connected: boolean;
    onselect: (id: string) => void;
  } = $props();

  async function apiCall(url: string) {
    await fetch(url, { method: "POST" });
  }

  let selectedService = $derived(services.find((s) => s.id === selectedId));
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

  <!-- Services list -->
  <div class="nav-section">
    <div class="nav-label">terminals</div>
    <nav class="service-list">
      <ServiceItem
        service={{ id: "shell", status: "running", restartPolicy: "always" }}
        selected={selectedId === "shell"}
        onclick={() => onselect("shell")}
      />
      {#each services as svc (svc.id)}
        <ServiceItem
          service={svc}
          selected={selectedId === svc.id}
          onclick={() => onselect(svc.id)}
        />
      {/each}
    </nav>
  </div>

  <!-- Selected service controls -->
  {#if selectedId !== "shell" && selectedService}
    <div class="nav-section control-section">
      <div class="nav-label">
        <ChevronRight size={10} />
        {selectedId}
      </div>
      <div class="control-buttons">
        <button class="ctrl-btn start" onclick={() => apiCall(`/api/services/${selectedId}/start`)}>
          <Play size={12} />
          <span>start</span>
        </button>
        <button class="ctrl-btn stop" onclick={() => apiCall(`/api/services/${selectedId}/stop`)}>
          <Square size={12} />
          <span>stop</span>
        </button>
        <button class="ctrl-btn restart" onclick={() => apiCall(`/api/services/${selectedId}/restart`)}>
          <RotateCw size={12} />
          <span>restart</span>
        </button>
      </div>
    </div>
  {/if}

  <div class="spacer"></div>

  <!-- Global actions -->
  <div class="bottom-section">
    <div class="global-actions">
      <button class="ghost-btn" onclick={() => apiCall("/api/services/start-all")}>
        <Play size={11} />
        <span>start all</span>
      </button>
      <button class="ghost-btn" onclick={() => apiCall("/api/services/stop-all")}>
        <Square size={11} />
        <span>stop all</span>
      </button>
    </div>
    <div class="logout-row">
      <form method="POST" action="/logout">
        <button type="submit" class="logout-btn">
          <LogOut size={12} />
          <span>logout</span>
        </button>
      </form>
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

  .brand {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  :global(.brand-icon) {
    color: #c9d1e0;
  }

  .brand-name {
    font-size: 0.8rem;
    font-weight: 600;
    color: #c9d1e0;
    letter-spacing: 0.08em;
    text-transform: lowercase;
  }

  .conn-indicator {
    display: flex;
    align-items: center;
    color: #3d3d4a;
    transition: color 0.3s;
  }

  .conn-indicator.connected {
    color: #5af78e;
  }

  /* Nav sections */
  .nav-section {
    padding: 10px 0 6px;
    border-bottom: 1px solid #1a1a20;
  }

  .nav-label {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 14px 6px;
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #3d3d52;
  }

  .service-list {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    max-height: 360px;
  }

  /* Control section */
  .control-section {
    background: #0f0f13;
  }

  .control-buttons {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 0 10px 6px;
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

  /* Spacer */
  .spacer { flex: 1; }

  /* Bottom */
  .bottom-section {
    border-top: 1px solid #1a1a20;
    padding: 8px 0;
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

  .logout-row {
    padding: 0 10px 2px;
  }

  .logout-row form { width: 100%; }

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
