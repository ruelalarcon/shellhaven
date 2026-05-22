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
      fontFamily: '"CaskaydiaMonoNerdFontMono", ui-monospace, monospace',
      fontSize: 14,
      lineHeight: 1.35,
      letterSpacing: 0.3,
      theme: {
        background: "#0d0d0f",
        foreground: "#c9d1e0",
        cursor: "#c9d1e0",
        cursorAccent: "#0d0d0f",
        selectionBackground: "#2d2b55",
        black: "#1a1a22",
        red: "#ff6b6b",
        green: "#5af78e",
        yellow: "#f4d03f",
        blue: "#61afef",
        magenta: "#c678dd",
        cyan: "#56d4c8",
        white: "#c9d1e0",
        brightBlack: "#4a4a62",
        brightRed: "#ff8585",
        brightGreen: "#72f7a4",
        brightYellow: "#f7e06a",
        brightBlue: "#7ec8ff",
        brightMagenta: "#d89cf7",
        brightCyan: "#78e8de",
        brightWhite: "#e8edf5",
      },
      cursorBlink: true,
      cursorStyle: "block",
      scrollback: 5000,
    });

    fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);
    fitAddon.fit();

    term.onData((data: string) => {
      send({ type: "input", id, data });
    });

    term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "C" && e.type === "keydown") {
        const selection = term.getSelection();
        if (selection) navigator.clipboard.writeText(selection);
        return false;
      }
      return true;
    });

    let scrollbackReceived = false;
    const removeMsg = onMessage((msg) => {
      if (msg.type === "output" && msg.id === id) {
        if (!scrollbackReceived) {
          scrollbackReceived = true;
          term.write(msg.data, () => {
            fitAddon?.fit();
            term.scrollToBottom();
          });
        } else {
          term.write(msg.data);
        }
      }
    });

    const removeOpen = onOpen(() => {
      scrollbackReceived = false;
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
    if (visible && fitAddon) {
      setTimeout(() => {
        fitAndResize();
        term?.scrollToBottom();
        term?.focus();
      }, 10);
    }
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
    background: #0d0d0f;
  }

  :global(.terminal-wrapper .xterm) { height: 100%; }
  :global(.terminal-wrapper .xterm-viewport) { overflow-y: auto; }
  :global(.terminal-wrapper .xterm-viewport::-webkit-scrollbar) { width: 6px; }
  :global(.terminal-wrapper .xterm-viewport::-webkit-scrollbar-track) { background: transparent; }
  :global(.terminal-wrapper .xterm-viewport::-webkit-scrollbar-thumb) { background: #2a2a38; border-radius: 3px; }
  :global(.terminal-wrapper .xterm-viewport::-webkit-scrollbar-thumb:hover) { background: #3a3a50; }
</style>
