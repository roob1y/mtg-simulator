// ── SCRYFALL API ──
// All communication with the Scryfall API lives here.

const Scryfall = {
  BASE: 'https://api.scryfall.com',

  // Search for cards by name
  async search(query) {
    if (!query || query.trim().length < 2) return [];
    try {
      const encoded = encodeURIComponent(query.trim());
      const res = await fetch(`${this.BASE}/cards/search?q=${encoded}&order=name&unique=cards`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.data || [];
    } catch (e) {
      console.error('Scryfall search error:', e);
      return [];
    }
  },

  // Get a single card by exact name
  async getByName(name) {
    try {
      const encoded = encodeURIComponent(name);
      const res = await fetch(`${this.BASE}/cards/named?fuzzy=${encoded}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.error('Scryfall getByName error:', e);
      return null;
    }
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
      .replace(/\{(\d+)\}/g, '($1)')
      .replace(/\{X\}/g, '(X)')
      .replace(/\{[A-Z]\/[A-Z]\}/g, (m) => m); // hybrid — leave as is
  },

  // Determine card type category for deck grouping
  getCategory(card) {
    const type = (card.type_line || '').toLowerCase();
    const ci = card.color_identity || [];

    // Check if it's a commander (legendary creature or background)
    if (type.includes('legendary') && (type.includes('creature') || type.includes('background'))) {
      return 'commander';
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
};
