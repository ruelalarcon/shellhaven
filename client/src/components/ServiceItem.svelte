<script lang="ts">
  import type { ShellState, ShellStats } from "../lib/types";
  import { Terminal, Circle } from "@lucide/svelte";

  let { service, selected, onclick, stats }: {
    service: ShellState;
    selected: boolean;
    onclick: () => void;
    stats: ShellStats | undefined;
  } = $props();

  let isShell = $derived(service.id === "shell");

  function formatMem(bytes: number): string {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}K`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}G`;
  }
</script>

<button class="item" class:selected class:running={service.status === "running"} class:crashed={service.status === "crashed"} {onclick}>
  <span class="icon-wrap">
    {#if isShell}
      <Terminal size={13} />
    {:else}
      <Circle size={7} class="status-dot {service.status}" />
    {/if}
  </span>
  <span class="name">{service.id}</span>
  {#if !isShell}
    {#if stats && service.status === "running"}
      <span class="inline-stats">
        <span class="inline-cpu">{stats.cpu.toFixed(0)}%</span>
        <span class="inline-mem">{formatMem(stats.mem)}</span>
      </span>
    {:else}
      <span class="badge {service.status}">{service.status}</span>
    {/if}
  {/if}
</button>

<style>
  .item {
    display: flex;
    align-items: center;
    gap: 9px;
    width: 100%;
    background: none;
    border: none;
    border-left: 2px solid transparent;
    color: #4a4a62;
    cursor: pointer;
    padding: 6px 12px 6px 12px;
    font-family: inherit;
    font-size: 0.82rem;
    text-align: left;
    transition: all 0.12s;
    line-height: 1;
  }

  .item:hover {
    background: #16161c;
    color: #8b95a8;
    border-left-color: #2e2e3e;
  }

  .item.selected {
    background: #15151c;
    color: #c9d1e0;
    border-left-color: #c9d1e0;
  }

  .icon-wrap {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    width: 16px;
    justify-content: center;
  }

  .item.selected .icon-wrap { color: #c9d1e0; }
  .item:not(.selected).running .icon-wrap { color: #4a4a62; }
  .item:not(.selected).crashed .icon-wrap { color: #4a4a62; }

  :global(.status-dot.running) { color: #5af78e; fill: #5af78e; }
  :global(.status-dot.crashed) { color: #ff6b6b; fill: #ff6b6b; }
  :global(.status-dot.stopped) { color: #3d3d52; fill: #3d3d52; }

  .name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .badge {
    font-size: 0.6rem;
    padding: 1px 5px;
    border-radius: 3px;
    letter-spacing: 0.04em;
    flex-shrink: 0;
    font-weight: 600;
    display: none;
  }

  .item.selected .badge { display: block; }

  .badge.running { background: #0d2018; color: #5af78e; }
  .badge.crashed { background: #200d0d; color: #ff6b6b; }
  .badge.stopped { background: #1a1a22; color: #4a4a62; }

  .inline-stats {
    display: flex;
    align-items: center;
    gap: 5px;
    flex-shrink: 0;
  }

  .inline-cpu {
    font-size: 0.6rem;
    font-weight: 600;
    color: #3d3d52;
    font-variant-numeric: tabular-nums;
    min-width: 28px;
    text-align: right;
    transition: color 0.3s;
  }

  .item:hover .inline-cpu,
  .item.selected .inline-cpu { color: #6b7280; }

  .inline-mem {
    font-size: 0.6rem;
    color: #2e2e42;
    font-variant-numeric: tabular-nums;
    min-width: 32px;
    text-align: right;
    transition: color 0.3s;
  }

  .item:hover .inline-mem,
  .item.selected .inline-mem { color: #4a4a5a; }
</style>
