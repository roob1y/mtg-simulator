// ── MAIN JS ──
// UI interactions, search, preview, navigation.

// Polite delay helper for Scryfall rate limiting
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// Cache for card previews to avoid repeat API calls
const cardCache = {};

// ── PAGE NAVIGATION ──

function showPage(id) {
  document.querySelectorAll('.page').forEach((p) => {
    p.classList.remove('active');
    p.classList.add('hidden');
  });
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));

  const page = document.getElementById(id);
  if (page) {
    page.classList.remove('hidden');
    page.classList.add('active');
  }

  const btn = document.querySelector(`.nav-btn[onclick="showPage('${id}')"]`);
  if (btn) btn.classList.add('active');
}

// ── CARD SEARCH ──

// FIX: Merged into a single DOMContentLoaded listener
document.addEventListener('DOMContentLoaded', () => {
  // Search on Enter
  const input = document.getElementById('search-input');
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') searchCards();
    });
  }

  // Initialise deck display
  Deck.render();
  Deck.updateStats();

  // FIX: null-guard on settings checkboxes
  const bm = document.getElementById('beginner-mode-toggle');
  const at = document.getElementById('auto-tap-toggle');
  if (bm) bm.checked = Settings.get('beginnerMode');
  if (at) at.checked = Settings.get('autoTap');
});

async function searchCards() {
  const query = document.getElementById('search-input').value.trim();
  if (!query || query.length < 2) return;

  const resultsEl = document.getElementById('search-results');
  resultsEl.innerHTML = '<p class="loading">Searching...</p>';

  const cards = await Scryfall.search(query);

  if (cards.length === 0) {
    resultsEl.innerHTML = '<p class="muted" style="padding:8px">No cards found.</p>';
    return;
  }

  // Cache results
  cards.forEach((c) => {
    cardCache[c.id] = c;
  });

  resultsEl.innerHTML = cards
    .slice(0, 30)
    .map((card) => {
      const imgUrl = Scryfall.getArtUrl(card);
      const cost = Scryfall.formatManaCost(Scryfall.getManaCost(card));
      const type = card.type_line || '';

      return `
      <div class="search-result-item" onclick="previewCardObj('${card.id}')">
        ${imgUrl ? `<img class="result-thumb" src="${imgUrl}" alt="${card.name}" loading="lazy">` : ''}
        <div class="result-info">
          <div class="result-name">${card.name}</div>
          <div class="result-meta">${type} ${cost ? '· ' + cost : ''}</div>
        </div>
        <button class="add-btn" onclick="event.stopPropagation(); addCardById('${card.id}')">+ Add</button>
      </div>`;
    })
    .join('');
}

// ── ADD CARD ──

async function addCardById(id) {
  let card = cardCache[id];
  if (!card) {
    const res = await fetch(`https://api.scryfall.com/cards/${id}`);
    if (res.ok) card = await res.json();
  }
  if (!card) return;

  // Add to AI deck if opponent tab is active, otherwise player deck
  const isOpponentTab = !document.getElementById('view-opponent').classList.contains('hidden');

  if (isOpponentTab) {
    AIDeck.add(card);
    return;
  }

  const added = Deck.add(card);
  if (!added) {
    const rows = document.querySelectorAll('.deck-card-row');
    rows.forEach((r) => {
      if (r.textContent.includes(card.name)) {
        r.style.background = '#2a1a1a';
        setTimeout(() => (r.style.background = ''), 600);
      }
    });
  }
}

// ── CARD PREVIEW ──

async function previewCard(id) {
  let card = cardCache[id];
  if (!card) {
    const res = await fetch(`https://api.scryfall.com/cards/${id}`);
    if (res.ok) {
      card = await res.json();
      cardCache[id] = card;
    }
  }
  if (card) previewCardObj(id, card);
}

