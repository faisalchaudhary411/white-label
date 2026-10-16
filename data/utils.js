/* Utility helpers */
const Utils = {
  async sha256(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  },

  uid(prefix = 'id') {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  },

  formatMoney(amount, symbol = 'Rs.') {
    const n = Number(amount) || 0;
    return `${symbol}${n.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  },

  formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  },

  formatDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  },

  daysUntil(iso) {
    if (!iso) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const exp = new Date(iso);
    exp.setHours(0, 0, 0, 0);
    return Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
  },

  expiryClass(days) {
    if (days === null) return '';
    if (days < 0) return 'badge-danger';
    if (days <= 30) return 'badge-danger';
    if (days <= 60) return 'badge-warning';
    if (days <= 90) return 'badge-info';
    return 'badge-success';
  },

  toast(msg, type = 'info') {
    const el = document.createElement('div');
    el.className = `alert alert-${type}`;
    el.style.cssText = 'position:fixed;top:1rem;right:1rem;z-index:9999;min-width:260px;box-shadow:0 10px 25px rgba(0,0,0,0.15);';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  },

  downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  },

  debounce(fn, ms = 300) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }
};
