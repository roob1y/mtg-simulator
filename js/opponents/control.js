const OpponentControl = {
  name: 'Control Bot',
  description: 'Plays defensively, removes threats, and only attacks when ahead.',

  attack(player, humanPlayer) {
    // Control only attacks if it has more total power than the human has toughness
    const attackers = player.getUntappedCreatures();
    if (attackers.length === 0) return;

    const totalAttackPower = attackers.reduce((sum, p) => sum + player.getEffectivePT(p).power, 0);
    const humanTotalToughness = humanPlayer
      .getCreatures()
      .reduce((sum, p) => sum + humanPlayer.getEffectivePT(p).toughness, 0);

    // Only attack if we can push through meaningful damage or human has no blockers
    const humanBlockers = humanPlayer.getUntappedCreatures();
    if (humanBlockers.length > 0 && totalAttackPower <= humanTotalToughness) {
      GameLog.add(`${player.name} holds back, waiting for a better attack.`, 'combat');
      return;
    }

    GameLog.add(`${player.name} attacks with ${attackers.length} creature(s)!`, 'combat');

    attackers.forEach((perm) => {
      perm.tapped = true;
    });

    const assignments = {};
    const usedBlockers = new Set();

    attackers.forEach((attacker) => {
      const { power: atkPwr } = player.getEffectivePT(attacker);
      const blocker = humanBlockers.find((b) => {
        if (usedBlockers.has(b.id)) return false;
        const { power: blkPwr, toughness: blkTgh } = humanPlayer.getEffectivePT(b);
        const { toughness: atkTgh } = player.getEffectivePT(attacker);
        return blkPwr >= atkTgh || atkPwr < blkTgh;
      });

      if (blocker) {
        assignments[attacker.id] = blocker.id;
        usedBlockers.add(blocker.id);
        humanPlayer.tap(blocker.id);
        GameLog.add(`You block ${attacker.card.name} with ${blocker.card.name}.`, 'combat');
      } else {
        assignments[attacker.id] = null;
      }
    });

    let totalDamageToHuman = 0;

    attackers.forEach((attacker) => {
      const { power: atkPwr, toughness: atkTgh } = player.getEffectivePT(attacker);
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

        if (blkPwr >= atkTgh) {
          player.sendToGraveyard(attacker.id);
          GameLog.add(`${attacker.card.name} dies.`, 'combat');
        }
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

    Game.checkWinCondition();
  },

  getDeckList() {
    return [
      { name: 'Wall of Omens', qty: 3 },
      { name: 'Fog Bank', qty: 3 },
      { name: "Nevinyrral's Disk", qty: 2 },
      { name: 'Mulldrifter', qty: 3 },
      { name: 'Counterspell', qty: 3 },
      { name: 'Wrath of God', qty: 2 },
      { name: 'Day of Judgment', qty: 2 },
      { name: 'Sun Titan', qty: 2 },
      { name: 'Sphinx of Jwar Isle', qty: 2 },
      { name: 'Consecrated Sphinx', qty: 1 },
      { name: 'Plains', qty: 18 },
      { name: 'Island', qty: 17 },
    ];
  },
};