function previewCardObj(id, cardOverride) {
  const card = cardOverride || cardCache[id];
  if (!card) return;

  const imgUrl = Scryfall.getImageUrl(card, 'border_crop');
  const cost = Scryfall.formatManaCost(Scryfall.getManaCost(card));
  const oracle = Scryfall.getOracleText(card);
  const pt = card.power ? `${card.power} / ${card.toughness}` : '';
  const loyalty = card.loyalty ? `Loyalty: ${card.loyalty}` : '';

  const html = `
    ${imgUrl ? `<img class="preview-img" src="${imgUrl}" alt="${card.name}">` : ''}
    <div class="preview-name">${card.name}</div>
    <div class="preview-type">${card.type_line || ''}</div>
    ${cost ? `<div class="preview-cost">${cost}</div>` : ''}
    ${oracle ? `<div class="preview-text">${oracle.replace(/\n/g, '<br>')}</div>` : ''}
    ${pt ? `<div class="preview-pt">${pt}</div>` : ''}
    ${loyalty ? `<div class="preview-pt">${loyalty}</div>` : ''}
  `;

  const isMobile = window.innerWidth <= 900;

  if (isMobile) {
    document.getElementById('card-preview-modal-content').innerHTML = html;
    document.getElementById('card-preview-modal').classList.remove('hidden');
  } else {
    document.getElementById('card-preview').innerHTML = html;
  }
}

// ── DECK CONTROLS ──

function saveDeck() {
  Deck.save();
}

function clearDeck() {
  Deck.clear();
}

function loadDeckMenu() {
  const saved = Deck.getSavedDecks();
  const keys = Object.keys(saved);
  const listEl = document.getElementById('saved-decks-list');

  if (keys.length === 0) {
    listEl.innerHTML = '<p class="muted">No saved decks.</p>';
  } else {
    listEl.innerHTML = keys
      .map((name) => {
        const deck = saved[name];
        const count = deck.cards.reduce((s, e) => s + e.qty, 0);
        return `
        <div class="saved-deck-item">
          <div>
            <div class="saved-deck-name">${name}</div>
            <div class="saved-deck-count">${count} cards</div>
          </div>
          <div class="saved-deck-actions">
            <button onclick="Deck.loadDeck('${name.replace(/'/g, "\\'")}')">Load</button>
            <button onclick="Deck.deleteSaved('${name.replace(/'/g, "\\'")}')">Delete</button>
          </div>
        </div>`;
      })
      .join('');
  }

  document.getElementById('load-modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('load-modal').classList.add('hidden');
}

function handleDeckCardClick(el) {
  const id = el.getAttribute('data-card-id');
  if (id && cardCache[id]) {
    previewCardObj(id, cardCache[id]);
  }
}

// Close modal on backdrop click
document.addEventListener('click', (e) => {
  const modal = document.getElementById('load-modal');
  if (modal && e.target === modal) closeModal();
});

// ── IMPORT ──

function showImportModal() {
  document.getElementById('import-modal').classList.remove('hidden');
}

function closeImportModal() {
  document.getElementById('import-modal').classList.add('hidden');
  document.getElementById('import-progress').textContent = '';
  document.getElementById('import-text').value = '';
}

async function runImport() {
  const text = document.getElementById('import-text').value.trim();
  if (!text) return;

  const progressEl = document.getElementById('import-progress');
  const lines = text.split('\n').filter((l) => l.trim());

  const cardRequests = [];
  for (const line of lines) {
    const match = line.trim().match(/^(\d+)x?\s+([^(]+?)(?:\s*\(([^)]+)\)\s*(\d+))?$/);
    if (!match) continue;
    const [, qty, name, setCode, collectorNumber] = match;
    const cleanName = name.trim().split(' / ')[0].trim();
    cardRequests.push({
      qty: parseInt(qty),
      name: cleanName,
      set: setCode ? setCode.toLowerCase() : null,
      collectorNumber: collectorNumber || null,
    });
  }

  progressEl.textContent = `Fetching cards...`;

  const failed = [];
  const batchSize = 75;

  for (let i = 0; i < cardRequests.length; i += batchSize) {
    const batch = cardRequests.slice(i, i + batchSize);
    const identifiers = batch.map((e) => {
      if (e.set && e.collectorNumber) {
        return { set: e.set, collector_number: e.collectorNumber };
      }
      return { name: e.name };
    });

    const res = await fetch('https://api.scryfall.com/cards/collection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifiers }),
    });
    const data = await res.json();
    const fetched = data.data || [];
    const notFound = (data.not_found || []).map((n) => n.name);
    failed.push(...notFound);

    batch.forEach(({ qty, name, set, collectorNumber }) => {
      const card =
        set && collectorNumber
          ? fetched.find((c) => c.set === set && c.collector_number === collectorNumber)
          : fetched.find((c) => c.name.toLowerCase() === name.toLowerCase());
      if (!card) return;
      cardCache[card.id] = card;
      const isBasic = Deck.isBasicLand(card);
      if (isBasic) {
        for (let j = 0; j < qty; j++) Deck.add(card);
      } else {
        Deck.add(card);
      }
    });

    progressEl.textContent = `Loading batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(cardRequests.length / batchSize)}...`;
    if (i + batchSize < cardRequests.length) await delay(200);
  }

  if (failed.length === 0) {
    progressEl.textContent = `✓ Imported ${cardRequests.length} cards successfully!`;
  } else {
    progressEl.textContent = `✓ Imported ${cardRequests.length - failed.length} cards. Failed: ${failed.join(', ')}`;
  }
}

