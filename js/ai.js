// ── AI OPPONENT ──
// Simple scripted AI opponent for Phase 2.
// Plays a basic aggressive strategy.

const AI = {
  player: null,

  // Initialise AI with a pre-built deck
  init(name = 'Opponent') {
    this.player = new Player(name, false);
    this.player.loadDeck(this.buildDeck());
    return this.player;
  },

  // AI takes its turn
  takeTurn(humanPlayer) {
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

    // Attack
    this.attack(humanPlayer);

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
    // Auto-tap new AI lands for appropriate mana
    const newLand = this.player.battlefield[this.player.battlefield.length - 1];
    if (newLand) newLand.tapped = false; // AI lands enter untapped for simplicity
    GameLog.add(`${this.player.name} plays ${land.name}.`, 'action');
  },

  // Cast creatures from hand if affordable
  castSpells() {
    const sortedCreatures = this.player.hand
      .filter((c) => c)
      .map((card, idx) => ({ card, idx }))
      .filter(({ card }) => {
        if (!card) return false;
        const type = (card.type_line || '').toLowerCase();
        return type.includes('creature');
      })
      .sort((a, b) => (a.card?.cmc || 0) - (b.card?.cmc || 0));

    if (sortedCreatures.length === 0) return;

    this.generateMana();

    for (const { card, idx } of sortedCreatures) {
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
  },

  // Generate mana from untapped lands
  generateMana() {
    this.player.clearManaPool();
    this.player.getLands().forEach((land) => {
      if (!land.tapped) {
        // Determine color from land type
        const type = (land.card.type_line || '').toLowerCase();
        if (type.includes('swamp')) this.player.addMana('B');
        else if (type.includes('mountain')) this.player.addMana('R');
        else if (type.includes('forest')) this.player.addMana('G');
        else if (type.includes('plains')) this.player.addMana('W');
        else if (type.includes('island')) this.player.addMana('U');
        else this.player.addMana('C');
        land.tapped = true;
      }
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

  // Attack with all available creatures
  attack(humanPlayer) {
    const attackers = this.player.getUntappedCreatures();
    if (attackers.length === 0) return;

    let totalPower = 0;
    attackers.forEach((perm) => {
      const { power } = this.player.getEffectivePT(perm);
      totalPower += power;
      perm.tapped = true;
    });

    // Simple: no blocking logic for now, just deal damage
    // Human player can't block in Phase 2 (Phase 3 will add this)
    humanPlayer.life -= totalPower;
    GameLog.add(
      `${this.player.name} attacks with ${attackers.length} creature(s) for ${totalPower} damage! Your life: ${humanPlayer.life}. (Blocking coming in Phase 3)`,
      'combat'
    );
  },

  // Build a simple pre-constructed aggro deck for the AI
  buildDeck() {
    // Returns an array of minimal card objects for the AI
    // These are simplified cards, not full Scryfall objects
    const makeCard = (name, type, cmc, power, toughness, colors = []) => ({
      name,
      type_line: type,
      cmc,
      power: String(power),
      toughness: String(toughness),
      color_identity: colors,
      mana_cost: '',
      oracle_text: '',
      keywords: [],
      id: name.replace(/\s/g, '_').toLowerCase(),
      image_uris: null,
    });

    const lands = [];
    for (let i = 0; i < 17; i++)
      lands.push(makeCard('Swamp', 'Basic Land — Swamp', 0, 0, 0, ['B']));
    for (let i = 0; i < 17; i++)
      lands.push(makeCard('Mountain', 'Basic Land — Mountain', 0, 0, 0, ['R']));

    const creatures = [
      makeCard('Vampire Grunt', 'Creature — Vampire', 1, 1, 1, ['B']),
      makeCard('Vampire Grunt', 'Creature — Vampire', 1, 1, 1, ['B']),
      makeCard('Vampire Grunt', 'Creature — Vampire', 1, 1, 1, ['B']),
      makeCard('Goblin Raider', 'Creature — Goblin', 1, 1, 1, ['R']),
      makeCard('Goblin Raider', 'Creature — Goblin', 1, 1, 1, ['R']),
      makeCard('Goblin Raider', 'Creature — Goblin', 1, 1, 1, ['R']),
      makeCard('Dark Cultist', 'Creature — Human Cleric', 2, 2, 1, ['B']),
      makeCard('Dark Cultist', 'Creature — Human Cleric', 2, 2, 1, ['B']),
      makeCard('Dark Cultist', 'Creature — Human Cleric', 2, 2, 1, ['B']),
      makeCard('Flame Imp', 'Creature — Imp', 2, 2, 2, ['R']),
      makeCard('Flame Imp', 'Creature — Imp', 2, 2, 2, ['R']),
      makeCard('Flame Imp', 'Creature — Imp', 2, 2, 2, ['R']),
      makeCard('Bloodthirsty Marauder', 'Creature — Vampire Warrior', 3, 3, 2, ['B']),
      makeCard('Bloodthirsty Marauder', 'Creature — Vampire Warrior', 3, 3, 2, ['B']),
      makeCard('Scorch Drake', 'Creature — Drake', 3, 2, 3, ['R']),
      makeCard('Scorch Drake', 'Creature — Drake', 3, 2, 3, ['R']),
      makeCard('Night Stalker', 'Creature — Vampire', 4, 4, 3, ['B']),
      makeCard('Night Stalker', 'Creature — Vampire', 4, 4, 3, ['B']),
      makeCard('Hellfire Titan', 'Creature — Giant', 5, 5, 5, ['R']),
      makeCard('Hellfire Titan', 'Creature — Giant', 5, 5, 5, ['R']),
    ];

    // Pad to 100 with lands
    const deck = [...creatures, ...lands];
    while (deck.length < 100) {
      deck.push(makeCard('Swamp', 'Basic Land — Swamp', 0, 0, 0, ['B']));
    }

    return deck.slice(0, 100);
  },
};
