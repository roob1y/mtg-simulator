const OpponentAggro = {
  name: 'Aggro Bot',
  description: 'Floods the board with cheap creatures and attacks every turn.',

  attack(player, humanPlayer) {
    const attackers = player.getUntappedCreatures();
    if (attackers.length === 0) return;

    GameLog.add(`${player.name} attacks with ${attackers.length} creature(s)!`, 'combat');

    attackers.forEach((perm) => {
      perm.tapped = true;
    });

    const humanBlockers = humanPlayer.getUntappedCreatures();
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
      { name: 'Llanowar Elves', qty: 3 },
      { name: 'Elvish Mystic', qty: 3 },
      { name: 'Runeclaw Bear', qty: 3 },
      { name: 'Centaur Courser', qty: 3 },
      { name: 'Kalonian Tusker', qty: 3 },
      { name: 'Deadly Recluse', qty: 2 },
      { name: 'Charging Rhino', qty: 2 },
      { name: 'Serra Angel', qty: 2 },
      { name: 'Silvercoat Lion', qty: 3 },
      { name: 'Lone Missionary', qty: 3 },
      { name: 'Attended Knight', qty: 2 },
      { name: 'Siege Mastodon', qty: 2 },
      { name: 'Forest', qty: 17 },
      { name: 'Plains', qty: 16 },
    ];
  },
};
