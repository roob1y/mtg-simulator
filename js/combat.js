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

    this.attackers.forEach((attackerId) => {
      const attacker = humanPlayer.battlefield.find((p) => p.id === attackerId);
      if (!attacker) return;

      const { power: atkPower } = humanPlayer.getEffectivePT(attacker);

      // AI tries to block if it has a creature that survives
      const blocker = aiCreatures.find((b) => {
        const { power: blkPower, toughness: blkToughness } = opponent.getEffectivePT(b);
        const { toughness: atkToughness } = humanPlayer.getEffectivePT(attacker);

        // Block if blocker survives and kills the attacker
        const blockerSurvives = atkPower < blkToughness;
        const attackerDies = blkPower >= atkToughness;
        return blockerSurvives || attackerDies;
      });

      if (blocker) {
        this.blockers[attackerId] = [blocker.id];
        GameLog.add(
          `${opponent.name} blocks ${attacker.card.name} with ${blocker.card.name}.`,
          'combat'
        );
      } else {
        GameLog.add(`${attacker.card.name} is unblocked!`, 'combat');
      }
    });

    this.resolveDamage(humanPlayer, opponent);
  },

  // Resolve combat damage
  resolveDamage(humanPlayer, opponent) {
    let totalDamageToOpponent = 0;

    this.attackers.forEach((attackerId) => {
      const attacker = humanPlayer.battlefield.find((p) => p.id === attackerId);
      if (!attacker) return;

      const { power: atkPower, toughness: atkToughness } = humanPlayer.getEffectivePT(attacker);
      const blockerIds = this.blockers[attackerId] || [];

      if (blockerIds.length === 0) {
        // Unblocked — deals damage to opponent
        totalDamageToOpponent += atkPower;
        GameLog.add(
          `${attacker.card.name} deals ${atkPower} damage to ${opponent.name}.`,
          'combat'
        );
      } else {
        // Blocked — creatures deal damage to each other
        blockerIds.forEach((blockerId) => {
          const blocker = opponent.battlefield.find((p) => p.id === blockerId);
          if (!blocker) return;

          const { power: blkPower, toughness: blkToughness } = opponent.getEffectivePT(blocker);

          GameLog.add(
            `${attacker.card.name} (${atkPower}/${atkToughness}) vs ${blocker.card.name} (${blkPower}/${blkToughness}).`,
            'combat'
          );

          // Check for deathtouch
          const attackerHasDeathtouch = (attacker.card.keywords || []).includes('Deathtouch');
          const blockerHasDeathtouch = (blocker.card.keywords || []).includes('Deathtouch');

          // Attacker dies?
          if (blkPower >= atkToughness || blockerHasDeathtouch) {
            humanPlayer.sendToGraveyard(attackerId);
            GameLog.add(`${attacker.card.name} dies in combat.`, 'combat');
          }

          // Blocker dies?
          if (atkPower >= blkToughness || attackerHasDeathtouch) {
            opponent.sendToGraveyard(blockerId);
            GameLog.add(`${blocker.card.name} dies in combat.`, 'combat');
          }
        });
      }
    });

    // Apply damage to opponent
    if (totalDamageToOpponent > 0) {
      opponent.life -= totalDamageToOpponent;
      GameLog.add(
        `${opponent.name} takes ${totalDamageToOpponent} damage. Life: ${opponent.life}.`,
        'combat'
      );
    }

    // FIX: call end() which cleans up state; Game.advancePhase() is called
    // separately by the player clicking the Next Phase button AFTER combat ends.
    this.endCombatState();

    // Check win condition after damage
    Game.checkWinCondition();
    GameUI.renderGame(Game);
  },

  // FIX: Renamed from end() — cleans up combat state WITHOUT advancing the phase.
  // The player must click "Next Phase" to advance to main2.
  endCombatState() {
    this.attackers = [];
    this.blockers = {};
    this.phase = null;
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
