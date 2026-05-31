<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import type { PrintOptions, ColorMode, DuplexMode, PaperSize } from '$lib/types';

  const jobId = $page.url.searchParams.get('job') ?? '';
  const pageCount = parseInt($page.url.searchParams.get('pages') ?? '1', 10);
  const fileName = $page.url.searchParams.get('name') ?? 'document.pdf';

  let copies = $state(1);
  let color = $state<ColorMode>('bw');
  let duplex = $state<DuplexMode>('simplex');
  let paper = $state<PaperSize>('A4');
  let pageFrom = $state(1);
  let pageTo = $state(pageCount);

  let price = $state(0);
  let priceLoading = $state(false);
  let breakdown = $state<Record<string, number> | null>(null);
  let isSubmitting = $state(false);

  async function fetchPrice() {
    if (!jobId) return;
    priceLoading = true;
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ copies, color, duplex, paper, pageFrom, pageTo })
      });
      if (res.ok) {
        const data = await res.json();
        price = data.price;
        breakdown = data.breakdown;
      }
    } finally {
      priceLoading = false;
    }
  }

  // Fetch price whenever any option changes
  $effect(() => {
    copies; color; duplex; paper; pageFrom; pageTo;
    fetchPrice();
  });

  function formatIDR(n: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
  }

  async function proceed() {
    if (!jobId || isSubmitting) return;
    isSubmitting = true;
    await fetchPrice();
    goto(`/preview?job=${jobId}&pages=${pageCount}&name=${encodeURIComponent(fileName)}`);
  }
</script>

<svelte:head>
  <title>PrintIn — Pengaturan Cetak</title>
</svelte:head>

