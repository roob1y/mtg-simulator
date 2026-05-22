// ── SCRYFALL API ──
// All communication with the Scryfall API lives here.

const searchCache = {};

const Scryfall = {
  BASE: 'https://api.scryfall.com',

  // Search for cards by name
  async search(query) {
    if (!query || query.trim().length < 2) return [];

    // Return cached result if available
    const key = query.trim().toLowerCase();
    if (searchCache[key]) return searchCache[key];

    try {
      const encoded = encodeURIComponent(query.trim());
      const res = await fetch(`${this.BASE}/cards/search?q=${encoded}&order=name&unique=cards`);
      if (!res.ok) return [];
      const data = await res.json();
      const results = data.data || [];

      // Cache the results
      searchCache[key] = results;
      return results;
    } catch (e) {
      console.error('Scryfall search error:', e);
      return [];
    }
  },

  // Get a single card by exact name
  async getByName(name) {
    let attempts = 0;
    while (attempts < 3) {
      try {
        const encoded = encodeURIComponent(name);
        const res = await fetch(`${this.BASE}/cards/named?fuzzy=${encoded}`);
        if (res.status === 429) {
          await new Promise((r) => setTimeout(r, 1000));
          attempts++;
          continue;
        }
        if (!res.ok) return null;
        return await res.json();
      } catch (e) {
        console.error('Scryfall getByName error:', e);
        return null;
      }
    }
    return null;
  },

  // Get card image URL from a card object
  getImageUrl(card, size = 'normal') {
    if (!card) return null;
    // Handle double-faced cards
    if (card.image_uris) {
      return card.image_uris[size] || card.image_uris.normal;
    }
    // Double-faced card — use front face
    if (card.card_faces && card.card_faces[0]?.image_uris) {
      return card.card_faces[0].image_uris[size] || card.card_faces[0].image_uris.normal;
    }
    return null;
  },

  // Get art crop URL
  getArtUrl(card) {
    return this.getImageUrl(card, 'art_crop');
  },

  // Get oracle text, handling double-faced cards
  getOracleText(card) {
    if (card.oracle_text) return card.oracle_text;
    if (card.card_faces) {
      return card.card_faces.map((f) => `[${f.name}]\n${f.oracle_text || ''}`).join('\n\n');
    }
    return '';
  },

  // Get mana cost, handling double-faced cards
  getManaCost(card) {
    if (card.mana_cost) return card.mana_cost;
    if (card.card_faces && card.card_faces[0]?.mana_cost) {
      return card.card_faces[0].mana_cost;
    }
    return '';
  },

  getFrontFace(card) {
    if (card.card_faces && card.card_faces[0]) {
      return { ...card, ...card.card_faces[0] };
    }
    return card;
  },

  // Extract color identity as array of letter codes
  getColorIdentity(card) {
    return card.color_identity || [];
  },

  // Format mana cost string into readable text
  formatManaCost(cost) {
    if (!cost) return '';
    return cost
      .replace(/\{W\}/g, '⬜')
      .replace(/\{U\}/g, '🔵')
      .replace(/\{B\}/g, '⚫')
      .replace(/\{R\}/g, '🔴')
      .replace(/\{G\}/g, '🟢')
      .replace(/\{C\}/g, '◇')
      .replace(/\{T\}/g, '↻')
      .replace(/\{Q\}/g, '↺')
      .replace(/\{S\}/g, '❄')
      .replace(/\{E\}/g, '⚡')
      .replace(/\{P\}/g, '◈')
      .replace(/\{(\d+)\}/g, '($1)')
      .replace(/\{X\}/g, '(X)')
      .replace(/\{Y\}/g, '(Y)')
      .replace(/\{Z\}/g, '(Z)')
      .replace(/\{[A-Z]\/[A-Z]\}/g, (m) => m);
  },

  // Determine card type category for deck grouping
  getCategory(card) {
    const type = (card.type_line || '').toLowerCase();
    const oracle = (card.oracle_text || '').toLowerCase();

    // Faceless One and similar — legendary creature that is also a background
    // Treat as legendary so it can be set as main commander
    if (type.includes('legendary') && type.includes('creature') && type.includes('background')) {
      return 'legendary';
    }

    // Pure background enchantments (not creatures)
    if (type.includes('background') && !type.includes('creature')) return 'background';

    // Legendary creatures with "Choose a Background" are also legendaries
    if (type.includes('legendary') && type.includes('creature')) {
      return 'legendary';
    }

    if (type.includes('land')) return 'land';
    if (type.includes('creature')) return 'creature';
    if (type.includes('planeswalker')) return 'planeswalker';
    if (type.includes('instant')) return 'instant';
    if (type.includes('sorcery')) return 'sorcery';
    if (type.includes('enchantment')) return 'enchantment';
    if (type.includes('artifact')) return 'artifact';
    return 'other';
  },
  isMDFC(card) {
    return card.layout === 'modal_dfc' && Array.isArray(card.card_faces);
  },

  getMDFCLandFace(card) {
    if (!this.isMDFC(card)) return null;
    return card.card_faces.find((f) => (f.type_line || '').toLowerCase().includes('land')) || null;
  },

  getMDFCSpellFace(card) {
    if (!this.isMDFC(card)) return null;
    return card.card_faces.find((f) => !(f.type_line || '').toLowerCase().includes('land')) || null;
  },
};
