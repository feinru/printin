<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount, onDestroy } from 'svelte';
  import type { JobStatus } from '$lib/types';

  const jobId = $page.url.searchParams.get('job') ?? '';

  type Step = { label: string; status: 'waiting' | 'active' | 'done'; icon: string };

  let jobStatus = $state<JobStatus>('queued');
  let eventSource: EventSource;
  let elapsedSecs = $state(0);
  let elapsedInterval: ReturnType<typeof setInterval>;

  const steps: Step[] = $state([
    { label: 'Pembayaran Dikonfirmasi', status: 'done',    icon: '1' },
    { label: 'Dokumen Dikirim ke Printer', status: 'active', icon: '2' },
    { label: 'Sedang Mencetak...',        status: 'waiting', icon: '3' },
    { label: 'Selesai!',                  status: 'waiting', icon: '4' }
  ]);

  function updateSteps(status: JobStatus) {
    if (status === 'queued') {
      steps[1].status = 'done';
      steps[2].status = 'active';
    } else if (status === 'printing') {
      steps[1].status = 'done';
      steps[2].status = 'active';
    } else if (status === 'done') {
      steps[1].status = 'done';
      steps[2].status = 'done';
      steps[3].status = 'done';
    }
  }

  const progressMap: Record<JobStatus, number> = {
    pending: 5, queued: 30, printing: 65, done: 100, error: 0, cancelled: 0
  };

  let progress = $derived(progressMap[jobStatus] ?? 0);

  onMount(() => {
    if (!jobId) { goto('/'); return; }

    elapsedInterval = setInterval(() => elapsedSecs++, 1000);

    // Poll job status via SSE
    eventSource = new EventSource(`/api/status/${jobId}`);
    eventSource.onmessage = (e) => {
      const data = JSON.parse(e.data);
      jobStatus = data.status;
      updateSteps(jobStatus);

      if (jobStatus === 'done') {
        clearInterval(elapsedInterval);
        eventSource.close();
        setTimeout(() => goto(`/done?job=${jobId}`), 1500);
      } else if (jobStatus === 'error' || jobStatus === 'cancelled') {
        clearInterval(elapsedInterval);
        eventSource.close();
      }
    };
  });

  onDestroy(() => {
    clearInterval(elapsedInterval);
    eventSource?.close();
  });

  function formatElapsed(s: number): string {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  }
</script>

<svelte:head>
  <title>PrintIn — Status Cetak</title>
</svelte:head>

