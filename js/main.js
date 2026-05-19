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

  const imgUrl = Scryfall.getImageUrl(card, 'normal');
  const cost = Scryfall.formatManaCost(Scryfall.getManaCost(card));
  const oracle = Scryfall.getOracleText(card);
  const pt = card.power ? `${card.power} / ${card.toughness}` : '';
  const loyalty = card.loyalty ? `Loyalty: ${card.loyalty}` : '';

  document.getElementById('card-preview').innerHTML = `
    ${imgUrl ? `<img class="preview-img" src="${imgUrl}" alt="${card.name}">` : ''}
    <div class="preview-name">${card.name}</div>
    <div class="preview-type">${card.type_line || ''}</div>
    ${cost ? `<div class="preview-cost">${cost}</div>` : ''}
    ${oracle ? `<div class="preview-text">${oracle.replace(/\n/g, '<br>')}</div>` : ''}
    ${pt ? `<div class="preview-pt">${pt}</div>` : ''}
    ${loyalty ? `<div class="preview-pt">${loyalty}</div>` : ''}
  `;
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
  let loaded = 0;
  let failed = [];

  const cardRequests = [];
  for (const line of lines) {
    const match = line.trim().match(/^(\d+)x?\s+(.+)$/);
    if (!match) continue;
    const [, qty, name] = match;
    cardRequests.push({ qty: parseInt(qty), name: name.trim() });
  }

  progressEl.textContent = `Fetching ${cardRequests.length} cards...`;

  const batchSize = 10;
  for (let i = 0; i < cardRequests.length; i += batchSize) {
    const batch = cardRequests.slice(i, i + batchSize);

    const results = await Promise.all(
      batch.map(async ({ qty, name }) => {
        const card = await Scryfall.getByName(name);
        return { card, qty, name };
      })
    );

    for (const { card, qty, name } of results) {
      if (card) {
        for (let j = 0; j < qty; j++) {
          cardCache[card.id] = card;
          Deck.add(card);
        }
        loaded++;
      } else {
        failed.push(name);
      }
    }

    progressEl.textContent = `Loading ${loaded} / ${cardRequests.length}...`;

    if (i + batchSize < cardRequests.length) {
      await delay(100);
    }
  }

  if (failed.length === 0) {
    progressEl.textContent = `✓ Imported ${loaded} cards successfully!`;
  } else {
    progressEl.textContent = `✓ Imported ${loaded} cards. Failed: ${failed.join(', ')}`;
  }
}

document.addEventListener('click', (e) => {
  const modal = document.getElementById('import-modal');
  if (modal && e.target === modal) closeImportModal();
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
  await Game.init(deckCards, commanders);

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
