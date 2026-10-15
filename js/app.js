/* Main application controller */
const App = {
  pages: {},
  currentPage: 'dashboard',

  async start() {
    await Store.init();
    this.applyBranding();
    const access = Store.isAccessAllowed();
    if (!access.allowed) {
      this.showTrialExpired(access.trial);
      this.bindGlobal();
      return;
    }
    this.checkLicense();
    const user = Store.restoreSession();
    if (user) {
      this.showApp();
    } else {
      this.showLogin();
    }
    this.bindGlobal();
  },

  applyBranding() {
    const c = Store.config;
    document.documentElement.style.setProperty('--primary', c.theme?.primaryColor || '#2563eb');
    document.documentElement.style.setProperty('--primary-dark', c.theme?.secondaryColor || '#1e40af');
    const title = document.getElementById('app-title');
    if (title) title.textContent = c.storeName || 'POS';
    document.title = (c.storeName || 'POS') + ' — Invoice & POS';
    // Logo
    document.querySelectorAll('[data-logo]').forEach(el => {
      if (c.logoBase64) {
        el.src = c.logoBase64;
        el.style.display = 'block';
      } else {
        el.style.display = 'none';
      }
    });
    document.querySelectorAll('[data-store-name]').forEach(el => {
      el.textContent = c.storeName || 'My Store POS';
    });
    document.querySelectorAll('[data-tagline]').forEach(el => {
      el.textContent = c.tagline || '';
    });
  },

  checkLicense() {
    const banner = document.getElementById('license-banner');
    if (!banner) return;
    if (Store.config.licensed) {
      banner.classList.add('hidden');
      return;
    }
    const trial = Store.getTrialInfo();
    banner.classList.remove('hidden');
    if (trial.expired) {
      banner.innerHTML = `⛔ Trial expired. Enter a valid license key in Settings (or use <code>keygen.html</code>) to continue.`;
      banner.style.background = '#fee2e2';
      banner.style.color = '#991b1b';
      banner.style.borderBottomColor = '#fca5a5';
    } else {
      banner.innerHTML = `⏳ Free trial: <strong>${trial.remainingDays} day${trial.remainingDays === 1 ? '' : 's'}</strong> remaining. Generate a license key with <code>keygen.html</code> and enter it in Settings.`;
      banner.style.background = '#fef3c7';
      banner.style.color = '#92400e';
      banner.style.borderBottomColor = '#fcd34d';
    }
  },

  showTrialExpired(trial) {
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('app-shell').classList.remove('active');
    let lock = document.getElementById('trial-lock');
    if (!lock) {
      lock = document.createElement('div');
      lock.id = 'trial-lock';
      lock.className = 'login-page';
      lock.innerHTML = `
        <div class="login-card" style="max-width:460px">
          <div style="text-align:center;font-size:2.5rem;margin-bottom:0.5rem">🔒</div>
          <h1 style="text-align:center">Trial Expired</h1>
          <p class="tagline" style="margin-bottom:1rem">Your 7-day free trial has ended. Enter a valid license key to unlock the app.</p>
          <div id="lock-error" class="error-msg"></div>
          <div class="form-group">
            <label>License Key</label>
            <input type="text" id="lock-license" placeholder="XXXX-XXXX-XXXX-XXXX" style="text-transform:uppercase;letter-spacing:0.08em">
          </div>
          <button type="button" class="btn btn-primary btn-block" id="btn-unlock">Unlock App</button>
          <p class="text-muted text-center mt-2" style="font-size:0.75rem">
            Generate keys with <code>keygen.html</code> (keep it private).<br>
            Trial started: <span id="lock-started"></span>
          </p>
        </div>`;
      document.body.appendChild(lock);
      document.getElementById('btn-unlock').addEventListener('click', async () => {
        const key = document.getElementById('lock-license').value.trim();
        const err = document.getElementById('lock-error');
        if (!key || !validateLicense(key)) {
          err.textContent = 'Invalid license key. Please check and try again.';
          err.style.display = 'block';
          return;
        }
        Store.config.licenseKey = key;
        Store.config.licensed = true;
        Store.config.updatedAt = new Date().toISOString();
        await Store.saveConfig();
        err.style.display = 'none';
        lock.remove();
        this.checkLicense();
        const user = Store.restoreSession();
        if (user) this.showApp();
        else this.showLogin();
        Utils.toast('License activated successfully!', 'success');
      });
    }
    const startedEl = document.getElementById('lock-started');
    if (startedEl && trial) startedEl.textContent = Utils.formatDate(trial.startedAt);
    lock.style.display = 'flex';
  },

  showLogin() {
    document.getElementById('login-page').style.display = 'flex';
    document.getElementById('app-shell').classList.remove('active');
  },

  showApp() {
    // Re-check access before showing app (e.g. trial expired while session open)
    const access = Store.isAccessAllowed();
    if (!access.allowed) {
      this.showTrialExpired(access.trial);
      return;
    }
    document.getElementById('login-page').style.display = 'none';
    const lock = document.getElementById('trial-lock');
    if (lock) lock.remove();
    document.getElementById('app-shell').classList.add('active');
    this.updateUserBadge();
    this.buildNav();
    this.navigate('dashboard');
  },

  updateUserBadge() {
    const u = Store.currentUser;
    const el = document.getElementById('user-badge');
    if (el && u) el.innerHTML = `<strong>${u.name}</strong> · ${u.role}`;
  },

  buildNav() {
    const nav = document.getElementById('sidebar-nav');
    const role = Store.currentUser?.role;
    const items = [
      { id: 'dashboard', label: 'Dashboard', icon: '📊', roles: ['admin', 'inventory', 'cashier'] },
      { id: 'pos', label: 'POS / Billing', icon: '🛒', roles: ['admin', 'cashier'] },
      { id: 'products', label: 'Products', icon: '📦', roles: ['admin', 'inventory'] },
      { id: 'customers', label: 'Customers', icon: '👥', roles: ['admin', 'cashier', 'inventory'] },
      { id: 'suppliers', label: 'Suppliers', icon: '🏭', roles: ['admin', 'inventory'] },
      { id: 'invoices', label: 'Invoices', icon: '🧾', roles: ['admin', 'cashier'] },
      { id: 'reports', label: 'Reports', icon: '📈', roles: ['admin'] },
      { id: 'users', label: 'Users', icon: '🔐', roles: ['admin'] },
      { id: 'settings', label: 'Settings', icon: '⚙️', roles: ['admin'] }
    ];
    nav.innerHTML = items
      .filter(i => i.roles.includes(role))
      .map(i => `<button class="nav-item" data-page="${i.id}">${i.icon} ${i.label}</button>`)
      .join('');
    nav.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => this.navigate(btn.dataset.page));
    });
  },

  navigate(page) {
    this.currentPage = page;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === page));
    document.getElementById('page-title').textContent = {
      dashboard: 'Dashboard',
      pos: 'Point of Sale',
      products: 'Product Management',
      customers: 'Customers',
      suppliers: 'Suppliers',
      invoices: 'Invoice History',
      reports: 'Reports & Analytics',
      users: 'User Management',
      settings: 'Settings & Branding'
    }[page] || page;

    const area = document.getElementById('content-area');
    area.innerHTML = '';
    if (this.pages[page]) this.pages[page](area);
    // Close mobile sidebar
    document.getElementById('sidebar').classList.remove('open');
  },

  bindGlobal() {
    // Login form
    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const user = document.getElementById('login-user').value.trim();
      const pass = document.getElementById('login-pass').value;
      const err = document.getElementById('login-error');
      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true;
      try {
        const u = await Store.login(user, pass);
        if (u) {
          err.style.display = 'none';
          this.showApp();
        } else {
          err.textContent = 'Invalid username or password';
          err.style.display = 'block';
        }
      } finally {
        btn.disabled = false;
      }
    });

    document.getElementById('btn-logout').addEventListener('click', () => {
      Store.logout();
      this.showLogin();
    });

    document.getElementById('menu-toggle').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('open');
    });
  }
};

