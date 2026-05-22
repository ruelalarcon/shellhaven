<script lang="ts">
  import { onMount } from "svelte";
  import type { ServiceState } from "./lib/types";
  import { onMessage, onOpen, onClose } from "./lib/ws";
  import Sidebar from "./components/Sidebar.svelte";
  import TerminalPane from "./components/TerminalPane.svelte";

  let services = $state<ServiceState[]>([]);
  let selectedId = $state("shell");
  let connected = $state(false);

  let terminalIds = $derived(["shell", ...services.map((s) => s.id)]);

  onMount(() => {
    const removeMsg = onMessage((msg) => {
      if (msg.type === "state") services = msg.services;
    });
    const removeOpen = onOpen(() => { connected = true; });
    const removeClose = onClose(() => { connected = false; });
    return () => { removeMsg(); removeOpen(); removeClose(); };
  });
</script>

<div class="app">
  <div class="main">
    <Sidebar {services} {selectedId} onselect={(id) => (selectedId = id)} />
    <TerminalPane ids={terminalIds} {selectedId} />
  </div>
  <div class="statusbar">
    <span class="status" class:disconnected={!connected}>
      {connected ? "connected" : "connecting…"}
    </span>
  </div>
</div>

<style>
  :global(*, *::before, *::after) { box-sizing: border-box; }
  :global(html, body) { margin: 0; padding: 0; height: 100%; background: #1a1a1a; color: #e0e0e0; font-family: monospace; }
  :global(#app) { height: 100%; }

  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }

  .main {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .statusbar {
    flex-shrink: 0;
    background: #141414;
    border-top: 1px solid #333;
    padding: 0 0.75rem;
    height: 30px;
    display: flex;
    align-items: center;
    font-size: 0.85rem;
    color: #555;
  }

  .status.disconnected {
    color: #e5c07b;
  }
</style>
