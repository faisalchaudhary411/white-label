/* GitHub Contents API client for JSON persistence */
const GitHub = {
  owner: '',
  repo: '',
  branch: 'main',
  token: '',
  base: 'https://api.github.com',

  configure({ owner, repo, branch = 'main', token }) {
    this.owner = owner || '';
    this.repo = repo || '';
    this.branch = branch || 'main';
    this.token = token || '';
  },

  isConfigured() {
    return !!(this.owner && this.repo && this.token);
  },

  headers() {
    return {
      'Authorization': `Bearer ${this.token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json'
    };
  },

  async getFile(path) {
    if (!this.isConfigured()) return null;
    const url = `${this.base}/repos/${this.owner}/${this.repo}/contents/${path}?ref=${this.branch}`;
    const res = await fetch(url, { headers: this.headers() });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GitHub GET ${path}: ${res.status}`);
    const data = await res.json();
    const content = atob(data.content.replace(/\n/g, ''));
    return { content: JSON.parse(content), sha: data.sha };
  },

  async putFile(path, jsonData, sha, message) {
    if (!this.isConfigured()) throw new Error('GitHub not configured');
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(jsonData, null, 2))));
    const body = {
      message: message || `Update ${path}`,
      content,
      branch: this.branch
    };
    if (sha) body.sha = sha;
    const url = `${this.base}/repos/${this.owner}/${this.repo}/contents/${path}`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: this.headers(),
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `GitHub PUT ${path}: ${res.status}`);
    }
    const data = await res.json();
    return data.content.sha;
  },

  async loadAll() {
    const files = ['users', 'products', 'customers', 'suppliers', 'invoices', 'config'];
    const result = {};
    const shas = {};
    for (const f of files) {
      try {
        const data = await this.getFile(`data/${f}.json`);
        if (data) {
          result[f] = data.content;
          shas[f] = data.sha;
        }
      } catch (e) {
        console.warn(`Failed to load ${f}:`, e.message);
      }
    }
    return { data: result, shas };
  }
};
