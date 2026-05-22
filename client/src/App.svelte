<script lang="ts">
  import Router from "svelte-spa-router";
  import Dashboard from "./components/Dashboard.svelte";
  import Login from "./pages/Login.svelte";
  import Setup from "./pages/Setup.svelte";

  const routes = {
    "/": Dashboard,
    "/login": Login,
    "/setup": Setup,
  };
</script>

<Router {routes} />

<style>
  :global(*, *::before, *::after) { box-sizing: border-box; }
  :global(html, body) {
    margin: 0;
    padding: 0;
    height: 100%;
    background: #0d0d0f;
    color: #c9d1e0;
    font-family: "CaskaydiaMonoNerdFont", ui-monospace, monospace;
  }
  :global(#app) { height: 100%; }
</style>
