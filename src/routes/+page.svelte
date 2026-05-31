<script lang="ts">
  import { goto } from '$app/navigation';

  let isDragging = $state(false);
  let isUploading = $state(false);
  let error = $state('');
  let fileInput: HTMLInputElement;

  async function handleFile(file: File) {
    error = '';
    if (file.type !== 'application/pdf') {
      error = 'Hanya file PDF yang didukung.';
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      error = 'Ukuran file terlalu besar. Maksimal 20MB.';
      return;
    }

    isUploading = true;
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!res.ok) {
        const msg = await res.text();
        error = `Gagal mengunggah: ${msg}`;
        return;
      }

      const data = await res.json();
      goto(`/options?job=${data.job_id}&pages=${data.page_count}&name=${encodeURIComponent(data.file_name)}`);
    } catch (e) {
      error = 'Koneksi gagal. Coba lagi.';
    } finally {
      isUploading = false;
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    isDragging = false;
    const file = e.dataTransfer?.files[0];
    if (file) handleFile(file);
  }

  function onDragover(e: DragEvent) { e.preventDefault(); isDragging = true; }
  function onDragleave() { isDragging = false; }
  function onFileChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) handleFile(file);
  }
</script>

<svelte:head>
  <title>PrintIn — Upload Dokumen</title>
</svelte:head>

<div class="page animate-in">
  <div class="content">
    <!-- Steps -->
    <div class="steps" style="justify-content: center; margin-bottom: var(--space-xl);">
      <div class="step active"><div class="step-num">1</div><span>Upload</span></div>
      <div class="step-connector"></div>
      <div class="step"><div class="step-num">2</div><span>Pengaturan</span></div>
      <div class="step-connector"></div>
      <div class="step"><div class="step-num">3</div><span>Bayar</span></div>
      <div class="step-connector"></div>
      <div class="step"><div class="step-num">4</div><span>Cetak</span></div>
    </div>

    <div class="hero">
      <h1>Cetak Dokumen Anda</h1>
      <p>Upload PDF, pilih pengaturan, bayar dengan QRIS — selesai!</p>
    </div>

    <!-- Dropzone -->
    <div
      id="dropzone"
      class="dropzone"
      class:dragging={isDragging}
      class:uploading={isUploading}
      role="button"
      tabindex="0"
      aria-label="Area upload file PDF"
      ondrop={onDrop}
      ondragover={onDragover}
      ondragleave={onDragleave}
      onclick={() => !isUploading && fileInput.click()}
      onkeydown={(e) => e.key === 'Enter' && fileInput.click()}
    >
      {#if isUploading}
        <div class="upload-state">
          <div class="spinner" style="width:48px;height:48px;border-width:4px;"></div>
          <p style="margin-top: var(--space-md); color: var(--text-primary); font-weight: 600;">Mengunggah...</p>
        </div>
      {:else if isDragging}
        <div class="upload-state">
          <div class="drop-icon active">📄</div>
          <p style="color: var(--m3-primary); font-weight: 700; font-size: 1.2rem;">Lepaskan file di sini</p>
        </div>
      {:else}
        <div class="upload-state">
          <div class="drop-icon">
            <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
              <circle cx="28" cy="28" r="28" fill="var(--m3-primary-container)"/>
              <path d="M28 36V24M28 24L23 29M28 24L33 29" stroke="var(--m3-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
              <rect x="17" y="37" width="22" height="3" rx="1.5" fill="var(--m3-primary)" opacity="0.4"/>
            </svg>
          </div>
          <p class="drop-title">Seret & Lepas PDF ke sini</p>
          <p class="drop-sub">atau klik untuk memilih file</p>
          <div class="drop-hint">PDF • Maks. 20MB</div>
        </div>
      {/if}
    </div>

    <input
      bind:this={fileInput}
      type="file"
      accept="application/pdf"
      style="display:none"
      onchange={onFileChange}
      id="file-input"
    />

    {#if error}
      <div class="error-msg animate-in">{error}</div>
    {/if}

    <p class="footer-note">Gunakan mesin ini secara mandiri. File yang diunggah akan dihapus secara otomatis.</p>
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

  .upload-container {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-xl);
  }

  .upload-card {
    width: 100%;
    max-width: 580px;
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  .content {
    width: 100%;
    max-width: 560px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-lg);
  }

  .hero {
    text-align: center;
  }
  .hero h1 { margin-bottom: 8px; }

  .dropzone {
    height: 280px;
    width: 100%;
    border: 3px dashed var(--border-subtle);
    border-radius: var(--radius-xl);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: transform var(--transition-spring), border-color var(--transition-fast), background var(--transition-fast);
    background: var(--m3-surface-container);
  }

  .dropzone:hover {
    border-color: var(--m3-primary);
    background: var(--m3-primary-container);
  }

  .dropzone.dragging {
    border-color: var(--m3-primary);
    background: var(--m3-primary-container);
    transform: scale(1.01);
    box-shadow: var(--shadow-glow);
  }

  .dropzone.uploading {
    cursor: not-allowed;
    pointer-events: none;
  }

  .upload-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-md);
  }

  .drop-icon {
    font-size: 3rem;
    line-height: 1;
    transition: transform var(--transition-normal);
  }
  .drop-icon.active { transform: scale(1.2); }

  .drop-title {
    font-size: 1.2rem;
    font-weight: 700;
    color: var(--text-primary) !important;
  }

  .drop-sub {
    font-size: 0.9rem;
    color: var(--text-muted) !important;
    margin-top: -8px;
  }

  .drop-hint {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 14px;
    border-radius: var(--radius-full);
    background: var(--m3-surface-container-high);
    border: 1px solid var(--border-subtle);
    font-size: 0.75rem;
    color: var(--text-secondary);
    font-family: var(--font-mono);
    margin-top: 4px;
  }

  .error-msg {
    width: 100%;
    padding: 12px 16px;
    border-radius: var(--radius-md);
    background: rgba(239,68,68,0.1);
    border: 1px solid rgba(239,68,68,0.3);
    color: var(--accent-danger);
    font-size: 0.9rem;
    font-weight: 500;
    text-align: center;
  }

  .footer-note {
    font-size: 0.75rem;
    color: var(--text-muted) !important;
    text-align: center;
  }
</style>
