// ── GAME UI ──
// Renders the game board and handles game UI interactions.

const GameUI = {
  selectedCard: null, // card index in hand currently selected
  pendingManaChoice: null, // { permanentId, colors }

  // ── MAIN RENDER ──

  renderGame(game) {
    if (!game) return;
    this.renderPhaseBar(game);
    this.renderLifeTotals(game);
    this.renderManaPool(game);
    this.renderOpponentArea(game);
    this.renderBattlefield(game.human, false);
    this.renderHand(game.human);
    this.renderCommandZone(game.human);
    this.renderActionButtons(game);
  },

  // ── PHASE BAR ──

  renderPhaseBar(game) {
    const phases = [
      { id: 'untap', label: 'Untap' },
      { id: 'upkeep', label: 'Upkeep' },
      { id: 'draw', label: 'Draw' },
      { id: 'main1', label: 'Main 1' },
      { id: 'combat', label: 'Combat' },
      { id: 'main2', label: 'Main 2' },
      { id: 'end', label: 'End' },
    ];

    const el = document.getElementById('phase-bar');
    if (!el) return;

    el.innerHTML = phases
      .map(
        (p) =>
          `<div class="phase-pip ${game.currentPhase === p.id ? 'active' : ''}">${p.label}</div>`
      )
      .join('');
  },

  // ── LIFE TOTALS ──

  renderLifeTotals(game) {
    const humanLife = document.getElementById('human-life');
    const oppLife = document.getElementById('opp-life');
    const turnInfo = document.getElementById('turn-info');

    if (humanLife) humanLife.textContent = game.human.life;
    if (oppLife) oppLife.textContent = game.opponent.life;
    if (turnInfo)
      turnInfo.textContent = `Turn ${game.turn} — ${game.isHumanTurn ? 'Your Turn' : "Opponent's Turn"}`;
  },

  // ── MANA POOL ──

  renderManaPool(game) {
    const el = document.getElementById('mana-pool');
    if (!el) return;

    const pool = game.human.manaPool;
    const colorSymbols = { W: '⬜', U: '🔵', B: '⚫', R: '🔴', G: '🟢', C: '◇' };
    const total = game.human.totalMana();

    let html = `<span class="mana-label">Mana:</span>`;

    if (total === 0) {
      html += `<span class="mana-empty">Empty</span>`;
    } else {
      for (const [color, amount] of Object.entries(pool)) {
        if (amount > 0) {
          for (let i = 0; i < amount; i++) {
            html += `<span class="mana-pip" title="${color}">${colorSymbols[color]}</span>`;
          }
        }
      }
    }

    el.innerHTML = html;
  },

  // ── OPPONENT AREA ──

  renderOpponentArea(game) {
    const el = document.getElementById('opp-battlefield');
    if (!el) return;

    const creatures = game.opponent.getCreatures();
    const lands = game.opponent.getLands();
    const handSize = game.opponent.hand.length;

    let html = `<div class="zone-label">Opponent — Hand: ${handSize} cards · Library: ${game.opponent.library.length}</div>`;

    // Opponent creatures
    if (creatures.length > 0) {
      html += `<div class="permanent-row">`;
      creatures.forEach((perm) => {
        const { power, toughness } = game.opponent.getEffectivePT(perm);
        html += `
          <div class="permanent opp-permanent ${perm.tapped ? 'tapped' : ''}">
            <div class="perm-name">${perm.card.name}</div>
            <div class="perm-pt">${power}/${toughness}</div>
            ${perm.counters.length > 0 ? `<div class="perm-counters">${perm.counters.join(', ')}</div>` : ''}
          </div>`;
      });
      html += `</div>`;
    }

    // Opponent lands
    if (lands.length > 0) {
      html += `<div class="permanent-row lands-row">`;
      lands.forEach((perm) => {
        html += `
          <div class="permanent land-perm opp-land ${perm.tapped ? 'tapped' : ''}">
            <div class="perm-name">${perm.card.name}</div>
          </div>`;
      });
      html += `</div>`;
    }

    el.innerHTML = html;
  },

  // ── HUMAN BATTLEFIELD ──

  renderBattlefield(humanPlayer, combatMode = false) {
    const el = document.getElementById('human-battlefield');
    if (!el) return;

    const creatures = humanPlayer.getCreatures();
    const lands = humanPlayer.getLands();
    const otherPerms = humanPlayer.battlefield.filter((p) => {
      const type = (p.card.type_line || '').toLowerCase();
      return !type.includes('creature') && !type.includes('land');
    });

    let html = `<div class="zone-label">Your Battlefield · Library: ${humanPlayer.library.length} · Graveyard: ${humanPlayer.graveyard.length}</div>`;

    // Non-creature permanents (enchantments, artifacts, planeswalkers)
    if (otherPerms.length > 0) {
      html += `<div class="permanent-row">`;
      otherPerms.forEach((perm) => {
        html += `
          <div class="permanent other-perm ${perm.tapped ? 'tapped' : ''}" onclick="GameUI.onPermanentClick('${perm.id}')">
            <div class="perm-name">${perm.card.name}</div>
            <div class="perm-type">${perm.card.type_line || ''}</div>
          </div>`;
      });
      html += `</div>`;
    }

    // Creatures
    if (creatures.length > 0) {
      html += `<div class="permanent-row">`;
      creatures.forEach((perm) => {
        const { power, toughness } = humanPlayer.getEffectivePT(perm);
        const isAttacker = combatMode && Combat.attackers.includes(perm.id);
        const canAttack = !perm.tapped && !perm.summoningSick;

        html += `
          <div class="permanent creature-perm 
            ${perm.tapped ? 'tapped' : ''} 
            ${perm.summoningSick ? 'sick' : ''}
            ${isAttacker ? 'attacking' : ''}
            ${combatMode && canAttack ? 'can-attack' : ''}"
            onclick="GameUI.onPermanentClick('${perm.id}')">
            <div class="perm-name">${perm.card.name}</div>
            <div class="perm-pt">${power}/${toughness}</div>
            ${perm.summoningSick ? '<div class="sick-label">Sick</div>' : ''}
            ${perm.isCommander ? '<div class="cmd-label">CMD</div>' : ''}
            ${perm.counters.length > 0 ? `<div class="perm-counters">${perm.counters.join(' ')}</div>` : ''}
          </div>`;
      });
      html += `</div>`;
    }

    // Lands
    if (lands.length > 0) {
      html += `<div class="permanent-row lands-row">`;
      lands.forEach((perm) => {
        html += `
          <div class="permanent land-perm ${perm.tapped ? 'tapped' : ''}"
            onclick="GameUI.onLandClick('${perm.id}')">
            <div class="perm-name">${perm.card.name}</div>
          </div>`;
      });
      html += `</div>`;
    }

    if (
      html ===
      `<div class="zone-label">Your Battlefield · Library: ${humanPlayer.library.length} · Graveyard: ${humanPlayer.graveyard.length}</div>`
    ) {
      html += `<p class="muted" style="padding:8px; font-size:12px">No permanents in play yet.</p>`;
    }

    el.innerHTML = html;
  },

  // ── HAND ──

  renderHand(humanPlayer) {
    const el = document.getElementById('human-hand');
    if (!el) return;

    if (humanPlayer.hand.length === 0) {
      el.innerHTML = '<p class="muted" style="padding:8px; font-size:12px">Hand is empty.</p>';
      return;
    }

    el.innerHTML = humanPlayer.hand
      .map((card, idx) => {
        const imgUrl = Scryfall.getArtUrl(card);
        const cost = Scryfall.formatManaCost(Scryfall.getManaCost(card));
        const type = card.type_line || '';
        const isSelected = this.selectedCard === idx;
        const cmc = card.cmc || 0;
        const canAfford = Game.human.totalMana() >= cmc;

        return `
        <div class="hand-card ${isSelected ? 'selected' : ''} ${!canAfford && cmc > 0 ? 'cant-afford' : ''}"
          onclick="GameUI.onHandCardClick(${idx})">
          ${imgUrl ? `<img class="hand-card-img" src="${imgUrl}" alt="${card.name}" loading="lazy">` : ''}
          <div class="hand-card-info">
            <div class="hand-card-name">${card.name}</div>
            <div class="hand-card-meta">${type} ${cost ? '· ' + cost : ''}</div>
          </div>
        </div>`;
      })
      .join('');
  },

  // ── COMMAND ZONE ──

  renderCommandZone(humanPlayer) {
    const el = document.getElementById('command-zone');
    if (!el) return;

    if (humanPlayer.commanders.length === 0) {
      el.innerHTML = '<p class="muted" style="font-size:12px">No commanders.</p>';
      return;
    }

    el.innerHTML = humanPlayer.commanders
      .map((commander, idx) => {
        const imgUrl = Scryfall.getArtUrl(commander);
        const tax = humanPlayer.commanderTax(commander.name);
        const totalCost = (commander.cmc || 0) + tax;
        const canAfford = humanPlayer.totalMana() >= totalCost;

        return `
        <div class="commander-card ${!canAfford ? 'cant-afford' : ''}"
          onclick="Game.castCommander(${idx})">
          ${imgUrl ? `<img class="cmd-art" src="${imgUrl}" alt="${commander.name}" loading="lazy">` : ''}
          <div class="cmd-info">
            <div class="cmd-name">${commander.name}</div>
            <div class="cmd-cost">Cost: ${totalCost}${tax > 0 ? ` (+${tax} tax)` : ''}</div>
          </div>
        </div>`;
      })
      .join('');
  },

  // ── ACTION BUTTONS ──

  renderActionButtons(game) {
    const el = document.getElementById('action-buttons');
    if (!el) return;

    const phase = game.currentPhase;
    const isMain = ['main1', 'main2'].includes(phase);
    const isCombat = phase === 'combat';

    let html = '';

    // Next Phase button (always available except in combat when attacking)
    const phaseNames = {
      untap: 'Untap',
      upkeep: 'Upkeep',
      draw: 'Draw',
      main1: 'Main Phase 1',
      combat: 'Combat',
      main2: 'Main Phase 2',
      end: 'End Step',
    };

    const phases = ['untap', 'upkeep', 'draw', 'main1', 'combat', 'main2', 'end'];
    const currentIdx = phases.indexOf(game.currentPhase);
    const nextPhase = phases[currentIdx + 1];
    const nextLabel = nextPhase ? phaseNames[nextPhase] : 'End Turn';
    const currentLabel = phaseNames[game.currentPhase] || game.currentPhase;

    html += `<button class="action-btn primary" onclick="Game.advancePhase()">
  ${currentLabel} → ${nextLabel}
</button>`;

    // Combat button
    if (game.isHumanTurn) {
      if (isCombat && Combat.phase === null) {
        html += `<button class="action-btn attack" onclick="Game.beginCombat()">
      ⚔ Declare Attackers
    </button>`;
      }

      // Confirm attackers button
      if (isCombat && Combat.phase === 'declare_attackers') {
        html += `<button class="action-btn attack" onclick="Combat.confirmAttackers(Game.human, Game.opponent)">
      ✓ Confirm Attackers (${Combat.attackers.length})
    </button>`;
        html += `<button class="action-btn" onclick="Combat.end()">
      Skip Combat
    </button>`;
      }
    }

    // Discard selected card
    if (this.selectedCard !== null) {
      const card = game.human.hand[this.selectedCard];
      if (card) {
        const type = (card.type_line || '').toLowerCase();
        const isLand = type.includes('land');

        if (isLand && isMain && game.human.canPlayLand()) {
          html += `<button class="action-btn land" onclick="Game.playLand(${this.selectedCard}); GameUI.selectedCard = null;">
            🌲 Play ${card.name}
          </button>`;
        } else if (!isLand && isMain) {
          html += `<button class="action-btn cast" onclick="Game.castSpell(${this.selectedCard}); GameUI.selectedCard = null;">
            ✨ Cast ${card.name} (${card.cmc || 0} mana)
          </button>`;
        }

        if (Game.currentPhase === 'end' && Game.human.hand.length > 7) {
          html += `<button class="action-btn discard" onclick="GameUI.discardCard(${this.selectedCard})">
    🗑 Discard ${card.name}
  </button>`;
        }
      }
    }

    el.innerHTML = html;
  },

  // ── CLICK HANDLERS ──

  onHandCardClick(idx) {
    if (this.selectedCard === idx) {
      this.selectedCard = null;
    } else {
      this.selectedCard = idx;

      // Preview the card
      const card = Game.human.hand[idx];
      if (card) this.previewGameCard(card);
    }
    GameUI.renderGame(Game);
  },

  onPermanentClick(permanentId) {
    // Only allow attacker selection on human's turn during combat
    if (Combat.phase === 'declare_attackers' && Game.isHumanTurn) {
      Combat.toggleAttacker(permanentId, Game.human);
      GameUI.renderGame(Game);
      return;
    }
    // Otherwise preview the card
    const perm = Game.human.battlefield.find((p) => p.id === permanentId);
    if (perm) this.previewGameCard(perm.card);
  },

  onLandClick(permanentId) {
    // In main phase, tap for mana
    if (['main1', 'main2', 'combat'].includes(Game.currentPhase)) {
      Game.tapLandForMana(permanentId);
    }
  },

  // ── CARD PREVIEW IN GAME ──

  previewGameCard(card) {
    const el = document.getElementById('game-card-preview');
    if (!el) return;

    const imgUrl = Scryfall.getImageUrl(card, 'normal');
    const oracle = Scryfall.getOracleText(card);

    el.innerHTML = `
      ${imgUrl ? `<img class="preview-img" src="${imgUrl}" alt="${card.name}">` : ''}
      <div class="preview-name">${card.name}</div>
      <div class="preview-type">${card.type_line || ''}</div>
      ${oracle ? `<div class="preview-text">${oracle.replace(/\n/g, '<br>')}</div>` : ''}
      ${card.power ? `<div class="preview-pt">${card.power} / ${card.toughness}</div>` : ''}
    `;
  },

  // ── DISCARD ──

  discardCard(idx) {
    const card = Game.human.hand[idx];
    if (!card) return;
    Game.human.hand.splice(idx, 1);
    Game.human.graveyard.push(card);
    GameLog.add(`You discard ${card.name}.`, 'action');
    this.selectedCard = null;
    GameUI.renderGame(Game);
  },

  // ── MULLIGAN SCREEN ──

  showMulligan(handSize) {
    const el = document.getElementById('mulligan-screen');
    const gameEl = document.getElementById('game-board');
    if (!el || !gameEl) return;

    el.classList.remove('hidden');
    gameEl.classList.add('hidden');

    // Render the hand
    const handEl = document.getElementById('mulligan-hand');
    if (handEl) {
      handEl.innerHTML = Game.human.hand
        .map((card) => {
          const imgUrl = Scryfall.getArtUrl(card);
          return `
          <div class="mulligan-card">
            ${imgUrl ? `<img src="${imgUrl}" alt="${card.name}" loading="lazy">` : ''}
            <div class="mulligan-card-name">${card.name}</div>
          </div>`;
        })
        .join('');
    }

    const infoEl = document.getElementById('mulligan-info');
    if (infoEl) {
      infoEl.textContent =
        Game.mulliganCount === 0
          ? 'This is your opening hand. Keep it or mulligan for a new 7?'
          : `Mulligan taken. This is your new hand of ${handSize}. Keep or mulligan again (${handSize - 1} cards next time)?`;
    }

    // Show/hide mulligan button based on hand size
    const mulliganBtn = document.getElementById('mulligan-btn');
    if (mulliganBtn) {
      mulliganBtn.disabled = handSize <= 1;
    }
  },

  acceptHand() {
    const el = document.getElementById('mulligan-screen');
    const gameEl = document.getElementById('game-board');
    if (el) el.classList.add('hidden');
    if (gameEl) gameEl.classList.remove('hidden');
    Game.acceptHand();
  },

  takeMulligan() {
    Game.takeMulligan();
  },

  // ── PHASE TIP ──

  showPhaseTip(phase) {
    const tip = PHASE_TIPS[phase];
    if (!tip) return;

    const el = document.getElementById('phase-tip');
    if (!el) return;

    el.innerHTML = `
      <div class="tip-title">${tip.title}</div>
      <div class="tip-text">${tip.text}</div>
    `;
    el.classList.remove('hidden');
  },

  // ── TRIGGER REMINDER ──

  showTriggerReminder(message) {
    const el = document.getElementById('trigger-reminder');
    if (!el) return;

    el.textContent = message;
    el.classList.remove('hidden');

    setTimeout(() => el.classList.add('hidden'), 6000);
  },

  // ── MANA CHOICE ──

  showManaChoice(permanentId, colors) {
    this.pendingManaChoice = { permanentId, colors };
    const el = document.getElementById('mana-choice');
    if (!el) return;

    const colorNames = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green', C: 'Colorless' };
    const colorSymbols = { W: '⬜', U: '🔵', B: '⚫', R: '🔴', G: '🟢', C: '◇' };

    el.innerHTML = `
      <div class="mana-choice-title">Choose mana color:</div>
      ${colors
        .map(
          (c) => `
        <button class="mana-choice-btn" onclick="GameUI.chooseMana('${c}')">
          ${colorSymbols[c]} ${colorNames[c]}
        </button>`
        )
        .join('')}
    `;
    el.classList.remove('hidden');
  },

  chooseMana(color) {
    if (!this.pendingManaChoice) return;
    const { permanentId } = this.pendingManaChoice;
    this.pendingManaChoice = null;

    const el = document.getElementById('mana-choice');
    if (el) el.classList.add('hidden');

    Game.tapLandForManaColor(permanentId, color);
  },

  // ── DISCARD PROMPT ──

  showDiscardPrompt() {
    GameLog.add('Select cards to discard down to 7.', 'warning');
    // Cards in hand are already clickable and show discard option when selected
  },

  // ── GAME OVER ──

  showGameOver(won) {
    const el = document.getElementById('game-over');
    if (!el) return;

    el.innerHTML = `
      <div class="game-over-inner">
        <div class="game-over-title">${won ? '🏆 You Win!' : '💀 You Lose'}</div>
        <div class="game-over-text">${won ? 'Congratulations!' : 'Better luck next time!'}</div>
        <button onclick="showPage('deck-builder')">Back to Deck Builder</button>
      </div>
    `;
    el.classList.remove('hidden');
  },
};
