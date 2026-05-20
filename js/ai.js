// ── AI OPPONENT ──
// Simple scripted AI opponent for Phase 2.
// Plays a basic aggressive strategy.

const AI = {
  player: null,
  opponent: OpponentAggro, // default

  setOpponent(opponent) {
    this.opponent = opponent;
  },

  // Initialise AI with a pre-built deck
  async init(name = 'Opponent', customDeck = null) {
    this.player = new Player(name, false);
    this.player.loadCommanders([]);

    // Use custom deck if provided, otherwise fetch from default list
    if (customDeck) {
      this.player.loadDeck(customDeck);
      return this.player;
    }

    const list = this.opponent.getDeckList();
    const identifiers = list.map((e) => ({ name: e.name }));

    const res = await fetch('https://api.scryfall.com/cards/collection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifiers }),
    });

    const data = await res.json();
    const fetched = data.data || [];

    const cards = [];
    list.forEach((entry) => {
      const card = fetched.find((c) => c.name.toLowerCase() === entry.name.toLowerCase());
      if (card) {
        for (let i = 0; i < entry.qty; i++) cards.push({ ...card });
      } else {
        GameLog.add(`AI deck: couldn't find ${entry.name}.`, 'warning');
      }
    });

    this.player.loadDeck(cards);
    return this.player;
  },

  // AI takes its turn
  takeTurn(humanPlayer) {
    if (Game.gameOver) return;

    GameLog.add(`--- ${this.player.name}'s turn ---`, 'phase');

    // Untap
    this.player.untapAll();
    this.player.resetForNewTurn();

    // Draw
    this.player.draw(1);
    GameLog.add(`${this.player.name} draws a card.`, 'info');

    // Play a land if possible
    this.playLand();

    // Cast spells
    this.castSpells();

    // FIX: Attack with blocking support
    this.opponent.attack(this.player, humanPlayer);

    if (Game.gameOver) return;

    // End step
    if (this.player.mustDiscard()) {
      this.player.discardToHandSize();
    }

    GameLog.add(`${this.player.name}'s turn ends.`, 'phase');
  },

  // Play the first land in hand
  playLand() {
    if (!this.player.canPlayLand()) return;
    const landIdx = this.player.hand.findIndex((c) => Scryfall.getCategory(c) === 'land');
    if (landIdx === -1) return;
    const land = this.player.hand[landIdx];
    this.player.playLand(landIdx);
    // AI lands enter untapped for simplicity
    const newLand = this.player.battlefield[this.player.battlefield.length - 1];
    if (newLand) newLand.tapped = false;
    GameLog.add(`${this.player.name} plays ${land.name}.`, 'action');
  },

  // Cast creatures from hand if affordable
  castSpells() {
    const hand = this.player.hand.filter((c) => c);
    if (hand.length === 0) return;

    // Count available mana without tapping yet
    const availableMana = this.player.getLands().filter((l) => !l.tapped).length;
    if (availableMana === 0) return;

    // Separate hand into creatures and non-creatures
    const creatures = hand
      .map((card, idx) => ({ card, idx }))
      .filter(({ card }) => (card.type_line || '').toLowerCase().includes('creature'))
      .sort((a, b) => (a.card?.cmc || 0) - (b.card?.cmc || 0));

    const nonCreatures = hand
      .map((card, idx) => ({ card, idx }))
      .filter(({ card }) => {
        const type = (card.type_line || '').toLowerCase();
        return !type.includes('creature') && !type.includes('land');
      })
      .sort((a, b) => (a.card?.cmc || 0) - (b.card?.cmc || 0));

    // Check if anything is affordable before tapping lands
    const cheapestCreature = creatures[0]?.card.cmc || Infinity;
    const cheapestNonCreature = nonCreatures[0]?.card.cmc || Infinity;
    const cheapest = Math.min(cheapestCreature, cheapestNonCreature);
    if (availableMana < cheapest) return;

    this.generateMana();

    // Cast creatures first (cheapest first)
    for (const { card } of creatures) {
      if (!card) continue;
      const cmc = card.cmc || 0;
      if (this.player.totalMana() >= cmc) {
        this.spendGenericMana(cmc);
        const handIdx = this.player.hand.findIndex((c) => c && c.name === card.name);
        if (handIdx !== -1) {
          this.player.castFromHand(handIdx);
          GameLog.add(`${this.player.name} casts ${card.name}.`, 'action');
        }
      }
    }

    // Cast non-creature spells
    for (const { card } of nonCreatures) {
      if (!card) continue;
      const cmc = card.cmc || 0;
      const type = (card.type_line || '').toLowerCase();
      const oracle = (card.oracle_text || '').toLowerCase();

      // Board wipes — only cast if human has more creatures
      const isBoardWipe =
        oracle.includes('destroy all creatures') || oracle.includes('all creatures');
      if (isBoardWipe) {
        const humanCreatures = Game.human.getCreatures().length;
        const aiCreatures = this.player.getCreatures().length;
        if (humanCreatures <= aiCreatures) {
          GameLog.add(`${this.player.name} holds ${card.name} — not the right moment.`, 'info');
          continue;
        }
      }

      if (this.player.totalMana() >= cmc) {
        this.spendGenericMana(cmc);
        const handIdx = this.player.hand.findIndex((c) => c && c.name === card.name);
        if (handIdx !== -1) {
          this.player.castFromHand(handIdx);
          GameLog.add(`${this.player.name} casts ${card.name}.`, 'action');
        }
      }
    }
  },

  // Generate mana from untapped lands
  generateMana() {
    this.player.clearManaPool();
    this.player.battlefield.forEach((perm) => {
      if (perm.tapped) return;
      const type = (perm.card.type_line || '').toLowerCase();
      const oracle = (perm.card.oracle_text || '').toLowerCase();

      // Only tap permanents that can produce mana
      const producesMana =
        type.includes('land') || (oracle.includes('{t}') && oracle.includes('add {'));
      if (!producesMana) return;

      // Read colors from type line first, then oracle text
      const colorSet = new Set();
      if (type.includes('plains')) colorSet.add('W');
      if (type.includes('island')) colorSet.add('U');
      if (type.includes('swamp')) colorSet.add('B');
      if (type.includes('mountain')) colorSet.add('R');
      if (type.includes('forest')) colorSet.add('G');
      if (oracle.includes('add {w}')) colorSet.add('W');
      if (oracle.includes('add {u}')) colorSet.add('U');
      if (oracle.includes('add {b}')) colorSet.add('B');
      if (oracle.includes('add {r}')) colorSet.add('R');
      if (oracle.includes('add {g}')) colorSet.add('G');

      const colors = [...colorSet];
      if (colors.length > 0) {
        this.player.addMana(colors[0]); // pick first color for AI simplicity
      } else {
        this.player.addMana('C');
      }
      perm.tapped = true;
    });
  },

  // Spend generic mana (simplified)
  spendGenericMana(amount) {
    let remaining = amount;
    for (const color of ['B', 'R', 'G', 'W', 'U', 'C']) {
      if (remaining <= 0) break;
      const available = this.player.manaPool[color];
      const spend = Math.min(available, remaining);
      this.player.manaPool[color] -= spend;
      remaining -= spend;
    }
  },
};
