// ── DECK MANAGER ──
// Handles all deck state, validation, save/load.

const Deck = {
  // Current deck state
  cards: [],
  name: 'My Deck',
  designatedCommanders: [], // manually assigned commanders
  // ── ADD / REMOVE ──

  add(card) {
    const category = Scryfall.getCategory(card);
    const existing = this.cards.find((e) => e.card.name === card.name);
    // Cache the card for preview
    if (card.id && typeof cardCache !== 'undefined') {
      cardCache[card.id] = card;
    }
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

  // Designate a card as commander
  setCommander(cardName, role = 'commander') {
    const entry = this.cards.find((e) => e.card.name === cardName);
    if (!entry) return;
    if (!this.designatedCommanders.find((c) => c.name === cardName)) {
      this.designatedCommanders.push({ ...entry.card, commanderRole: role });
      GameLog && GameLog.add && GameLog.add(`${cardName} set as ${role}.`, 'info');
    }
    this.render();
    this.updateStats();
  },

  // Remove a card from commander designation
  removeCommander(cardName) {
    this.designatedCommanders = this.designatedCommanders.filter((c) => c.name !== cardName);
    this.render();
    this.updateStats();
  },

  // Check if a card is designated as commander
  isCommander(cardName) {
    return !!this.designatedCommanders.find((c) => c.name === cardName);
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
    const commanders = this.designatedCommanders;
    if (total < 100)
      warnings.push(
        `Deck has ${total}/100 cards (${100 - total} short of full Commander size — OK for testing).`
      );
    if (total > 100) errors.push(`Deck has ${total} cards — ${total - 100} too many.`);
    if (commanders.length === 0) warnings.push('No commander detected.');
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
      commander: { label: '👑 Commanders', cards: [] },
      legendary: { label: '⭐ Legendary Creatures', cards: [] },
      background: { label: '🌟 Backgrounds', cards: [] },
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
      const isDesignated = this.isCommander(e.card.name);
      if (isDesignated) {
        groups.commander.cards.push(e);
      } else {
        const cat = Scryfall.getCategory(e.card);
        if (groups[cat]) groups[cat].cards.push(e);
      }
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
          const isCmd = Deck.isCommander(e.card.name);
          const cmdEntry = Deck.designatedCommanders.find((c) => c.name === e.card.name);
          const cmdRole = cmdEntry ? cmdEntry.commanderRole : null;
          const isLegendary = cat === 'legendary' || cat === 'background' || cat === 'commander';
          html += `
        <div class="deck-card-row" data-card-id="${e.card.id || ''}" onclick="handleDeckCardClick(this)">
        <span class="deck-card-name ${cat === 'commander' ? 'commander' : cat === 'land' ? 'land' : ''}">${e.qty > 1 ? e.qty + 'x ' : ''}${e.card.name}${isCmd ? (cmdRole === 'background' ? ' 🌟' : ' 👑') : ''}</span>
        <span class="deck-card-cost">${cost}</span>
        ${
          cat === 'legendary'
            ? `
  <button class="cmd-assign-btn ${isCmd ? 'active' : ''}" 
    onclick="event.stopPropagation(); ${isCmd ? `Deck.removeCommander('${e.card.name.replace(/'/g, "\\'")}')` : `Deck.setCommander('${e.card.name.replace(/'/g, "\\'")}', 'commander')`}">
    ${isCmd ? '👑 Remove' : '+ Commander'}
  </button>
  ${
    (e.card.type_line || '').toLowerCase().includes('background')
      ? `
  <button class="cmd-assign-btn ${isCmd ? 'active' : ''}"
    onclick="event.stopPropagation(); ${isCmd ? `Deck.removeCommander('${e.card.name.replace(/'/g, "\\'")}')` : `Deck.setCommander('${e.card.name.replace(/'/g, "\\'")}', 'background')`}">
    ${isCmd ? '🌟 Remove' : '+ Background'}
  </button>`
      : ''
  }`
            : ''
        }
${
  cat === 'background'
    ? `
  <button class="cmd-assign-btn ${isCmd ? 'active' : ''}" 
    onclick="event.stopPropagation(); ${isCmd ? `Deck.removeCommander('${e.card.name.replace(/'/g, "\\'")}')` : `Deck.setCommander('${e.card.name.replace(/'/g, "\\'")}', 'background')`}">
    ${isCmd ? '🌟 Remove' : '+ Background'}
  </button>`
    : ''
}
${
  cat === 'commander'
    ? `
  <button class="cmd-assign-btn active" 
    onclick="event.stopPropagation(); Deck.removeCommander('${e.card.name.replace(/'/g, "\\'")}')">
    ${cmdRole === 'background' ? '🌟 Remove' : '👑 Remove'}
  </button>`
    : ''
}
        <button class="remove-btn" onclick="event.stopPropagation(); Deck.remove('${e.card.name.replace(/'/g, "\\'")}')">✕</button>
      </div>`;
        });
    });

    el.innerHTML = html;

    // Rebuild cardCache from current deck
    this.cards.forEach((e) => {
      if (e.card && e.card.id && typeof cardCache !== 'undefined') {
        cardCache[e.card.id] = e.card;
      }
    });
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
      msgEl.textContent = errors[0];
    } else if (warnings.length > 0) {
      msgEl.className = 'ok';
      msgEl.textContent = '⚠ ' + warnings[0];
    } else {
      msgEl.className = 'ok';
      msgEl.textContent = '✓ Deck is valid and ready to play!';
    }

    const canPlay = total > 0 && this.designatedCommanders.length > 0;
    startBtn.disabled = !canPlay;
    if (playBtn) playBtn.disabled = !canPlay;
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
      designatedCommanders: this.designatedCommanders,
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
    this.designatedCommanders = deck.designatedCommanders || [];
    this.name = deck.name;

    // Rebuild cache from loaded cards
    this.cards.forEach((e) => {
      if (e.card.id && typeof cardCache !== 'undefined') {
        cardCache[e.card.id] = e.card;
      }
    });
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
    return this.designatedCommanders;
  },
};

