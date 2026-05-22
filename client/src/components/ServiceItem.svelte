<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { ServiceState } from "../lib/types";

  export let service: ServiceState;
  export let selected: boolean;

  const dispatch = createEventDispatcher<{ click: void }>();
</script>

<button class="service-item" class:selected on:click={() => dispatch("click")}>
  <span class="dot" class:running={service.status === "running"} class:crashed={service.status === "crashed"}></span>
  <span class="name">{service.id}</span>
</button>

<style>
  .service-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    background: none;
    border: none;
    color: #ccc;
    cursor: pointer;
    padding: 0.35rem 0.75rem;
    font-family: monospace;
    font-size: 0.9rem;
    text-align: left;
    border-radius: 3px;
  }

  .service-item:hover {
    background: #2a2a2a;
    color: #e0e0e0;
  }

  .service-item.selected {
    background: #2d3748;
    color: #fff;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    background: #555;
  }

  .dot.running {
    background: #98c379;
  }

  .dot.crashed {
    background: #e06c75;
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
