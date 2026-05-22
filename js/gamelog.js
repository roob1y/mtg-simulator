// ── GAME LOG ──
// Tracks all game events and displays them in the UI.

const GameLog = {
  entries: [],
  maxEntries: 100,

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
    if (entry.type === 'phase') return;
    const toast = document.getElementById('game-log-toast');
    if (!toast) return;

    const icons = { info: '·', warning: '⚠', action: '▶', trigger: '⚡', combat: '⚔', phase: '◆' };

    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const div = document.createElement('div');
    div.className = `toast-entry toast-${entry.type}`;
    div.id = id;
    div.innerHTML = `<span class="toast-icon">${icons[entry.type] || '·'}</span><span class="toast-msg">${entry.message}</span>`;

    toast.appendChild(div);
    toast.classList.remove('toast-hidden');

    // Each entry expires individually after 3s
    setTimeout(() => {
      div.classList.add('toast-entry-hiding');
      setTimeout(() => {
        div.remove();
        if (toast.children.length === 0) toast.classList.add('toast-hidden');
      }, 300);
    }, 3000);
  },

  clear() {
    this.entries = [];
    this.render();
    const toast = document.getElementById('game-log-toast');
    if (toast) { toast.innerHTML = ''; toast.classList.add('toast-hidden'); }
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
