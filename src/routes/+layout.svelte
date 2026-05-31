<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';

  const IDLE_TIMEOUT = 90_000; // 90 seconds

  let { children } = $props();
  let idleTimer: ReturnType<typeof setTimeout>;
  let clockStr = $state('');

  function resetIdle() {
    clearTimeout(idleTimer);
    const path = $page.url.pathname;
    if (path.startsWith('/admin') || path === '/done') return;
    idleTimer = setTimeout(() => goto('/'), IDLE_TIMEOUT);
  }

  onMount(() => {
    resetIdle();
    window.addEventListener('pointerdown', resetIdle);
    window.addEventListener('pointermove', resetIdle);
    window.addEventListener('keydown', resetIdle);

    // Clock
    const updateClock = () => {
      clockStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };
    updateClock();
    const clockInterval = setInterval(updateClock, 1000);

    return () => {
      clearTimeout(idleTimer);
      clearInterval(clockInterval);
      window.removeEventListener('pointerdown', resetIdle);
      window.removeEventListener('pointermove', resetIdle);
      window.removeEventListener('keydown', resetIdle);
    };
  });
</script>

<!-- Kiosk top bar -->
<header class="kiosk-header">
  <div class="header-inner">
    <div class="logo">
      <span class="logo-text">PrintIn</span>
    </div>
    <span class="header-time">{clockStr}</span>
  </div>
</header>

<main class="kiosk-main">
  {@render children()}
</main>

<style>
  :global(html, body) {
    min-height: 100%;
    overflow-y: auto; /* Enable clean, unified global scrolling */
    background: var(--m3-surface);
  }
  :global(#svelte) {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .kiosk-header {
    background: rgba(255, 255, 255, 0.75);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 2px solid var(--border-subtle);
    border-radius: var(--radius-md);
    margin: var(--space-md) var(--space-md) 0 var(--space-md);
    padding: 0 var(--space-lg);
    height: 64px;
    flex-shrink: 0;
    z-index: 100;
    box-shadow: var(--shadow-card);
  }

  .header-inner {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    max-width: 1280px;
    margin: 0 auto;
    width: 100%;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .logo-text {
    font-size: 1.35rem;
    font-weight: 900;
    background: linear-gradient(135deg, var(--m3-primary), var(--m3-secondary));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    letter-spacing: -0.03em;
  }

  .header-time {
    font-family: var(--font-mono);
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: 0.05em;
  }

  .kiosk-main {
    flex: 1;
    overflow: visible; /* Allow content to stretch naturally */
    position: relative;
    display: flex;
    flex-direction: column;
  }
</style>
