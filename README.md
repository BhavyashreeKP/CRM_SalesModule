# 3Vikram Technologies

A CRM application built with **Next.js 16**, **React 19**, **TypeScript**, and **Tailwind CSS 4**.

## Prerequisites

Install the following on your Windows machine:

1. **Node.js** — v20 or newer (the project runs on v24; download from https://nodejs.org). Using the official Windows installer is fine. Verify with:
   ```powershell
   node -v
   ```

2. **pnpm** — the package manager used by this project. Install it globally:
   ```powershell
   npm install -g pnpm
   ```
   Verify:
   ```powershell
   pnpm -v
   ```

> Tip: If you use [nvm-windows](https://github.com/coreybutler/nvm-windows), switch to a supported Node version first: `nvm use 24`.

## Getting Started

All commands below run in **PowerShell** (or any terminal) from the project folder, e.g. `C:\Users\workspace\crm`.

### 1. Install dependencies

```powershell
pnpm install
```

If pnpm prompts about **ignored build scripts** (e.g. for `sharp`, `msw`), approve them so optional native binaries build correctly:

```powershell
pnpm approve-builds
```

Use the spacebar to select `sharp` (and `msw` if you'll use it), then press Enter. Re-run `pnpm install` afterward to run the approved build scripts.

> `sharp` is used by Next.js for image optimization. The app still runs without it, but approving it is recommended.

### 2. Start the development server

```powershell
pnpm dev
```

Open **http://localhost:3000** in your browser. The server stays running in that terminal; press `Ctrl + C` to stop it.

If port 3000 is in use, Next.js automatically picks another port (e.g. 3001) — check the terminal output for the actual URL.

### 3. Build for production (optional)

```powershell
pnpm build
pnpm start
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start the dev server with hot reload |
| `pnpm build` | Create an optimized production build |
| `pnpm start` | Run the production build |
| `pnpm lint` | Run ESLint |

## Project Structure

```
crm/
├── app/                # Next.js app router — pages & layout
│   ├── customers/      # Customers page (add / edit / view)
│   ├── dashboard/
│   ├── inventory/
│   ├── leads/
│   ├── bill-sale/
│   ├── dc-tracking/
│   └── purchase-orders/
├── components/         # Reusable UI components (sidebar, modal, cards, etc.)
├── lib/                # Utilities
├── public/             # Static assets
├── package.json
└── tsconfig.json
```

## Tech Stack

- [Next.js 16](https://nextjs.org) (App Router)
- [React 19](https://react.dev)
- [TypeScript](https://www.typescriptlang.org)
- [Tailwind CSS 4](https://tailwindcss.com)
- [pnpm](https://pnpm.io) for dependency management

## Notes

- Customer data currently lives in component state and resets when you refresh. Wire up a backend or `localStorage` persistence when you're ready.
- For any "command not found" errors, make sure Node.js and pnpm are installed and that they appear on your `PATH` (close and reopen the terminal after installing).