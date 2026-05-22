<script lang="ts">
  import { onMount } from "svelte";
  import { push } from "svelte-spa-router";
  import type { ServiceState, PaneView } from "../lib/types";
  import { onMessage, onOpen, onClose, send } from "../lib/ws";
  import Sidebar from "./Sidebar.svelte";
  import TerminalPane from "./TerminalPane.svelte";
  import { TerminalSquare, Menu, Wifi, WifiOff } from "@lucide/svelte";
  import type { ServiceStats } from "../lib/types";

  let services = $state<ServiceState[]>([]);
  let selectedId = $state("shell");
  let connected = $state(false);
  let btop = $state(false);
  let view = $state<PaneView>({ type: "terminal" });
  let sidebarOpen = $state(false);
  let stats = $state<Record<string, ServiceStats>>({});

  let terminalIds = $derived([
    "shell",
    ...(btop ? ["btop"] : []),
    ...services.map((s) => s.id),
  ]);

  function select(id: string) {
    selectedId = id;
    view = { type: "terminal" };
  }

  function openLogs(id: string) {
    selectedId = id;
    view = { type: "logs" };
  }

  onMount(() => {
    const removeMsg = onMessage((msg) => {
      if (msg.type === "state") services = msg.services;
      else if (msg.type === "stats") stats = msg.stats;
    });
    const removeOpen = onOpen(() => { connected = true; send({ type: "get-state" }); });
    const removeClose = onClose(() => { connected = false; });

    fetch("/api/status")
      .then((r) => r.json())
      .then((data) => {
        if (!data.configured) { push("/setup"); return; }
        if (!data.authenticated) { push("/login"); return; }
        btop = data.btop ?? false;
      });

    return () => { removeMsg(); removeOpen(); removeClose(); };
  });
</script>

<div class="dashboard">
  <!-- Mobile top bar -->
  <div class="mobile-bar">
    <div class="mobile-brand">
      <TerminalSquare size={14} />
      <span>services</span>
    </div>
    <div class="mobile-right">
      <span class="mobile-conn" class:connected>
        {#if connected}<Wifi size={13} />{:else}<WifiOff size={13} />{/if}
      </span>
      <button class="mobile-menu" onclick={() => (sidebarOpen = !sidebarOpen)}>
        <Menu size={18} />
      </button>
    </div>
  </div>

  <!-- Sidebar drawer backdrop -->
  <div class="backdrop" class:visible={sidebarOpen} onclick={() => (sidebarOpen = false)}></div>

  <div class="layout">
    <div class="sidebar-wrap" class:open={sidebarOpen}>
      <Sidebar
        {services}
        {selectedId}
        {connected}
        {btop}
        {stats}
        onselect={select}
        {openLogs}
      />
    </div>
    <TerminalPane
      ids={terminalIds}
      {selectedId}
      {services}
      {view}
      onviewchange={(v) => (view = v)}
    />
  </div>
</div>

<style>
  .dashboard {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  /* Mobile top bar — hidden on desktop */
  .mobile-bar {
    display: none;
    align-items: center;
    justify-content: space-between;
    padding: 0 14px;
    height: 46px;
    background: #111114;
    border-bottom: 1px solid #1e1e24;
    flex-shrink: 0;
    z-index: 10;
  }

  .mobile-brand {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.8rem;
    font-weight: 600;
    color: #c9d1e0;
    letter-spacing: 0.08em;
  }

  .mobile-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .mobile-conn {
    display: flex;
    align-items: center;
    color: #3d3d4a;
    transition: color 0.3s;
  }

  .mobile-conn.connected { color: #5af78e; }

  .mobile-menu {
    background: none;
    border: none;
    color: #6b7280;
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    border-radius: 4px;
    transition: color 0.15s;
  }

  .mobile-menu:hover { color: #c9d1e0; }

  /* Backdrop */
  .backdrop {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 20;
    opacity: 0;
    transition: opacity 0.25s;
  }

  .backdrop.visible { opacity: 1; }

  /* Layout */
  .layout {
    display: flex;
    flex: 1;
    overflow: hidden;
    min-height: 0;
  }

  .sidebar-wrap {
    display: contents;
  }

  /* Mobile styles */
  @media (max-width: 767px) {
    .mobile-bar { display: flex; }

    .backdrop { display: block; pointer-events: none; }
    .backdrop.visible { pointer-events: auto; }

    .sidebar-wrap {
      display: block;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 30;
      max-height: 75vh;
      transform: translateY(100%);
      transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      border-radius: 12px 12px 0 0;
      overflow: hidden;
    }

    .sidebar-wrap.open {
      transform: translateY(0);
    }

    /* Hide the sidebar's own header on mobile since we have the top bar */
    .sidebar-wrap :global(.sidebar .header) {
      display: none;
    }
  }
</style>