async function runAIImport() {
  const text = document.getElementById('ai-import-text').value.trim();
  if (!text) return;

  const progressEl = document.getElementById('ai-import-progress');
  const lines = text.split('\n').filter((l) => l.trim());

  const cardRequests = [];
  for (const line of lines) {
    const match = line.trim().match(/^(\d+)x?\s+([^(]+?)(?:\s*\(([^)]+)\)\s*(\d+))?$/);
    if (!match) continue;
    const [, qty, name, setCode, collectorNumber] = match;
    const cleanName = name.trim().split(' / ')[0].trim();
    cardRequests.push({
      qty: parseInt(qty),
      name: cleanName,
      set: setCode ? setCode.toLowerCase() : null,
      collectorNumber: collectorNumber || null,
    });
  }

  progressEl.textContent = `Fetching cards...`;
  AIDeck.clear();

  const failed = [];
  const batchSize = 75;

  for (let i = 0; i < cardRequests.length; i += batchSize) {
    const batch = cardRequests.slice(i, i + batchSize);
    const identifiers = batch.map((e) => {
      if (e.set && e.collectorNumber) {
        return { set: e.set, collector_number: e.collectorNumber };
      }
      return { name: e.name };
    });

    const res = await fetch('https://api.scryfall.com/cards/collection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifiers }),
    });
    const data = await res.json();
    const fetched = data.data || [];
    const notFound = (data.not_found || []).map((n) => n.name);
    failed.push(...notFound);

    batch.forEach(({ qty, name, set, collectorNumber }) => {
      const card =
        set && collectorNumber
          ? fetched.find((c) => c.set === set && c.collector_number === collectorNumber)
          : fetched.find((c) => c.name.toLowerCase() === name.toLowerCase());
      if (!card) return;
      cardCache[card.id] = card;
      const isBasic = Deck.isBasicLand(card);
      if (isBasic) {
        for (let j = 0; j < qty; j++) AIDeck.add(card);
      } else {
        AIDeck.add(card);
      }
    });

    progressEl.textContent = `Loading batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(cardRequests.length / batchSize)}...`;
    if (i + batchSize < cardRequests.length) await delay(200);
  }

  if (failed.length === 0) {
    progressEl.textContent = `✓ Imported ${cardRequests.length} cards successfully!`;
  } else {
    progressEl.textContent = `✓ Imported ${cardRequests.length - failed.length} cards. Failed: ${failed.join(', ')}`;
  }
}

document.addEventListener('click', (e) => {
  const modal = document.getElementById('import-modal');
  if (modal && e.target === modal) closeImportModal();
});

function showAIImportModal() {
  document.getElementById('ai-import-modal').classList.remove('hidden');
}

function closeAIImportModal() {
  document.getElementById('ai-import-modal').classList.add('hidden');
  document.getElementById('ai-import-progress').textContent = '';
  document.getElementById('ai-import-text').value = '';
}

// Close AI import modal on backdrop click
document.addEventListener('click', (e) => {
  const modal = document.getElementById('ai-import-modal');
  if (modal && e.target === modal) closeAIImportModal();
});

// ── START GAME ──

async function startGame() {
  const { valid } = Deck.validate();
  if (!valid && Deck.totalCards() === 0) return;

  // FIX: separate commanders from library cards
  const allCards = Deck.getFlatDeck();
  const commanderNames = new Set(Deck.getCommanders().map((c) => c.name));

  // Library = all non-commander copies
  const deckCards = allCards.filter((c) => !commanderNames.has(c.name));
  const commanders = Deck.getCommanders();

  const btn = document.getElementById('start-game-btn');
  btn.textContent = 'Loading opponent deck...';
  btn.disabled = true;

  // FIX: init game BEFORE showing game page
  const aiCards = AIDeck.totalCards() > 0 ? AIDeck.getFlatDeck() : null;
  await Game.init(deckCards, commanders, aiCards);
  // Show game page
  showPage('game');

  // Show mulligan screen, hide board
  const mulliganEl = document.getElementById('mulligan-screen');
  const boardEl = document.getElementById('game-board');
  if (mulliganEl) mulliganEl.classList.remove('hidden');
  if (boardEl) boardEl.classList.add('hidden');
}

