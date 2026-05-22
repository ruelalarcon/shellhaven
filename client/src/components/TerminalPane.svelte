<script lang="ts">
  import Terminal from "./Terminal.svelte";

  let { ids, selectedId }: { ids: string[]; selectedId: string } = $props();

  let termRefs = $state<Record<string, Terminal>>({});
</script>

<div class="pane">
  <div class="toolbar">
    <span class="label">{selectedId}</span>
    <button onclick={() => termRefs[selectedId]?.clear()}>Clear</button>
  </div>
  <div class="terminal-area">
    {#each ids as id (id)}
      <div class="term-slot" style:display={id === selectedId ? "block" : "none"}>
        <Terminal {id} visible={id === selectedId} bind:this={termRefs[id]} />
      </div>
    {/each}
  </div>
</div>

<style>
  .pane {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #1a1a1a;
  }

  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.3rem 0.75rem;
    background: #141414;
    border-bottom: 1px solid #333;
    flex-shrink: 0;
  }

  .label { font-family: monospace; font-size: 0.85rem; color: #888; }

  button {
    background: #2a2a2a;
    border: 1px solid #444;
    color: #888;
    cursor: pointer;
    padding: 0.2rem 0.6rem;
    font-family: monospace;
    font-size: 0.8rem;
    border-radius: 3px;
  }

  button:hover { background: #363636; color: #ccc; }

  .terminal-area {
    flex: 1;
    overflow: hidden;
    position: relative;
  }

  .term-slot {
    position: absolute;
    inset: 0;
  }
</style>
