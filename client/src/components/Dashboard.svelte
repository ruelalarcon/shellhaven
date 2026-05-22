<script lang="ts">
  import { onMount } from "svelte";
  import { push } from "svelte-spa-router";
  import type { ServiceState } from "../lib/types";
  import { onMessage, onOpen, onClose } from "../lib/ws";
  import Sidebar from "./Sidebar.svelte";
  import TerminalPane from "./TerminalPane.svelte";

  let services = $state<ServiceState[]>([]);
  let selectedId = $state("shell");
  let connected = $state(false);
  let ready = $state(false);

  let terminalIds = $derived(["shell", ...services.map((s) => s.id)]);

  onMount(async () => {
    const res = await fetch("/api/status");
    const { configured, authenticated } = await res.json();
    if (!configured) { push("/setup"); return; }
    if (!authenticated) { push("/login"); return; }
    ready = true;

    const removeMsg = onMessage((msg) => {
      if (msg.type === "state") services = msg.services;
    });
    const removeOpen = onOpen(() => { connected = true; });
    const removeClose = onClose(() => { connected = false; });
    return () => { removeMsg(); removeOpen(); removeClose(); };
  });
</script>

{#if ready}
  <div class="dashboard">
    <Sidebar {services} {selectedId} {connected} onselect={(id) => (selectedId = id)} />
    <TerminalPane ids={terminalIds} {selectedId} {services} />
  </div>
{/if}

<style>
  .dashboard {
    display: flex;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
</style>
