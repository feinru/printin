<script lang="ts">
  import { onMount } from 'svelte';
  import type { Job } from '$lib/types';

  let password = $state('');
  let authed = $state(false);
  let authError = $state('');
  let jobs = $state<Job[]>([]);
  let stats = $state<{ total_jobs: number; completed_jobs: number; total_revenue: number } | null>(null);
  let loading = $state(false);

  function formatIDR(n: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
  }
  function formatDate(ts: number) {
    return new Date(ts).toLocaleString('id-ID');
  }

  async function login() {
    loading = true;
    authError = '';
    try {
      const res = await fetch('/api/admin?action=stats', {
        headers: { 'x-admin-password': password }
      });
      if (res.ok) {
        authed = true;
        stats = await res.json();
        await loadJobs();
      } else {
        authError = 'Password salah.';
      }
    } finally {
      loading = false;
    }
  }

  async function loadJobs() {
    const res = await fetch('/api/admin', { headers: { 'x-admin-password': password } });
    if (res.ok) {
      const data = await res.json();
      jobs = data.jobs;
    }
  }

  async function cancelJob(jobId: string) {
    await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
      body: JSON.stringify({ action: 'cancel', job_id: jobId })
    });
    await loadJobs();
  }

  function statusBadge(s: string) {
    const map: Record<string, string> = {
      pending: 'badge-pending', queued: 'badge-printing', printing: 'badge-printing',
      done: 'badge-success', error: 'badge-error', cancelled: 'badge-error'
    };
    return map[s] ?? '';
  }
</script>

<svelte:head>
  <title>PrintIn — Admin</title>
</svelte:head>

<div class="page">
  {#if !authed}
    <div class="login-wrap animate-in">
      <div class="card card-elevated login-card">
        <div class="login-icon">🔐</div>
        <h2>Admin Panel</h2>
        <p>Masukkan password admin untuk melanjutkan</p>

        <div style="display:flex; flex-direction:column; gap: var(--space-sm); width:100%;">
          <input
            id="admin-password"
            type="password"
            class="input"
            placeholder="Password admin"
            bind:value={password}
            onkeydown={(e) => e.key === 'Enter' && login()}
          />
          {#if authError}
            <p style="color: var(--accent-danger); font-size: 0.85rem;">{authError}</p>
          {/if}
          <button id="btn-admin-login" class="btn btn-primary" onclick={login} disabled={loading}>
            {loading ? 'Memverifikasi...' : 'Masuk'}
          </button>
        </div>

        <a href="/" style="color: var(--text-muted); font-size: 0.8rem; margin-top: var(--space-sm);">← Kembali ke Kiosk</a>
      </div>
    </div>

  {:else}
    <div class="dashboard animate-in">
      <div class="dash-header">
        <h2>Dashboard Admin</h2>
        <a href="/" class="btn btn-secondary" style="min-width:unset; padding: 8px 16px; font-size: 0.85rem;">
          ← Kiosk
        </a>
      </div>

      <!-- Stats -->
      {#if stats}
        <div class="stats-grid">
          <div class="stat-card card">
            <div class="stat-value">{stats.total_jobs}</div>
            <div class="stat-label">Total Pekerjaan</div>
          </div>
          <div class="stat-card card">
            <div class="stat-value">{stats.completed_jobs}</div>
            <div class="stat-label">Berhasil Dicetak</div>
          </div>
          <div class="stat-card card card-elevated">
            <div class="stat-value gradient-text">{formatIDR(stats.total_revenue)}</div>
            <div class="stat-label">Total Pendapatan</div>
          </div>
        </div>
      {/if}

      <!-- Jobs table -->
      <div class="table-wrap card">
        <div class="table-header">
          <h3>Riwayat Pekerjaan</h3>
          <button class="btn btn-secondary" style="padding: 8px 16px; min-width:unset; font-size:0.85rem;" onclick={loadJobs}>
            Refresh
          </button>
        </div>

        <div class="table-scroll">
          <table id="jobs-table">
            <thead>
              <tr>
                <th>Waktu</th>
                <th>File</th>
                <th>Hal.</th>
                <th>Salinan</th>
                <th>Warna</th>
                <th>Harga</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {#each jobs as job}
                <tr>
                  <td style="white-space: nowrap; font-family: var(--font-mono); font-size: 0.75rem;">{formatDate(job.created_at)}</td>
                  <td title={job.file_name} style="max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{job.file_name}</td>
                  <td>{job.page_count}</td>
                  <td>{job.options.copies}×</td>
                  <td>{job.options.color === 'color' ? 'Warna' : 'H&P'}</td>
                  <td style="font-family: var(--font-mono);">{formatIDR(job.price)}</td>
                  <td><span class="badge {statusBadge(job.status)}">{job.status}</span></td>
                  <td>
                    {#if job.status === 'queued' || job.status === 'printing'}
                      <button class="btn btn-danger" style="padding:6px 12px; min-height:unset; min-width:unset; font-size:0.8rem;" onclick={() => cancelJob(job.id)}>
                        Batalkan
                      </button>
                    {:else}
                      <span style="color: var(--text-muted); font-size:0.8rem;">—</span>
                    {/if}
                  </td>
                </tr>
              {:else}
                <tr>
                  <td colspan="8" style="text-align:center; color: var(--text-muted); padding: var(--space-xl);">
                    Belum ada pekerjaan
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .page {
    min-height: calc(100vh - 100px);
    overflow: visible;
    padding: var(--space-xl);
  }

  /* Login */
  .login-wrap {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .login-card {
    width: 360px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-md);
    text-align: center;
  }
  .login-icon { font-size: 3rem; }

  /* Dashboard */
  .dashboard {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  .dash-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-md);
  }

  .stat-card {
    text-align: center;
    padding: var(--space-lg);
  }
  .stat-value { font-size: 2rem; font-weight: 800; color: var(--text-primary); }
  .stat-label { font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px; text-transform: uppercase; letter-spacing: 0.05em; }

  .table-wrap { overflow: hidden; }
  .table-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-md);
  }

  .table-scroll { overflow-x: auto; }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
  }
  thead { background: var(--bg-elevated); }
  th {
    text-align: left;
    padding: 10px 12px;
    color: var(--text-secondary);
    font-weight: 600;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid var(--border-subtle);
  }
  td {
    padding: 10px 12px;
    border-bottom: 1px solid var(--border-subtle);
    color: var(--text-primary);
    vertical-align: middle;
  }
  tbody tr:hover { background: var(--bg-hover); }
  tbody tr:last-child td { border-bottom: none; }
</style>