<div class="page animate-in">
  <div class="content">
    <div class="steps" style="justify-content:center; margin-bottom: var(--space-xl);">
      <div class="step done"><div class="step-num">✓</div></div>
      <div class="step-connector done"></div>
      <div class="step done"><div class="step-num">✓</div></div>
      <div class="step-connector done"></div>
      <div class="step done"><div class="step-num">✓</div></div>
      <div class="step-connector done"></div>
      <div class="step active"><div class="step-num">4</div><span>Cetak</span></div>
    </div>

    <div class="status-layout">
      <div class="printer-visual" class:printing={jobStatus === 'printing'}>
        <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
          <rect x="20" y="40" width="80" height="50" rx="8" fill="var(--bg-elevated)" stroke="var(--border-active)" stroke-width="2"/>
          <rect x="30" y="20" width="60" height="25" rx="4" fill="var(--bg-surface)" stroke="var(--border-subtle)" stroke-width="1.5"/>
          <rect x="35" y="68" width="50" height="4" rx="2" fill="var(--accent-primary)" opacity="0.6"/>
          <circle cx="85" cy="60" r="5" fill="{jobStatus === 'printing' ? 'var(--accent-success)' : 'var(--text-muted)'}"/>
          <!-- Paper coming out -->
          {#if jobStatus === 'printing' || jobStatus === 'done'}
            <rect x="38" y="85" width="44" height="28" rx="2" fill="white" opacity="0.9"/>
            <line x1="44" y1="93" x2="76" y2="93" stroke="#ccc" stroke-width="1.5"/>
            <line x1="44" y1="98" x2="76" y2="98" stroke="#ccc" stroke-width="1.5"/>
            <line x1="44" y1="103" x2="65" y2="103" stroke="#ccc" stroke-width="1.5"/>
          {/if}
        </svg>
        {#if jobStatus === 'printing'}
          <div class="print-pulse"></div>
        {/if}
      </div>

      <div class="status-info">
        <div class="progress-section">
          <div class="progress-header">
            <span class="progress-label">Progress</span>
            <span class="progress-pct">{progress}%</span>
          </div>
          <div class="progress-bar" style="height: 10px;">
            <div class="progress-fill" style="width: {progress}%;"></div>
          </div>
        </div>

        <div class="job-steps">
          {#each steps as step}
            <div class="job-step" class:active={step.status === 'active'} class:done={step.status === 'done'}>
              <div class="job-step-icon" class:spin-icon={step.status === 'active' && jobStatus !== 'done'}>
                {#if step.status === 'active' && jobStatus !== 'done'}
                  <div class="spinner" style="width:20px;height:20px;border-width:2px;"></div>
                {:else}
                  {step.icon}
                {/if}
              </div>
              <span>{step.label}</span>
            </div>
          {/each}
        </div>

        <div class="meta-row">
          <div class="meta-item">
            <span class="meta-label">Status</span>
            <span class="badge" class:badge-printing={jobStatus === 'queued' || jobStatus === 'printing'} class:badge-success={jobStatus === 'done'} class:badge-error={jobStatus === 'error'}>
              {jobStatus === 'queued' ? 'Mengantre' : jobStatus === 'printing' ? 'Mencetak' : jobStatus === 'done' ? 'Selesai' : jobStatus}
            </span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Waktu berlalu</span>
            <span class="meta-val" style="font-family: var(--font-mono);">{formatElapsed(elapsedSecs)}</span>
          </div>
        </div>

        {#if jobStatus === 'error'}
          <div class="error-section">
            <p style="color: var(--accent-danger); font-weight: 600;">Terjadi kesalahan saat mencetak.</p>
            <p style="color: var(--text-secondary); font-size: 0.85rem;">Hubungi petugas atau coba lagi.</p>
            <button class="btn btn-danger" onclick={() => goto('/')}>Mulai Ulang</button>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .page {
    min-height: calc(100vh - 100px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-xl);
  }

  .content {
    max-width: 800px;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--space-xl);
  }

  .status-layout {
    display: flex;
    align-items: center;
    gap: var(--space-2xl);
  }

  .printer-visual {
    position: relative;
    flex-shrink: 0;
  }
  .printer-visual.printing svg {
    filter: drop-shadow(0 0 20px rgba(108,99,255,0.5));
  }

  .print-pulse {
    position: absolute;
    inset: -10px;
    border-radius: 50%;
    border: 2px solid var(--accent-primary);
    animation: pulse-glow 1.5s ease-in-out infinite;
    pointer-events: none;
  }

  .status-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  .progress-section { display: flex; flex-direction: column; gap: 8px; }
  .progress-header { display: flex; justify-content: space-between; }
  .progress-label { font-size: 0.85rem; color: var(--text-secondary); font-weight: 500; }
  .progress-pct { font-family: var(--font-mono); font-size: 0.85rem; color: var(--accent-primary); }

  .job-steps {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .job-step {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    color: var(--text-muted);
    font-size: 0.95rem;
    transition: color var(--transition-fast);
  }
  .job-step.active { color: var(--text-primary); font-weight: 600; }
  .job-step.done   { color: var(--accent-success); }

  .job-step-icon {
    width: 28px; height: 28px;
    display: flex; align-items: center; justify-content: center;
    font-size: 1rem;
    flex-shrink: 0;
  }

  .meta-row {
    display: flex;
    gap: var(--space-xl);
  }
  .meta-item { display: flex; flex-direction: column; gap: 4px; }
  .meta-label { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
  .meta-val { font-weight: 600; color: var(--text-primary); }

  .error-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }
</style>
