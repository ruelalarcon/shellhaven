<script lang="ts">
  import { onMount } from "svelte";
  import { push } from "svelte-spa-router";
  import type { ServiceState, PaneView } from "../lib/types";
  import { onMessage, onOpen, onClose, send } from "../lib/ws";
  import Sidebar from "./Sidebar.svelte";
  import TerminalPane from "./TerminalPane.svelte";

  let services = $state<ServiceState[]>([]);
  let selectedId = $state("shell");
  let connected = $state(false);
  let btop = $state(false);
  let view = $state<PaneView>({ type: "terminal" });

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
  <Sidebar
    {services}
    {selectedId}
    {connected}
    {btop}
    onselect={select}
    {openLogs}
  />
  <TerminalPane
    ids={terminalIds}
    {selectedId}
    {services}
    {view}
    onviewchange={(v) => (view = v)}
  />
</div>

<style>
  .dashboard {
    display: flex;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
</style>