<div class="page animate-in">
  <div class="content">
    <!-- Steps -->
    <div class="steps" style="justify-content:center; margin-bottom: var(--space-lg);">
      <div class="step done"><div class="step-num">✓</div><span>Upload</span></div>
      <div class="step-connector done"></div>
      <div class="step active"><div class="step-num">2</div><span>Pengaturan</span></div>
      <div class="step-connector"></div>
      <div class="step"><div class="step-num">3</div><span>Bayar</span></div>
      <div class="step-connector"></div>
      <div class="step"><div class="step-num">4</div><span>Cetak</span></div>
    </div>

    <div class="layout">
      <!-- Left: Options -->
      <div class="options-col">
        <div class="file-info card">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M4 2h8l4 4v12a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="var(--m3-primary)" stroke-width="1.5"/>
            <path d="M12 2v5h4" stroke="var(--m3-primary)" stroke-width="1.5"/>
          </svg>
          <div>
            <div class="file-name" title={fileName}>{fileName.length > 30 ? fileName.slice(0, 27) + '...' : fileName}</div>
            <div class="file-meta">{pageCount} halaman</div>
          </div>
        </div>

        <!-- Color mode -->
        <div class="option-section">
          <label class="option-label">Mode Warna</label>
          <div class="option-group">
            <button id="opt-bw" class="option-btn" class:selected={color === 'bw'} onclick={() => color = 'bw'}>
              Hitam &amp; Putih
            </button>
            <button id="opt-color" class="option-btn" class:selected={color === 'color'} onclick={() => color = 'color'}>
              Berwarna
            </button>
          </div>
        </div>

        <!-- Duplex -->
        <div class="option-section">
          <label class="option-label">Sisi Cetak</label>
          <div class="option-group">
            <button id="opt-simplex" class="option-btn" class:selected={duplex === 'simplex'} onclick={() => duplex = 'simplex'}>
              1 Sisi
            </button>
            <button id="opt-duplex" class="option-btn" class:selected={duplex === 'duplex'} onclick={() => duplex = 'duplex'}>
              2 Sisi
            </button>
          </div>
        </div>

        <!-- Paper size -->
        <div class="option-section">
          <label class="option-label" for="paper-select">Ukuran Kertas</label>
          <select id="paper-select" class="select" bind:value={paper}>
            <option value="A4">A4 (210 × 297 mm)</option>
            <option value="A3">A3 (297 × 420 mm)</option>
            <option value="Letter">Letter (216 × 279 mm)</option>
            <option value="Legal">Legal (216 × 356 mm)</option>
          </select>
        </div>

        <!-- Copies -->
        <div class="option-section">
          <label class="option-label">Jumlah Salinan</label>
          <div class="counter">
            <button id="copies-minus" class="counter-btn" onclick={() => copies = Math.max(1, copies - 1)} disabled={copies <= 1}>−</button>
            <span class="counter-val">{copies}</span>
            <button id="copies-plus" class="counter-btn" onclick={() => copies = Math.min(99, copies + 1)} disabled={copies >= 99}>+</button>
          </div>
        </div>

        <!-- Page range -->
        <div class="option-section">
          <label class="option-label">Rentang Halaman</label>
          <div class="range-row">
            <div class="range-field">
              <label for="page-from" style="font-size:0.75rem; color: var(--text-muted)">Dari</label>
              <input id="page-from" type="number" class="input" min="1" max={pageTo} bind:value={pageFrom} />
            </div>
            <span style="color: var(--text-muted); margin-top: 20px;">—</span>
            <div class="range-field">
              <label for="page-to" style="font-size:0.75rem; color: var(--text-muted)">Sampai</label>
              <input id="page-to" type="number" class="input" min={pageFrom} max={pageCount} bind:value={pageTo} />
            </div>
            <button
              class="btn btn-secondary"
              style="margin-top: 18px; padding: 12px 14px; min-width: unset;"
              onclick={() => { pageFrom = 1; pageTo = pageCount; }}
            >Semua</button>
          </div>
        </div>
      </div>

      <!-- Right: Price preview -->
      <div class="price-col">
        <div class="price-card card card-elevated">
          <h3 style="margin-bottom: var(--space-md);">Estimasi Biaya</h3>

          {#if priceLoading}
            <div style="display:flex; justify-content:center; padding: var(--space-lg);">
              <div class="spinner"></div>
            </div>
          {:else}
            <div class="price-tag">{formatIDR(price)}</div>

            {#if breakdown}
              <div class="breakdown">
                <div class="breakdown-row">
                  <span>Halaman dicetak</span>
                  <span>{breakdown.effective_pages} × {copies} salinan</span>
                </div>
                <div class="breakdown-row">
                  <span>Harga per halaman</span>
                  <span>{formatIDR(breakdown.base_per_page)}</span>
                </div>
                {#if breakdown.duplex_discount > 0}
                  <div class="breakdown-row discount">
                    <span>Diskon 2 sisi</span>
                    <span>− {formatIDR(breakdown.duplex_discount)}</span>
                  </div>
                {/if}
                <div class="breakdown-divider"></div>
                <div class="breakdown-row total">
                  <span>Total</span>
                  <span>{formatIDR(breakdown.total)}</span>
                </div>
              </div>
            {/if}
          {/if}

          <button
            id="btn-proceed"
            class="btn btn-primary btn-lg"
            style="width:100%; margin-top: var(--space-lg);"
            onclick={proceed}
            disabled={isSubmitting || priceLoading || price <= 0}
          >
            {isSubmitting ? 'Memuat...' : 'Lanjut ke Preview →'}
          </button>
        </div>

        <button class="btn btn-secondary" style="width:100%;" onclick={() => history.back()}>
          ← Kembali
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  .page {
    min-height: calc(100vh - 80px);
    overflow: visible; /* Let the browser scroll naturally */
    padding: var(--space-lg) var(--space-xl);
  }

  .content {
    max-width: 1100px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
  }

  .layout {
    display: grid;
    grid-template-columns: 1fr 360px;
    gap: var(--space-xl);
  }

  .options-col {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    overflow: visible; /* Prevent nested column scrollbars */
    padding: 8px 12px var(--space-lg) 12px;
  }

  .price-col {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .file-info {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-md);
  }
  .file-name {
    font-weight: 600;
    font-size: 0.9rem;
    color: var(--text-primary);
    word-break: break-all;
  }
  .file-meta {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .option-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }
  .option-label {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-secondary);
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }

  .counter {
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }
  .counter-btn {
    width: 48px; height: 48px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
    background: var(--m3-surface-container);
    color: var(--text-primary);
    font-size: 1.4rem;
    font-weight: 700;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: all var(--transition-fast);
  }
  .counter-btn:hover:not(:disabled) { border-color: var(--m3-primary); color: var(--m3-primary); }
  .counter-btn:disabled { opacity: 0.3; cursor: not-allowed; }
  .counter-val {
    font-size: 1.4rem;
    font-weight: 700;
    min-width: 40px;
    text-align: center;
    font-family: var(--font-mono);
  }

  .range-row {
    display: flex;
    align-items: flex-end;
    gap: var(--space-sm);
  }
  .range-field {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .price-card {
    padding: var(--space-lg);
  }

  .breakdown {
    margin-top: var(--space-md);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .breakdown-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.85rem;
    color: var(--text-secondary);
  }
  .breakdown-row.discount { color: var(--accent-success); }
  .breakdown-row.total { color: var(--text-primary); font-weight: 700; font-size: 1rem; }
  .breakdown-divider {
    height: 1px;
    background: var(--border-subtle);
    margin: 4px 0;
  }
</style>
