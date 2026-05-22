<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { ServiceState } from "../lib/types";
  import ServiceItem from "./ServiceItem.svelte";

  export let services: ServiceState[];
  export let selectedId: string;

  const dispatch = createEventDispatcher<{ select: string }>();

  async function apiCall(url: string) {
    await fetch(url, { method: "POST" });
  }
</script>

<aside class="sidebar">
  <div class="section services-list">
    <ServiceItem
      service={{ id: "shell", status: "running", restartPolicy: "always" }}
      selected={selectedId === "shell"}
      on:click={() => dispatch("select", "shell")}
    />
    {#each services as svc (svc.id)}
      <ServiceItem
        service={svc}
        selected={selectedId === svc.id}
        on:click={() => dispatch("select", svc.id)}
      />
    {/each}
  </div>

  <div class="section global-actions">
    <button on:click={() => apiCall("/api/services/start-all")}>Start All</button>
    <button on:click={() => apiCall("/api/services/stop-all")}>Stop All</button>
  </div>

  {#if selectedId !== "shell"}
    <div class="section per-service">
      <div class="section-label">{selectedId}</div>
      <button on:click={() => apiCall(`/api/services/${selectedId}/start`)}>Start</button>
      <button on:click={() => apiCall(`/api/services/${selectedId}/stop`)}>Stop</button>
      <button on:click={() => apiCall(`/api/services/${selectedId}/restart`)}>Restart</button>
    </div>
  {/if}

  <div class="spacer"></div>

  <div class="section logout">
    <form method="POST" action="/logout">
      <button type="submit" class="logout-btn">Logout</button>
    </form>
  </div>
</aside>

<style>
  .sidebar {
    width: 180px;
    flex-shrink: 0;
    background: #141414;
    border-right: 1px solid #333;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .section {
    padding: 0.5rem 0;
    border-bottom: 1px solid #2a2a2a;
  }

  .services-list {
    flex: 1;
    overflow-y: auto;
  }

  .global-actions,
  .per-service {
    padding: 0.5rem 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .section-label {
    font-size: 0.75rem;
    color: #666;
    margin-bottom: 0.3rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  button {
    background: #2a2a2a;
    border: 1px solid #444;
    color: #ccc;
    cursor: pointer;
    padding: 0.35rem 0.5rem;
    font-family: monospace;
    font-size: 0.85rem;
    text-align: left;
    border-radius: 3px;
  }

  button:hover {
    background: #363636;
    color: #e0e0e0;
  }

  .spacer {
    flex: 1;
  }

  .logout {
    padding: 0.5rem 0.75rem;
  }

  .logout-btn {
    width: 100%;
    color: #888;
    font-size: 0.8rem;
  }
</style>