// ── AI DECK ──
// Simpler deck manager for the opponent — no commander validation, no 100 card limit.

const AIDeck = {
  cards: [],
  name: 'Opponent Deck',

  add(card) {
    const existing = this.cards.find((e) => e.card.name === card.name);
    if (card.id && typeof cardCache !== 'undefined') {
      cardCache[card.id] = card;
    }
    if (existing) {
      if (Deck.isBasicLand(card)) {
        existing.qty++;
      } else {
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
    this.cards = [];
    this.render();
    this.updateStats();
  },

  totalCards() {
    return this.cards.reduce((sum, e) => sum + e.qty, 0);
  },

  landCount() {
    return this.cards
      .filter((e) => Scryfall.getCategory(e.card) === 'land')
      .reduce((sum, e) => sum + e.qty, 0);
  },

  // Load from a getDeckList() array by fetching cards from Scryfall
  async loadFromList(list) {
    this.cards = [];
    const el = document.getElementById('ai-deck-list');
    if (el) el.innerHTML = '<p class="muted" style="padding:8px">Loading deck...</p>';

    const identifiers = list.map((e) => ({ name: e.name }));
    const res = await fetch('https://api.scryfall.com/cards/collection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifiers }),
    });
    const data = await res.json();
    const fetched = data.data || [];

    list.forEach((entry) => {
      const card = fetched.find((c) => c.name.toLowerCase() === entry.name.toLowerCase());
      if (card) {
        cardCache[card.id] = card;
        if (Deck.isBasicLand(card)) {
          for (let i = 0; i < entry.qty; i++) {
            const existing = this.cards.find((e) => e.card.name === card.name);
            if (existing) existing.qty++;
            else this.cards.push({ card, qty: 1 });
          }
        } else {
          this.cards.push({ card, qty: entry.qty });
        }
      }
    });

    this.render();
    this.updateStats();
  },

  render() {
    const el = document.getElementById('ai-deck-list');
    if (!el) return;

    if (this.cards.length === 0) {
      el.innerHTML = '<p class="muted" style="padding:8px">No cards yet. Select a strategy or search for cards.</p>';
      return;
    }

    const groups = {
      creature: { label: 'Creatures', cards: [] },
      instant: { label: 'Instants', cards: [] },
      sorcery: { label: 'Sorceries', cards: [] },
      enchantment: { label: 'Enchantments', cards: [] },
      artifact: { label: 'Artifacts', cards: [] },
      planeswalker: { label: 'Planeswalkers', cards: [] },
      land: { label: 'Lands', cards: [] },
      other: { label: 'Other', cards: [] },
    };

    this.cards.forEach((e) => {
      const cat = Scryfall.getCategory(e.card);
      const group = groups[cat] || groups.other;
      group.cards.push(e);
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
          html += `
            <div class="deck-card-row" data-card-id="${e.card.id || ''}" onclick="handleDeckCardClick(this)">
              <span class="deck-card-name ${cat === 'land' ? 'land' : ''}">${e.qty > 1 ? e.qty + 'x ' : ''}${e.card.name}</span>
              <span class="deck-card-cost">${cost}</span>
              <button class="remove-btn" onclick="event.stopPropagation(); AIDeck.remove('${e.card.name.replace(/'/g, "\\'")}')">✕</button>
            </div>`;
        });
    });

    el.innerHTML = html;

    this.cards.forEach((e) => {
      if (e.card && e.card.id && typeof cardCache !== 'undefined') {
        cardCache[e.card.id] = e.card;
      }
    });
  },

  updateStats() {
    const total = this.totalCards();
    const lands = this.landCount();
    const countEl = document.getElementById('ai-card-count');
    const landEl = document.getElementById('ai-land-count');
    if (countEl) countEl.textContent = `Cards: ${total}`;
    if (landEl) landEl.textContent = `Lands: ${lands}`;
  },

  getFlatDeck() {
    const flat = [];
    this.cards.forEach((e) => {
      for (let i = 0; i < e.qty; i++) {
        flat.push({ ...e.card });
      }
    });
    return flat;
  },
};