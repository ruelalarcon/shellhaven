<script lang="ts">
  import { onMount } from "svelte";
  import { push } from "svelte-spa-router";
  import type { ServiceState } from "../lib/types";
  import { onMessage, onOpen, onClose, send } from "../lib/ws";
  import Sidebar from "./Sidebar.svelte";
  import TerminalPane from "./TerminalPane.svelte";

  let services = $state<ServiceState[]>([]);
  let selectedId = $state("shell");
  let connected = $state(false);

  let terminalIds = $derived(["shell", ...services.map((s) => s.id)]);

  onMount(() => {
    const removeMsg = onMessage((msg) => {
      if (msg.type === "state") services = msg.services;
    });
    const removeOpen = onOpen(() => { connected = true; send({ type: "get-state" }); });
    const removeClose = onClose(() => { connected = false; });

    fetch("/api/status")
      .then((r) => r.json())
      .then(({ configured, authenticated }) => {
        if (!configured) push("/setup");
        else if (!authenticated) push("/login");
      });

    return () => { removeMsg(); removeOpen(); removeClose(); };
  });
</script>

<div class="dashboard">
  <Sidebar {services} {selectedId} {connected} onselect={(id) => (selectedId = id)} />
  <TerminalPane ids={terminalIds} {selectedId} {services} />
</div>

<style>
  .dashboard {
    display: flex;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
</style>
