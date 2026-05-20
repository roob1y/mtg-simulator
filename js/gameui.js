// ── GAME UI ──
// Renders the game board and handles game UI interactions.

const GameUI = {
  selectedCard: null, // card index in hand currently selected
  pendingManaChoice: null, // { permanentId, colors }
  pendingDraw: false,

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
    this.renderGraveyard(game.human, game.opponent);
    this.renderExile(game.human);
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

    if (creatures.length > 0) {
      html += `<div class="permanent-row">`;
      creatures.forEach((perm) => {
        const { power, toughness } = game.opponent.getEffectivePT(perm);
        html += `
            <div class="permanent opp-permanent ${perm.tapped ? 'tapped' : ''}" onclick="GameUI.onPermanentClick('${perm.id}')" oncontextmenu="GameUI.onPermanentRightClick('${perm.id}', event)">
            <div class="perm-name">${perm.card.name}</div>
            <div class="perm-pt">${power}/${toughness}</div>
            ${perm.counters.length > 0 ? `<div class="perm-counters">${perm.counters.join(', ')}</div>` : ''}
          </div>`;
      });
      html += `</div>`;
    }

    if (lands.length > 0) {
      html += `<div class="permanent-row lands-row">`;
      lands.forEach((perm) => {
        html += `
            <div class="permanent land-perm opp-land ${perm.tapped ? 'tapped' : ''}" onclick="GameUI.onPermanentClick('${perm.id}')">
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

    if (otherPerms.length > 0) {
      html += `<div class="permanent-row">`;
      otherPerms.forEach((perm) => {
        html += `
          <div class="permanent other-perm ${perm.tapped ? 'tapped' : ''}" onclick="GameUI.onArtifactClick('${perm.id}')">
            <div class="perm-name">${perm.card.name}</div>
            <div class="perm-type">${perm.card.type_line || ''}</div>
          </div>`;
      });
      html += `</div>`;
    }

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
            onclick="GameUI.onPermanentClick('${perm.id}')" oncontextmenu="GameUI.onPermanentRightClick('${perm.id}', event)">
            <div class="perm-name">${perm.card.name}</div>
            <div class="perm-pt">${power}/${toughness}</div>
            ${perm.summoningSick ? '<div class="sick-label">Sick</div>' : ''}
            ${perm.isCommander ? '<div class="cmd-label">CMD</div>' : ''}
            ${perm.counters.length > 0 ? `<div class="perm-counters">${perm.counters.join(' ')}</div>` : ''}
          </div>`;
      });
      html += `</div>`;
    }

    if (lands.length > 0) {
      html += `<div class="permanent-row lands-row">`;
      lands.forEach((perm) => {
        html += `
          <div class="permanent land-perm ${perm.tapped ? 'tapped' : ''}"
            onclick="GameUI.onLandClick('${perm.id}')">
            <div class="perm-name">${perm.card.name}</div>
            ${perm.canUntap && perm.tapped ? '<div class="sick-label" onclick="event.stopPropagation(); GameUI.untapLand(' + perm.id + ')">↺ Undo</div>' : ''}
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
        const canAfford = Game.canAffordCard(card);

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
        const canAfford = Game.canAffordCard(commander);
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

  renderGraveyard(humanPlayer, opponent) {
    // Human graveyard
    const el = document.getElementById('graveyard-list');
    const countEl = document.getElementById('graveyard-count');
    if (el) {
      if (countEl) countEl.textContent = humanPlayer.graveyard.length;
      if (humanPlayer.graveyard.length === 0) {
        el.innerHTML = '<p class="muted" style="font-size:12px">Empty.</p>';
      } else {
        el.innerHTML = humanPlayer.graveyard
          .map((card, idx) => {
            const imgUrl = Scryfall.getArtUrl(card);
            const safeName = card.name.replace(/'/g, "\\'");
            return `
          <div class="hand-card" onclick="GameUI.previewGameCard(Game.human.graveyard[${idx}])">
            ${imgUrl ? `<img class="hand-card-img" src="${imgUrl}" alt="${card.name}" loading="lazy">` : ''}
            <div class="hand-card-info">
              <div class="hand-card-name">${card.name}</div>
              <div class="hand-card-meta">${card.type_line || ''}</div>
              ${
                ['main1', 'main2', 'end'].includes(Game.currentPhase)
                  ? `
              <div style="display:flex; gap:4px; margin-top:4px; flex-wrap:wrap;">
                <button onclick="event.stopPropagation(); GameUI.returnToHand(${idx})" 
                  style="font-size:9px; padding:2px 6px; background:#0a1a0a; border:1px solid #2a4a2a; color:#8c8; cursor:pointer; font-family:monospace;">
                  ↩ Hand
                </button>
                <button onclick="event.stopPropagation(); GameUI.returnToBattlefield(${idx})"
                  style="font-size:9px; padding:2px 6px; background:#0a0a1a; border:1px solid #2a2a4a; color:#88c; cursor:pointer; font-family:monospace;">
                  ↑ Battlefield
                </button>
              </div>`
                  : ''
              }
            </div>
          </div>`;
          })
          .join('');
      }
    }

    // Opponent graveyard
    const oppEl = document.getElementById('opp-graveyard-list');
    const oppCountEl = document.getElementById('opp-graveyard-count');
    if (oppEl) {
      if (oppCountEl) oppCountEl.textContent = opponent.graveyard.length;
      if (opponent.graveyard.length === 0) {
        oppEl.innerHTML = '<p class="muted" style="font-size:12px">Empty.</p>';
      } else {
        oppEl.innerHTML = opponent.graveyard
          .map((card, idx) => {
            const imgUrl = Scryfall.getArtUrl(card);
            return `
          <div class="hand-card" onclick="GameUI.previewGameCard(Game.opponent.graveyard[${idx}])">
            ${imgUrl ? `<img class="hand-card-img" src="${imgUrl}" alt="${card.name}" loading="lazy">` : ''}
            <div class="hand-card-info">
              <div class="hand-card-name">${card.name}</div>
              <div class="hand-card-meta">${card.type_line || ''}</div>
            </div>
          </div>`;
          })
          .join('');
      }
    }
  },

  returnToHand(graveyardIdx) {
    const card = Game.human.graveyard[graveyardIdx];
    if (!card) return;

    const confirmed = confirm(
      `Return ${card.name} to your hand?\n\n` +
        `⚠️ Only do this if you have a spell or ability that allows it (e.g. Scorpion God's death trigger).`
    );

    if (!confirmed) return;

    Game.human.graveyard.splice(graveyardIdx, 1);
    Game.human.hand.push(card);
    GameLog.add(`${card.name} returned to hand from graveyard.`, 'action');
    GameUI.renderGame(Game);
  },

  returnToBattlefield(graveyardIdx) {
    const card = Game.human.graveyard[graveyardIdx];
    if (!card) return;

    const type = (card.type_line || '').toLowerCase();
    const isCreature = type.includes('creature');

    const confirmed = confirm(
      `Return ${card.name} to the battlefield?\n\n` +
        `⚠️ Only do this if you have a spell or ability that allows it (e.g. a reanimate spell).\n\n` +
        `${isCreature ? '📋 Note: This creature will have summoning sickness and cannot attack this turn.' : ''}`
    );

    if (!confirmed) return;

    Game.human.graveyard.splice(graveyardIdx, 1);
    Game.human.battlefield.push({
      card,
      tapped: false,
      counters: [],
      summoningSick: isCreature,
      id: nextPermId(),
    });
    GameLog.add(`${card.name} returned to battlefield from graveyard.`, 'action');
    GameUI.renderGame(Game);
  },

  renderExile(humanPlayer) {
    const el = document.getElementById('exile-list');
    const countEl = document.getElementById('exile-count');
    if (!el) return;

    if (countEl) countEl.textContent = humanPlayer.exile.length;

    if (humanPlayer.exile.length === 0) {
      el.innerHTML = '<p class="muted" style="font-size:12px">Empty.</p>';
      return;
    }

    el.innerHTML = humanPlayer.exile
      .map((card) => {
        const imgUrl = Scryfall.getArtUrl(card);
        return `
        <div class="hand-card" onclick="GameUI.previewGameCard(${JSON.stringify(card).replace(/"/g, '&quot;')})">
          ${imgUrl ? `<img class="hand-card-img" src="${imgUrl}" alt="${card.name}" loading="lazy">` : ''}
          <div class="hand-card-info">
            <div class="hand-card-name">${card.name}</div>
            <div class="hand-card-meta">${card.type_line || ''}</div>
          </div>
        </div>`;
      })
      .join('');
  },

  // ── ACTION BUTTONS ──

  renderActionButtons(game) {
    const el = document.getElementById('action-buttons');
    if (!el) return;

    // FIX: use local `phase` variable consistently — no Game.currentPhase reference
    const phase = game.currentPhase;
    const isMain = ['main1', 'main2'].includes(phase);
    const isCombat = phase === 'combat';

    let html = '';

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
    const currentIdx = phases.indexOf(phase);
    const nextPhase = phases[currentIdx + 1];
    const nextLabel = nextPhase ? phaseNames[nextPhase] : 'End Turn';
    const currentLabel = phaseNames[phase] || phase;

    // Don't show Next Phase during active attacker declaration
    if (!(isCombat && Combat.phase === 'declare_attackers')) {
      html += `<button class="action-btn primary" onclick="Game.advancePhase()">
        ${currentLabel} → ${nextLabel}
      </button>`;
      if (this.pendingDraw) {
        html += `<button class="action-btn" onclick="Game.human.draw(1); GameLog.add('You draw a card (triggered effect).', 'action'); GameUI.pendingDraw = false; GameUI.renderGame(Game);">
    🃏 Draw a Card
  </button>`;
      }
    }

    // Combat buttons
    if (game.isHumanTurn) {
      if (isCombat && Combat.phase === null) {
        html += `<button class="action-btn attack" onclick="Game.beginCombat()">
          ⚔ Declare Attackers
        </button>`;
      }

      if (isCombat && Combat.phase === 'declare_attackers') {
        html += `<button class="action-btn attack" onclick="Combat.confirmAttackers(Game.human, Game.opponent)">
          ✓ Confirm Attackers (${Combat.attackers.length})
        </button>`;
        html += `<button class="action-btn" onclick="Combat.end()">
          Skip Combat
        </button>`;
      }
    }

    // Actions for selected hand card
    if (this.selectedCard !== null) {
      const card = game.human.hand[this.selectedCard];
      if (card) {
        const type = (card.type_line || '').toLowerCase();
        const isLand = type.includes('land');

        if (Scryfall.isMDFC(card) && isMain) {
          const landFace = Scryfall.getMDFCLandFace(card);
          const spellFace = Scryfall.getMDFCSpellFace(card);
          if (landFace && game.human.canPlayLand()) {
            html += `<button class="action-btn land" onclick="Game.playMDFCLand(${this.selectedCard})">
      🌲 Play ${landFace.name}
    </button>`;
          }
          if (spellFace) {
            const cmc = card.cmc || 0;
            html += `<button class="action-btn cast" onclick="Game.castSpell(${this.selectedCard})">
      ✨ Cast ${spellFace.name} (${cmc} mana)
    </button>`;
          }
        } else if (isLand && isMain && game.human.canPlayLand()) {
          html += `<button class="action-btn land" onclick="Game.playLand(${this.selectedCard})">
    🌲 Play ${card.name}
  </button>`;
        } else if (!isLand && isMain) {
          html += `<button class="action-btn cast" onclick="Game.castSpell(${this.selectedCard})">
    ✨ Cast ${card.name} (${card.cmc || 0} mana)
  </button>`;
        }

        // FIX: use local phase variable, not Game.currentPhase
        if (phase === 'end' && game.human.hand.length > game.human.maxHandSize) {
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

      const card = Game.human.hand[idx];
      if (card) this.previewGameCard(card);
    }
    GameUI.renderGame(Game);
  },

  onPermanentClick(permanentId) {
    console.log('onPermanentClick called', permanentId);
    const id = isNaN(permanentId) ? permanentId : Number(permanentId);

    if (Combat.phase === 'declare_attackers' && Game.isHumanTurn) {
      Combat.toggleAttacker(id, Game.human);
      GameUI.renderGame(Game);
      return;
    }

    const perm =
      Game.human.battlefield.find((p) => p.id === id) ||
      Game.opponent.battlefield.find((p) => p.id === id);
    console.log('preview lookup', id, perm);
    if (perm) this.previewGameCard(perm.card);
  },

  onPermanentRightClick(permanentId, event) {
    event.preventDefault();
    const id = isNaN(permanentId) ? permanentId : Number(permanentId);
    const perm =
      Game.human.battlefield.find((p) => p.id === id) ||
      Game.opponent.battlefield.find((p) => p.id === id);
    if (!perm) return;

    this.showCounterMenu(perm, id);
  },

  showCounterMenu(perm, id) {
    // Remove any existing menu
    const existing = document.getElementById('counter-menu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.id = 'counter-menu';
    menu.style.cssText = `
    position: fixed;
    background: #1a1a2a;
    border: 1px solid #4a4a8a;
    border-radius: 4px;
    padding: 8px;
    z-index: 300;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-family: monospace;
    font-size: 12px;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  `;

    const counters = perm.counters || [];
    const negCount = counters.filter((c) => c === '-1/-1').length;
    const posCount = counters.filter((c) => c === '+1/+1').length;

    menu.innerHTML = `
    <div style="color:#888; margin-bottom:4px; font-size:11px">
      ${perm.card.name}<br>
      Counters: ${posCount > 0 ? posCount + 'x +1/+1 ' : ''}${negCount > 0 ? negCount + 'x -1/-1' : ''}${posCount === 0 && negCount === 0 ? 'none' : ''}
    </div>
    <button onclick="GameUI.placeCounter(${id}, '+1/+1')" style="background:#0a1a0a;border:1px solid #2a4a2a;color:#8c8;padding:6px;cursor:pointer;font-family:monospace">+ Place +1/+1</button>
    <button onclick="GameUI.placeCounter(${id}, '-1/-1')" style="background:#1a0a0a;border:1px solid #4a2a2a;color:#c88;padding:6px;cursor:pointer;font-family:monospace">− Place -1/-1</button>
    ${counters.length > 0 ? `<button onclick="GameUI.removeLastCounter(${id})" style="background:#1a1a1a;border:1px solid #333;color:#888;padding:6px;cursor:pointer;font-family:monospace">✕ Remove last counter</button>` : ''}
    <button onclick="document.getElementById('counter-menu').remove()" style="background:#111;border:1px solid #222;color:#555;padding:4px;cursor:pointer;font-family:monospace;margin-top:2px">Cancel</button>
  `;

    document.body.appendChild(menu);

    // Close on outside click
    setTimeout(() => {
      document.addEventListener('click', function handler(e) {
        if (!menu.contains(e.target)) {
          menu.remove();
          document.removeEventListener('click', handler);
        }
      });
    }, 0);
  },

  placeCounter(permanentId, counterType) {
    const id = isNaN(permanentId) ? permanentId : Number(permanentId);
    const perm =
      Game.human.battlefield.find((p) => p.id === id) ||
      Game.opponent.battlefield.find((p) => p.id === id);
    if (!perm) return;

    perm.counters.push(counterType);
    GameLog.add(`Placed ${counterType} counter on ${perm.card.name}.`, 'action');

    const existing = document.getElementById('counter-menu');
    if (existing) existing.remove();

    // Check if creature dies
    const owner = Game.human.battlefield.find((p) => p.id === id) ? Game.human : Game.opponent;
    owner.checkStateBasedActions();

    // Fire trigger reminders
    Game.checkTriggers('any_counter_placed');

    GameUI.renderGame(Game);
  },

  removeLastCounter(permanentId) {
    const id = isNaN(permanentId) ? permanentId : Number(permanentId);
    const perm =
      Game.human.battlefield.find((p) => p.id === id) ||
      Game.opponent.battlefield.find((p) => p.id === id);
    if (!perm || perm.counters.length === 0) return;

    const removed = perm.counters.pop();
    GameLog.add(`Removed ${removed} counter from ${perm.card.name}.`, 'action');

    const existing = document.getElementById('counter-menu');
    if (existing) existing.remove();

    GameUI.renderGame(Game);
  },

  onLandClick(permanentId) {
    const id = isNaN(permanentId) ? permanentId : Number(permanentId);
    const perm = Game.human.battlefield.find((p) => p.id === id);

    if (['main1', 'main2', 'combat'].includes(Game.currentPhase)) {
      if (perm && perm.tapped && perm.canUntap) {
        this.untapLand(id);
      } else {
        Game.tapLandForMana(permanentId);
      }
    } else {
      if (perm) this.previewGameCard(perm.card);
    }
  },
  onArtifactClick(permanentId) {
    const id = isNaN(permanentId) ? permanentId : Number(permanentId);
    const perm = Game.human.battlefield.find((p) => p.id === id);
    if (!perm) return;

    // Beginner mode undo
    if (perm.tapped && perm.canUntap && Settings.get('beginnerMode')) {
      Game.untapArtifact(id);
      return;
    }

    const type = (perm.card.type_line || '').toLowerCase();
    if (!type.includes('artifact')) {
      this.previewGameCard(perm.card);
      return;
    }

    // Check if artifact taps for mana (like Sol Ring)
    const oracle = (perm.card.oracle_text || '').toLowerCase();
    if (oracle.includes('{t}') && oracle.includes('add') && !perm.tapped) {
      Game.tapArtifactForMana(id);
    } else {
      this.previewGameCard(perm.card);
    }
  },
  untapLand(permanentId) {
    const id = isNaN(permanentId) ? permanentId : Number(permanentId);
    const perm = Game.human.battlefield.find((p) => p.id === id);
    if (!perm || !perm.canUntap) return;
    perm.tapped = false;
    perm.canUntap = false;
    // Remove the mana that was added
    const colors = Game.getLandColors(perm.card);
    if (colors.length === 1) {
      Game.human.manaPool[colors[0]] = Math.max(0, Game.human.manaPool[colors[0]] - 1);
    }
    GameLog.add(`Untapped ${perm.card.name} (undo).`, 'action');
    GameUI.renderGame(Game);
  },

  // ── CARD PREVIEW IN GAME ──

  previewGameCard(card) {
    const el = document.getElementById('game-card-preview');
    console.log('preview el', el, 'imgUrl', Scryfall.getImageUrl(card, 'normal'));
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

    const mulliganBtn = document.getElementById('mulligan-btn');
    if (mulliganBtn) {
      mulliganBtn.disabled = handSize <= 1;
    }
  },

  acceptHand() {
    const el = document.getElementById('mulligan-screen');
    const gameEl = document.getElementById('game-board');
    if (el) el.classList.add('hidden');
    // FIX: ensure game-board is shown
    if (gameEl) gameEl.classList.remove('hidden');
    Game.acceptHand();
  },

  takeMulligan() {
    Game.takeMulligan();
  },

  // ── PHASE TIP ──

  // FIX: always update and show the tip (clear-then-set pattern)
  showPhaseTip(phase) {
    const tip = PHASE_TIPS[phase];
    const el = document.getElementById('phase-tip');
    if (!el) return;

    if (!tip) {
      el.classList.add('hidden');
      return;
    }

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

    if (message.toLowerCase().includes('draw a card')) {
      GameUI.pendingDraw = true;
    }

    const entry = document.createElement('div');
    entry.style.cssText =
      'padding: 6px 0; border-bottom: 1px solid #3a3a1a; display:flex; justify-content:space-between; align-items:flex-start; gap:8px;';
    entry.innerHTML = `
    <span style="flex:1; line-height:1.5">${message}</span>
    <button onclick="this.parentElement.remove(); const el=document.getElementById('trigger-reminder'); if(el.children.length===0) el.classList.add('hidden'); GameUI.renderGame(Game);"
      style="background:none; border:none; color:#555; cursor:pointer; font-size:14px; padding:0; flex-shrink:0;">✕</button>
  `;

    el.classList.remove('hidden');
    el.appendChild(entry);
    GameUI.renderGame(Game);
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
    GameLog.add('Select a card in your hand and click Discard to reduce to 7.', 'warning');
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