/* ========== PAGE: Dashboard ========== */
App.pages.dashboard = function (el) {
  const products = Store.products.filter(p => p.active !== false);
  const lowStock = products.filter(p => p.stock <= (p.lowStockThreshold || Store.config.lowStockThresholdDefault || 10));
  const expiring = [];
  products.forEach(p => {
    (p.batches || []).forEach(b => {
      const days = Utils.daysUntil(b.expiryDate);
      if (days !== null && days <= 90) {
        expiring.push({ product: p.name, lot: b.lotNumber, expiry: b.expiryDate, days, qty: b.quantity });
      }
    });
  });
  expiring.sort((a, b) => a.days - b.days);

  const today = new Date().toISOString().slice(0, 10);
  const todayInvoices = Store.invoices.filter(i => (i.createdAt || '').startsWith(today));
  const todaySales = todayInvoices.reduce((s, i) => s + (i.total || 0), 0);

  el.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card success">
        <div class="label">Today's Sales</div>
        <div class="value">${Utils.formatMoney(todaySales, Store.config.currencySymbol)}</div>
      </div>
      <div class="stat-card">
        <div class="label">Today's Invoices</div>
        <div class="value">${todayInvoices.length}</div>
      </div>
      <div class="stat-card ${lowStock.length ? 'warning' : ''}">
        <div class="label">Low Stock Items</div>
        <div class="value">${lowStock.length}</div>
      </div>
      <div class="stat-card ${expiring.length ? 'danger' : ''}">
        <div class="label">Expiring Soon (≤90d)</div>
        <div class="value">${expiring.length}</div>
      </div>
    </div>
    ${Store.offline ? '<div class="alert alert-warning">⚠️ Working offline — changes saved locally. Re-sync when GitHub is available.</div>' : ''}
    <div class="card">
      <div class="card-header"><h3>⚠️ Low Stock Alerts</h3></div>
      ${lowStock.length === 0 ? '<div class="empty-state">All stock levels healthy</div>' : `
        <div class="table-wrap"><table>
          <thead><tr><th>SKU</th><th>Name</th><th>Stock</th><th>Threshold</th></tr></thead>
          <tbody>${lowStock.map(p => `
            <tr>
              <td>${p.sku}</td>
              <td>${p.name}</td>
              <td class="text-danger"><strong>${p.stock}</strong></td>
              <td>${p.lowStockThreshold || 10}</td>
            </tr>`).join('')}</tbody>
        </table></div>`}
    </div>
    <div class="card">
      <div class="card-header"><h3>📅 Expiry Alerts</h3></div>
      ${expiring.length === 0 ? '<div class="empty-state">No items nearing expiry</div>' : `
        <div class="table-wrap"><table>
          <thead><tr><th>Product</th><th>Lot</th><th>Expiry</th><th>Days Left</th><th>Qty</th></tr></thead>
          <tbody>${expiring.slice(0, 20).map(e => `
            <tr>
              <td>${e.product}</td>
              <td>${e.lot}</td>
              <td>${Utils.formatDate(e.expiry)}</td>
              <td><span class="badge ${Utils.expiryClass(e.days)}">${e.days < 0 ? 'EXPIRED' : e.days + 'd'}</span></td>
              <td>${e.qty}</td>
            </tr>`).join('')}</tbody>
        </table></div>`}
    </div>
  `;
};

/* ========== PAGE: POS ========== */
App.pages.pos = function (el) {
  let selectedCustomer = Store.customers.find(c => c.name === 'Walk-in Customer') || Store.customers[0];
  let cartDiscount = 0;
  let paymentType = 'Cash';

  function render() {
    const totals = Store.cartTotals();
    const grand = Math.max(0, totals.total - cartDiscount);
    el.innerHTML = `
      <div class="pos-layout">
        <div class="pos-products">
          <div class="pos-search">
            <input type="text" id="pos-search" placeholder="Search name, SKU or scan barcode..." autofocus>
            <button class="btn btn-outline btn-sm" id="btn-scan">📷 Scan</button>
          </div>
          <div id="scanner-box" class="scanner-area hidden">
            <div id="qr-reader" style="width:100%"></div>
            <button class="btn btn-outline btn-sm mt-1" id="btn-stop-scan">Stop Scanner</button>
          </div>
          <div class="product-grid" id="product-grid"></div>
        </div>
        <div class="pos-cart">
          <div class="cart-header">Cart <span class="text-muted" id="cart-count">(${Store.cart.length})</span></div>
          <div class="cart-items" id="cart-items"></div>
          <div class="cart-footer">
            <div class="form-group mb-1">
              <label>Customer</label>
              <select id="pos-customer">${Store.customers.filter(c => c.active !== false).map(c =>
                `<option value="${c.id}" ${selectedCustomer && c.id === selectedCustomer.id ? 'selected' : ''}>${c.name}${c.creditBalance > 0 ? ' (Udhar: ' + Utils.formatMoney(c.creditBalance, Store.config.currencySymbol) + ')' : ''}</option>`
              ).join('')}</select>
            </div>
            <div class="cart-row"><span>Subtotal</span><span id="c-sub">${Utils.formatMoney(totals.subtotal, Store.config.currencySymbol)}</span></div>
            <div class="cart-row"><span>Discount</span><span id="c-disc">${Utils.formatMoney(totals.discount + cartDiscount, Store.config.currencySymbol)}</span></div>
            <div class="cart-row"><span>${Store.config.taxLabel || 'Tax'}</span><span id="c-tax">${Utils.formatMoney(totals.tax, Store.config.currencySymbol)}</span></div>
            <div class="cart-row total"><span>Total</span><span id="c-total">${Utils.formatMoney(grand, Store.config.currencySymbol)}</span></div>
            <div class="form-group mt-1">
              <label>Bill Discount (flat)</label>
              <input type="number" id="cart-discount" value="${cartDiscount}" min="0" step="0.01">
            </div>
            <div class="form-group">
              <label>Payment Type</label>
              <select id="payment-type">
                <option value="Cash" ${paymentType === 'Cash' ? 'selected' : ''}>Cash</option>
                <option value="Credit" ${paymentType === 'Credit' ? 'selected' : ''}>Credit / Udhar</option>
                <option value="Bank Transfer" ${paymentType === 'Bank Transfer' ? 'selected' : ''}>Bank Transfer</option>
                <option value="Digital Wallet" ${paymentType === 'Digital Wallet' ? 'selected' : ''}>Digital Wallet</option>
              </select>
            </div>
            <div class="cart-actions">
              <button class="btn btn-outline" id="btn-clear-cart">Clear</button>
              <button class="btn btn-success" id="btn-checkout" ${Store.cart.length === 0 ? 'disabled' : ''}>Complete Sale</button>
            </div>
          </div>
        </div>
      </div>
    `;
    renderProducts();
    renderCart();
    bindPosEvents();
  }

  function renderProducts(filter = '') {
    const q = filter.toLowerCase();
    const list = Store.products.filter(p => p.active !== false && p.stock > 0 && (
      !q || p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q) || (p.barcode || '').includes(q)
    ));
    const grid = document.getElementById('product-grid');
    if (!grid) return;
    grid.innerHTML = list.length === 0
      ? '<div class="empty-state">No products found</div>'
      : list.map(p => `
        <div class="product-tile" data-id="${p.id}">
          <div class="name">${p.name}</div>
          <div class="price">${Utils.formatMoney(p.sellingPrice, Store.config.currencySymbol)}</div>
          <div class="stock">Stock: ${p.stock}</div>
        </div>`).join('');
    grid.querySelectorAll('.product-tile').forEach(t => {
      t.addEventListener('click', () => {
        const prod = Store.getProduct(t.dataset.id);
        if (prod && prod.stock > 0) {
          Store.addToCart(prod, 1);
          renderCart();
          updateTotals();
        } else Utils.toast('Out of stock', 'warning');
      });
    });
  }

  function renderCart() {
    const box = document.getElementById('cart-items');
    if (!box) return;
    if (Store.cart.length === 0) {
      box.innerHTML = '<div class="empty-state">Cart is empty</div>';
      return;
    }
    box.innerHTML = Store.cart.map(item => `
      <div class="cart-item">
        <div>
          <strong>${item.name}</strong>
          <div class="text-muted">${Utils.formatMoney(item.price, Store.config.currencySymbol)} × ${item.qty}</div>
          <div class="qty-controls">
            <button data-action="dec" data-id="${item.productId}">−</button>
            <span>${item.qty}</span>
            <button data-action="inc" data-id="${item.productId}">+</button>
            <button data-action="rm" data-id="${item.productId}" style="margin-left:0.5rem;color:var(--danger)">✕</button>
          </div>
        </div>
        <div class="text-right">
          <strong>${Utils.formatMoney(item.price * item.qty - (item.discount || 0), Store.config.currencySymbol)}</strong>
        </div>
      </div>`).join('');
    box.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const item = Store.cart.find(c => c.productId === id);
        if (!item) return;
        if (btn.dataset.action === 'inc') Store.updateCartQty(id, item.qty + 1);
        if (btn.dataset.action === 'dec') Store.updateCartQty(id, item.qty - 1);
        if (btn.dataset.action === 'rm') Store.updateCartQty(id, 0);
        renderCart();
        updateTotals();
      });
    });
    const cnt = document.getElementById('cart-count');
    if (cnt) cnt.textContent = `(${Store.cart.length})`;
  }

  function updateTotals() {
    cartDiscount = parseFloat(document.getElementById('cart-discount')?.value) || 0;
    paymentType = document.getElementById('payment-type')?.value || 'Cash';
    const totals = Store.cartTotals();
    const grand = Math.max(0, totals.total - cartDiscount);
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    set('c-sub', Utils.formatMoney(totals.subtotal, Store.config.currencySymbol));
    set('c-disc', Utils.formatMoney(totals.discount + cartDiscount, Store.config.currencySymbol));
    set('c-tax', Utils.formatMoney(totals.tax, Store.config.currencySymbol));
    set('c-total', Utils.formatMoney(grand, Store.config.currencySymbol));
    const btn = document.getElementById('btn-checkout');
    if (btn) btn.disabled = Store.cart.length === 0;
  }

  function bindPosEvents() {
    document.getElementById('pos-search')?.addEventListener('input', Utils.debounce(e => {
      const val = e.target.value.trim();
      // Try exact barcode match first
      const byCode = Store.getProductByBarcode(val);
      if (byCode && byCode.stock > 0) {
        Store.addToCart(byCode, 1);
        e.target.value = '';
        renderCart();
        updateTotals();
        return;
      }
      renderProducts(val);
    }, 200));

    document.getElementById('pos-search')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const val = e.target.value.trim();
        const byCode = Store.getProductByBarcode(val);
        if (byCode && byCode.stock > 0) {
          Store.addToCart(byCode, 1);
          e.target.value = '';
          renderCart();
          updateTotals();
        }
      }
    });

    document.getElementById('cart-discount')?.addEventListener('input', updateTotals);
    document.getElementById('payment-type')?.addEventListener('change', e => { paymentType = e.target.value; });
    document.getElementById('pos-customer')?.addEventListener('change', e => {
      selectedCustomer = Store.customers.find(c => c.id === e.target.value);
    });

    document.getElementById('btn-clear-cart')?.addEventListener('click', () => {
      Store.clearCart();
      cartDiscount = 0;
      render();
    });

    document.getElementById('btn-checkout')?.addEventListener('click', completeSale);

    // Simple barcode via camera using html5-qrcode if available
    document.getElementById('btn-scan')?.addEventListener('click', () => {
      const box = document.getElementById('scanner-box');
      box.classList.remove('hidden');
      if (window.Html5Qrcode) {
        const scanner = new Html5Qrcode('qr-reader');
        scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: 200 },
          (decoded) => {
            const prod = Store.getProductByBarcode(decoded);
            if (prod && prod.stock > 0) {
              Store.addToCart(prod, 1);
              renderCart();
              updateTotals();
              Utils.toast(`Added: ${prod.name}`, 'success');
            } else Utils.toast('Product not found or out of stock', 'warning');
          },
          () => {}
        ).catch(() => Utils.toast('Camera not available', 'warning'));
        document.getElementById('btn-stop-scan').onclick = () => {
          scanner.stop().catch(() => {});
          box.classList.add('hidden');
        };
      } else {
        Utils.toast('Scanner library not loaded. Type barcode manually.', 'info');
        box.classList.add('hidden');
      }
    });
  }

  async function completeSale() {
    if (Store.cart.length === 0) return;
    const totals = Store.cartTotals();
    const billDisc = parseFloat(document.getElementById('cart-discount')?.value) || 0;
    const grand = Math.max(0, totals.total - billDisc);
    const payType = document.getElementById('payment-type')?.value || 'Cash';
    const custId = document.getElementById('pos-customer')?.value;
    const customer = Store.customers.find(c => c.id === custId);

    // Stock check
    for (const item of Store.cart) {
      const p = Store.getProduct(item.productId);
      if (!p || p.stock < item.qty) {
        Utils.toast(`Insufficient stock for ${item.name}`, 'danger');
        return;
      }
    }

    // Decrement stock (FIFO-ish on batches)
    for (const item of Store.cart) {
      const p = Store.getProduct(item.productId);
      let remaining = item.qty;
      p.stock -= item.qty;
      if (p.batches && p.batches.length) {
        for (const b of p.batches) {
          if (remaining <= 0) break;
          const take = Math.min(b.quantity, remaining);
          b.quantity -= take;
          remaining -= take;
        }
        p.batches = p.batches.filter(b => b.quantity > 0);
      }
    }

    // Credit / Udhar
    if (payType === 'Credit' && customer) {
      customer.creditBalance = (customer.creditBalance || 0) + grand;
    }

    const invoice = {
      id: Utils.uid('inv'),
      number: 'INV-' + String(Store.invoices.length + 1).padStart(5, '0'),
      customerId: customer?.id || null,
      customerName: customer?.name || 'Walk-in',
      items: Store.cart.map(c => ({ ...c })),
      subtotal: totals.subtotal,
      itemDiscount: totals.discount,
      billDiscount: billDisc,
      tax: totals.tax,
      total: grand,
      paymentType: payType,
      cashierId: Store.currentUser.id,
      cashierName: Store.currentUser.name,
      createdAt: new Date().toISOString(),
      status: 'completed'
    };
    Store.invoices.unshift(invoice);

    await Store.save('products');
    await Store.save('customers');
    await Store.save('invoices');

    // Show receipt
    showReceipt(invoice);
    Store.clearCart();
    cartDiscount = 0;
    render();
    Utils.toast('Sale completed successfully!', 'success');
  }

  function showReceipt(inv) {
    const c = Store.config;
    const html = `
      <div id="receipt-print" style="font-family:monospace;width:80mm;padding:8px;margin:0 auto;">
        ${c.logoBase64 ? `<div style="text-align:center"><img src="${c.logoBase64}" style="max-height:50px;max-width:120px"></div>` : ''}
        <div style="text-align:center;font-weight:bold;font-size:14px">${c.storeName || 'Store'}</div>
        <div style="text-align:center;font-size:11px">${c.tagline || ''}</div>
        <div style="text-align:center;font-size:10px">${c.address || ''}<br>${c.phone || ''}</div>
        ${c.ntn ? `<div style="text-align:center;font-size:10px">NTN: ${c.ntn}</div>` : ''}
        <hr style="border:1px dashed #000">
        <div style="font-size:11px">
          Invoice: ${inv.number}<br>
          Date: ${Utils.formatDateTime(inv.createdAt)}<br>
          Cashier: ${inv.cashierName}<br>
          Customer: ${inv.customerName}<br>
          Payment: ${inv.paymentType}
        </div>
        <hr style="border:1px dashed #000">
        <table style="width:100%;font-size:11px;border-collapse:collapse">
          <thead><tr><th align="left">Item</th><th align="right">Qty</th><th align="right">Amt</th></tr></thead>
          <tbody>
            ${inv.items.map(i => `<tr>
              <td>${i.name}</td>
              <td align="right">${i.qty}</td>
              <td align="right">${(i.price * i.qty - (i.discount || 0)).toFixed(2)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        <hr style="border:1px dashed #000">
        <div style="font-size:11px;text-align:right">
          Subtotal: ${inv.subtotal.toFixed(2)}<br>
          Discount: ${(inv.itemDiscount + inv.billDiscount).toFixed(2)}<br>
          ${c.taxLabel || 'Tax'}: ${inv.tax.toFixed(2)}<br>
          <strong>TOTAL: ${c.currencySymbol || 'Rs.'}${inv.total.toFixed(2)}</strong>
        </div>
        <hr style="border:1px dashed #000">
        <div style="text-align:center;font-size:10px">${c.footnote || 'Thank you!'}</div>
      </div>
      <div class="modal-footer no-print">
        <button class="btn btn-outline" onclick="document.getElementById('receipt-modal').classList.remove('open')">Close</button>
        <button class="btn btn-primary" onclick="window.print()">🖨️ Print Receipt</button>
      </div>
    `;
    let modal = document.getElementById('receipt-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'receipt-modal';
      modal.className = 'modal-overlay';
      modal.innerHTML = `<div class="modal"><div class="modal-header"><h3>Receipt</h3><button class="modal-close" onclick="this.closest('.modal-overlay').classList.remove('open')">&times;</button></div><div class="modal-body" id="receipt-body"></div></div>`;
      document.body.appendChild(modal);
    }
    document.getElementById('receipt-body').innerHTML = html;
    modal.classList.add('open');
  }

  render();
};

/* ========== PAGE: Products ========== */
App.pages.products = function (el) {
  function render() {
    const canEdit = Store.hasRole('admin', 'inventory');
    el.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h3>Products (${Store.products.length})</h3>
          <div class="flex gap-1">
            <input type="text" id="prod-search" placeholder="Search..." style="width:180px">
            ${canEdit ? '<button class="btn btn-primary btn-sm" id="btn-add-prod">+ Add Product</button>' : ''}
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>SKU</th><th>Barcode</th><th>Name</th><th>Category</th>
                ${Store.hasRole('admin') ? '<th>Cost</th>' : ''}
                <th>Sell</th><th>Stock</th><th>Expiry</th><th></th>
              </tr>
            </thead>
            <tbody id="prod-tbody"></tbody>
          </table>
        </div>
      </div>
    `;
    drawTable();
    document.getElementById('prod-search')?.addEventListener('input', Utils.debounce(e => drawTable(e.target.value), 200));
    document.getElementById('btn-add-prod')?.addEventListener('click', () => openProductModal());
  }

  function drawTable(filter = '') {
    const q = filter.toLowerCase();
    const list = Store.products.filter(p =>
      !q || p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q) || (p.barcode || '').includes(q)
    );
    const tbody = document.getElementById('prod-tbody');
    if (!tbody) return;
    tbody.innerHTML = list.map(p => {
      const nearest = (p.batches || []).map(b => Utils.daysUntil(b.expiryDate)).filter(d => d !== null).sort((a, b) => a - b)[0];
      return `<tr>
        <td>${p.sku || '—'}</td>
        <td>${p.barcode || '—'}</td>
        <td>${p.name}</td>
        <td>${p.category || '—'}</td>
        ${Store.hasRole('admin') ? `<td>${Utils.formatMoney(p.costPrice, Store.config.currencySymbol)}</td>` : ''}
        <td>${Utils.formatMoney(p.sellingPrice, Store.config.currencySymbol)}</td>
        <td class="${p.stock <= (p.lowStockThreshold || 10) ? 'text-danger' : ''}">${p.stock}</td>
        <td>${nearest !== undefined ? `<span class="badge ${Utils.expiryClass(nearest)}">${nearest < 0 ? 'EXP' : nearest + 'd'}</span>` : '—'}</td>
        <td>
          <button class="btn btn-outline btn-sm" data-edit="${p.id}">Edit</button>
          ${Store.hasRole('admin') ? `<button class="btn btn-danger btn-sm" data-del="${p.id}">Del</button>` : ''}
        </td>
      </tr>`;
    }).join('');
    tbody.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openProductModal(b.dataset.edit)));
    tbody.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Delete this product?')) return;
      Store.products = Store.products.filter(p => p.id !== b.dataset.del);
      await Store.save('products');
      render();
      Utils.toast('Product deleted', 'success');
    }));
  }

  function openProductModal(id) {
    const p = id ? Store.getProduct(id) : null;
    const isNew = !p;
    const modal = ensureModal('product-modal', 'Product', `
      <div class="form-row">
        <div class="form-group"><label>SKU *</label><input id="p-sku" value="${p?.sku || ''}"></div>
        <div class="form-group"><label>Barcode</label><input id="p-barcode" value="${p?.barcode || ''}"></div>
      </div>
      <div class="form-group"><label>Item Name *</label><input id="p-name" value="${p?.name || ''}"></div>
      <div class="form-row">
        <div class="form-group"><label>Category</label><input id="p-cat" value="${p?.category || ''}"></div>
        <div class="form-group"><label>Tax Rate %</label><input type="number" id="p-tax" value="${p?.taxRate ?? Store.config.defaultTaxRate ?? 17}" step="0.01"></div>
      </div>
      <div class="form-row-3">
        <div class="form-group"><label>Cost Price</label><input type="number" id="p-cost" value="${p?.costPrice ?? 0}" step="0.01"></div>
        <div class="form-group"><label>Selling Price *</label><input type="number" id="p-sell" value="${p?.sellingPrice ?? 0}" step="0.01"></div>
        <div class="form-group"><label>Wholesale</label><input type="number" id="p-whole" value="${p?.wholesalePrice ?? 0}" step="0.01"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Stock Qty</label><input type="number" id="p-stock" value="${p?.stock ?? 0}" min="0"></div>
        <div class="form-group"><label>Low Stock Alert</label><input type="number" id="p-low" value="${p?.lowStockThreshold ?? 10}" min="0"></div>
      </div>
      <div class="form-group"><label>Batch / Lot (JSON or simple)</label>
        <textarea id="p-batches" rows="3" placeholder='[{"lotNumber":"LOT1","expiryDate":"2026-12-31","quantity":50}]'>${p?.batches ? JSON.stringify(p.batches, null, 2) : ''}</textarea>
      </div>
      <div class="form-group">
        <label><input type="checkbox" id="p-active" ${p?.active !== false ? 'checked' : ''}> Active</label>
      </div>
    `, async () => {
      const name = document.getElementById('p-name').value.trim();
      const sell = parseFloat(document.getElementById('p-sell').value);
      if (!name || isNaN(sell)) { Utils.toast('Name and selling price required', 'danger'); return; }
      let batches = [];
      try {
        const raw = document.getElementById('p-batches').value.trim();
        if (raw) batches = JSON.parse(raw);
      } catch (_) { Utils.toast('Invalid batches JSON', 'danger'); return; }
      const data = {
        id: p?.id || Utils.uid('prod'),
        sku: document.getElementById('p-sku').value.trim(),
        barcode: document.getElementById('p-barcode').value.trim(),
        name,
        category: document.getElementById('p-cat').value.trim(),
        costPrice: parseFloat(document.getElementById('p-cost').value) || 0,
        sellingPrice: sell,
        wholesalePrice: parseFloat(document.getElementById('p-whole').value) || 0,
        taxRate: parseFloat(document.getElementById('p-tax').value) || 0,
        stock: parseInt(document.getElementById('p-stock').value) || 0,
        lowStockThreshold: parseInt(document.getElementById('p-low').value) || 10,
        batches,
        active: document.getElementById('p-active').checked,
        createdAt: p?.createdAt || new Date().toISOString()
      };
      if (isNew) Store.products.push(data);
      else {
        const idx = Store.products.findIndex(x => x.id === p.id);
        Store.products[idx] = data;
      }
      await Store.save('products');
      closeModal('product-modal');
      render();
      Utils.toast(isNew ? 'Product added' : 'Product updated', 'success');
    });
    openModal('product-modal');
  }

  render();
};

/* ========== PAGE: Customers ========== */
App.pages.customers = function (el) {
  function render() {
    el.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h3>Customers (${Store.customers.length})</h3>
          <button class="btn btn-primary btn-sm" id="btn-add-cust">+ Add Customer</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Phone</th><th>Address</th><th>NTN</th><th>Credit (Udhar)</th><th></th></tr></thead>
            <tbody id="cust-tbody"></tbody>
          </table>
        </div>
      </div>
    `;
    const tbody = document.getElementById('cust-tbody');
    tbody.innerHTML = Store.customers.map(c => `
      <tr>
        <td>${c.name}</td>
        <td>${c.phone || '—'}</td>
        <td>${c.address || '—'}</td>
        <td>${c.ntn || '—'}</td>
        <td class="${c.creditBalance > 0 ? 'text-danger' : ''}">${Utils.formatMoney(c.creditBalance || 0, Store.config.currencySymbol)}</td>
        <td>
          <button class="btn btn-outline btn-sm" data-edit="${c.id}">Edit</button>
          ${c.creditBalance > 0 ? `<button class="btn btn-success btn-sm" data-pay="${c.id}">Receive Payment</button>` : ''}
        </td>
      </tr>`).join('');
    tbody.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openCustModal(b.dataset.edit)));
    tbody.querySelectorAll('[data-pay]').forEach(b => b.addEventListener('click', () => receivePayment(b.dataset.pay)));
    document.getElementById('btn-add-cust').addEventListener('click', () => openCustModal());
  }

  function openCustModal(id) {
    const c = id ? Store.customers.find(x => x.id === id) : null;
    ensureModal('cust-modal', c ? 'Edit Customer' : 'Add Customer', `
      <div class="form-group"><label>Name *</label><input id="c-name" value="${c?.name || ''}"></div>
      <div class="form-row">
        <div class="form-group"><label>Phone</label><input id="c-phone" value="${c?.phone || ''}"></div>
        <div class="form-group"><label>NTN / Tax ID</label><input id="c-ntn" value="${c?.ntn || ''}"></div>
      </div>
      <div class="form-group"><label>Address</label><textarea id="c-addr" rows="2">${c?.address || ''}</textarea></div>
      <div class="form-group"><label>Current Credit Balance</label><input type="number" id="c-credit" value="${c?.creditBalance ?? 0}" step="0.01" ${!Store.hasRole('admin') ? 'readonly' : ''}></div>
    `, async () => {
      const name = document.getElementById('c-name').value.trim();
      if (!name) { Utils.toast('Name required', 'danger'); return; }
      const data = {
        id: c?.id || Utils.uid('cust'),
        name,
        phone: document.getElementById('c-phone').value.trim(),
        address: document.getElementById('c-addr').value.trim(),
        ntn: document.getElementById('c-ntn').value.trim(),
        creditBalance: parseFloat(document.getElementById('c-credit').value) || 0,
        active: true,
        createdAt: c?.createdAt || new Date().toISOString()
      };
      if (c) {
        const idx = Store.customers.findIndex(x => x.id === c.id);
        Store.customers[idx] = data;
      } else Store.customers.push(data);
      await Store.save('customers');
      closeModal('cust-modal');
      render();
      Utils.toast('Customer saved', 'success');
    });
    openModal('cust-modal');
  }

  function receivePayment(id) {
    const c = Store.customers.find(x => x.id === id);
    if (!c) return;
    ensureModal('pay-modal', 'Receive Credit Payment', `
      <p>Customer: <strong>${c.name}</strong></p>
      <p>Current Balance: <strong class="text-danger">${Utils.formatMoney(c.creditBalance, Store.config.currencySymbol)}</strong></p>
      <div class="form-group"><label>Amount Received</label><input type="number" id="pay-amt" min="0" max="${c.creditBalance}" step="0.01" value="${c.creditBalance}"></div>
    `, async () => {
      const amt = parseFloat(document.getElementById('pay-amt').value) || 0;
      if (amt <= 0 || amt > c.creditBalance) { Utils.toast('Invalid amount', 'danger'); return; }
      c.creditBalance -= amt;
      await Store.save('customers');
      closeModal('pay-modal');
      render();
      Utils.toast(`Received ${Utils.formatMoney(amt, Store.config.currencySymbol)}`, 'success');
    });
    openModal('pay-modal');
  }

  render();
};

