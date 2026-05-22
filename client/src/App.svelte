<script lang="ts">
  import { onMount } from "svelte";
  import type { ServiceState } from "./lib/types";
  import { onMessage, onOpen, onClose } from "./lib/ws";
  import Sidebar from "./components/Sidebar.svelte";
  import TerminalPane from "./components/TerminalPane.svelte";

  let services: ServiceState[] = [];
  let selectedId: string = "shell";
  let connected: boolean = false;

  $: terminalIds = ["shell", ...services.map((s) => s.id)];

  onMount(() => {
    const removeMsg = onMessage((msg) => {
      if (msg.type === "state") {
        services = msg.services;
      }
    });
    const removeOpen = onOpen(() => { connected = true; });
    const removeClose = onClose(() => { connected = false; });
    return () => { removeMsg(); removeOpen(); removeClose(); };
  });
</script>

<div class="app">
  {#if !connected}
    <div class="connecting">connecting…</div>
  {/if}
  <Sidebar {services} {selectedId} on:select={(e) => (selectedId = e.detail)} />
  <TerminalPane ids={terminalIds} {selectedId} />
</div>

<style>
  :global(*, *::before, *::after) {
    box-sizing: border-box;
  }

  :global(html, body) {
    margin: 0;
    padding: 0;
    height: 100%;
    background: #1a1a1a;
    color: #e0e0e0;
    font-family: monospace;
  }

  :global(#app) {
    height: 100%;
  }

  .app {
    display: flex;
    height: 100vh;
    overflow: hidden;
    position: relative;
  }

  .connecting {
    position: fixed;
    top: 0.5rem;
    right: 0.75rem;
    font-size: 0.75rem;
    color: #e5c07b;
    z-index: 100;
  }
</style>
