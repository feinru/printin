<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount, onDestroy } from 'svelte';

  const jobId = $page.url.searchParams.get('job') ?? '';
  const paymentId = $page.url.searchParams.get('payment') ?? '';
  const amount = parseInt($page.url.searchParams.get('amount') ?? '0', 10);

  let qrData = $state('');
  let paymentStatus = $state<'pending' | 'confirmed' | 'failed'>('pending');
  let countdown = $state(60); // countdown display (mock)
  let countdownInterval: ReturnType<typeof setInterval>;
  let eventSource: EventSource;
  let isSubmittingPrint = $state(false);

  function formatIDR(n: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
  }

  async function loadPaymentData() {
    // Fetch QR from storage (payment already created, we have qr_data in response)
    // We'll re-request or rely on what was passed; use SSE to watch status
    const res = await fetch(`/api/payment/${paymentId}/poll`);
    // We'll use the SSE stream below instead
  }

  onMount(async () => {
    if (!paymentId || !jobId) { goto('/'); return; }

    // Fetch initial QR data by re-loading payment info via status endpoint
    const res = await fetch(`/api/payment/${paymentId}/info`).catch(() => null);
    if (res?.ok) {
      const data = await res.json();
      qrData = data.qr_data;
    }

    // Subscribe to SSE payment status
    eventSource = new EventSource(`/api/payment/${paymentId}/poll`);
    eventSource.onmessage = async (e) => {
      const data = JSON.parse(e.data);
      paymentStatus = data.status;
      if (data.status === 'confirmed') {
        clearInterval(countdownInterval);
        eventSource.close();
        // Submit print job
        await submitPrint();
      } else if (data.status === 'failed') {
        clearInterval(countdownInterval);
        eventSource.close();
      }
    };

    // Countdown just for UX (doesn't control anything)
    countdownInterval = setInterval(() => {
      if (countdown > 0) countdown--;
    }, 1000);
  });

  onDestroy(() => {
    clearInterval(countdownInterval);
    eventSource?.close();
  });

  async function submitPrint() {
    isSubmittingPrint = true;
    try {
      const res = await fetch('/api/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: jobId })
      });
      if (res.ok) {
        goto(`/status?job=${jobId}`);
      }
    } finally {
      isSubmittingPrint = false;
    }
  }
</script>

<svelte:head>
  <title>PrintIn — Pembayaran QRIS</title>
</svelte:head>

