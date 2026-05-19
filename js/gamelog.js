// ── GAME LOG ──
// Tracks all game events and displays them in the UI.

const GameLog = {
  entries: [],
  maxEntries: 100,

  add(message, type = 'info') {
    const entry = {
      message,
      type, // 'info', 'warning', 'action', 'trigger', 'combat', 'phase'
      timestamp: Date.now(),
    };
    this.entries.unshift(entry); // newest first
    if (this.entries.length > this.maxEntries) {
      this.entries.pop();
    }
    this.render();
  },

  clear() {
    this.entries = [];
    this.render();
  },

  render() {
    const el = document.getElementById('game-log-entries');
    if (!el) return;

    el.innerHTML = this.entries
      .map((e) => {
        const icons = {
          info: '·',
          warning: '⚠',
          action: '▶',
          trigger: '⚡',
          combat: '⚔',
          phase: '◆',
        };
        return `<div class="log-entry log-${e.type}">
        <span class="log-icon">${icons[e.type] || '·'}</span>
        <span class="log-msg">${e.message}</span>
      </div>`;
      })
      .join('');
  },
};
