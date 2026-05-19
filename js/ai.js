// ── AI OPPONENT ──
// Simple scripted AI opponent for Phase 2.
// Plays a basic aggressive strategy.

const AI = {
  player: null,

  // Initialise AI with a pre-built deck
  async init(name = 'Opponent') {
    this.player = new Player(name, false);
    this.player.loadCommanders([]);
    const list = this.getDeckList();

    // Build identifiers array for collection endpoint
    const identifiers = list.map((e) => ({ name: e.name }));

    // Fetch all cards in one POST request
    const res = await fetch('https://api.scryfall.com/cards/collection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifiers }),
    });

    const data = await res.json();
    const fetched = data.data || [];

    // Build deck from results, matching back to quantities
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
    this.attack(humanPlayer);

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

    // Count available mana without tapping yet
    const availableMana = this.player.getLands().filter((l) => !l.tapped).length;
    const cheapest = sortedCreatures[0].card.cmc || 0;
    if (availableMana < cheapest) return; // nothing affordable — don't tap any lands

    this.generateMana();

    for (const { card } of sortedCreatures) {
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

  // FIX: Attack with human blocking — human's untapped creatures can block
  attack(humanPlayer) {
    const attackers = this.player.getUntappedCreatures();
    if (attackers.length === 0) return;

    GameLog.add(`${this.player.name} attacks with ${attackers.length} creature(s)!`, 'combat');

    // Tap all attackers
    attackers.forEach((perm) => {
      perm.tapped = true;
    });

    // Human auto-blocks: assign best available blockers
    const humanBlockers = humanPlayer.getUntappedCreatures();
    const assignments = {}; // attackerId -> blockerId | null
    const usedBlockers = new Set();

    attackers.forEach((attacker) => {
      const { power: atkPwr } = this.player.getEffectivePT(attacker);
      // Find a blocker that trades favourably or survives
      const blocker = humanBlockers.find((b) => {
        if (usedBlockers.has(b.id)) return false;
        const { power: blkPwr, toughness: blkTgh } = humanPlayer.getEffectivePT(b);
        const { toughness: atkTgh } = this.player.getEffectivePT(attacker);
        return blkPwr >= atkTgh || atkPwr < blkTgh; // kills attacker or blocker survives
      });

      if (blocker) {
        assignments[attacker.id] = blocker.id;
        usedBlockers.add(blocker.id);
        GameLog.add(`You block ${attacker.card.name} with ${blocker.card.name}.`, 'combat');
      } else {
        assignments[attacker.id] = null;
      }
    });

    // Resolve damage
    let totalDamageToHuman = 0;

    attackers.forEach((attacker) => {
      const { power: atkPwr, toughness: atkTgh } = this.player.getEffectivePT(attacker);
      const blockerId = assignments[attacker.id];

      if (!blockerId) {
        totalDamageToHuman += atkPwr;
        GameLog.add(`${attacker.card.name} deals ${atkPwr} damage to you (unblocked).`, 'combat');
      } else {
        const blocker = humanPlayer.battlefield.find((p) => p.id === blockerId);
        if (!blocker) {
          totalDamageToHuman += atkPwr;
          return;
        }
        const { power: blkPwr, toughness: blkTgh } = humanPlayer.getEffectivePT(blocker);

        GameLog.add(
          `${attacker.card.name} (${atkPwr}/${atkTgh}) vs ${blocker.card.name} (${blkPwr}/${blkTgh}).`,
          'combat'
        );

        // Attacker dies?
        if (blkPwr >= atkTgh) {
          this.player.sendToGraveyard(attacker.id);
          GameLog.add(`${attacker.card.name} dies.`, 'combat');
        }
        // Blocker dies?
        if (atkPwr >= blkTgh) {
          humanPlayer.sendToGraveyard(blockerId);
          GameLog.add(`${blocker.card.name} dies.`, 'combat');
        }
      }
    });

    if (totalDamageToHuman > 0) {
      humanPlayer.life -= totalDamageToHuman;
      GameLog.add(
        `You take ${totalDamageToHuman} damage. Your life: ${humanPlayer.life}.`,
        'combat'
      );
    }

    // FIX: check win condition immediately after AI attack
    Game.checkWinCondition();
  },

  // Build a simple pre-constructed aggro deck for the AI
  getDeckList() {
    return [
      { name: 'Llanowar Elves', qty: 3 },
      { name: 'Elvish Mystic', qty: 3 },
      { name: 'Runeclaw Bear', qty: 3 },
      { name: 'Centaur Courser', qty: 3 },
      { name: 'Kalonian Tusker', qty: 3 },
      { name: 'Deadly Recluse', qty: 2 },
      { name: 'Charging Rhino', qty: 2 },
      { name: 'Serra Angel', qty: 2 },
      { name: 'Silvercoat Lion', qty: 3 },
      { name: 'Lone Missionary', qty: 3 },
      { name: 'Attended Knight', qty: 2 },
      { name: 'Siege Mastodon', qty: 2 },
      { name: 'Forest', qty: 17 },
      { name: 'Plains', qty: 16 },
    ];
  },
};
