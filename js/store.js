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
  offline: false,
  TRIAL_DAYS: 7,

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
          github: { owner: '', repo: '', branch: 'main', token: '' },
          theme: { primaryColor: '#2563eb', secondaryColor: '#1e40af' }
        };
      }
      // Ensure trial start date exists (first run)
      this.ensureTrialStart();
      if (!Array.isArray(this.users) || this.users.length === 0) {
        // Seed default admin if empty (password: admin)
        this.users = [{
          id: 'admin-001',
          username: 'admin',
          passwordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
          role: 'admin',
          name: 'Administrator',
          active: true,
          createdAt: new Date().toISOString()
        }];
      }
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
  addToCart(product, qty = 1) {
    const existing = this.cart.find(c => c.productId === product.id);
    if (existing) {
      existing.qty += qty;
    } else {
      this.cart.push({
        productId: product.id,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        price: product.sellingPrice,
        costPrice: product.costPrice,
        taxRate: product.taxRate || 0,
        qty,
        discount: 0
      });
    }
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
