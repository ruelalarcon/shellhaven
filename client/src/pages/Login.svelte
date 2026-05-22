<script lang="ts">
  import { onMount } from "svelte";
  import { push } from "svelte-spa-router";
  import { TerminalSquare } from "@lucide/svelte";

  let password = $state("");
  let error = $state("");
  let loading = $state(false);

  onMount(async () => {
    const res = await fetch("/api/status");
    const { configured, authenticated } = await res.json();
    if (!configured) { push("/setup"); return; }
    if (authenticated) { push("/"); return; }
  });

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    error = "";
    loading = true;
    try {
      const res = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) { error = data.error; return; }
      push("/");
    } catch {
      error = "Connection failed.";
    } finally {
      loading = false;
    }
  }
</script>

<div class="page">
  <div class="wordmark">
    <TerminalSquare size={14} />
    terminal dashboard
  </div>
  <div class="card">
    <div class="card-title">welcome back</div>
    <div class="card-sub">enter your password to continue</div>
    {#if error}
      <div class="error">{error}</div>
    {/if}
    <form onsubmit={submit}>
      <label for="password">Password</label>
      <input id="password" type="password" bind:value={password} autofocus required />
      <button type="submit" disabled={loading}>
        {loading ? "logging in…" : "login"}
      </button>
    </form>
  </div>
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background: #0d0d0f;
  }

  .wordmark {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.72rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #3a3a52;
    margin-bottom: 2rem;
    font-weight: 600;
  }

  .card {
    width: 340px;
    background: #111114;
    border: 1px solid #1e1e24;
    border-radius: 8px;
    padding: 2rem;
  }

  .card-title {
    margin: 0 0 0.35rem;
    font-size: 0.95rem;
    font-weight: 600;
    color: #c9d1e0;
    letter-spacing: 0.03em;
  }

  .card-sub {
    margin: 0 0 1.75rem;
    font-size: 0.75rem;
    color: #3a3a52;
  }

  .error {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #1f0d0d;
    border: 1px solid #3a1a1a;
    border-radius: 5px;
    color: #ff8585;
    padding: 0.5rem 0.75rem;
    margin-bottom: 1.25rem;
    font-size: 0.78rem;
  }

  .error::before { content: "!"; font-weight: 700; flex-shrink: 0; }

  label {
    display: block;
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #3d3d52;
    margin-bottom: 0.4rem;
  }

  input[type="password"] {
    width: 100%;
    background: #0d0d0f;
    border: 1px solid #1e1e28;
    border-radius: 5px;
    color: #c9d1e0;
    padding: 0.55rem 0.75rem;
    font-family: inherit;
    font-size: 0.85rem;
    margin-bottom: 1.1rem;
    outline: none;
    transition: border-color 0.15s;
  }

  input[type="password"]:focus { border-color: #3a3a52; }

  button[type="submit"] {
    width: 100%;
    padding: 0.6rem;
    background: #1a1a22;
    border: 1px solid #2e2e3e;
    border-radius: 5px;
    color: #c9d1e0;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.82rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    transition: all 0.15s;
    margin-top: 0.25rem;
  }

  button[type="submit"]:hover:not(:disabled) { background: #22222e; border-color: #3e3e52; color: #e2e8f0; }
  button[type="submit"]:disabled { opacity: 0.5; cursor: default; }
</style>