// ── SETTINGS TOGGLES ──

function toggleBeginnerMode() {
  const val = Settings.toggle('beginnerMode');
  const el = document.getElementById('beginner-mode-toggle');
  if (el) el.checked = val;
}

function toggleAutoTap() {
  const val = Settings.toggle('autoTap');
  const el = document.getElementById('auto-tap-toggle');
  if (el) el.checked = val;
}

// ── DECK TABS ──

let aiDeckInitialised = false;

function switchDeckTab(tab) {
  document.getElementById('view-your-deck').classList.toggle('hidden', tab !== 'your-deck');
  document.getElementById('view-opponent').classList.toggle('hidden', tab !== 'opponent');
  document.getElementById('tab-your-deck').classList.toggle('active', tab === 'your-deck');
  document.getElementById('tab-opponent').classList.toggle('active', tab === 'opponent');

  // Load default deck first time opponent tab is opened
  if (tab === 'opponent' && !aiDeckInitialised) {
    aiDeckInitialised = true;
    AIDeck.loadFromList(AI.opponent.getDeckList());
  }
}

// ── STRATEGY SELECTOR ──

function selectStrategy(strategy) {
  document.querySelectorAll('.strategy-btn').forEach((b) => b.classList.remove('active'));
  document.getElementById(`strategy-${strategy}`).classList.add('active');

  const opponents = { aggro: OpponentAggro, control: OpponentControl, midrange: OpponentMidrange };
  AI.setOpponent(opponents[strategy]);

  // Auto-populate AI deck with strategy's default list
  AIDeck.loadFromList(AI.opponent.getDeckList());
}

// ── AI DECK CONTROLS ──

function saveAIDeck() {
  const name = document.getElementById('ai-deck-name-input').value.trim() || 'Opponent Deck';
  AIDeck.name = name;

  const saved = JSON.parse(localStorage.getItem('mtg_ai_decks') || '{}');
  saved[name] = {
    name,
    cards: AIDeck.cards.map((e) => ({ cardData: e.card, qty: e.qty })),
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem('mtg_ai_decks', JSON.stringify(saved));
  alert(`AI deck "${name}" saved!`);
}

function loadAIDeckMenu() {
  const saved = JSON.parse(localStorage.getItem('mtg_ai_decks') || '{}');
  const keys = Object.keys(saved);

  const listEl = document.getElementById('ai-saved-decks-list');
  if (keys.length === 0) {
    listEl.innerHTML = '<p class="muted">No saved AI decks.</p>';
  } else {
    listEl.innerHTML = keys
      .map((name) => {
        const deck = saved[name];
        const count = deck.cards.reduce((s, e) => s + e.qty, 0);
        return `
        <div class="saved-deck-item">
          <div>
            <div class="saved-deck-name">${name}</div>
            <div class="saved-deck-count">${count} cards</div>
          </div>
          <div class="saved-deck-actions">
            <button onclick="loadAIDeck('${name.replace(/'/g, "\\'")}')">Load</button>
            <button onclick="deleteAIDeck('${name.replace(/'/g, "\\'")}')">Delete</button>
          </div>
        </div>`;
      })
      .join('');
  }

  document.getElementById('ai-load-modal').classList.remove('hidden');
}

function loadAIDeck(name) {
  const saved = JSON.parse(localStorage.getItem('mtg_ai_decks') || '{}');
  const deck = saved[name];
  if (!deck) return;

  AIDeck.cards = deck.cards.map((e) => ({ card: e.cardData, qty: e.qty }));
  AIDeck.name = deck.name;
  AIDeck.cards.forEach((e) => {
    if (e.card.id) cardCache[e.card.id] = e.card;
  });

  document.getElementById('ai-deck-name-input').value = deck.name;
  AIDeck.render();
  AIDeck.updateStats();
  document.getElementById('ai-load-modal').classList.add('hidden');
}

function deleteAIDeck(name) {
  if (!confirm(`Delete "${name}"?`)) return;
  const saved = JSON.parse(localStorage.getItem('mtg_ai_decks') || '{}');
  delete saved[name];
  localStorage.setItem('mtg_ai_decks', JSON.stringify(saved));
  loadAIDeckMenu();
}

function clearAIDeck() {
  AIDeck.clear();
}
