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

  init(deckCards) {
    // Set up human player
    this.human = new Player('You', true);
    this.human.loadDeck([...deckCards]);

    // Set up AI opponent
    this.opponent = AI.init('Opponent');

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
    const currentIdx = PHASES.indexOf(this.currentPhase);
    const nextIdx = currentIdx + 1;

    if (nextIdx >= PHASES.length) {
      // End of turn
      this.endTurn();
      return;
    }

    this.currentPhase = PHASES[nextIdx];
    this.processCurrentPhase();
  },

  processCurrentPhase() {
    switch (this.currentPhase) {
      case 'untap': this.processUntap(); break;
      case 'upkeep': this.processUpkeep(); break;
      case 'draw': this.processDraw(); break;
      case 'main1': this.processMain(); break;
      case 'combat': this.processCombat(); break;
      case 'main2': this.processMain(); break;
      case 'end': this.processEnd(); break;
    }
  },

  // ── PHASES ──

  processUntap() {
    if (this.isHumanTurn) {
      this.human.untapAll();
      this.human.resetForNewTurn();
      GameLog.add('Untap step: All your permanents untapped.', 'phase');

      if (Settings.get('beginnerMode')) {
        GameUI.showPhaseTip('untap');
      }
    }
    // Untap is automatic — advance immediately
    setTimeout(() => this.advancePhase(), 300);
  },

  processUpkeep() {
    GameLog.add('Upkeep step.', 'phase');

    if (Settings.get('beginnerMode')) {
      GameUI.showPhaseTip('upkeep');
    }

    // Check for upkeep triggers on human's battlefield
    if (this.isHumanTurn) {
      this.checkTriggers('upkeep');
    }

    GameUI.renderGame(this);
    // Player manually advances from upkeep
  },

  processDraw() {
    if (this.isHumanTurn) {
      if (this.turn === 1) {
        // First player skips draw on turn 1 in some formats
        // In Commander with 1 player we'll allow it
        this.human.draw(1);
        GameLog.add('You draw a card.', 'action');
      } else {
        this.human.draw(1);
        GameLog.add('You draw a card.', 'action');
      }

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

    if (Settings.get('beginnerMode')) {
      GameUI.showPhaseTip(this.currentPhase === 'main1' ? 'main1' : 'main2');
    }

    // Check for any trigger reminders
    this.checkTriggers('main');

    GameUI.renderGame(this);
    // Player takes actions — they manually advance when ready
  },

  processCombat() {
    GameLog.add('Beginning of combat.', 'phase');

    if (Settings.get('beginnerMode')) {
      GameUI.showPhaseTip('combat');
    }

    GameUI.renderGame(this);
    // Player declares attackers via UI
    // Combat.begin() is called when player clicks Attack button
  },

  processEnd() {
    GameLog.add('End step.', 'phase');

    if (Settings.get('beginnerMode')) {
      GameUI.showPhaseTip('end');
    }

    // Check end step triggers
    this.checkTriggers('end_step');

    // Discard to hand size
    if (this.human.mustDiscard() && this.isHumanTurn) {
      GameLog.add(`You have ${this.human.hand.length} cards — discard to 7.`, 'warning');
      GameUI.showDiscardPrompt();
    }

    GameUI.renderGame(this);
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
        this.checkWinCondition();
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

    const success = this.human.playLand(cardIndex);
    if (success) {
      // Determine if land enters tapped
      const oracleText = (card.oracle_text || '').toLowerCase();
      const entersTapped = oracleText.includes('enters tapped') ||
        oracleText.includes('enters the battlefield tapped');

      const newLand = this.human.battlefield[this.human.battlefield.length - 1];
      if (newLand) {
        newLand.tapped = entersTapped;
      }

      GameLog.add(
        `You play ${card.name}${entersTapped ? ' (enters tapped)' : ''}.`,
        'action'
      );

      // Check Evolution Sage trigger
      this.checkTriggers('land_enters', card);
      this.checkWinCondition();
      GameUI.renderGame(this);
    }
    return success;
  },

  // Tap a land for mana
  tapLandForMana(permanentId) {
    const perm = this.human.battlefield.find((p) => p.id === permanentId);
    if (!perm) return;
    if (perm.tapped) {
      GameLog.add('That permanent is already tapped.', 'warning');
      return;
    }

    // Determine mana colors from card
    const colors = this.getLandColors(perm.card);

    if (colors.length === 1) {
      this.human.tap(permanentId);
      this.human.addMana(colors[0]);
      GameLog.add(
        `Tapped ${perm.card.name} for {${colors[0]}}.`,
        'action'
      );
    } else if (colors.length > 1) {
      // Show color choice
      GameUI.showManaChoice(permanentId, colors);
      return;
    }

    GameUI.renderGame(this);
  },

  // Complete tapping a land after color choice
  tapLandForManaColor(permanentId, color) {
    const perm = this.human.battlefield.find((p) => p.id === permanentId);
    if (!perm) return;

    this.human.tap(permanentId);
    this.human.addMana(color);
    GameLog.add(`Tapped ${perm.card.name} for {${color}}.`, 'action');
    GameUI.renderGame(this);
  },

  // Get mana colors a land produces
  getLandColors(card) {
    const name = card.name.toLowerCase();
    const type = (card.type_line || '').toLowerCase();
    const oracle = (card.oracle_text || '').toLowerCase();
    const colors = [];

    if (type.includes('plains') || oracle.includes('add {w}')) colors.push('W');
    if (type.includes('island') || oracle.includes('add {u}')) colors.push('U');
    if (type.includes('swamp') || oracle.includes('add {b}')) colors.push('B');
    if (type.includes('mountain') || oracle.includes('add {r}')) colors.push('R');
    if (type.includes('forest') || oracle.includes('add {g}')) colors.push('G');

    // Dual lands - check oracle for multiple colors
    if (colors.length === 0) colors.push('C'); // Colorless fallback

    return colors;
  },

  // Cast a spell from hand
  castSpell(cardIndex) {
    if (!['main1', 'main2'].includes(this.currentPhase)) {
      // Check if it's an instant
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
    const cmc = card.cmc || 0;
    if (this.human.totalMana() < cmc) {
      GameLog.add(`Not enough mana to cast ${card.name} (costs ${cmc}, you have ${this.human.totalMana()}).`, 'warning');
      return false;
    }

    // Spend mana (simplified - spend generic)
    let remaining = cmc;
    for (const color of ['B', 'R', 'G', 'W', 'U', 'C']) {
      if (remaining <= 0) break;
      const spend = Math.min(this.human.manaPool[color], remaining);
      this.human.manaPool[color] -= spend;
      remaining -= spend;
    }

    const result = this.human.castFromHand(cardIndex);
    if (result) {
      GameLog.add(`You cast ${card.name}.`, 'action');

      // Check triggers
      this.checkTriggers('spell_cast', card);
      this.checkWinCondition();
      GameUI.renderGame(this);
    }

    return !!result;
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
    for (const color of ['B', 'R', 'G', 'W', 'U', 'C']) {
      if (remaining <= 0) break;
      const spend = Math.min(this.human.manaPool[color], remaining);
      this.human.manaPool[color] -= spend;
      remaining -= spend;
    }

    this.human.castCommander(index);
    GameLog.add(
      `You cast ${commander.name}${tax > 0 ? ` (commander tax: +${tax})` : ''}.`,
      'action'
    );

    this.checkTriggers('spell_cast', commander);
    this.checkWinCondition();
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
      const reminder = TRIGGER_REMINDERS[perm.card.name];
      if (!reminder) return;
      if (reminder.when === event) {
        GameUI.showTriggerReminder(reminder.reminder);
      }
    });
  },

  // ── WIN CONDITIONS ──

  checkWinCondition() {
    if (this.opponent.life <= 0) {
      this.gameOver = true;
      GameLog.add(`🏆 ${this.opponent.name} has 0 life. You win!`, 'phase');
      GameUI.showGameOver(true);
    } else if (this.human.life <= 0) {
      this.gameOver = true;
      GameLog.add('💀 You have 0 life. You lose.', 'phase');
      GameUI.showGameOver(false);
    }
  },
};
