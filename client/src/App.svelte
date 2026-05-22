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
  <Sidebar {services} {selectedId} {connected} onselect={(id) => (selectedId = id)} />
  <TerminalPane ids={terminalIds} {selectedId} {services} />
</div>

<style>
  :global(*, *::before, *::after) { box-sizing: border-box; }
  :global(html, body) {
    margin: 0;
    padding: 0;
    height: 100%;
    background: #0d0d0f;
    color: #e2e8f0;
    font-family: "CaskaydiaMonoNerdFont", ui-monospace, monospace;
  }
  :global(#app) { height: 100%; }

  .app {
    display: flex;
    height: 100vh;
    overflow: hidden;
    background: #0d0d0f;
  }
</style>
