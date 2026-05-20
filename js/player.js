// ── PLAYER ──
// Represents a single player's game state.

// Incrementing ID counter — avoids Date.now() collision risk
let _permId = 0;
const nextPermId = () => ++_permId;

class Player {
  constructor(name, isHuman = false) {
    this.name = name;
    this.isHuman = isHuman;
    this.life = 40;
    this.library = []; // shuffled deck
    this.hand = [];
    this.battlefield = []; // { card, tapped, counters, summoningSick }
    this.graveyard = [];
    this.exile = [];
    this.commanders = []; // commander zone
    this.commanderNames = new Set();
    this.commanderCastCount = {};
    this.manaPool = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
    this.landsPlayedThisTurn = 0;
    this.hasDrawnThisTurn = false;
    this.maxHandSize = 7; // can be increased by card effects
  }

  // ── LIBRARY ──

  // Load and shuffle a flat array of card objects
  // Commanders are passed separately via loadCommanders()
  loadDeck(cards) {
    this.library = [...cards];
    this.shuffle();
  }

  // Set commanders directly (called from Game.init)
  loadCommanders(commanders) {
    this.commanders = [...commanders];
    commanders.forEach((c) => this.commanderNames.add(c.name));
  }

  shuffle() {
    for (let i = this.library.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.library[i], this.library[j]] = [this.library[j], this.library[i]];
    }
  }

  // Draw n cards from library into hand
  draw(n = 1) {
    const drawn = [];
    for (let i = 0; i < n; i++) {
      if (this.library.length === 0) {
        GameLog.add(`${this.name} has no cards left to draw — they lose!`, 'warning');
        Game.checkDrawLoss(this);
        break;
      }
      const card = this.library.shift();
      this.hand.push(card);
      drawn.push(card);
    }
    return drawn;
  }

  // Draw opening hand
  drawOpeningHand(size = 7) {
    this.hand = [];
    this.draw(size);
  }

  // Mulligan — shuffle hand back, draw one fewer
  mulligan(handSize) {
    this.library.push(...this.hand);
    this.hand = [];
    this.shuffle();
    this.draw(handSize);
  }

  // ── MANA ──

  // Add mana to pool
  addMana(color, amount = 1) {
    if (this.manaPool[color] !== undefined) {
      this.manaPool[color] += amount;
    }
  }

  // Spend mana - returns true if successful
  spendMana(cost) {
    // cost is object like { B: 1, R: 1, generic: 2 }
    const pool = { ...this.manaPool };

    // Pay specific colors first
    for (const [color, amount] of Object.entries(cost)) {
      if (color === 'generic') continue;
      if ((pool[color] || 0) < amount) return false;
      pool[color] -= amount;
    }

    // Pay generic with any remaining mana
    let generic = cost.generic || 0;
    for (const color of ['G', 'R', 'B', 'W', 'U', 'C']) {
      if (generic <= 0) break;
      const available = pool[color] || 0;
      const spend = Math.min(available, generic);
      pool[color] -= spend;
      generic -= spend;
    }

    if (generic > 0) return false; // Not enough mana

    // Apply the new pool
    this.manaPool = pool;
    return true;
  }

  // Clear mana pool at end of phase
  clearManaPool() {
    this.manaPool = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
  }

  // Total mana available
  totalMana() {
    return Object.values(this.manaPool).reduce((a, b) => a + b, 0);
  }

  // ── LANDS ──

  canPlayLand() {
    return this.landsPlayedThisTurn === 0;
  }

  playLand(cardIndex) {
    if (!this.canPlayLand()) return false;
    const card = this.hand[cardIndex];
    if (!card) return false;
    if (Scryfall.getCategory(card) !== 'land') return false;

    this.hand.splice(cardIndex, 1);
    // FIX: lands enter untapped by default; game.js sets tapped if oracle says so
    this.battlefield.push({
      card,
      tapped: false,
      counters: [],
      summoningSick: false,
      id: nextPermId(),
    });
    this.landsPlayedThisTurn++;
    return true;
  }

  // ── BATTLEFIELD ──

  // Tap a permanent by its battlefield id
  tap(permanentId) {
    const perm = this.battlefield.find((p) => p.id === permanentId);
    if (!perm || perm.tapped) return false;
    perm.tapped = true;
    return true;
  }

  // Untap a permanent
  untap(permanentId) {
    const perm = this.battlefield.find((p) => p.id === permanentId);
    if (!perm) return false;
    perm.tapped = false;
    return true;
  }

  // Untap all permanents (beginning of untap step)
  untapAll() {
    this.battlefield.forEach((p) => {
      p.tapped = false;
      const type = (p.card.type_line || '').toLowerCase();
      if (type.includes('creature')) {
        p.summoningSick = false;
      }
    });
  }

  // Get lands on battlefield
  getLands() {
    return this.battlefield.filter((p) => Scryfall.getCategory(p.card) === 'land');
  }

  // Get creatures on battlefield
  getCreatures() {
    return this.battlefield.filter((p) => {
      const type = (p.card.type_line || '').toLowerCase();
      return type.includes('creature');
    });
  }

  // Get untapped lands
  getUntappedLands() {
    return this.getLands().filter((p) => !p.tapped);
  }

  // Get untapped creatures (can attack or tap)
  getUntappedCreatures() {
    return this.getCreatures().filter((p) => !p.tapped && !p.summoningSick);
  }

  // Move a card from battlefield to graveyard
  sendToGraveyard(permanentId) {
    const idx = this.battlefield.findIndex((p) => p.id === permanentId);
    if (idx === -1) return false;
    const [perm] = this.battlefield.splice(idx, 1);

    const isCreature = (perm.card.type_line || '').toLowerCase().includes('creature');

    this.battlefield.forEach((p) => (p.canUntap = false));

    // Commander replacement effect
    if (perm.isCommander && this.isHuman) {
      const toCommandZone = confirm(
        `${perm.card.name} would go to the graveyard.\n\n` +
          `As a commander, you may return it to the command zone instead.\n\n` +
          `Send to command zone? (Cancel = graveyard)`
      );
      if (toCommandZone) {
        GameLog.add(`${perm.card.name} returned to the command zone.`, 'info');
        this.commanders.unshift(perm.card);
        // Fire triggers before leaving
        const hadNegCounters = perm.counters.some((c) => c === '-1/-1');
        if (hadNegCounters && isCreature) Game.checkTriggers('countered_creature_dies');
        if (isCreature) Game.checkTriggers('creature_dies');
        GameUI.renderGame(Game);
        return perm.card;
      }
    }

    this.graveyard.push(perm.card);

    // Fire countered_creature_dies trigger if it had -1/-1 counters
    const hadNegCounters = perm.counters.some((c) => c === '-1/-1');
    if (hadNegCounters && isCreature) {
      Game.checkTriggers('countered_creature_dies');
    }

    // Fire creature_dies trigger for Grave Venerations etc.
    if (isCreature) {
      Game.checkTriggers('creature_dies');
    }

    return perm.card;
  }

  // Cast a card from hand (moves to battlefield or resolves)
  castFromHand(cardIndex) {
    const card = this.hand[cardIndex];
    if (!card) return false;

    this.hand.splice(cardIndex, 1);

    const type = (card.type_line || '').toLowerCase();
    const isInstant = type.includes('instant');
    const isSorcery = type.includes('sorcery');

    if (!isInstant && !isSorcery) {
      // Permanent — goes to battlefield
      this.battlefield.push({
        card,
        tapped: false,
        counters: [],
        summoningSick: type.includes('creature'), // creatures have summoning sickness
        id: nextPermId(),
      });
    } else {
      // Spell — resolves and goes to graveyard
      this.graveyard.push(card);
    }

    return card;
  }

  // Cast commander from command zone
  castCommander(commanderIndex) {
    const commander = this.commanders[commanderIndex];
    if (!commander) return false;

    const name = commander.name;
    const castCount = this.commanderCastCount[name] || 0;
    this.commanderCastCount[name] = castCount + 1;

    // Remove from command zone
    this.commanders.splice(commanderIndex, 1);

    this.battlefield.push({
      card: commander,
      tapped: false,
      counters: [],
      summoningSick: true,
      isCommander: true,
      id: nextPermId(),
    });

    return commander;
  }

  // Commander tax for a given commander
  commanderTax(commanderName) {
    return (this.commanderCastCount[commanderName] || 0) * 2;
  }

  // Return commander to command zone (from battlefield or graveyard)
  returnCommanderToZone(commanderName) {
    // Check battlefield
    const bfIdx = this.battlefield.findIndex((p) => p.isCommander && p.card.name === commanderName);
    if (bfIdx !== -1) {
      this.battlefield.splice(bfIdx, 1);
      GameLog.add(`${commanderName} returned to the command zone.`, 'info');
      return true;
    }
    // Check graveyard
    const gyIdx = this.graveyard.findIndex((c) => c.name === commanderName);
    if (gyIdx !== -1) {
      this.graveyard.splice(gyIdx, 1);
      GameLog.add(`${commanderName} returned to the command zone from graveyard.`, 'info');
      return true;
    }
    return false;
  }

  // ── TURN RESET ──

  resetForNewTurn() {
    this.landsPlayedThisTurn = 0;
    this.hasDrawnThisTurn = false;
    this.clearManaPool();
  }

  // ── POWER/TOUGHNESS ──

  // Get effective power/toughness accounting for -1/-1 counters
  getEffectivePT(permanent) {
    const card = permanent.card;
    const basePower = parseInt(card.power) || 0;
    const baseToughness = parseInt(card.toughness) || 0;
    const negCounters = permanent.counters.filter((c) => c === '-1/-1').length;
    const posCounters = permanent.counters.filter((c) => c === '+1/+1').length;

    return {
      power: basePower - negCounters + posCounters,
      toughness: baseToughness - negCounters + posCounters,
    };
  }

  // Check if a creature should die (toughness <= 0)
  checkStateBasedActions() {
    const toRemove = [];
    this.battlefield.forEach((perm) => {
      const type = (perm.card.type_line || '').toLowerCase();
      if (type.includes('creature')) {
        const { toughness } = this.getEffectivePT(perm);
        if (toughness <= 0) {
          toRemove.push(perm.id);
        }
      }
    });
    toRemove.forEach((id) => this.sendToGraveyard(id));
    return toRemove.length > 0;
  }

  // ── HAND SIZE ──

  // Discard down to 7 at end of turn
  mustDiscard() {
    return this.hand.length > this.maxHandSize;
  }

  discardToHandSize() {
    if (this.isHuman) return; // human discards manually via UI
    while (this.hand.length > this.maxHandSize) {
      const discarded = this.hand.pop();
      this.graveyard.push(discarded);
      GameLog.add(`${this.name} discarded ${discarded.name}.`, 'info');
    }
  }
}
