<script lang="ts">
  import { onMount } from "svelte";
  import { Terminal as XTerm } from "@xterm/xterm";
  import { FitAddon } from "@xterm/addon-fit";
  import { send, onMessage, onOpen } from "../lib/ws";
  import "@xterm/xterm/css/xterm.css";

  let { id, visible }: { id: string; visible: boolean } = $props();

  let container: HTMLDivElement;
  let term: XTerm;
  let fitAddon: FitAddon;

  onMount(() => {
    term = new XTerm({
      fontFamily: '"CaskaydiaMono Nerd Font", "Cascadia Mono", monospace',
      fontSize: 14,
      theme: {
        background: "#1a1a1a",
        foreground: "#e0e0e0",
        cursor: "#e0e0e0",
        black: "#1a1a1a",
        red: "#e06c75",
        green: "#98c379",
        yellow: "#e5c07b",
        blue: "#61afef",
        magenta: "#c678dd",
        cyan: "#56b6c2",
        white: "#abb2bf",
        brightBlack: "#5c6370",
        brightRed: "#e06c75",
        brightGreen: "#98c379",
        brightYellow: "#e5c07b",
        brightBlue: "#61afef",
        brightMagenta: "#c678dd",
        brightCyan: "#56b6c2",
        brightWhite: "#ffffff",
      },
      cursorBlink: true,
    });

    fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);
    fitAddon.fit();

    term.onData((data: string) => {
      send({ type: "input", id, data });
    });

    const removeMsg = onMessage((msg) => {
      if (msg.type === "output" && msg.id === id) term.write(msg.data);
    });

    const removeOpen = onOpen(() => {
      fitAndResize();
      send({ type: "get-scrollback", id });
    });

    send({ type: "get-scrollback", id });

    const ro = new ResizeObserver(() => {
      if (visible) fitAndResize();
    });
    ro.observe(container);

    return () => {
      removeMsg();
      removeOpen();
      ro.disconnect();
      term.dispose();
    };
  });

  $effect(() => {
    if (visible && fitAddon) setTimeout(fitAndResize, 10);
  });

  function fitAndResize() {
    if (!fitAddon || !term) return;
    fitAddon.fit();
    send({ type: "resize", id, cols: term.cols, rows: term.rows });
  }

  export function clear() {
    term?.clear();
  }
</script>

<div class="terminal-wrapper" bind:this={container}></div>

<style>
  .terminal-wrapper {
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #1a1a1a;
  }

  :global(.terminal-wrapper .xterm) { height: 100%; }
  :global(.terminal-wrapper .xterm-viewport) { overflow-y: auto; }
</style>
