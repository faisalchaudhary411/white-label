# White-Label Multi-User POS & Invoice App

Client-side SPA designed for **GitHub Pages** with optional JSON persistence via the **GitHub Contents API**.

## Features

### Core POS & Inventory
- Product management (SKU, barcode, name, category, cost/sell/wholesale, tax rate)
- Real-time stock tracking with automatic decrement on sale
- Low-stock alerts
- Batch/Lot + expiry date tracking with color-coded alerts (30/60/90 days)
- Customer & supplier directories with credit (Udhar) balances
- Barcode support: type or scan via camera (Html5-Qrcode) / USB scanners act as keyboard input

### Invoicing & Payments
- Fast POS cart with qty adjust, item/bill discounts
- Payment types: Cash, Credit/Udhar, Bank Transfer, Digital Wallet
- Credit ledger + partial payment recording
- Thermal-friendly receipt print (`window.print()`) + on-screen invoice view
- Tax (GST etc.) per item

### Multi-User & RBAC
- Roles: **Admin**, **Cashier**, **Inventory Manager**
- Password hashing (SHA-256) in browser
- Admin-only password reset (no email – static hosting limitation)
- Route/feature guarding by role

### GitHub JSON Backend
- Optional fine-grained Personal Access Token
- Files: `data/users.json`, `products.json`, `customers.json`, `suppliers.json`, `invoices.json`, `config.json`
- Local-first with Indexed/localStorage cache + offline fallback

### White-Label
- Store name, tagline, phone, address, NTN, footnote
- Logo upload (Base64)
- Theme color
- License key system

## Quick Start

1. Open `index.html` in a browser (or host the folder on GitHub Pages).
2. Login: **admin** / **admin**
3. Go to **Settings** → set branding, optionally add GitHub PAT.
4. Use `keygen.html` to generate a license key and download a pre-filled `config.json`.

### Default users
| Username  | Password | Role              |
|-----------|----------|-------------------|
| admin     | admin    | Admin             |
| cashier   | 123      | Cashier           |
| inventory | 123      | Inventory Manager |

(After first load the seed users are written to localStorage. Change passwords immediately.)

## Deploying to GitHub Pages

1. Create a repository and push the contents of `pos-app/`.
2. Enable Pages (Settings → Pages → Deploy from branch `main` / root).
3. For multi-device data sync:
   - Create a fine-grained PAT with **Contents: Read and write** on that repo (or a separate data repo).
   - In the app Settings, enter Owner, Repo, Branch, and the token.
   - The token is stored only in the browser’s localStorage.

## License & 7-Day Trial

- **Trial**: On first open the app records a start date (localStorage). You get **7 full days** of unrestricted use without a license key.
- **After 7 days**: The app locks. A license-key screen is shown; nothing else is accessible until a valid key is entered.
- **Activate**: Open `keygen.html` (keep it private) → Generate a key → paste into Settings → License, or into the lock screen, or embed it in a downloaded `config.json`.
- Clearing site data / localStorage resets the trial clock on that browser.
## File Structure

```
pos-app/
├── index.html          # Main SPA
├── keygen.html         # License generator + branding config exporter
├── css/styles.css
├── js/
│   ├── utils.js
│   ├── github.js
│   ├── store.js
│   └── app.js
├── data/               # Default / example JSON (used when GitHub not configured)
│   ├── users.json
│   ├── products.json
│   ├── customers.json
│   ├── suppliers.json
│   ├── invoices.json
│   └── config.json
└── README.md
```

## Security Notes

- This is a **static** app. The GitHub token has write access to the configured repository — treat it like a password.
- Prefer a **fine-grained** token limited to one private data repo.
- For production multi-tenant use, consider a real backend; GitHub API rate limits and concurrent write conflicts are real constraints.
- Passwords are hashed client-side (SHA-256). This prevents casual inspection of the JSON but is not a substitute for a proper auth server.

## Browser Support

Modern Chromium, Firefox, Safari. Camera barcode scanning requires HTTPS (or localhost).