<div class="page animate-in">
  <div class="content">
    <div class="steps" style="justify-content:center; margin-bottom: var(--space-xl);">
      <div class="step done"><div class="step-num">✓</div></div>
      <div class="step-connector done"></div>
      <div class="step done"><div class="step-num">✓</div></div>
      <div class="step-connector done"></div>
      <div class="step active"><div class="step-num">3</div><span>Bayar</span></div>
      <div class="step-connector"></div>
      <div class="step"><div class="step-num">4</div><span>Cetak</span></div>
    </div>

    {#if paymentStatus === 'pending'}
      <div class="payment-layout">
        <div class="qr-section card card-elevated">
          <div class="qris-badge">
            <img src="/qris-logo.svg" alt="QRIS" height="20" />
            <span>Scan dengan aplikasi e-wallet Anda</span>
          </div>

          <div class="qr-container" id="qr-container">
            {#if qrData}
              <img id="qr-image" src={qrData} alt="QRIS QR Code" class="qr-image" />
            {:else}
              <div class="qr-placeholder">
                <div class="spinner" style="width:40px;height:40px;border-width:3px;"></div>
              </div>
            {/if}
          </div>

          <div class="amount-display">
            <span class="amount-label">Total Pembayaran</span>
            <div class="amount-value">{formatIDR(amount)}</div>
          </div>

          <!-- Countdown bar -->
          <div class="countdown-section">
            <div class="progress-bar">
              <div class="progress-fill" style="width: {(countdown/60)*100}%;"></div>
            </div>
            <p style="font-size:0.8rem; color: var(--text-muted); margin-top:6px;">
              Simulasi konfirmasi dalam ~8 detik (demo mode)
            </p>
          </div>
        </div>

        <div class="instructions card">
          <h3>Cara Pembayaran</h3>
          <ol class="steps-list">
            <li>
              <div class="step-circle">1</div>
              <div>
                <strong>Buka aplikasi e-wallet</strong>
                <p>GoPay, OVO, Dana, ShopeePay, atau m-banking</p>
              </div>
            </li>
            <li>
              <div class="step-circle">2</div>
              <div>
                <strong>Scan kode QRIS</strong>
                <p>Pilih menu "Scan" atau "Pay" lalu arahkan ke QR di layar</p>
              </div>
            </li>
            <li>
              <div class="step-circle">3</div>
              <div>
                <strong>Konfirmasi pembayaran</strong>
                <p>Periksa jumlah dan konfirmasi di aplikasi Anda</p>
              </div>
            </li>
            <li>
              <div class="step-circle">4</div>
              <div>
                <strong>Dokumen langsung dicetak!</strong>
                <p>Status cetak akan tampil otomatis</p>
              </div>
            </li>
          </ol>

          <div class="wallets">
            <span style="font-size:0.9rem; font-weight: 700; color: var(--text-secondary);">Mendukung GoPay, OVO, Dana, ShopeePay, LinkAja, serta semua m-banking dan e-wallet berstandar QRIS</span>
          </div>
        </div>
      </div>

    {:else if paymentStatus === 'confirmed'}
      <div class="status-state animate-in">
        <div class="status-icon success">✓</div>
        <h2>Pembayaran Berhasil!</h2>
        <p>Dokumen Anda sedang diproses untuk dicetak...</p>
        <div class="spinner" style="margin-top: var(--space-md);"></div>
      </div>

    {:else if paymentStatus === 'failed'}
      <div class="status-state animate-in">
        <div class="status-icon error">✕</div>
        <h2>Pembayaran Gagal</h2>
        <p>Silakan coba kembali atau hubungi petugas.</p>
        <button class="btn btn-primary" onclick={() => history.back()}>Coba Lagi</button>
      </div>
    {/if}
  </div>
</div>

<style>
  .page {
    min-height: calc(100vh - 80px);
    overflow: visible; /* Use clean global scrollbar */
    padding: var(--space-lg) var(--space-xl);
    display: flex;
    flex-direction: column;
  }

  .content {
    max-width: 960px;
    margin: 0 auto;
    width: 100%;
    display: flex;
    flex-direction: column;
  }

  .payment-layout {
    display: grid;
    grid-template-columns: 420px 1fr;
    gap: var(--space-xl);
    flex: 1;
  }

  .qr-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-md);
    text-align: center;
  }

  .qris-badge {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: 8px 16px;
    background: var(--m3-surface-container-high);
    border-radius: var(--radius-full);
    border: 1px solid var(--border-subtle);
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .qr-container {
    width: 240px;
    height: 240px;
    background: white;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px;
    box-shadow: var(--shadow-card);
    border: 2px solid var(--border-subtle);
  }

  .qr-image { width: 100%; height: 100%; object-fit: contain; border-radius: 4px; }

  .qr-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    background: #f5f5f5;
    border-radius: 4px;
  }

  .amount-display { text-align: center; }
  .amount-label { font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; }
  .amount-value {
    font-size: 2rem;
    font-weight: 800;
    background: linear-gradient(135deg, var(--m3-primary), var(--m3-secondary));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    letter-spacing: -0.02em;
  }

  .countdown-section { width: 100%; }

  .instructions { display: flex; flex-direction: column; gap: var(--space-md); }
  .steps-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }
  .steps-list li {
    display: flex;
    align-items: flex-start;
    gap: var(--space-md);
  }
  .step-circle {
    width: 32px; height: 32px;
    border-radius: 50%;
    background: var(--m3-primary-container);
    border: 2px solid var(--m3-primary);
    color: var(--m3-primary);
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 0.85rem;
    flex-shrink: 0;
  }
  .steps-list strong { display: block; font-size: 0.9rem; color: var(--text-primary); margin-bottom: 2px; }
  .steps-list p { font-size: 0.8rem; color: var(--text-muted) !important; }

  .wallets {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    flex-wrap: wrap;
    margin-top: var(--space-sm);
  }

  /* Confirmed / Failed states */
  .status-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-md);
    text-align: center;
  }
  .status-icon {
    width: 80px; height: 80px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 2rem; font-weight: 700;
  }
  .status-icon.success { background: rgba(16,185,129,0.15); color: var(--accent-success); border: 3px solid var(--accent-success); }
  .status-icon.error   { background: rgba(239,68,68,0.15);  color: var(--accent-danger);  border: 3px solid var(--accent-danger); }
</style>
