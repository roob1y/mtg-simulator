// ── GAME UI ──
// Renders the game board and handles game UI interactions.

const GameUI = {
  selectedCard: null,
  pendingManaChoice: null,
  pendingDraw: false,
  _lastHandKey: null,
  _lastBfKey: null,
  _lastOppBfKey: null,
  _contextMenuSuppressed: false,

  // ── MAIN RENDER ──

  renderGame(game) {
    if (!game) return;

    // Suppress context menu on touch devices globally for game board
    if (!this._contextMenuSuppressed) {
      const board = document.getElementById('game-board');
      if (board) {
        board.addEventListener(
          'contextmenu',
          (e) => {
            e.preventDefault();
            e.stopPropagation();
            return false;
          },
          { passive: false, capture: true }
        );
        this._contextMenuSuppressed = true;
      }
    }
    this.renderPhaseBar(game);
    this.renderLifeTotals(game);
    this.renderManaPool(game);
    this.renderOpponentArea(game);
    this.renderBattlefield(game.human, Combat.phase === 'declare_attackers');
    this.renderHand(game.human);
    this.renderCommandZone(game.human);
    this.renderActionButtons(game);
    this.renderGraveyard(game.human, game.opponent);
    this.renderExile(game.human);
    // Recalculate battlefield padding based on actual HUD heights
    requestAnimationFrame(() => {
      const topHud = document.getElementById('game-hud-top');
      const botHud = document.getElementById('game-hud-bottom');
      const bf = document.querySelector('.game-battlefield');
      if (bf && topHud && botHud) {
        bf.style.paddingTop = (topHud.offsetHeight + 4) + 'px';
        bf.style.paddingBottom = (botHud.offsetHeight + 16) + 'px';
      }
    });
    document
      .getElementById('game-board')
      ?.addEventListener('contextmenu', (e) => e.preventDefault());
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

  _prevHumanLife: null,
  _prevOppLife: null,

  renderLifeTotals(game) {
    const humanLife = document.getElementById('human-life');
    const oppLife = document.getElementById('opp-life');
    const turnInfo = document.getElementById('turn-info');

    if (humanLife) {
      const prev = this._prevHumanLife;
      humanLife.textContent = game.human.life;
      if (prev !== null && prev !== game.human.life) {
        humanLife.classList.remove('life-flash-damage', 'life-flash-gain');
        void humanLife.offsetWidth;
        humanLife.classList.add(game.human.life < prev ? 'life-flash-damage' : 'life-flash-gain');
        setTimeout(() => humanLife.classList.remove('life-flash-damage', 'life-flash-gain'), 600);
      }
      this._prevHumanLife = game.human.life;
    }

    if (oppLife) {
      const prev = this._prevOppLife;
      oppLife.textContent = game.opponent.life;
      if (prev !== null && prev !== game.opponent.life) {
        oppLife.classList.remove('life-flash-damage', 'life-flash-gain');
        void oppLife.offsetWidth;
        oppLife.classList.add(game.opponent.life < prev ? 'life-flash-damage' : 'life-flash-gain');
        setTimeout(() => oppLife.classList.remove('life-flash-damage', 'life-flash-gain'), 600);
      }
      this._prevOppLife = game.opponent.life;
    }

    if (turnInfo)
      turnInfo.textContent = `Turn ${game.turn} — ${game.isHumanTurn ? 'Your Turn' : "Opponent's Turn"}`;
  },

  // ── DRAWERS ──

  summariseCounters(counters) {
    const tally = {};
    counters.forEach(c => { tally[c] = (tally[c] || 0) + 1; });
    return Object.entries(tally).map(([type, count]) => {
      if (type === '+1/+1') return `+${count}/+${count}`;
      if (type === '-1/-1') return `-${count}/-${count}`;
      return count > 1 ? `${count}× ${type}` : type;
    }).join(', ');
  },

  toggleDrawer(drawerId) {
    const el = document.getElementById(drawerId);
    if (el) el.classList.toggle('is-open');
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
        const artUrl = Scryfall.getImageUrl(perm.card, 'normal');
        html += `
          <div class="permanent opp-permanent ${perm.tapped ? 'tapped' : ''}"
            onclick="GameUI.onPermanentClick('${perm.id}')"
            oncontextmenu="event.preventDefault()"
            onmousedown="GameUI.startPermanentLongPress('${perm.id}', event)"
            onmouseup="GameUI.cancelLongPress()"
            onmouseleave="GameUI.cancelLongPress()"
            ontouchstart="GameUI.startPermanentLongPress('${perm.id}', event)"
            ontouchend="GameUI.cancelLongPress()"
            ontouchmove="GameUI.cancelLongPress()">
            ${artUrl ? `<img class="perm-art" src="${artUrl}" alt="${Scryfall.getFrontFace(perm.card).name}">` : ''}
            <div class="perm-overlay">
              <div class="perm-name">${Scryfall.getFrontFace(perm.card).name}</div>
              <div class="perm-pt">${power}/${toughness}</div>
            </div>
            ${perm.counters.length > 0 ? `<div class="perm-counters">${GameUI.summariseCounters(perm.counters)}</div>` : ''}
          </div>`;
      });
      html += `</div>`;
    }

    if (lands.length > 0) {
      html += `<div class="permanent-row lands-row">`;
      lands.forEach((perm) => {
        const landArt = Scryfall.getImageUrl(perm.card, 'normal');
        html += `
          <div class="permanent land-perm opp-land ${perm.tapped ? 'tapped' : ''}"
            onclick="GameUI.onPermanentClick('${perm.id}')"
            oncontextmenu="event.preventDefault()"
            onmousedown="GameUI.startPermanentLongPress('${perm.id}', event)"
            onmouseup="GameUI.cancelLongPress()"
            onmouseleave="GameUI.cancelLongPress()"
            ontouchstart="GameUI.startPermanentLongPress('${perm.id}', event)"
            ontouchend="GameUI.cancelLongPress()"
            ontouchmove="GameUI.cancelLongPress()">
            ${landArt ? `<img class="perm-art" src="${landArt}" alt="${perm.card.name}">` : ''}
            <div class="perm-overlay">
              <div class="perm-name">${perm.card.name}</div>
            </div>
          </div>`;
      });
      html += `</div>`;
    }

    el.innerHTML = html;

    // Animate new permanents in
    const oppBfKey = game.opponent.battlefield.map((p) => p.id).join(',');
    if (oppBfKey !== this._lastOppBfKey) {
      const lastCount = this._lastOppBfKey ? this._lastOppBfKey.split(',').length : 0;
      const perms = el.querySelectorAll('.permanent');
      const newPerms = Array.from(perms).slice(lastCount);
      if (newPerms.length > 0) {
        gsap.fromTo(
          newPerms,
          { scale: 0, opacity: 0 },
          {
            scale: 1,
            opacity: 1,
            duration: 0.2,
            stagger: 0.03,
            ease: 'back.out(1.6)',
            clearProps: 'transform',
          }
        );
      }
    }
    this._lastOppBfKey = oppBfKey;
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
        const artUrl = Scryfall.getImageUrl(perm.card, 'normal');
        const loyalty = perm.card.loyalty || Scryfall.getFrontFace(perm.card).loyalty;
        const isPlaneswalker = (perm.card.type_line || '').toLowerCase().includes('planeswalker');
        html += `
          <div class="permanent other-perm ${perm.tapped ? 'tapped' : ''}"
            onclick="GameUI.onArtifactClick('${perm.id}')"
            onmousedown="GameUI.startPermanentLongPress('${perm.id}', event)"
            onmouseup="GameUI.cancelLongPress()"
            onmouseleave="GameUI.cancelLongPress()"
            ontouchstart="GameUI.startPermanentLongPress('${perm.id}', event)"
            ontouchend="GameUI.cancelLongPress()"
            ontouchmove="GameUI.cancelLongPress()">
            ${artUrl ? `<img class="perm-art" src="${artUrl}" alt="${Scryfall.getFrontFace(perm.card).name}">` : ''}
            ${perm.counters.length > 0 ? `<div class="perm-counters">${GameUI.summariseCounters(perm.counters)}</div>` : ''}
            ${isPlaneswalker && loyalty ? `<div class="perm-loyalty">${loyalty}</div>` : ''}
            <div class="perm-overlay">
              <div class="perm-name">${Scryfall.getFrontFace(perm.card).name}</div>
            </div>
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
        const artUrl = Scryfall.getImageUrl(perm.card, 'normal');
        const isCreature = (perm.card.type_line || '').toLowerCase().includes('creature');

        html += `
          <div class="permanent creature-perm 
            ${perm.tapped ? 'tapped' : ''} 
            ${perm.summoningSick ? 'sick' : ''}
            ${isAttacker ? 'attacking' : ''}
            ${combatMode && canAttack ? 'can-attack' : ''}"
            onclick="GameUI.onPermanentClick('${perm.id}')" oncontextmenu="event.preventDefault()" onmousedown="GameUI.startPermanentLongPress('${perm.id}', event)" onmouseup="GameUI.cancelLongPress()" onmouseleave="GameUI.cancelLongPress()" ontouchstart="GameUI.startPermanentLongPress('${perm.id}', event)" ontouchend="GameUI.cancelLongPress()" ontouchmove="GameUI.cancelLongPress()">
            ${artUrl ? `<img class="perm-art" src="${artUrl}" alt="${Scryfall.getFrontFace(perm.card).name}">` : ''}
            ${perm.summoningSick ? '<div class="sick-label">Sick</div>' : ''}
            ${perm.isCommander ? '<div class="cmd-label">CMD</div>' : ''}
            ${perm.counters.length > 0 ? `<div class="perm-counters">${GameUI.summariseCounters(perm.counters)}</div>` : ''}
          </div>`;
      });
      html += `</div>`;
    }

    if (lands.length > 0) {
      html += `<div class="permanent-row lands-row">`;
      lands.forEach((perm) => {
        const landArt = Scryfall.getImageUrl(perm.card, 'normal');
        html += `
          <div class="permanent land-perm ${perm.tapped ? 'tapped' : ''}"
            onclick="GameUI.onLandClick('${perm.id}')"
            oncontextmenu="event.preventDefault()"
            onmousedown="GameUI._landPressStart = Date.now(); GameUI.startPermanentLongPress('${perm.id}', event)"
            onmouseup="GameUI.cancelLongPress()"
            onmouseleave="GameUI.cancelLongPress()"
            ontouchstart="GameUI.startPermanentLongPress('${perm.id}', event)"
            ontouchend="GameUI.cancelLongPress()"
            ontouchmove="GameUI.cancelLongPress()">
            ${landArt ? `<img class="perm-art" src="${landArt}" alt="${perm.card.name}">` : ''}
            <div class="perm-overlay">
              <div class="perm-name">${perm.card.name}</div>
            </div>
            ${perm.canUntap && perm.tapped ? `<div class="sick-label" onclick="event.stopPropagation(); GameUI.untapLand(${perm.id})">↺ Undo</div>` : ''}
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

    // Animate permanents in
    const bfKey = Game.human.battlefield.map((p) => p.id).join(',');
    if (bfKey !== this._lastBfKey) {
      const lastCount = this._lastBfKey ? this._lastBfKey.split(',').length : 0;
      const perms = el.querySelectorAll('.permanent');
      const newPerms = Array.from(perms).slice(lastCount);
      if (newPerms.length > 0) {
        gsap.fromTo(
          newPerms,
          { scale: 0, opacity: 0 },
          {
            scale: 1,
            opacity: 1,
            duration: 0.2,
            stagger: 0.03,
            ease: 'back.out(1.6)',
            clearProps: 'transform',
          }
        );
      }
    }
    this._lastBfKey = bfKey;
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
        const face = Scryfall.getFrontFace(card);
        const type = face.type_line || '';
        const isSelected = this.selectedCard === idx;
        const cmc = card.cmc || 0;
        const canAfford = Game.canAffordCard(card);

        const isLand = (face.type_line || '').toLowerCase().includes('land');
        const affordClass = canAfford && !isLand && ['main1','main2'].includes(Game.currentPhase) ? 'can-afford' : '';
        return `
        <div class="hand-card ${isSelected ? 'selected' : ''} ${!canAfford && cmc > 0 ? 'cant-afford' : ''} ${affordClass}"
          onclick="GameUI.handleHandCardTap(${idx})"
          oncontextmenu="event.preventDefault(); GameUI.previewGameCard(Game.human.hand[${idx}])"
          onmousedown="GameUI.startHandLongPress(${idx})"
          onmouseup="GameUI.cancelLongPress()"
          onmouseleave="GameUI.cancelLongPress()"
          ontouchstart="GameUI.startHandLongPress(${idx})"
          ontouchend="GameUI.cancelLongPress()"
          ontouchmove="GameUI.cancelLongPress()">
          ${imgUrl ? `<img class="hand-card-img" src="${imgUrl}" alt="${card.name}" loading="lazy">` : ''}
          <div class="hand-card-info">
            <div class="hand-card-name">${face.name}</div>
            <div class="hand-card-meta">${type} ${cost ? '· ' + cost : ''}</div>
          </div>
        </div>`;
      })
      .join('');

    // Animate only newly added cards
    const handKey = humanPlayer.hand.map((c) => c.id || c.name).join(',');
    if (handKey !== this._lastHandKey) {
      const lastCount = this._lastHandKey ? this._lastHandKey.split(',').length : 0;
      const currentCount = humanPlayer.hand.length;
      const handCards = el.querySelectorAll('.hand-card');

      if (currentCount > lastCount) {
        // Cards were added — animate only the new ones at the end
        const newCards = Array.from(handCards).slice(lastCount);
        if (newCards.length > 0) {
          gsap.fromTo(
            newCards,
            { y: 40, opacity: 0, scale: 0.85 },
            {
              y: 0,
              opacity: 1,
              scale: 1,
              duration: 0.25,
              stagger: 0.05,
              ease: 'back.out(1.4)',
              clearProps: 'transform',
            }
          );
        }
      }
    }
    this._lastHandKey = handKey;
  },

  // ── COMMAND ZONE ──

  renderCommandZone(humanPlayer) {
    const el = document.getElementById('command-zone');
    if (!el) return;

    if (humanPlayer.commanders.length === 0) {
      el.innerHTML = '<p class="muted" style="font-size:12px">No commanders.</p>';
      return;
    }

    // Sort: main commanders first, backgrounds last
    const sorted = [...humanPlayer.commanders].sort((a, b) => {
      const aIsBackground = (a.type_line || '').toLowerCase().includes('background');
      const bIsBackground = (b.type_line || '').toLowerCase().includes('background');
      if (aIsBackground && !bIsBackground) return 1;
      if (!aIsBackground && bIsBackground) return -1;
      return 0;
    });

    el.innerHTML = sorted
      .map((commander, idx) => {
        // Find real index for casting
        const realIdx = humanPlayer.commanders.indexOf(commander);
        const imgUrl = Scryfall.getArtUrl(commander);
        const tax = humanPlayer.commanderTax(commander.name);
        const totalCost = (commander.cmc || 0) + tax;
        const canAfford = Game.human.totalMana() >= totalCost;

        return `
        <div class="commander-card ${!canAfford ? 'cant-afford' : ''}"
          onclick="Game.castCommander(${realIdx})">
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

    const isCommander = Game.human.commanderNames.has(card.name);
    const confirmed = confirm(
      `Return ${card.name} to the battlefield?\n\n` +
        `⚠️ Only do this if you have a spell or ability that allows it (e.g. a reanimate spell).\n\n` +
        `${isCreature ? '📋 Note: This creature will have summoning sickness and cannot attack this turn.\n\n' : ''}` +
        `${isCommander ? '👑 Commander note: Reanimating from graveyard does NOT count as casting from the command zone — no commander tax applies. However your tax counter still increases next time you cast from the command zone.' : ''}`
    );

    if (!confirmed) return;

    Game.human.graveyard.splice(graveyardIdx, 1);
    Game.human.battlefield.push({
      card,
      tapped: false,
      counters: [],
      summoningSick: isCreature,
      isCommander: Game.human.commanderNames.has(card.name),
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
      .map((card, idx) => {
        const imgUrl = Scryfall.getArtUrl(card);
        return `
  <div class="hand-card" onclick="GameUI.previewGameCard(Game.human.exile[${idx}])">
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
            const canAffordMDFC = Game.canAffordCard(card);
            html += `<button class="action-btn cast" onclick="Game.castSpell(${this.selectedCard})" ${!canAffordMDFC ? 'disabled title="Not enough mana"' : ''}>
      ✨ Cast ${spellFace.name} (${cmc} mana)${!canAffordMDFC ? ' 🔒' : ''}
    </button>`;
          }
        } else if (isLand && isMain && game.human.canPlayLand()) {
          html += `<button class="action-btn land" onclick="Game.playLand(${this.selectedCard})">
    🌲 Play ${card.name}
  </button>`;
        } else if (!isLand && isMain) {
          const canAfford = Game.canAffordCard(card);
          html += `<button class="action-btn cast" onclick="Game.castSpell(${this.selectedCard})" ${!canAfford ? 'disabled title="Not enough mana"' : ''}>
    ✨ Cast ${card.name} (${card.cmc || 0} mana)${!canAfford ? ' 🔒' : ''}
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
    if (window.innerWidth <= 768) {
      html += `<button class="action-btn" onclick="GameUI.toggleMobileLog()">📋 Log</button>`;
    }

    el.innerHTML = html;
  },

  // ── CLICK HANDLERS ──

  onHandCardClick(idx) {
    if (this.selectedCard === idx) {
      this.selectedCard = null;
    } else {
      this.selectedCard = idx;
    }
    GameUI.renderGame(Game);
  },

  onPermanentClick(permanentId) {
    const id = isNaN(permanentId) ? permanentId : Number(permanentId);

    if (Combat.phase === 'declare_attackers' && Game.isHumanTurn) {
      Combat.toggleAttacker(id, Game.human);
      GameUI.renderGame(Game);
      return;
    }
  },

  onPermanentRightClick(permanentId, event) {
    event.preventDefault();
    event.stopPropagation();
    if (window.innerWidth <= 768) return;

    const id = isNaN(permanentId) ? permanentId : Number(permanentId);

    const oppPerm = Game.opponent.battlefield.find((p) => p.id === id);
    if (oppPerm) {
      this.previewGameCard(oppPerm.card);
      return;
    }

    const ownPerm = Game.human.battlefield.find((p) => p.id === id);
    if (ownPerm) {
      this.previewGameCard(ownPerm.card, id);
    }
  },

  placeCounter(permanentId, counterType) {
    const id = isNaN(permanentId) ? permanentId : Number(permanentId);
    const perm =
      Game.human.battlefield.find((p) => p.id === id) ||
      Game.opponent.battlefield.find((p) => p.id === id);
    if (!perm) return;

    perm.counters.push(counterType);

    // MTG rule: +1/+1 and -1/-1 counters cancel each other out
    let pos = perm.counters.filter((c) => c === '+1/+1').length;
    let neg = perm.counters.filter((c) => c === '-1/-1').length;
    if (pos > 0 && neg > 0) {
      const cancel = Math.min(pos, neg);
      for (let i = 0; i < cancel; i++) {
        perm.counters.splice(perm.counters.indexOf('+1/+1'), 1);
        perm.counters.splice(perm.counters.indexOf('-1/-1'), 1);
      }
      GameLog.add(
        `${cancel} +1/+1 and -1/-1 counter(s) cancelled out on ${perm.card.name}.`,
        'action'
      );
    } else {
      GameLog.add(`Placed ${counterType} counter on ${perm.card.name}.`, 'action');
    }

    Game.checkTriggers('any_counter_placed');
    GameUI.renderGame(Game);
    this.previewGameCard(perm.card, id);
  },

  removeAllCounters(permanentId) {
    const id = isNaN(permanentId) ? permanentId : Number(permanentId);
    const perm =
      Game.human.battlefield.find((p) => p.id === id) ||
      Game.opponent.battlefield.find((p) => p.id === id);
    if (!perm || perm.counters.length === 0) return;

    perm.counters = [];
    GameLog.add(`Removed all counters from ${perm.card.name}.`, 'action');

    GameUI.renderGame(Game);
    this.previewGameCard(perm.card, id);
  },

  confirmCounters(permanentId) {
    const id = isNaN(permanentId) ? permanentId : Number(permanentId);
    const owner = Game.human.battlefield.find((p) => p.id === id) ? Game.human : Game.opponent;
    const perm = owner.battlefield.find((p) => p.id === id);

    owner.checkStateBasedActions();

    if (!owner.battlefield.find((p) => p.id === id)) {
      GameLog.add(`${perm.card.name} died from counter effects.`, 'action');
    }

    document.getElementById('card-preview-modal').classList.add('hidden');
    GameUI.renderGame(Game);
  },

  onLandClick(permanentId) {
    // If mouse was held for 300ms+ it was a long press — don't tap
    if (this._landPressStart && Date.now() - this._landPressStart >= 300) {
      this._landPressStart = null;
      return;
    }
    this._landPressStart = null;
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
    const colorToRemove = perm.chosenColor || Game.getLandColors(perm.card)[0];
    Game.human.manaPool[colorToRemove] = Math.max(0, Game.human.manaPool[colorToRemove] - 1);
    perm.chosenColor = null;
    const manaChoice = document.getElementById('mana-choice');
    if (manaChoice) manaChoice.classList.add('hidden');
    this.pendingManaChoice = null;
    GameLog.add(`Untapped ${perm.card.name} (undo).`, 'action');
    GameUI.renderGame(Game);
  },

  // ── CARD PREVIEW IN GAME ──

  previewGameCard(card, permanentId = null) {
    const isMobile = window.innerWidth <= 768;

    const imgUrl = Scryfall.getImageUrl(card, 'border_crop');
    const oracle = Scryfall.getOracleText(card);
    const cost = Scryfall.formatManaCost(Scryfall.getManaCost(card));
    const loyalty = card.loyalty ? `Loyalty: ${card.loyalty}` : '';

    // Check if this is own permanent and build counter controls
    let counterHtml = '';
    if (permanentId !== null) {
      const id = isNaN(permanentId) ? permanentId : Number(permanentId);
      const perm =
        Game.human.battlefield.find((p) => p.id === id) ||
        Game.opponent.battlefield.find((p) => p.id === id);
      const isCreature = perm && (perm.card.type_line || '').toLowerCase().includes('creature');
      if (perm && isCreature) {
        const counters = perm.counters || [];
        const negCount = counters.filter((c) => c === '-1/-1').length;
        const posCount = counters.filter((c) => c === '+1/+1').length;
        counterHtml = `
          <div class="preview-counters">
            <div class="preview-counter-label">${posCount === 0 && negCount === 0 ? 'No counters' : [posCount > 0 ? `+${posCount}/+${posCount}` : '', negCount > 0 ? `-${negCount}/-${negCount}` : ''].filter(Boolean).join(' · ')}</div>
            <div class="preview-counter-btns">
              <button onclick="GameUI.placeCounter(${id}, '+1/+1')">+ +1/+1</button>
              <button onclick="GameUI.placeCounter(${id}, '-1/-1')">− -1/-1</button>
              ${counters.length > 0 ? `<button onclick="GameUI.removeAllCounters(${id})">✕ Remove All</button>` : ''}
              ${counters.length > 0 ? `<button onclick="GameUI.confirmCounters(${id})" style="border-color: var(--accent); color: var(--accent);">✓ Confirm</button>` : ''}
            </div>
          </div>`;
      }
    }

    const html = `
      ${imgUrl ? `<img class="preview-img" src="${imgUrl}" alt="${card.name}">` : ''}
      <div class="preview-name">${card.name}</div>
      <div class="preview-type">${card.type_line || ''}</div>
      ${cost ? `<div class="preview-cost">${cost}</div>` : ''}
      ${oracle ? `<div class="preview-text">${oracle.replace(/\n/g, '<br>')}</div>` : ''}
      ${card.power ? `<div class="preview-pt">${card.power} / ${card.toughness}</div>` : ''}
      ${loyalty ? `<div class="preview-pt">${loyalty}</div>` : ''}
      ${counterHtml}
    `;

    document.getElementById('card-preview-modal-content').innerHTML = html;
    document.getElementById('card-preview-modal').classList.remove('hidden');

    if (!isMobile) {
      const el = document.getElementById('game-card-preview');
      if (el) el.innerHTML = html;
    }
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

    const colorNames = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green', C: 'Colorless' };
    const colorSymbols = { W: '⬜', U: '🔵', B: '⚫', R: '🔴', G: '🟢', C: '◇' };

    const html = `
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

    // Always use modal for mana choice
    document.getElementById('card-preview-modal-content').innerHTML = html;
    document.getElementById('card-preview-modal').classList.remove('hidden');

    // Also update sidebar for desktop
    const el = document.getElementById('mana-choice');
    if (el) {
      el.innerHTML = html;
      el.classList.remove('hidden');
    }
  },

  chooseMana(color) {
    if (!this.pendingManaChoice) return;
    const { permanentId } = this.pendingManaChoice;
    this.pendingManaChoice = null;

    const el = document.getElementById('mana-choice');
    if (el) el.classList.add('hidden');

    document.getElementById('card-preview-modal').classList.add('hidden');

    Game.tapLandForManaColor(permanentId, color);
  },

  // ── DISCARD PROMPT ──

  showDiscardPrompt() {
    const over = Game.human.hand.length - Game.human.maxHandSize;
    GameLog.add(
      `⚠ You have ${Game.human.hand.length} cards — discard ${over} card${over > 1 ? 's' : ''} before ending your turn. Click a card in your hand then click Discard.`,
      'warning'
    );
  },

  // ── GAME OVER ──

  showGameOver(won) {
    const el = document.getElementById('game-over');
    if (!el) return;

    el.innerHTML = `
      <div class="game-over-inner">
        <div class="game-over-title">${won ? '🏆 You Win!' : '💀 You Lose'}</div>
        <div class="game-over-text">${won ? 'Congratulations!' : 'Better luck next time!'}</div>
        <button onclick="abandonGame()">Back to Deck Builder</button>
      </div>
    `;
    el.classList.remove('hidden');
  },
  handleHandCardTap(idx) {
    this.cancelLongPress();
    const now = Date.now();
    if (this._lastTap && now - this._lastTap < 300 && this._lastTapIdx === idx) {
      const card = Game.human.hand[idx];
      if (card) this.previewGameCard(card);
      this._lastTap = null;
    } else {
      this._lastTap = now;
      this._lastTapIdx = idx;
      this.onHandCardClick(idx);
    }
  },

  flashHandCard(idx, type) {
    const handCards = document.querySelectorAll('#human-hand .hand-card');
    const el = handCards[idx];
    if (!el) return;
    const cls = type === 'land' ? 'flash-land' : 'flash-cast';
    // Force reflow before adding class to ensure animation triggers fresh
    el.classList.remove('flash-cast', 'flash-land');
    void el.offsetWidth;
    el.classList.add(cls);
  },
  startPermanentLongPress(permanentId, event) {
    this._longPressTimer = setTimeout(() => {
      const id = isNaN(permanentId) ? permanentId : Number(permanentId);
      const perm =
        Game.human.battlefield.find((p) => p.id === id) ||
        Game.opponent.battlefield.find((p) => p.id === id);
      if (perm) this.previewGameCard(perm.card, id);
    }, 300);
  },

  cancelLongPress() {
    if (this._longPressTimer) {
      clearTimeout(this._longPressTimer);
      this._longPressTimer = null;
    }
  },
  toggleMobileLog() {
    const drawer = document.getElementById('mobile-log-drawer');
    const toggle = document.getElementById('mobile-log-toggle');
    if (!drawer) return;

    const isHidden = drawer.classList.contains('hidden');
    drawer.classList.toggle('hidden');
    if (toggle) toggle.textContent = isHidden ? '▼' : '▲';

    // Sync log entries
    if (isHidden) {
      const entries = document.getElementById('game-log-entries');
      const mobileEntries = document.getElementById('mobile-log-entries');
      if (entries && mobileEntries) {
        mobileEntries.innerHTML = entries.innerHTML;
        mobileEntries.scrollTop = mobileEntries.scrollHeight;
      }
    }
  },
  startHandLongPress(idx) {
    this._longPressTimer = setTimeout(() => {
      const card = Game.human.hand[idx];
      if (card) this.previewGameCard(card);
    }, 300);
  },
};
