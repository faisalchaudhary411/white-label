/* Central data store with local cache + optional GitHub sync */
const Store = {
  users: [],
  products: [],
  customers: [],
  suppliers: [],
  invoices: [],
  config: {},
  shas: {},
  currentUser: null,
  cart: [],
  heldCarts: [],
  offline: false,
  TRIAL_DAYS: 7,
  priceMode: 'retail', // 'retail' | 'wholesale'

  async init() {
    // Load local first for speed
    this.loadLocal();
    // Then try GitHub if configured
    const gh = this.config.github || {};
    if (gh.token && gh.owner && gh.repo) {
      GitHub.configure(gh);
      try {
        const { data, shas } = await GitHub.loadAll();
        if (data.users) this.users = data.users;
        if (data.products) this.products = data.products;
        if (data.customers) this.customers = data.customers;
        if (data.suppliers) this.suppliers = data.suppliers;
        if (data.invoices) this.invoices = data.invoices;
        if (data.config) this.config = { ...this.config, ...data.config };
        this.shas = shas;
        this.ensureTrialStart(); // keep trial clock stable after remote config merge
        this.saveLocal();
        this.offline = false;
      } catch (e) {
        console.warn('GitHub sync failed, using local cache', e);
        this.offline = true;
      }
    }
  },

  loadLocal() {
    try {
      const keys = ['users', 'products', 'customers', 'suppliers', 'invoices', 'config', 'shas'];
      keys.forEach(k => {
        const raw = localStorage.getItem(`pos_${k}`);
        if (raw) this[k] = JSON.parse(raw);
      });
      if (!this.config.storeName) {
        this.config = {
          storeName: 'My Store POS',
          tagline: 'Quality Products, Trusted Service',
          phone: '',
          address: '',
          ntn: '',
          footnote: 'Thank you for shopping with us!',
          logoBase64: '',
          currency: 'PKR',
          currencySymbol: 'Rs.',
          taxLabel: 'GST',
          defaultTaxRate: 17,
          receiptWidth: '80mm',
          lowStockThresholdDefault: 10,
          expiryAlertDays: [30, 60, 90],
          licenseKey: '',
          licensed: false,
          trialStartedAt: null,
          vendor: {
            appName: 'GrokPOS',
            makerName: '',
            makerWebsite: '',
            makerSupport: '',
            poweredByText: 'Powered by GrokPOS',
            makerLogoBase64: ''
          },
          github: { owner: '', repo: '', branch: 'main', token: '' },
          theme: { primaryColor: '#2563eb', secondaryColor: '#1e40af' }
        };
      }
      if (!this.config.vendor) {
        this.config.vendor = {
          appName: 'GrokPOS',
          makerName: '',
          makerWebsite: '',
          makerSupport: '',
          poweredByText: 'Powered by GrokPOS',
          makerLogoBase64: ''
        };
      }
      // Ensure trial start date exists (first run)
      this.ensureTrialStart();
      if (!Array.isArray(this.users) || this.users.length === 0) {
        this.users = [{
          id: 'admin-001',
          username: 'admin',
          passwordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
          role: 'admin',
          name: 'Administrator',
          active: true,
          createdAt: new Date().toISOString()
        }, {
          id: 'cashier-001',
          username: 'cashier',
          passwordHash: 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3',
          role: 'cashier',
          name: 'Cashier User',
          active: true,
          createdAt: new Date().toISOString()
        }];
      }
      if (!Array.isArray(this.products)) this.products = [];
      if (this.products.length === 0) {
        // Demo catalog for first run / testing
        this.products = [
          { id: 'prod-001', sku: 'RICE-5KG', barcode: '8901001001001', name: 'Basmati Rice 5kg', category: 'Grocery', costPrice: 850, sellingPrice: 1100, wholesalePrice: 980, taxRate: 0, stock: 48, lowStockThreshold: 10, batches: [{ lotNumber: 'RICE-A1', expiryDate: '2027-06-30', quantity: 30 }, { lotNumber: 'RICE-A2', expiryDate: '2027-12-15', quantity: 18 }], active: true, createdAt: new Date().toISOString() },
          { id: 'prod-002', sku: 'OIL-1L', barcode: '8901001001002', name: 'Cooking Oil 1 Litre', category: 'Grocery', costPrice: 420, sellingPrice: 520, wholesalePrice: 480, taxRate: 17, stock: 72, lowStockThreshold: 15, batches: [{ lotNumber: 'OIL-B1', expiryDate: '2026-08-20', quantity: 72 }], active: true, createdAt: new Date().toISOString() },
          { id: 'prod-003', sku: 'MILK-1L', barcode: '8901001001003', name: 'Fresh Milk 1L', category: 'Dairy', costPrice: 180, sellingPrice: 220, wholesalePrice: 200, taxRate: 0, stock: 8, lowStockThreshold: 12, batches: [{ lotNumber: 'MLK-C1', expiryDate: '2026-10-20', quantity: 8 }], active: true, createdAt: new Date().toISOString() },
          { id: 'prod-004', sku: 'SOAP-100', barcode: '8901001001004', name: 'Bath Soap 100g', category: 'Personal Care', costPrice: 45, sellingPrice: 80, wholesalePrice: 60, taxRate: 17, stock: 120, lowStockThreshold: 20, batches: [], active: true, createdAt: new Date().toISOString() },
          { id: 'prod-005', sku: 'PANADOL-500', barcode: '8901001001005', name: 'Panadol 500mg (10 tabs)', category: 'Pharmacy', costPrice: 35, sellingPrice: 55, wholesalePrice: 45, taxRate: 0, stock: 25, lowStockThreshold: 15, batches: [{ lotNumber: 'PN-D1', expiryDate: '2026-11-05', quantity: 15 }, { lotNumber: 'PN-D2', expiryDate: '2027-03-01', quantity: 10 }], active: true, createdAt: new Date().toISOString() },
          { id: 'prod-006', sku: 'SUGAR-1KG', barcode: '8901001001006', name: 'White Sugar 1kg', category: 'Grocery', costPrice: 140, sellingPrice: 175, wholesalePrice: 155, taxRate: 0, stock: 60, lowStockThreshold: 10, batches: [], active: true, createdAt: new Date().toISOString() },
          { id: 'prod-007', sku: 'TEA-450', barcode: '8901001001007', name: 'Tapal Tea 450g', category: 'Grocery', costPrice: 520, sellingPrice: 680, wholesalePrice: 600, taxRate: 17, stock: 35, lowStockThreshold: 8, batches: [], active: true, createdAt: new Date().toISOString() },
          { id: 'prod-008', sku: 'BREAD-STD', barcode: '8901001001008', name: 'Bread Loaf', category: 'Bakery', costPrice: 80, sellingPrice: 120, wholesalePrice: 100, taxRate: 0, stock: 14, lowStockThreshold: 10, batches: [{ lotNumber: 'BRD-F1', expiryDate: '2026-10-18', quantity: 14 }], active: true, createdAt: new Date().toISOString() },
          { id: 'prod-009', sku: 'SHAMPOO-200', barcode: '8901001001009', name: 'Shampoo 200ml', category: 'Personal Care', costPrice: 210, sellingPrice: 350, wholesalePrice: 280, taxRate: 17, stock: 22, lowStockThreshold: 5, batches: [], active: true, createdAt: new Date().toISOString() },
          { id: 'prod-010', sku: 'ORS-SACHET', barcode: '8901001001010', name: 'ORS Sachet', category: 'Pharmacy', costPrice: 12, sellingPrice: 25, wholesalePrice: 18, taxRate: 0, stock: 90, lowStockThreshold: 20, batches: [], active: true, createdAt: new Date().toISOString() },
          { id: 'prod-011', sku: 'CHIPS-LAYS', barcode: '8901001001011', name: 'Lays Chips Regular', category: 'Snacks', costPrice: 40, sellingPrice: 60, wholesalePrice: 50, taxRate: 17, stock: 55, lowStockThreshold: 15, batches: [], active: true, createdAt: new Date().toISOString() },
          { id: 'prod-012', sku: 'WATER-1.5', barcode: '8901001001012', name: 'Mineral Water 1.5L', category: 'Beverages', costPrice: 50, sellingPrice: 80, wholesalePrice: 65, taxRate: 0, stock: 100, lowStockThreshold: 24, batches: [], active: true, createdAt: new Date().toISOString() }
        ];
      }
      if (!Array.isArray(this.suppliers) || this.suppliers.length === 0) {
        this.suppliers = [
          { id: 'supp-001', companyName: 'ABC Distributors', contactPerson: 'Ali Raza', phone: '03009876543', ledgerBalance: 45000, active: true, createdAt: new Date().toISOString() },
          { id: 'supp-002', companyName: 'Punjab Pharma Supply', contactPerson: 'Dr. Hassan', phone: '042111222333', ledgerBalance: 18500, active: true, createdAt: new Date().toISOString() }
        ];
      }
      if (!Array.isArray(this.heldCarts)) this.heldCarts = [];
      try {
        const held = localStorage.getItem('pos_heldCarts');
        if (held) this.heldCarts = JSON.parse(held);
      } catch (_) {}
      if (!Array.isArray(this.customers)) this.customers = [];
      if (!this.customers.find(c => c.name === 'Walk-in Customer')) {
        this.customers.unshift({
          id: 'cust-walkin',
          name: 'Walk-in Customer',
          phone: '',
          address: '',
          ntn: '',
          creditBalance: 0,
          active: true,
          createdAt: new Date().toISOString()
        });
      }
    } catch (e) {
      console.error('Local load error', e);
    }
  },

  saveLocal() {
    ['users', 'products', 'customers', 'suppliers', 'invoices', 'config', 'shas'].forEach(k => {
      localStorage.setItem(`pos_${k}`, JSON.stringify(this[k]));
    });
    localStorage.setItem('pos_heldCarts', JSON.stringify(this.heldCarts || []));
  },

  async save(collection) {
    this.saveLocal();
    if (!GitHub.isConfigured()) return;
    try {
      const path = `data/${collection}.json`;
      const newSha = await GitHub.putFile(
        path,
        this[collection],
        this.shas[collection],
        `Update ${collection} via POS`
      );
      this.shas[collection] = newSha;
      localStorage.setItem('pos_shas', JSON.stringify(this.shas));
      this.offline = false;
    } catch (e) {
      console.error('GitHub save failed', e);
      this.offline = true;
      Utils.toast('Saved locally. GitHub sync failed: ' + e.message, 'warning');
    }
  },

  async saveConfig() {
    await this.save('config');
  },

  // --- Auth ---
  async login(username, password) {
    const hash = await Utils.sha256(password);
    const user = this.users.find(u => u.username === username && u.passwordHash === hash && u.active);
    if (!user) return null;
    this.currentUser = { id: user.id, username: user.username, role: user.role, name: user.name };
    sessionStorage.setItem('pos_user', JSON.stringify(this.currentUser));
    return this.currentUser;
  },

  logout() {
    this.currentUser = null;
    sessionStorage.removeItem('pos_user');
  },

  restoreSession() {
    try {
      const raw = sessionStorage.getItem('pos_user');
      if (raw) this.currentUser = JSON.parse(raw);
    } catch (_) {}
    return this.currentUser;
  },

  hasRole(...roles) {
    return this.currentUser && roles.includes(this.currentUser.role);
  },

  // --- Trial / License ---
  ensureTrialStart() {
    // Prefer dedicated localStorage key so clearing config doesn't reset trial
    let started = localStorage.getItem('pos_trial_started');
    if (!started) {
      started = new Date().toISOString();
      localStorage.setItem('pos_trial_started', started);
    }
    if (!this.config.trialStartedAt) {
      this.config.trialStartedAt = started;
      this.saveLocal();
    }
    // Keep the earlier of the two (prevents reset by editing config)
    const a = new Date(started).getTime();
    const b = new Date(this.config.trialStartedAt).getTime();
    if (b < a) {
      localStorage.setItem('pos_trial_started', this.config.trialStartedAt);
    } else if (a < b) {
      this.config.trialStartedAt = started;
    }
  },

  getTrialInfo() {
    this.ensureTrialStart();
    const started = new Date(localStorage.getItem('pos_trial_started') || this.config.trialStartedAt);
    const now = new Date();
    const elapsedMs = now - started;
    const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
    const remaining = Math.max(0, this.TRIAL_DAYS - elapsedDays);
    const expired = elapsedDays >= this.TRIAL_DAYS;
    return {
      startedAt: started.toISOString(),
      elapsedDays,
      remainingDays: remaining,
      expired,
      trialDays: this.TRIAL_DAYS
    };
  },

  isAccessAllowed() {
    if (this.config.licensed && this.config.licenseKey) {
      // Re-validate key in case someone tampered with licensed flag
      if (typeof validateLicense === 'function' && validateLicense(this.config.licenseKey)) {
        return { allowed: true, reason: 'licensed' };
      }
      // Invalid key stored — fall through to trial check
      this.config.licensed = false;
    }
    const trial = this.getTrialInfo();
    if (!trial.expired) {
      return { allowed: true, reason: 'trial', trial };
    }
    return { allowed: false, reason: 'expired', trial };
  },


  // --- Products ---
  getProduct(id) {
    return this.products.find(p => p.id === id);
  },

  getProductByBarcode(code) {
    return this.products.find(p => p.barcode === code || p.sku === code);
  },

  // --- Cart ---
  unitPrice(product) {
    if (this.priceMode === 'wholesale' && product.wholesalePrice > 0) {
      return product.wholesalePrice;
    }
    return product.sellingPrice;
  },

  addToCart(product, qty = 1) {
    const price = this.unitPrice(product);
    const existing = this.cart.find(c => c.productId === product.id && c.price === price);
    if (existing) {
      existing.qty += qty;
    } else {
      this.cart.push({
        productId: product.id,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        price,
        costPrice: product.costPrice,
        taxRate: product.taxRate || 0,
        qty,
        discount: 0,
        priceMode: this.priceMode
      });
    }
  },

  holdCart(label = '') {
    if (!this.cart.length) return null;
    const held = {
      id: Utils.uid('hold'),
      label: label || ('Hold ' + new Date().toLocaleTimeString()),
      cart: JSON.parse(JSON.stringify(this.cart)),
      createdAt: new Date().toISOString()
    };
    this.heldCarts.unshift(held);
    this.cart = [];
    this.saveLocal();
    return held;
  },

  resumeHold(id) {
    const h = this.heldCarts.find(x => x.id === id);
    if (!h) return false;
    this.cart = JSON.parse(JSON.stringify(h.cart));
    this.heldCarts = this.heldCarts.filter(x => x.id !== id);
    this.saveLocal();
    return true;
  },

  deleteHold(id) {
    this.heldCarts = this.heldCarts.filter(x => x.id !== id);
    this.saveLocal();
  },


  updateCartQty(productId, qty) {
    const item = this.cart.find(c => c.productId === productId);
    if (!item) return;
    if (qty <= 0) this.cart = this.cart.filter(c => c.productId !== productId);
    else item.qty = qty;
  },

  clearCart() {
    this.cart = [];
  },

  cartTotals() {
    let subtotal = 0, tax = 0, discount = 0;
    this.cart.forEach(item => {
      const line = item.price * item.qty;
      const disc = item.discount || 0;
      const taxable = line - disc;
      const t = taxable * (item.taxRate / 100);
      subtotal += line;
      discount += disc;
      tax += t;
    });
    return { subtotal, discount, tax, total: subtotal - discount + tax };
  }
};
