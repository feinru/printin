<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  const jobId = $page.url.searchParams.get('job') ?? '';
  let job = $state<{ file_name: string; page_count: number; options: Record<string,unknown>; price: number } | null>(null);
  let countdown = $state(15);

  function formatIDR(n: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
  }

  let timer: ReturnType<typeof setInterval>;

  onMount(() => {
    if (jobId) {
      fetch(`/api/jobs/${jobId}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) job = d; });
    }

    timer = setInterval(() => {
      countdown--;
      if (countdown <= 0) {
        clearInterval(timer);
        goto('/');
      }
    }, 1000);

    return () => clearInterval(timer);
  });
</script>

<svelte:head>
  <title>PrintIn — Selesai!</title>
</svelte:head>

<div class="page animate-in">
  <div class="content">
    <!-- Success animation -->
    <div class="success-circle">
      <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
        <path d="M15 30L26 41L45 20" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>

    <h1 class="gradient-text">Dokumen Berhasil Dicetak!</h1>
    <p>Terima kasih telah menggunakan PrintIn. Ambil dokumen Anda dari printer.</p>

    {#if job}
      <div class="receipt card">
        <div class="receipt-header">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="1" width="14" height="14" rx="2" stroke="var(--accent-success)" stroke-width="1.5"/>
            <path d="M4 8l3 3 5-5" stroke="var(--accent-success)" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <span>Struk Pembayaran</span>
        </div>
        <div class="receipt-rows">
          <div class="receipt-row"><span>File</span><span>{job.file_name.length > 24 ? job.file_name.slice(0,21)+'...' : job.file_name}</span></div>
          <div class="receipt-row"><span>Halaman</span><span>{job.page_count} hal.</span></div>
          <div class="receipt-row"><span>Warna</span><span>{job.options.color === 'color' ? 'Berwarna' : 'H&P'}</span></div>
          <div class="receipt-row"><span>Salinan</span><span>{job.options.copies}×</span></div>
          <div class="receipt-divider"></div>
          <div class="receipt-row total"><span>Total Dibayar</span><span>{formatIDR(job.price)}</span></div>
        </div>
      </div>
    {/if}

    <div class="actions">
      <button id="btn-print-again" class="btn btn-primary btn-lg" onclick={() => goto('/')}>
        Cetak Dokumen Lain
      </button>
    </div>

    <div class="auto-reset">
      <div class="progress-bar" style="width: 300px;">
        <div class="progress-fill" style="width: {(countdown/15)*100}%; transition: width 1s linear;"></div>
      </div>
      <p>Layar akan reset dalam <strong>{countdown}</strong> detik</p>
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
    max-width: 520px;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-lg);
    text-align: center;
  }

  .success-circle {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--accent-success), hsl(142, 60%, 55%));
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: var(--shadow-card);
  }

  .receipt {
    width: 100%;
    padding: var(--space-md);
  }
  .receipt-header {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--accent-success);
    margin-bottom: var(--space-md);
    padding-bottom: var(--space-md);
    border-bottom: 1px solid var(--border-subtle);
  }

  .receipt-rows { display: flex; flex-direction: column; gap: 8px; }
  .receipt-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.85rem;
    color: var(--text-secondary);
  }
  .receipt-row span:last-child { font-weight: 600; color: var(--text-primary); }
  .receipt-row.total span { font-weight: 700; font-size: 0.95rem; color: var(--accent-success); }
  .receipt-divider { height: 1px; background: var(--border-subtle); margin: 4px 0; }

  .actions { width: 100%; }

  .auto-reset {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  .auto-reset p { font-size: 0.8rem; color: var(--text-muted); }
  .auto-reset strong { color: var(--text-secondary); }
</style>
