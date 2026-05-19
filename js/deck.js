// ── DECK MANAGER ──
// Handles all deck state, validation, save/load.

const Deck = {
  // Current deck state
  cards: [], // Array of { card: ScryfallCard, qty: number }
  name: 'My Deck',

  // ── ADD / REMOVE ──

  add(card) {
    const category = Scryfall.getCategory(card);
    const existing = this.cards.find((e) => e.card.name === card.name);

    // Commanders and basic lands can have multiples (basics unlimited, commanders max 1)
    if (existing) {
      if (category === 'land' && this.isBasicLand(card)) {
        existing.qty++;
      } else {
        // Non-basic, non-commander: max 1 copy in Commander format
        console.log('Already in deck (Commander format: 1 copy max)');
        return false;
      }
    } else {
      this.cards.push({ card, qty: 1 });
    }

    this.render();
    this.updateStats();
    return true;
  },

  remove(cardName) {
    const idx = this.cards.findIndex((e) => e.card.name === cardName);
    if (idx === -1) return;
    if (this.cards[idx].qty > 1) {
      this.cards[idx].qty--;
    } else {
      this.cards.splice(idx, 1);
    }
    this.render();
    this.updateStats();
  },

  clear() {
    if (!confirm('Clear the entire deck?')) return;
    this.cards = [];
    this.render();
    this.updateStats();
  },

  isBasicLand(card) {
    const type = (card.type_line || '').toLowerCase();
    const basicTypes = ['plains', 'island', 'swamp', 'mountain', 'forest', 'wastes'];
    return type.includes('basic') || basicTypes.some((t) => card.name.toLowerCase() === t);
  },

  // ── TOTAL COUNT ──

  totalCards() {
    return this.cards.reduce((sum, e) => sum + e.qty, 0);
  },

  landCount() {
    return this.cards
      .filter((e) => Scryfall.getCategory(e.card) === 'land')
      .reduce((sum, e) => sum + e.qty, 0);
  },

  // ── COLOR IDENTITY ──

  colorIdentity() {
    const colors = new Set();
    this.cards.forEach((e) => {
      (e.card.color_identity || []).forEach((c) => colors.add(c));
    });
    return [...colors].sort();
  },

  colorName(code) {
    const map = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' };
    return map[code] || code;
  },

  // ── VALIDATION ──

  validate() {
    const errors = [];
    const warnings = [];
    const total = this.totalCards();
    const lands = this.landCount();
    const commanders = this.cards.filter((e) => Scryfall.getCategory(e.card) === 'commander');

    if (total < 100) errors.push(`Deck has ${total}/100 cards — needs ${100 - total} more.`);
    if (total > 100) errors.push(`Deck has ${total} cards — ${total - 100} too many.`);
    if (commanders.length === 0) errors.push('No commander detected — add a Legendary Creature.');
    if (commanders.length > 2) errors.push('Commander format allows max 2 commanders.');
    if (lands < 33) warnings.push(`Only ${lands} lands — recommend at least 33.`);
    if (lands < 20) errors.push(`Only ${lands} lands — this is critically low.`);

    return { errors, warnings, valid: errors.length === 0 };
  },

  // ── RENDER DECK LIST ──

  render() {
    const el = document.getElementById('deck-list');
    if (!el) return;

    if (this.cards.length === 0) {
      el.innerHTML =
        '<p class="muted" style="padding:8px">No cards added yet. Search for cards and add them.</p>';
      return;
    }

    // Group by category
    const groups = {
      commander: { label: 'Commanders', cards: [] },
      planeswalker: { label: 'Planeswalkers', cards: [] },
      creature: { label: 'Creatures', cards: [] },
      instant: { label: 'Instants', cards: [] },
      sorcery: { label: 'Sorceries', cards: [] },
      enchantment: { label: 'Enchantments', cards: [] },
      artifact: { label: 'Artifacts', cards: [] },
      land: { label: 'Lands', cards: [] },
      other: { label: 'Other', cards: [] },
    };

    this.cards.forEach((e) => {
      const cat = Scryfall.getCategory(e.card);
      if (groups[cat]) groups[cat].cards.push(e);
    });

    let html = '';
    Object.entries(groups).forEach(([cat, group]) => {
      if (group.cards.length === 0) return;
      const groupTotal = group.cards.reduce((s, e) => s + e.qty, 0);
      html += `<div class="deck-section-header">${group.label} (${groupTotal})</div>`;
      group.cards
        .sort((a, b) => a.card.name.localeCompare(b.card.name))
        .forEach((e) => {
          const cost = Scryfall.formatManaCost(Scryfall.getManaCost(e.card));
          const nameClass =
            cat === 'commander'
              ? 'deck-card-name commander'
              : cat === 'land'
                ? 'deck-card-name land'
                : 'deck-card-name';
          html += `
            <div class="deck-card-row" onclick="previewCard('${e.card.id}')">
              <span class="deck-card-name ${nameClass === 'deck-card-name' ? '' : nameClass.split(' ')[1]}">${e.qty > 1 ? e.qty + 'x ' : ''}${e.card.name}</span>
              <span class="deck-card-cost">${cost}</span>
              <button class="remove-btn" onclick="event.stopPropagation(); Deck.remove('${e.card.name.replace(/'/g, "\\'")}')">✕</button>
            </div>`;
        });
    });

    el.innerHTML = html;
  },

  // ── UPDATE STATS BAR ──

  updateStats() {
    const total = this.totalCards();
    const lands = this.landCount();
    const colors =
      this.colorIdentity()
        .map((c) => this.colorName(c))
        .join(', ') || '—';

    document.getElementById('card-count').textContent = `Cards: ${total} / 100`;
    document.getElementById('land-count').textContent = `Lands: ${lands}`;
    document.getElementById('color-identity').textContent = `Colors: ${colors}`;

    // Validation
    const { errors, warnings, valid } = this.validate();
    const msgEl = document.getElementById('validation-msg');
    const startBtn = document.getElementById('start-game-btn');
    const playBtn = document.getElementById('play-btn');

    if (errors.length > 0) {
      msgEl.className = 'error';
      msgEl.innerHTML = errors.map((e) => `<div>⚠ ${e}</div>`).join('');
    } else if (warnings.length > 0) {
      msgEl.className = 'ok';
      msgEl.textContent = '⚠ ' + warnings[0];
    } else {
      msgEl.className = 'ok';
      msgEl.textContent = '✓ Deck is valid and ready to play!';
    }

    startBtn.disabled = !valid;
    if (playBtn) playBtn.disabled = !valid;
  },

  // ── SAVE / LOAD ──

  save() {
    const name = document.getElementById('deck-name-input').value.trim() || 'My Deck';
    this.name = name;

    const saved = this.getSavedDecks();
    saved[name] = {
      name,
      cards: this.cards.map((e) => ({
        cardData: e.card,
        qty: e.qty,
      })),
      savedAt: new Date().toISOString(),
    };

    localStorage.setItem('mtg_decks', JSON.stringify(saved));
    alert(`Deck "${name}" saved!`);
  },

  getSavedDecks() {
    try {
      return JSON.parse(localStorage.getItem('mtg_decks') || '{}');
    } catch {
      return {};
    }
  },

  loadDeck(name) {
    const saved = this.getSavedDecks();
    const deck = saved[name];
    if (!deck) return;

    this.cards = deck.cards.map((e) => ({ card: e.cardData, qty: e.qty }));
    this.name = deck.name;
    document.getElementById('deck-name-input').value = deck.name;

    this.render();
    this.updateStats();
    closeModal();
  },

  deleteSaved(name) {
    if (!confirm(`Delete "${name}"?`)) return;
    const saved = this.getSavedDecks();
    delete saved[name];
    localStorage.setItem('mtg_decks', JSON.stringify(saved));
    loadDeckMenu(); // Refresh modal
  },

  // ── EXPORT / IMPORT ──

  // Export current deck as a simple text list
  exportText() {
    return this.cards.map((e) => `${e.qty} ${e.card.name}`).join('\n');
  },

  // Returns flat array of card objects for use in game engine (one entry per copy)
  getFlatDeck() {
    const flat = [];
    this.cards.forEach((e) => {
      for (let i = 0; i < e.qty; i++) {
        flat.push({ ...e.card });
      }
    });
    return flat;
  },

  // Get commanders separately
  getCommanders() {
    return this.cards
      .filter((e) => Scryfall.getCategory(e.card) === 'commander')
      .map((e) => e.card);
  },
};