/* ========== PAGE: Suppliers ========== */
App.pages.suppliers = function (el) {
  function render() {
    el.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h3>Suppliers (${Store.suppliers.length})</h3>
          <button class="btn btn-primary btn-sm" id="btn-add-supp">+ Add Supplier</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Company</th><th>Contact</th><th>Phone</th><th>Ledger Balance</th><th></th></tr></thead>
            <tbody id="supp-tbody"></tbody>
          </table>
        </div>
      </div>
    `;
    document.getElementById('supp-tbody').innerHTML = Store.suppliers.map(s => `
      <tr>
        <td>${s.companyName}</td>
        <td>${s.contactPerson || '—'}</td>
        <td>${s.phone || '—'}</td>
        <td>${Utils.formatMoney(s.ledgerBalance || 0, Store.config.currencySymbol)}</td>
        <td><button class="btn btn-outline btn-sm" data-edit="${s.id}">Edit</button></td>
      </tr>`).join('');
    document.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openSupp(b.dataset.edit)));
    document.getElementById('btn-add-supp').addEventListener('click', () => openSupp());
  }

  function openSupp(id) {
    const s = id ? Store.suppliers.find(x => x.id === id) : null;
    ensureModal('supp-modal', s ? 'Edit Supplier' : 'Add Supplier', `
      <div class="form-group"><label>Company Name *</label><input id="s-name" value="${s?.companyName || ''}"></div>
      <div class="form-row">
        <div class="form-group"><label>Contact Person</label><input id="s-contact" value="${s?.contactPerson || ''}"></div>
        <div class="form-group"><label>Phone</label><input id="s-phone" value="${s?.phone || ''}"></div>
      </div>
      <div class="form-group"><label>Ledger Balance</label><input type="number" id="s-bal" value="${s?.ledgerBalance ?? 0}" step="0.01"></div>
    `, async () => {
      const name = document.getElementById('s-name').value.trim();
      if (!name) { Utils.toast('Company name required', 'danger'); return; }
      const data = {
        id: s?.id || Utils.uid('supp'),
        companyName: name,
        contactPerson: document.getElementById('s-contact').value.trim(),
        phone: document.getElementById('s-phone').value.trim(),
        ledgerBalance: parseFloat(document.getElementById('s-bal').value) || 0,
        active: true,
        createdAt: s?.createdAt || new Date().toISOString()
      };
      if (s) {
        const idx = Store.suppliers.findIndex(x => x.id === s.id);
        Store.suppliers[idx] = data;
      } else Store.suppliers.push(data);
      await Store.save('suppliers');
      closeModal('supp-modal');
      render();
      Utils.toast('Supplier saved', 'success');
    });
    openModal('supp-modal');
  }
  render();
};

/* ========== PAGE: Invoices ========== */
App.pages.invoices = function (el) {
  el.innerHTML = `
    <div class="card">
      <div class="card-header"><h3>Invoice History (${Store.invoices.length})</h3></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Date</th><th>Customer</th><th>Cashier</th><th>Payment</th><th>Total</th><th></th></tr></thead>
          <tbody>
            ${Store.invoices.length === 0 ? '<tr><td colspan="7" class="text-center text-muted">No invoices yet</td></tr>' :
              Store.invoices.map(inv => `
                <tr>
                  <td>${inv.number}</td>
                  <td>${Utils.formatDateTime(inv.createdAt)}</td>
                  <td>${inv.customerName}</td>
                  <td>${inv.cashierName}</td>
                  <td><span class="badge badge-info">${inv.paymentType}</span></td>
                  <td>${Utils.formatMoney(inv.total, Store.config.currencySymbol)}</td>
                  <td><button class="btn btn-outline btn-sm" data-view="${inv.id}">View</button></td>
                </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
  el.querySelectorAll('[data-view]').forEach(b => {
    b.addEventListener('click', () => {
      const inv = Store.invoices.find(i => i.id === b.dataset.view);
      if (!inv) return;
      // Reuse receipt view
      const c = Store.config;
      ensureModal('inv-view', inv.number, `
        <p><strong>Date:</strong> ${Utils.formatDateTime(inv.createdAt)}</p>
        <p><strong>Customer:</strong> ${inv.customerName}</p>
        <p><strong>Cashier:</strong> ${inv.cashierName}</p>
        <p><strong>Payment:</strong> ${inv.paymentType}</p>
        <div class="table-wrap mt-1"><table>
          <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead>
          <tbody>${inv.items.map(i => `<tr>
            <td>${i.name}</td><td>${i.qty}</td>
            <td>${Utils.formatMoney(i.price, c.currencySymbol)}</td>
            <td>${Utils.formatMoney(i.price * i.qty - (i.discount || 0), c.currencySymbol)}</td>
          </tr>`).join('')}</tbody>
        </table></div>
        <div class="mt-1 text-right">
          <div>Subtotal: ${Utils.formatMoney(inv.subtotal, c.currencySymbol)}</div>
          <div>Discount: ${Utils.formatMoney(inv.itemDiscount + inv.billDiscount, c.currencySymbol)}</div>
          <div>${c.taxLabel || 'Tax'}: ${Utils.formatMoney(inv.tax, c.currencySymbol)}</div>
          <div><strong>Total: ${Utils.formatMoney(inv.total, c.currencySymbol)}</strong></div>
        </div>
      `, null, true);
      openModal('inv-view');
    });
  });
};

/* ========== PAGE: Reports ========== */
App.pages.reports = function (el) {
  const byDay = {};
  Store.invoices.forEach(inv => {
    const d = (inv.createdAt || '').slice(0, 10);
    if (!byDay[d]) byDay[d] = { count: 0, total: 0, cost: 0 };
    byDay[d].count++;
    byDay[d].total += inv.total || 0;
    inv.items.forEach(i => { byDay[d].cost += (i.costPrice || 0) * i.qty; });
  });
  const days = Object.keys(byDay).sort().reverse().slice(0, 30);
  const totalSales = Store.invoices.reduce((s, i) => s + (i.total || 0), 0);
  const totalCost = Store.invoices.reduce((s, inv) => s + inv.items.reduce((a, i) => a + (i.costPrice || 0) * i.qty, 0), 0);

  el.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card success"><div class="label">Total Sales</div><div class="value">${Utils.formatMoney(totalSales, Store.config.currencySymbol)}</div></div>
      <div class="stat-card"><div class="label">Est. Cost of Goods</div><div class="value">${Utils.formatMoney(totalCost, Store.config.currencySymbol)}</div></div>
      <div class="stat-card"><div class="label">Gross Profit</div><div class="value">${Utils.formatMoney(totalSales - totalCost, Store.config.currencySymbol)}</div></div>
      <div class="stat-card"><div class="label">Invoices</div><div class="value">${Store.invoices.length}</div></div>
    </div>
    <div class="card">
      <div class="card-header"><h3>Daily Sales (last 30 days with activity)</h3></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Date</th><th>Invoices</th><th>Sales</th><th>Est. Profit</th></tr></thead>
        <tbody>
          ${days.length === 0 ? '<tr><td colspan="4" class="text-center text-muted">No data</td></tr>' :
            days.map(d => `<tr>
              <td>${Utils.formatDate(d)}</td>
              <td>${byDay[d].count}</td>
              <td>${Utils.formatMoney(byDay[d].total, Store.config.currencySymbol)}</td>
              <td>${Utils.formatMoney(byDay[d].total - byDay[d].cost, Store.config.currencySymbol)}</td>
            </tr>`).join('')}
        </tbody>
      </table></div>
    </div>
  `;
};

/* ========== PAGE: Users ========== */
App.pages.users = function (el) {
  function render() {
    el.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h3>Users</h3>
          <button class="btn btn-primary btn-sm" id="btn-add-user">+ Add User</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Username</th><th>Name</th><th>Role</th><th>Status</th><th></th></tr></thead>
            <tbody>
              ${Store.users.map(u => `
                <tr>
                  <td>${u.username}</td>
                  <td>${u.name}</td>
                  <td><span class="badge badge-info">${u.role}</span></td>
                  <td>${u.active ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-danger">Disabled</span>'}</td>
                  <td>
                    <button class="btn btn-outline btn-sm" data-edit="${u.id}">Edit</button>
                    <button class="btn btn-warning btn-sm" data-reset="${u.id}">Reset Password</button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <p class="text-muted mt-1" style="font-size:0.8rem">Password recovery is manual (Admin resets password). Default admin password: <code>admin</code></p>
      </div>
    `;
    document.getElementById('btn-add-user').addEventListener('click', () => openUser());
    el.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openUser(b.dataset.edit)));
    el.querySelectorAll('[data-reset]').forEach(b => b.addEventListener('click', () => resetPass(b.dataset.reset)));
  }

  function openUser(id) {
    const u = id ? Store.users.find(x => x.id === id) : null;
    ensureModal('user-modal', u ? 'Edit User' : 'Add User', `
      <div class="form-group"><label>Username *</label><input id="u-user" value="${u?.username || ''}" ${u ? 'readonly' : ''}></div>
      <div class="form-group"><label>Display Name</label><input id="u-name" value="${u?.name || ''}"></div>
      <div class="form-group"><label>Role</label>
        <select id="u-role">
          <option value="admin" ${u?.role === 'admin' ? 'selected' : ''}>Admin</option>
          <option value="cashier" ${u?.role === 'cashier' ? 'selected' : ''}>Cashier</option>
          <option value="inventory" ${u?.role === 'inventory' ? 'selected' : ''}>Inventory Manager</option>
        </select>
      </div>
      ${!u ? '<div class="form-group"><label>Password *</label><input type="password" id="u-pass"></div>' : ''}
      <div class="form-group"><label><input type="checkbox" id="u-active" ${u?.active !== false ? 'checked' : ''}> Active</label></div>
    `, async () => {
      const username = document.getElementById('u-user').value.trim();
      if (!username) { Utils.toast('Username required', 'danger'); return; }
      if (!u) {
        const pass = document.getElementById('u-pass').value;
        if (!pass) { Utils.toast('Password required', 'danger'); return; }
        const hash = await Utils.sha256(pass);
        Store.users.push({
          id: Utils.uid('user'),
          username,
          passwordHash: hash,
          role: document.getElementById('u-role').value,
          name: document.getElementById('u-name').value.trim() || username,
          active: document.getElementById('u-active').checked,
          createdAt: new Date().toISOString()
        });
      } else {
        const idx = Store.users.findIndex(x => x.id === u.id);
        Store.users[idx] = {
          ...u,
          name: document.getElementById('u-name').value.trim() || u.name,
          role: document.getElementById('u-role').value,
          active: document.getElementById('u-active').checked
        };
      }
      await Store.save('users');
      closeModal('user-modal');
      render();
      Utils.toast('User saved', 'success');
    });
    openModal('user-modal');
  }

  function resetPass(id) {
    const u = Store.users.find(x => x.id === id);
    if (!u) return;
    ensureModal('reset-modal', 'Reset Password — ' + u.username, `
      <div class="form-group"><label>New Password</label><input type="password" id="r-pass"></div>
      <div class="form-group"><label>Confirm</label><input type="password" id="r-pass2"></div>
    `, async () => {
      const p1 = document.getElementById('r-pass').value;
      const p2 = document.getElementById('r-pass2').value;
      if (!p1 || p1 !== p2) { Utils.toast('Passwords do not match', 'danger'); return; }
      u.passwordHash = await Utils.sha256(p1);
      await Store.save('users');
      closeModal('reset-modal');
      Utils.toast('Password reset', 'success');
    });
    openModal('reset-modal');
  }
  render();
};

/* ========== PAGE: Settings ========== */
App.pages.settings = function (el) {
  const c = Store.config;
  el.innerHTML = `
    <div class="card">
      <div class="card-header"><h3>Store Branding</h3></div>
      <div class="form-row">
        <div class="form-group"><label>Store Name</label><input id="cfg-name" value="${c.storeName || ''}"></div>
        <div class="form-group"><label>Tagline</label><input id="cfg-tag" value="${c.tagline || ''}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Phone</label><input id="cfg-phone" value="${c.phone || ''}"></div>
        <div class="form-group"><label>NTN / Tax ID</label><input id="cfg-ntn" value="${c.ntn || ''}"></div>
      </div>
      <div class="form-group"><label>Address</label><textarea id="cfg-addr" rows="2">${c.address || ''}</textarea></div>
      <div class="form-group"><label>Receipt Footnote</label><textarea id="cfg-foot" rows="2">${c.footnote || ''}</textarea></div>
      <div class="form-row">
        <div class="form-group"><label>Currency Symbol</label><input id="cfg-sym" value="${c.currencySymbol || 'Rs.'}"></div>
        <div class="form-group"><label>Tax Label</label><input id="cfg-taxlabel" value="${c.taxLabel || 'GST'}"></div>
      </div>
      <div class="form-group"><label>Logo (upload image → Base64)</label>
        <input type="file" id="cfg-logo" accept="image/*">
        ${c.logoBase64 ? '<img src="' + c.logoBase64 + '" style="max-height:60px;margin-top:0.5rem;display:block">' : ''}
      </div>
    </div>
    <div class="card">
      <div class="card-header"><h3>GitHub Persistence (optional)</h3></div>
      <p class="text-muted mb-1" style="font-size:0.85rem">Create a fine-grained PAT with Contents: Read & Write on your repo. Store only in browser localStorage.</p>
      <div class="form-row">
        <div class="form-group"><label>GitHub Owner</label><input id="cfg-owner" value="${c.github?.owner || ''}" placeholder="username or org"></div>
        <div class="form-group"><label>Repository</label><input id="cfg-repo" value="${c.github?.repo || ''}" placeholder="repo-name"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Branch</label><input id="cfg-branch" value="${c.github?.branch || 'main'}"></div>
        <div class="form-group"><label>Personal Access Token</label><input type="password" id="cfg-token" value="${c.github?.token || ''}" placeholder="ghp_..."></div>
      </div>
      <button class="btn btn-outline btn-sm" id="btn-test-gh">Test Connection</button>
    </div>
    <div class="card">
      <div class="card-header"><h3>License & Trial</h3></div>
      <div class="form-group"><label>License Key</label><input id="cfg-license" value="${c.licenseKey || ''}" placeholder="XXXX-XXXX-XXXX-XXXX" style="text-transform:uppercase;letter-spacing:0.06em"></div>
      ${(() => {
        const t = Store.getTrialInfo();
        if (c.licensed) return `<p class="alert alert-success" style="margin:0">✅ Licensed — full access unlocked.</p>`;
        if (t.expired) return `<p class="alert alert-danger" style="margin:0">⛔ Trial expired (${t.trialDays} days). Enter a valid key to continue.</p>`;
        return `<p class="alert alert-warning" style="margin:0">⏳ Trial: <strong>${t.remainingDays}</strong> of ${t.trialDays} days remaining (started ${Utils.formatDate(t.startedAt)}).</p>`;
      })()}
      <p class="text-muted mt-1" style="font-size:0.8rem">Generate keys from <code>keygen.html</code> (keep that file private).</p>
    </div>
    <button class="btn btn-primary" id="btn-save-cfg">Save Settings</button>
  `;

  document.getElementById('cfg-logo')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      Store.config.logoBase64 = reader.result;
      Utils.toast('Logo loaded (save settings to persist)', 'info');
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('btn-test-gh')?.addEventListener('click', async () => {
    const owner = document.getElementById('cfg-owner').value.trim();
    const repo = document.getElementById('cfg-repo').value.trim();
    const token = document.getElementById('cfg-token').value.trim();
    const branch = document.getElementById('cfg-branch').value.trim() || 'main';
    if (!owner || !repo || !token) { Utils.toast('Fill owner, repo and token', 'warning'); return; }
    GitHub.configure({ owner, repo, branch, token });
    try {
      await GitHub.getFile('data/config.json');
      Utils.toast('GitHub connection OK', 'success');
    } catch (e) {
      Utils.toast('Connection failed: ' + e.message, 'danger');
    }
  });

  document.getElementById('btn-save-cfg')?.addEventListener('click', async () => {
    Store.config.storeName = document.getElementById('cfg-name').value.trim();
    Store.config.tagline = document.getElementById('cfg-tag').value.trim();
    Store.config.phone = document.getElementById('cfg-phone').value.trim();
    Store.config.ntn = document.getElementById('cfg-ntn').value.trim();
    Store.config.address = document.getElementById('cfg-addr').value.trim();
    Store.config.footnote = document.getElementById('cfg-foot').value.trim();
    Store.config.currencySymbol = document.getElementById('cfg-sym').value.trim() || 'Rs.';
    Store.config.taxLabel = document.getElementById('cfg-taxlabel').value.trim() || 'GST';
    Store.config.github = {
      owner: document.getElementById('cfg-owner').value.trim(),
      repo: document.getElementById('cfg-repo').value.trim(),
      branch: document.getElementById('cfg-branch').value.trim() || 'main',
      token: document.getElementById('cfg-token').value.trim()
    };
    const lic = document.getElementById('cfg-license').value.trim();
    Store.config.licenseKey = lic;
    Store.config.licensed = validateLicense(lic);
    Store.config.updatedAt = new Date().toISOString();
    GitHub.configure(Store.config.github);
    await Store.saveConfig();
    App.applyBranding();
    App.checkLicense();
    // If trial was expired and key is now valid, ensure we're not stuck
    if (Store.config.licensed) {
      const lock = document.getElementById('trial-lock');
      if (lock) lock.remove();
    }
    Utils.toast(Store.config.licensed ? 'Settings saved — license active' : 'Settings saved', 'success');
    // Re-render settings to refresh trial status card
    if (App.currentPage === 'settings') App.navigate('settings');
  });
};


/* ===== Modal helpers ===== */
function ensureModal(id, title, bodyHtml, onSave, viewOnly = false) {
  let m = document.getElementById(id);
  if (!m) {
    m = document.createElement('div');
    m.id = id;
    m.className = 'modal-overlay';
    m.innerHTML = `<div class="modal"><div class="modal-header"><h3></h3><button class="modal-close">&times;</button></div><div class="modal-body"></div><div class="modal-footer"></div></div>`;
    document.body.appendChild(m);
    m.querySelector('.modal-close').onclick = () => closeModal(id);
    m.addEventListener('click', e => { if (e.target === m) closeModal(id); });
  }
  m.querySelector('.modal-header h3').textContent = title;
  m.querySelector('.modal-body').innerHTML = bodyHtml;
  const footer = m.querySelector('.modal-footer');
  if (viewOnly || !onSave) {
    footer.innerHTML = `<button class="btn btn-outline" data-close>Close</button>`;
  } else {
    footer.innerHTML = `<button class="btn btn-outline" data-close>Cancel</button><button class="btn btn-primary" data-save>Save</button>`;
    footer.querySelector('[data-save]').onclick = onSave;
  }
  footer.querySelector('[data-close]').onclick = () => closeModal(id);
  return m;
}
function openModal(id) { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

/* ===== License validation (shared secret with keygen) ===== */
function validateLicense(key) {
  if (!key) return false;
  // Format: XXXX-XXXX-XXXX-XXXX where checksum derived from store name + secret
  const parts = key.toUpperCase().replace(/[^A-Z0-9]/g, '').match(/.{1,4}/g);
  if (!parts || parts.length < 4) return false;
  const payload = parts.slice(0, 3).join('');
  const check = parts[3];
  // Simple deterministic checksum (same algorithm as keygen.html)
  let h = 0;
  const secret = 'POS-WL-2025-SECRET';
  const str = payload + secret;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  const expected = Math.abs(h).toString(36).toUpperCase().padStart(4, '0').slice(0, 4);
  return check === expected;
}

// Boot
document.addEventListener('DOMContentLoaded', () => App.start());
