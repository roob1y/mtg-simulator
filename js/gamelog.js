// ── GAME LOG ──
// Tracks all game events and displays them in the UI.

const GameLog = {
  entries: [],
  maxEntries: 100,
  _toastTimer: null,
  _toastEntries: [],

  add(message, type = 'info') {
    const entry = {
      message,
      type,
      timestamp: Date.now(),
    };
    this.entries.unshift(entry);
    if (this.entries.length > this.maxEntries) this.entries.pop();
    this.render();
    this.showToast(entry);
  },

  showToast(entry) {
    this._toastEntries.push(entry);

    // Reset timer
    if (this._toastTimer) clearTimeout(this._toastTimer);

    // Render toast
    const toast = document.getElementById('game-log-toast');
    if (!toast) return;

    const icons = { info: '·', warning: '⚠', action: '▶', trigger: '⚡', combat: '⚔', phase: '◆' };

    toast.innerHTML = this._toastEntries.map(e =>
      `<div class="toast-entry toast-${e.type}">
        <span class="toast-icon">${icons[e.type] || '·'}</span>
        <span class="toast-msg">${e.message}</span>
      </div>`
    ).join('');

    toast.classList.remove('toast-hidden');

    // Auto-hide after 3s of no new entries
    this._toastTimer = setTimeout(() => {
      toast.classList.add('toast-hidden');
      this._toastEntries = [];
    }, 3000);
  },

  clear() {
    this.entries = [];
    this._toastEntries = [];
    this.render();
    const toast = document.getElementById('game-log-toast');
    if (toast) toast.classList.add('toast-hidden');
  },

  render() {
    const el = document.getElementById('game-log-entries');
    if (!el) return;

    el.innerHTML = this.entries
      .map((e) => {
        const icons = { info: '·', warning: '⚠', action: '▶', trigger: '⚡', combat: '⚔', phase: '◆' };
        return `<div class="log-entry log-${e.type}">
          <span class="log-icon">${icons[e.type] || '·'}</span>
          <span class="log-msg">${e.message}</span>
        </div>`;
      })
      .join('');
  },
};
