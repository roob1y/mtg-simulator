// ── GAME ENGINE ──
// Core game state and turn structure.

const PHASES = ['untap', 'upkeep', 'draw', 'main1', 'combat', 'main2', 'end'];

const Game = {
  human: null,
  opponent: null,
  currentPhase: 'main1',
  turn: 1,
  isHumanTurn: true,
  gameOver: false,
  mulliganCount: 0,
  inMulligan: true,

  // ── INIT ──

  async init(deckCards, commanders, aiCards = null) {
    // Set up human player
    this.human = new Player('You', true);
    // FIX: load library cards and commanders separately
    this.human.loadDeck([...deckCards]);
    this.human.loadCommanders([...commanders]);

    // Set up AI opponent
    this.opponent = await AI.init('Opponent', aiCards);
    // Reset state
    this.turn = 1;
    this.isHumanTurn = true;
    this.gameOver = false;
    this.mulliganCount = 0;
    this.inMulligan = true;

    GameLog.clear();
    GameLog.add('Game started! Drawing opening hands...', 'phase');

    // Draw opening hands
    this.human.drawOpeningHand(7);
    this.opponent.drawOpeningHand(7);

    // Show mulligan screen
    GameUI.showMulligan(7 - this.mulliganCount);
  },

  // ── MULLIGAN ──

  acceptHand() {
    this.inMulligan = false;
    GameLog.add('Opening hand kept.', 'info');
    this.startFirstTurn();
  },

  takeMulligan() {
    this.mulliganCount++;
    const newSize = 7 - this.mulliganCount;
    if (newSize <= 0) {
      GameLog.add('No cards left to mulligan to. Starting with empty hand.', 'warning');
      this.inMulligan = false;
      this.startFirstTurn();
      return;
    }
    this.human.mulligan(newSize);
    GameLog.add(`Mulligan taken. Drawing ${newSize} cards.`, 'info');
    GameUI.showMulligan(newSize);
  },

  // ── TURN STRUCTURE ──

  startFirstTurn() {
    this.currentPhase = 'untap';
    GameLog.add(`=== Turn ${this.turn} — Your Turn ===`, 'phase');
    this.processUntap();
  },

  // Advance to the next phase
  advancePhase() {
    if (this.gameOver) return;

    if (this.currentPhase === 'end' && this.isHumanTurn && this.human.mustDiscard()) {
      GameLog.add(
        `Discard down to ${this.human.maxHandSize} cards before ending your turn.`,
        'warning'
      );
      return;
    }

    // Clear any lingering UI state
    const manaChoice = document.getElementById('mana-choice');
    if (manaChoice) manaChoice.classList.add('hidden');
    GameUI.pendingManaChoice = null;
    GameUI.selectedCard = null;

    const currentIdx = PHASES.indexOf(this.currentPhase);
    const nextIdx = currentIdx + 1;

    if (nextIdx >= PHASES.length) {
      this.endTurn();
      return;
    }

    this.currentPhase = PHASES[nextIdx];
    if (this.currentPhase !== 'combat') Combat.phase = null;
    this.human.clearManaPool();
    this.processCurrentPhase();
  },

  processCurrentPhase() {
    switch (this.currentPhase) {
      case 'untap':
        this.processUntap();
        break;
      case 'upkeep':
        this.processUpkeep();
        break;
      case 'draw':
        this.processDraw();
        break;
      case 'main1':
        this.processMain();
        break;
      case 'combat':
        this.processCombat();
        break;
      case 'main2':
        this.processMain();
        break;
      case 'end':
        this.processEnd();
        break;
    }
  },

  // ── PHASES ──

  processUntap() {
    if (this.isHumanTurn) {
      this.human.untapAll();
      this.human.resetForNewTurn();
      GameLog.add('Untap step: All your permanents untapped.', 'phase');
      GameUI.renderGame(this);
      if (Settings.get('beginnerMode')) {
        GameUI.showPhaseTip('untap');
      }
    }
    // FIX: only auto-advance on human's turn; AI manages its own turn flow
    if (this.isHumanTurn) {
      setTimeout(() => this.advancePhase(), 300);
    }
  },

  processUpkeep() {
    GameLog.add('Upkeep step.', 'phase');

    // Check for upkeep triggers on human's battlefield
    if (this.isHumanTurn) {
      this.checkTriggers('upkeep');
    }

    GameUI.renderGame(this);
    if (Settings.get('beginnerMode')) {
      GameUI.showPhaseTip('upkeep');
    }
    // Player manually advances from upkeep
  },

  processDraw() {
    if (this.isHumanTurn) {
      this.human.draw(1);
      GameLog.add('You draw a card.', 'action');
      if (Settings.get('beginnerMode')) {
        GameUI.showPhaseTip('draw');
      }
    }

    GameUI.renderGame(this);
    // Player manually advances from draw
  },

  processMain() {
    const phase = this.currentPhase === 'main1' ? 'Main Phase 1' : 'Main Phase 2';
    GameLog.add(`${phase}.`, 'phase');

    // Check for any trigger reminders
    this.checkTriggers('main');

    GameUI.renderGame(this);
    if (Settings.get('beginnerMode')) {
      GameUI.showPhaseTip(this.currentPhase === 'main1' ? 'main1' : 'main2');
    }
    // Player takes actions — they manually advance when ready
  },

  processCombat() {
    GameLog.add('Beginning of combat.', 'phase');

    GameUI.renderGame(this);
    if (Settings.get('beginnerMode')) {
      GameUI.showPhaseTip('combat');
    }
    // Player declares attackers via UI
    // Combat.begin() is called when player clicks Attack button
  },

  processEnd() {
    GameLog.add('End step.', 'phase');

    // Check end step triggers
    this.checkTriggers('end_step');

    // Discard to hand size
    if (this.human.mustDiscard() && this.isHumanTurn) {
      GameLog.add(
        `You have ${this.human.hand.length} cards — discard to ${this.human.maxHandSize}.`,
        'warning'
      );
      GameUI.showDiscardPrompt();
    }

    GameUI.renderGame(this);
    if (Settings.get('beginnerMode')) {
      GameUI.showPhaseTip('end');
    }
  },

  // ── END TURN ──

  endTurn() {
    this.human.clearManaPool();

    if (this.isHumanTurn) {
      GameLog.add("Your turn ends. Opponent's turn begins.", 'phase');
      this.isHumanTurn = false;
      this.currentPhase = 'untap';

      // AI takes its turn
      setTimeout(() => {
        AI.takeTurn(this.human);

        // FIX: check win condition immediately after AI turn ends
        if (this.checkWinCondition()) return;

        GameUI.renderGame(this);

        // Back to human's turn
        setTimeout(() => {
          this.isHumanTurn = true;
          this.turn++;
          this.currentPhase = 'untap';
          GameLog.add(`=== Turn ${this.turn} — Your Turn ===`, 'phase');
          this.processUntap();
        }, 1000);
      }, 500);
    }
  },

  // ── ACTIONS ──

  // Play a land from hand
  playLand(cardIndex) {
    if (!['main1', 'main2'].includes(this.currentPhase)) {
      GameLog.add('You can only play lands during your main phase.', 'warning');
      return false;
    }
    if (!this.human.canPlayLand()) {
      GameLog.add('You have already played a land this turn.', 'warning');
      return false;
    }

    const card = this.human.hand[cardIndex];
    if (!card) return false;

    GameUI.flashHandCard(cardIndex, 'land');
    const success = this.human.playLand(cardIndex);
    if (success) {
      // Determine if land enters tapped
      const oracleText = (card.oracle_text || '').toLowerCase();
      const entersTapped =
        oracleText.includes('enters tapped') ||
        oracleText.includes('enters the battlefield tapped');

      const newLand = this.human.battlefield[this.human.battlefield.length - 1];
      if (newLand) {
        newLand.tapped = entersTapped;
      }

      GameLog.add(`You play ${card.name}${entersTapped ? ' (enters tapped)' : ''}.`, 'action');

      // FIX: deselect card only on success
      GameUI.selectedCard = null;

      // Check Evolution Sage trigger
      this.checkTriggers('land_enters', card);
      this.processETB(card);
      this.checkWinCondition();
      setTimeout(() => GameUI.renderGame(this), 300);
    }
    return success;
  },

  playMDFCLand(cardIndex) {
    if (!['main1', 'main2'].includes(this.currentPhase)) {
      GameLog.add('You can only play lands during your main phase.', 'warning');
      return false;
    }
    if (!this.human.canPlayLand()) {
      GameLog.add('You have already played a land this turn.', 'warning');
      return false;
    }

    const card = this.human.hand[cardIndex];
    if (!card) return false;

    const landFace = Scryfall.getMDFCLandFace(card);
    if (!landFace) return false;

    // Remove from hand, put land face on battlefield
    this.human.hand.splice(cardIndex, 1);
    const oracleText = (landFace.oracle_text || '').toLowerCase();
    const entersTapped =
      oracleText.includes('enters tapped') || oracleText.includes('enters the battlefield tapped');

    this.human.battlefield.push({
      card: { ...card, ...landFace, oracle_text: landFace.oracle_text },
      tapped: entersTapped,
      counters: [],
      summoningSick: false,
      id: nextPermId(),
    });

    this.human.landsPlayedThisTurn++;
    GameUI.selectedCard = null;
    GameLog.add(`You play ${landFace.name}${entersTapped ? ' (enters tapped)' : ''}.`, 'action');
    this.processETB({ ...card, ...landFace });
    this.checkTriggers('land_enters', card);
    GameUI.renderGame(this);
    return true;
  },

  // Tap a land for mana
  tapLandForMana(permanentId) {
    const id = isNaN(permanentId) ? permanentId : Number(permanentId);
    const perm = this.human.battlefield.find((p) => p.id === id);

    if (!perm) return;
    if (perm.tapped) {
      GameLog.add('That permanent is already tapped.', 'warning');
      return;
    }

    const colors = this.getLandColors(perm.card);

    if (colors.length === 1) {
      this.human.tap(id);
      this.human.addMana(colors[0]);
      GameLog.add(`Tapped ${perm.card.name} for {${colors[0]}}.`, 'action');
      if (Settings.get('beginnerMode')) perm.canUntap = true;
    } else if (colors.length > 1) {
      const selectedIdx = GameUI.selectedCard;
      if (selectedIdx !== null) {
        const card = this.human.hand[selectedIdx];
        if (card) {
          const cost = (card.mana_cost || '').toUpperCase();
          const needed = colors.find((c) => cost.includes(`{${c}}`));
          if (needed) {
            this.human.tap(id);
            this.human.addMana(needed);
            GameLog.add(`Tapped ${perm.card.name} for {${needed}} (auto).`, 'action');
            if (Settings.get('beginnerMode')) perm.canUntap = true;
            GameUI.renderGame(this);
            const manaEl = document.getElementById('mana-choice');
            if (manaEl) manaEl.classList.add('hidden');
            GameUI.pendingManaChoice = null;
            return;
          }
        }
      }
      GameUI.showManaChoice(id, colors);
      return;
    }

    GameUI.renderGame(this);
  },

  // Complete tapping a land after color choice
  tapLandForManaColor(permanentId, color) {
    const id = isNaN(permanentId) ? permanentId : Number(permanentId);
    const perm = this.human.battlefield.find((p) => p.id === id);
    if (!perm) return;

    this.human.tap(id); // pass coerced id
    perm.chosenColor = color;
    if (Settings.get('beginnerMode')) perm.canUntap = true;

    this.human.addMana(color);
    GameLog.add(`Tapped ${perm.card.name} for {${color}}.`, 'action');
    GameUI.renderGame(this);
  },

  tapArtifactForMana(permanentId) {
    const perm = this.human.battlefield.find((p) => p.id === permanentId);
    if (!perm || perm.tapped) return;

    const oracle = (perm.card.oracle_text || '').toLowerCase();
    const colorSet = new Set();

    if (oracle.includes('add {w}')) colorSet.add('W');
    if (oracle.includes('add {u}')) colorSet.add('U');
    if (oracle.includes('add {b}')) colorSet.add('B');
    if (oracle.includes('add {r}')) colorSet.add('R');
    if (oracle.includes('add {g}')) colorSet.add('G');

    // Sol Ring pattern: "add {c}{c}" or "add two mana"
    const colorlessMatch = oracle.match(/add \{c\}\{c\}|add two mana of any color|add \{c\}/);
    if (colorlessMatch) {
      if (oracle.includes('{c}{c}')) {
        this.human.addMana('C');
        this.human.addMana('C');
        this.human.tap(permanentId);
        if (Settings.get('beginnerMode')) perm.canUntap = true;
        GameLog.add(`Tapped ${perm.card.name} for {C}{C}.`, 'action');
      } else {
        this.human.addMana('C');
        this.human.tap(permanentId);
        if (Settings.get('beginnerMode')) perm.canUntap = true;
        GameLog.add(`Tapped ${perm.card.name} for {C}.`, 'action');
      }
      GameUI.renderGame(this);
      return;
    }

    const colors = [...colorSet];
    if (colors.length === 1) {
      this.human.tap(permanentId);
      if (Settings.get('beginnerMode')) perm.canUntap = true;
      this.human.addMana(colors[0]);
      GameLog.add(`Tapped ${perm.card.name} for {${colors[0]}}.`, 'action');
    } else if (colors.length > 1) {
      GameUI.showManaChoice(permanentId, colors);
      return;
    }

    GameUI.renderGame(this);
  },

  untapArtifact(permanentId) {
    const perm = this.human.battlefield.find((p) => p.id === permanentId);
    if (!perm || !perm.canUntap) return;
    perm.tapped = false;
    perm.canUntap = false;
    // Remove mana that was added — parse oracle to know how much
    const oracle = (perm.card.oracle_text || '').toLowerCase();
    if (oracle.includes('{c}{c}')) {
      this.human.manaPool.C = Math.max(0, this.human.manaPool.C - 2);
    } else {
      this.human.manaPool.C = Math.max(0, this.human.manaPool.C - 1);
    }
    GameLog.add(`Untapped ${perm.card.name} (undo).`, 'action');
    GameUI.renderGame(this);
  },

  // FIX: Get mana colors a land produces — case-insensitive oracle text matching
  getLandColors(card) {
    const type = (card.type_line || '').toLowerCase();
    const oracle = (card.oracle_text || '').toLowerCase();
    const colorSet = new Set();

    // Subtypes in type_line (most reliable for basic and typed duals)
    if (type.includes('plains')) colorSet.add('W');
    if (type.includes('island')) colorSet.add('U');
    if (type.includes('swamp')) colorSet.add('B');
    if (type.includes('mountain')) colorSet.add('R');
    if (type.includes('forest')) colorSet.add('G');

    // Always also check oracle text for "add {x}" — catches pure-Land duals
    // and any land whose oracle lists colors not reflected in subtypes
    if (oracle.includes('{w}')) colorSet.add('W');
    if (oracle.includes('{u}')) colorSet.add('U');
    if (oracle.includes('{b}')) colorSet.add('B');
    if (oracle.includes('{r}')) colorSet.add('R');
    if (oracle.includes('{g}')) colorSet.add('G');

    const colors = [...colorSet];
    if (colors.length === 0) colors.push('C');
    return colors;
  },

  canAffordCard(card) {
    const face = Scryfall.getFrontFace(card);
    const cost = face.mana_cost || '';
    const pool = { ...this.human.manaPool };

    // Check specific colour pips first
    const pips = cost.match(/\{([WUBRG])\}/g) || [];
    for (const pip of pips) {
      const color = pip[1];
      if ((pool[color] || 0) <= 0) return false;
      pool[color]--;
    }

    // Check generic mana
    const genericMatch = cost.match(/\{(\d+)\}/);
    let generic = genericMatch ? parseInt(genericMatch[1]) : 0;
    const total = Object.values(pool).reduce((a, b) => a + b, 0);
    if (total < generic) return false;

    return true;
  },

  processETB(card) {
    const oracle = (card.oracle_text || '').toLowerCase();
    const name = card.name;

    // "you gain N life"
    const lifeGain = oracle.match(/you gain (\d+) life/);
    if (lifeGain) {
      const amount = parseInt(lifeGain[1]);
      this.human.life += amount;
      GameLog.add(`${name} enters — you gain ${amount} life. Life: ${this.human.life}.`, 'action');
    }

    // "draw a card"
    if (oracle.includes('when') && oracle.includes('enters') && oracle.includes('draw a card')) {
      this.human.draw(1);
      GameLog.add(`${name} enters — you draw a card.`, 'action');
    }
  },

  // Cast a spell from hand
  castSpell(cardIndex) {
    if (!['main1', 'main2'].includes(this.currentPhase)) {
      const card = this.human.hand[cardIndex];
      if (card) {
        const type = (card.type_line || '').toLowerCase();
        if (!type.includes('instant')) {
          GameLog.add('You can only cast sorceries during your main phase.', 'warning');
          return false;
        }
      }
    }

    const card = this.human.hand[cardIndex];
    if (!card) return false;

    // Check mana
    if (!this.canAffordCard(card)) {
      GameLog.add(`Not enough mana to cast ${card.name}.`, 'warning');
      return false;
    }

    GameUI.flashHandCard(cardIndex, 'cast');

    // Delay actual cast so flash animation is visible
    setTimeout(() => {
      this._spendManaCost(card);
      const result = this.human.castFromHand(cardIndex);
      if (result) {
        GameLog.add(`You cast ${card.name}.`, 'action');
        this.processETB(card);
        GameUI.selectedCard = null;
        this.human.battlefield.forEach((p) => { p.canUntap = false; });
        this.checkTriggers('spell_cast', card);
        this.checkWinCondition();
        GameUI.renderGame(this);
      }
    }, 300);

    return true;
  },

  // FIX: Parse mana cost string and spend matching colors before generic
  _spendManaCost(card) {
    const cost = card.mana_cost || '';
    const pool = this.human.manaPool;

    // Extract colored pips
    const colorMap = { W: 'W', U: 'U', B: 'B', R: 'R', G: 'G' };
    const matches = cost.match(/\{([WUBRG])\}/g) || [];
    matches.forEach((m) => {
      const color = m[1];
      if (pool[color] > 0) {
        pool[color]--;
      } else {
        // Can't pay specific color — fall through to generic spend
        // (simplified: just spend any available)
        for (const c of ['W', 'U', 'B', 'R', 'G', 'C']) {
          if (pool[c] > 0) {
            pool[c]--;
            break;
          }
        }
      }
    });

    // Spend generic mana (numbers in cost)
    const genericMatch = cost.match(/\{(\d+)\}/);
    let generic = genericMatch ? parseInt(genericMatch[1]) : 0;

    // Also handle X costs — skip for now (X=0)
    for (const color of ['C', 'G', 'R', 'B', 'W', 'U']) {
      if (generic <= 0) break;
      const spend = Math.min(pool[color], generic);
      pool[color] -= spend;
      generic -= spend;
    }
  },

  // Cast commander from command zone
  castCommander(index) {
    if (!['main1', 'main2'].includes(this.currentPhase)) {
      GameLog.add('You can only cast your commander during your main phase.', 'warning');
      return;
    }

    const commander = this.human.commanders[index];
    if (!commander) return;

    const tax = this.human.commanderTax(commander.name);
    const cmc = (commander.cmc || 0) + tax;

    if (this.human.totalMana() < cmc) {
      GameLog.add(
        `Not enough mana. ${commander.name} costs ${cmc} (including ${tax} commander tax).`,
        'warning'
      );
      return;
    }

    // Spend mana
    let remaining = cmc;
    const pool = this.human.manaPool;
    for (const color of ['B', 'R', 'G', 'W', 'U', 'C']) {
      if (remaining <= 0) break;
      const spend = Math.min(pool[color], remaining);
      pool[color] -= spend;
      remaining -= spend;
    }

    this.human.castCommander(index);
    GameLog.add(
      `You cast ${commander.name}${tax > 0 ? ` (commander tax: +${tax})` : ''}.`,
      'action'
    );

    this.checkTriggers('spell_cast', commander);
    this.checkWinCondition();
    this.human.battlefield.forEach((p) => (p.canUntap = false));

    GameUI.renderGame(this);
  },

  // Begin combat
  beginCombat() {
    if (this.currentPhase !== 'combat') {
      GameLog.add('You can only attack during the combat phase.', 'warning');
      return;
    }
    Combat.begin(this.human);
    GameUI.renderGame(this);
  },

  // ── TRIGGERS ──

  checkTriggers(event, card = null) {
    if (!Settings.get('beginnerMode')) return;

    this.human.battlefield.forEach((perm) => {
      const reminders = TRIGGER_REMINDERS[perm.card.name];
      if (!reminders) return;
      reminders.forEach((r) => {
        if (r.when === event) {
          GameUI.showTriggerReminder(r.reminder);
        }
      });
    });
  },

  // ── WIN CONDITIONS ──

  // Returns true if the game ended
  checkWinCondition() {
    if (this.gameOver) return true;

    if (this.opponent.life <= 0) {
      this.gameOver = true;
      GameLog.add(`🏆 ${this.opponent.name} has 0 life. You win!`, 'phase');
      GameUI.renderGame(this);
      GameUI.showGameOver(true);
      return true;
    } else if (this.human.life <= 0) {
      this.gameOver = true;
      GameLog.add('💀 You have 0 life. You lose.', 'phase');
      GameUI.renderGame(this);
      GameUI.showGameOver(false);
      return true;
    }
    return false;
  },
  checkDrawLoss(player) {
    if (this.gameOver) return;
    this.gameOver = true;
    if (player.isHuman) {
      GameLog.add('💀 You tried to draw from an empty library. You lose.', 'phase');
      GameUI.renderGame(this);
      GameUI.showGameOver(false);
    } else {
      GameLog.add('🏆 Opponent tried to draw from an empty library. You win!', 'phase');
      GameUI.renderGame(this);
      GameUI.showGameOver(true);
    }
  },
};
