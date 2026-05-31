# PrintIn

**PrintIn** is a beautiful, tactile, self-service print-vending kiosk web application. Designed using the modern **Material 3 Expressive Light Theme** system, it features soft off-white volumetric layouts, responsive feedback, and warm color palettes. 

Users can upload PDF documents, adjust custom print preferences, pay instantly using **Midtrans QRIS**, and automatically retrieve physical prints via a real **CUPS printer integration** or secure fallback simulation.

---

## Key Features

* **Beautiful M3 Expressive UI**: Elegant pastel tones, responsive glassmorphic navigation headers, and micro-animations. Fully optimized for high-resolution self-service kiosks.
* **Unified Global Viewport Scrolling**: No weird nested scrollbars or cropped layouts, providing maximum convenience on touch interfaces.
* **Robust SSE Streaming**: Fast Server-Sent Events status streams for real-time checkout & printing status updates, fully optimized to prevent connection-teardown process crashes on Node v26.
* **Midtrans Sandbox QRIS**: Automatic dynamic checkout generation with simulated QRIS checkouts when no API keys are provided.
* **Real CUPS Hardware Integration**: Auto-queue printing directly to system printers via hardware command-line wrapping.
* **Embedded SQLite Storage**: Built using high-performance atomic `better-sqlite3` operations requiring zero complex database configuration.

---

## Tech Stack

* **Frontend**: SvelteKit 2 + Svelte 5 (Runners running on Node v26 / Bun)
* **Styling**: Vanilla CSS (Fluid grids, HSL variables, spring transitions)
* **Backend**: SvelteKit SSR Workers + REST API endpoints
* **Database**: `better-sqlite3` (WAL mode enabled)
* **Payment**: Midtrans Core API (Sandbox / Production-ready fallback)
* **Printing**: CUPS system wrapper (`lp` command integrations)

---

## Environment Variables

To configure custom behaviors, create a `.env` file in the root folder:

```ini
# Midtrans Credentials (Optional — falls back to beautiful Sandbox simulation if empty)
MIDTRANS_SERVER_KEY=your_sandbox_server_key

# CUPS Hardware Configuration
PRINTER_NAME=HP_LaserJet_Pro_M402
```

---

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Launch Development Kiosk
```bash
npm run dev
```
Open `http://localhost:5173` to explore the kiosk interface!

### 3. Build & Production Preview
```bash
npm run build
npm run preview
```

---

## Project Architecture

```text
src/
├── app.css           # Core M3 design tokens, variables, & responsive animations
├── lib/
│   ├── assets/       # Static branding and icons
│   ├── server/
│   │   ├── db.ts     # Embedded better-sqlite3 engine & WAL configuration
│   │   ├── payment.ts# Midtrans QRIS payment adapter
│   │   └── print.ts  # CUPS printing system wrapper & mockup toggle
│   └── types.ts      # Structured TypeScript type declarations
└── routes/
    ├── +layout.svelte# Floating, glassmorphic header, clock & idle-timer reset
    ├── +page.svelte  # Step 1: Drag-and-drop PDF upload
    ├── options/      # Step 2: Page selection, color mode & price breakdown
    ├── preview/      # Step 3: Interactive PDF preview & dynamic checkout request
    ├── payment/      # Step 3 (checkout): Real-time QRIS countdown & polling
    ├── status/       # Step 4: Real-time printing progress & SSE stream status
    ├── done/         # Done: Interactive payment receipt & screen reset timer
    └── admin/        # Admin dashboard: Stats, revenue breakdown & active job logs
```

---

## Real Printer Deployment

To connect PrintIn to a real system printer:
1. Ensure `cups` is installed and running on your host Linux system (`sudo systemctl start cups`).
2. Identify your printer name using:
   ```bash
   lpstat -p -d
   ```
3. Open `src/lib/server/print.ts`, set `IS_MOCK = false`, and supply your printer name in the `.env` or configuration file.
