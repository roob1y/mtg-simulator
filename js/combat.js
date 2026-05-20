// ── COMBAT ──
// Handles the combat phase: declare attackers, declare blockers, damage.

const Combat = {
  attackers: [], // array of permanent ids
  blockers: {}, // { attackerId: blockerId[] }
  phase: null, // 'declare_attackers' | 'declare_blockers' | 'damage' | null

  // Start combat phase
  begin(humanPlayer) {
    this.attackers = [];
    this.blockers = {};
    this.phase = 'declare_attackers';
    GameLog.add('⚔ Combat phase begins. Declare your attackers.', 'combat');
    this.renderAttackerSelection(humanPlayer);
  },

  // Toggle a creature as an attacker
  toggleAttacker(permanentId, humanPlayer) {
    const id = isNaN(permanentId) ? permanentId : Number(permanentId);
    const perm = humanPlayer.battlefield.find((p) => p.id === id);
    if (!perm) return;

    const type = (perm.card.type_line || '').toLowerCase();
    if (!type.includes('creature')) return;
    if (perm.tapped || perm.summoningSick) {
      GameLog.add(`${perm.card.name} can't attack (tapped or summoning sickness).`, 'warning');
      return;
    }

    const idx = this.attackers.indexOf(id);
    if (idx === -1) {
      this.attackers.push(id);
      GameLog.add(`${perm.card.name} declared as attacker.`, 'combat');
    } else {
      this.attackers.splice(idx, 1);
      GameLog.add(`${perm.card.name} removed from attackers.`, 'combat');
    }

    this.renderAttackerSelection(humanPlayer);
  },

  // Confirm attackers, move to declare blockers (AI phase)
  confirmAttackers(humanPlayer, opponent) {
    if (this.attackers.length === 0) {
      GameLog.add('No attackers declared. Skipping combat.', 'combat');
      this.end();
      return;
    }

    // Tap attacking creatures
    this.attackers.forEach((id) => {
      humanPlayer.tap(id);
    });

    GameLog.add(`${this.attackers.length} creature(s) attacking!`, 'combat');

    // AI declares blockers
    this.phase = 'damage';
    this.aiDeclareBlockers(humanPlayer, opponent);
  },

  // Simple AI blocker logic
  aiDeclareBlockers(humanPlayer, opponent) {
    const aiCreatures = opponent.getUntappedCreatures();
    const usedBlockerIds = new Set();

    // First pass — assign one blocker per attacker where possible
    this.attackers.forEach((attackerId) => {
      const attacker = humanPlayer.battlefield.find((p) => p.id === attackerId);
      if (!attacker) return;

      const { power: atkPower, toughness: atkToughness } = humanPlayer.getEffectivePT(attacker);

      const blocker = aiCreatures.find((b) => {
        if (usedBlockerIds.has(b.id)) return false;
        const { power: blkPower, toughness: blkToughness } = opponent.getEffectivePT(b);
        const blockerSurvives = atkPower < blkToughness;
        const attackerDies = blkPower >= atkToughness;
        return blockerSurvives || attackerDies;
      });

      if (blocker) {
        this.blockers[attackerId] = [blocker.id];
        usedBlockerIds.add(blocker.id);
        opponent.tap(blocker.id);
        GameLog.add(
          `${opponent.name} blocks ${attacker.card.name} with ${blocker.card.name}.`,
          'combat'
        );
      } else {
        this.blockers[attackerId] = [];
        GameLog.add(`${attacker.card.name} is unblocked!`, 'combat');
      }
    });

    // Second pass — gang block any attacker that the first blocker can't kill alone
    this.attackers.forEach((attackerId) => {
      const attacker = humanPlayer.battlefield.find((p) => p.id === attackerId);
      if (!attacker) return;

      const { power: atkPower, toughness: atkToughness } = humanPlayer.getEffectivePT(attacker);
      const assignedBlockers = this.blockers[attackerId] || [];
      if (assignedBlockers.length === 0) return; // unblocked — don't pile on

      // Check if current blockers can kill the attacker
      const totalBlkPower = assignedBlockers.reduce((sum, bid) => {
        const b = opponent.battlefield.find((p) => p.id === bid);
        if (!b) return sum;
        return sum + opponent.getEffectivePT(b).power;
      }, 0);

      if (totalBlkPower >= atkToughness) return; // already lethal — no need for more

      // Assign additional blockers until lethal or no blockers left
      for (const b of aiCreatures) {
        if (usedBlockerIds.has(b.id)) continue;
        const { power: blkPower } = opponent.getEffectivePT(b);
        this.blockers[attackerId].push(b.id);
        usedBlockerIds.add(b.id);
        opponent.tap(b.id);
        GameLog.add(
          `${opponent.name} also blocks ${attacker.card.name} with ${b.card.name}.`,
          'combat'
        );

        const newTotal = this.blockers[attackerId].reduce((sum, bid) => {
          const bp = opponent.battlefield.find((p) => p.id === bid);
          if (!bp) return sum;
          return sum + opponent.getEffectivePT(bp).power;
        }, 0);

        if (newTotal >= atkToughness) break; // now lethal — stop adding blockers
      }
    });

    this.resolveDamage(humanPlayer, opponent);
  },

  // Resolve combat damage
  resolveDamage(humanPlayer, opponent) {
    GameLog.add('⚔ Resolving combat damage...', 'combat');

    const hasFirstStrike = (perm) => {
      const keywords = perm.card.keywords || [];
      return keywords.includes('First strike') || keywords.includes('Double strike');
    };

    const hasDoubleStrike = (perm) => {
      return (perm.card.keywords || []).includes('Double strike');
    };

    // ── FIRST STRIKE DAMAGE ──
    const firstStrikeAttackers = this.attackers.filter((id) => {
      const a = humanPlayer.battlefield.find((p) => p.id === id);
      return a && hasFirstStrike(a);
    });

    const firstStrikeBlockers = new Set();
    this.attackers.forEach((attackerId) => {
      (this.blockers[attackerId] || []).forEach((blockerId) => {
        const b = opponent.battlefield.find((p) => p.id === blockerId);
        if (b && hasFirstStrike(b)) firstStrikeBlockers.add(blockerId);
      });
    });

    if (firstStrikeAttackers.length > 0 || firstStrikeBlockers.size > 0) {
      GameLog.add('⚡ First strike damage step.', 'combat');
      this._resolveDamageStep(humanPlayer, opponent, true, hasFirstStrike, hasDoubleStrike);
    }

    // ── NORMAL DAMAGE ──
    GameLog.add('Normal damage step.', 'combat');
    this._resolveDamageStep(humanPlayer, opponent, false, hasFirstStrike, hasDoubleStrike);

    GameLog.add('Combat damage resolved.', 'combat');
    this.endCombatState();
    Game.checkWinCondition();
    GameUI.renderGame(Game);
  },

  _resolveDamageStep(humanPlayer, opponent, firstStrikeStep, hasFirstStrike, hasDoubleStrike) {
    let totalDamageToOpponent = 0;

    this.attackers.forEach((attackerId) => {
      const attacker = humanPlayer.battlefield.find((p) => p.id === attackerId);
      if (!attacker) return;

      const attackerIsFS = hasFirstStrike(attacker);
      const attackerIsDS = hasDoubleStrike(attacker);
      const attackerDealsNow = firstStrikeStep
        ? attackerIsFS || attackerIsDS
        : !attackerIsFS || attackerIsDS;

      const { power: atkPower, toughness: atkToughness } = humanPlayer.getEffectivePT(attacker);
      const attackerHasDeathtouch = (attacker.card.keywords || []).includes('Deathtouch');
      const attackerHasTrample = (attacker.card.keywords || []).includes('Trample');
      const blockerIds = this.blockers[attackerId] || [];

      if (blockerIds.length === 0) {
        // Unblocked
        if (attackerDealsNow) {
          totalDamageToOpponent += atkPower;
          GameLog.add(
            `➤ ${attacker.card.name} is unblocked — deals ${atkPower} damage to ${opponent.name}.`,
            'combat'
          );
        }
      } else {
        // Blocked — calculate trample excess
        let damageAssigned = 0;
        let trampleDamage = 0;

        blockerIds.forEach((blockerId) => {
          const blocker = opponent.battlefield.find((p) => p.id === blockerId);
          if (!blocker) return;

          const blockerIsFS = hasFirstStrike(blocker);
          const blockerIsDS = hasDoubleStrike(blocker);
          const blockerDealsNow = firstStrikeStep
            ? blockerIsFS || blockerIsDS
            : !blockerIsFS || blockerIsDS;

          const { power: blkPower, toughness: blkToughness } = opponent.getEffectivePT(blocker);
          const blockerHasDeathtouch = (blocker.card.keywords || []).includes('Deathtouch');

          GameLog.add(
            `➤ ${attacker.card.name} (${atkPower}/${atkToughness}) vs ${blocker.card.name} (${blkPower}/${blkToughness}).`,
            'combat'
          );

          const attackerDies =
            blockerDealsNow && (blkPower >= atkToughness || blockerHasDeathtouch);
          const blockerDies =
            attackerDealsNow && (atkPower >= blkToughness || attackerHasDeathtouch);

          // Track damage needed to kill this blocker for trample calculation
          if (attackerDealsNow) {
            const damageNeeded = attackerHasDeathtouch ? 1 : blkToughness;
            damageAssigned += damageNeeded;
          }

          if (attackerDies && blockerDies) {
            GameLog.add(`✖ Both die.`, 'combat');
            humanPlayer.sendToGraveyard(attackerId);
            opponent.sendToGraveyard(blockerId);
          } else if (attackerDies) {
            GameLog.add(`✖ ${attacker.card.name} dies. ${blocker.card.name} survives.`, 'combat');
            humanPlayer.sendToGraveyard(attackerId);
          } else if (blockerDies) {
            GameLog.add(`✖ ${blocker.card.name} dies. ${attacker.card.name} survives.`, 'combat');
            opponent.sendToGraveyard(blockerId);
          } else {
            GameLog.add(`◇ Neither dies.`, 'combat');
          }
        });

        // Trample excess damage
        if (attackerDealsNow && attackerHasTrample) {
          trampleDamage = Math.max(0, atkPower - damageAssigned);
          if (trampleDamage > 0) {
            totalDamageToOpponent += trampleDamage;
            GameLog.add(
              `🐾 ${attacker.card.name} tramples — ${trampleDamage} excess damage to ${opponent.name}.`,
              'combat'
            );
          }
        }
      }
    });

    if (totalDamageToOpponent > 0) {
      opponent.life -= totalDamageToOpponent;
      GameLog.add(
        `💥 ${opponent.name} takes ${totalDamageToOpponent} damage — life total: ${opponent.life}.`,
        'combat'
      );
    }
  },

  // FIX: Renamed from end() — cleans up combat state WITHOUT advancing the phase.
  // The player must click "Next Phase" to advance to main2.
  endCombatState() {
    this.attackers = [];
    this.blockers = {};
    this.phase = 'done';
    GameLog.add('Combat phase ends. Proceed to Main Phase 2.', 'combat');
  },

  // Skip combat entirely (called from Skip Combat button)
  end() {
    this.endCombatState();
    GameUI.renderGame(Game);
    // Do NOT advance phase here — player uses the Next Phase button
  },

  // Render attacker selection UI
  renderAttackerSelection(humanPlayer) {
    GameUI.renderBattlefield(humanPlayer, true);
    GameUI.renderActionButtons(Game);
  },
};
