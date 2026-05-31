<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  const jobId = $page.url.searchParams.get('job') ?? '';
  const pageCount = parseInt($page.url.searchParams.get('pages') ?? '1', 10);
  const fileName = $page.url.searchParams.get('name') ?? 'document.pdf';

  let job = $state<{ price: number; options: Record<string, unknown> } | null>(null);
  let isPaying = $state(false);
  let error = $state('');

  function formatIDR(n: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
  }

  onMount(async () => {
    if (!jobId) { goto('/'); return; }
    const res = await fetch(`/api/jobs/${jobId}`);
    if (res.ok) job = await res.json();
    else goto('/');
  });

  async function proceedToPayment() {
    if (!jobId || isPaying) return;
    isPaying = true;
    error = '';
    try {
      const res = await fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: jobId })
      });
      if (!res.ok) { error = await res.text(); return; }
      const data = await res.json();
      goto(`/payment?job=${jobId}&payment=${data.payment_id}&amount=${data.amount}`);
    } catch {
      error = 'Koneksi gagal. Coba lagi.';
    } finally {
      isPaying = false;
    }
  }
</script>

<svelte:head>
  <title>PrintIn — Preview &amp; Konfirmasi</title>
</svelte:head>

<div class="page animate-in">
  <div class="content">
    <div class="steps" style="justify-content:center; margin-bottom: var(--space-lg);">
      <div class="step done"><div class="step-num">✓</div><span>Upload</span></div>
      <div class="step-connector done"></div>
      <div class="step done"><div class="step-num">✓</div><span>Pengaturan</span></div>
      <div class="step-connector done"></div>
      <div class="step active"><div class="step-num">3</div><span>Bayar</span></div>
      <div class="step-connector"></div>
      <div class="step"><div class="step-num">4</div><span>Cetak</span></div>
    </div>

    <div class="layout">
      <!-- PDF Preview -->
      <div class="preview-col">
        <div class="card" style="height:100%; display:flex; flex-direction:column;">
          <div class="preview-header">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 1h8l4 4v10a1 1 0 01-1 1H2a1 1 0 01-1-1V2a1 1 0 011-1z" stroke="var(--m3-primary)" stroke-width="1.5"/>
            </svg>
            <span>{fileName}</span>
            <span class="badge badge-printing">{pageCount} hal.</span>
          </div>
          <div class="pdf-viewer" id="pdf-container">
            <iframe
              id="pdf-frame"
              src="/api/file/{jobId}"
              title="Preview PDF"
              style="width:100%; height:100%; border:none; border-radius: var(--radius-md);"
            ></iframe>
          </div>
        </div>
      </div>

      <!-- Confirmation panel -->
      <div class="confirm-col">
        {#if job}
          <div class="card card-elevated confirm-card">
            <h2>Konfirmasi Pesanan</h2>

            <div class="summary-list">
              <div class="summary-row">
                <span class="summary-key">File</span>
                <span class="summary-val">{fileName.length > 20 ? fileName.slice(0,17) + '...' : fileName}</span>
              </div>
              <div class="summary-row">
                <span class="summary-key">Halaman</span>
                <span class="summary-val">{(job.options as Record<string,unknown>).pageFrom} – {(job.options as Record<string,unknown>).pageTo} dari {pageCount}</span>
              </div>
              <div class="summary-row">
                <span class="summary-key">Warna</span>
                <span class="summary-val">{(job.options as Record<string,unknown>).color === 'color' ? 'Berwarna' : 'Hitam & Putih'}</span>
              </div>
              <div class="summary-row">
                <span class="summary-key">Sisi</span>
                <span class="summary-val">{(job.options as Record<string,unknown>).duplex === 'duplex' ? '2 Sisi' : '1 Sisi'}</span>
              </div>
              <div class="summary-row">
                <span class="summary-key">Kertas</span>
                <span class="summary-val">{(job.options as Record<string,unknown>).paper}</span>
              </div>
              <div class="summary-row">
                <span class="summary-key">Salinan</span>
                <span class="summary-val">{(job.options as Record<string,unknown>).copies}×</span>
              </div>
            </div>

            <div class="price-display">
              <span class="price-label">Total Pembayaran</span>
              <div class="price-tag">{formatIDR(job.price)}</div>
            </div>

            {#if error}
              <div class="error-msg" role="alert">{error}</div>
            {/if}

            <button
              id="btn-pay"
              class="btn btn-primary btn-lg"
              style="width:100%;"
              onclick={proceedToPayment}
              disabled={isPaying}
            >
              {isPaying ? 'Memproses...' : 'Bayar dengan QRIS'}
            </button>

            <button class="btn btn-secondary" style="width:100%;" onclick={() => history.back()}>
              Ubah Pengaturan
            </button>
          </div>
        {:else}
          <div class="card" style="display:flex; align-items:center; justify-content:center; min-height:200px;">
            <div class="spinner"></div>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .page {
    min-height: calc(100vh - 80px);
    padding: var(--space-lg) var(--space-xl);
    overflow: visible;
    display: flex;
    flex-direction: column;
  }

  .content {
    flex: 1;
    max-width: 1100px;
    margin: 0 auto;
    width: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .layout {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 380px;
    gap: var(--space-xl);
    overflow: visible;
  }

  .preview-col { overflow: visible; display: flex; flex-direction: column; min-height: 500px; }
  .pdf-viewer { flex: 1; background: var(--m3-surface-container-high); border-radius: var(--radius-md); overflow: hidden; }

  .preview-header {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding-bottom: var(--space-md);
    border-bottom: 1px solid var(--border-subtle);
    margin-bottom: var(--space-md);
    font-size: 0.85rem;
    font-weight: 500;
  }

  .confirm-col {
    overflow: visible;
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .confirm-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .summary-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: var(--m3-surface-container-high);
    border-radius: var(--radius-md);
    padding: var(--space-md);
  }
  .summary-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.85rem;
  }
  .summary-key { color: var(--text-secondary); }
  .summary-val { font-weight: 600; color: var(--text-primary); }

  .price-display {
    text-align: center;
    padding: var(--space-md);
    border-radius: var(--radius-md);
    background: var(--m3-primary-container);
    border: 2px solid var(--border-subtle);
  }
  .price-label {
    display: block;
    font-size: 0.8rem;
    color: var(--text-secondary);
    margin-bottom: 4px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .error-msg {
    padding: 10px 14px;
    border-radius: var(--radius-md);
    background: rgba(239,68,68,0.1);
    border: 1px solid rgba(239,68,68,0.3);
    color: var(--accent-danger);
    font-size: 0.85rem;
    text-align: center;
  }
</style>
