const OpponentMidrange = {
  name: 'Midrange Bot',
  description: 'Plays efficient threats, values good trades, and attacks opportunistically.',

  attack(player, humanPlayer) {
    const attackers = player.getUntappedCreatures();
    if (attackers.length === 0) return;

    const humanBlockers = humanPlayer.getUntappedCreatures();

    // Filter to only creatures that can attack profitably
    // A creature attacks if it kills a blocker without dying, or is unblocked
    const profitableAttackers = attackers.filter((attacker) => {
      const { power: atkPwr, toughness: atkTgh } = player.getEffectivePT(attacker);

      // Find the best blocker the human would assign
      const worstCase = humanBlockers.find((b) => {
        const { power: blkPwr } = humanPlayer.getEffectivePT(b);
        return blkPwr >= atkTgh; // this blocker kills our attacker
      });

      if (!worstCase) return true; // no blocker kills it — attack

      // Would we kill their blocker too? If so it's a trade — midrange accepts trades
      const { toughness: blkTgh } = humanPlayer.getEffectivePT(worstCase);
      return atkPwr >= blkTgh;
    });

    if (profitableAttackers.length === 0) {
      GameLog.add(`${player.name} sees no profitable attacks.`, 'combat');
      return;
    }

    GameLog.add(`${player.name} attacks with ${profitableAttackers.length} creature(s)!`, 'combat');

    profitableAttackers.forEach((perm) => {
      perm.tapped = true;
    });

    const assignments = {};
    const usedBlockers = new Set();

    profitableAttackers.forEach((attacker) => {
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
        GameLog.add(`You block ${attacker.card.name} with ${blocker.card.name}.`, 'combat');
      } else {
        assignments[attacker.id] = null;
      }
    });

    let totalDamageToHuman = 0;

    profitableAttackers.forEach((attacker) => {
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
      { name: 'Tarmogoyf', qty: 3 },
      { name: 'Siege Rhino', qty: 3 },
      { name: 'Tireless Tracker', qty: 3 },
      { name: 'Courser of Kruphix', qty: 3 },
      { name: 'Bloodbraid Elf', qty: 3 },
      { name: 'Obstinate Baloth', qty: 2 },
      { name: 'Thragtusk', qty: 2 },
      { name: 'Huntmaster of the Fells', qty: 2 },
      { name: 'Lingering Souls', qty: 2 },
      { name: 'Forest', qty: 10 },
      { name: 'Plains', qty: 8 },
      { name: 'Swamp', qty: 8 },
      { name: 'Overgrown Tomb', qty: 2 },
      { name: 'Temple Garden', qty: 2 },
    ];
  },
};
