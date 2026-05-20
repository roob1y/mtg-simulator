// ── SETTINGS ──
// Manages user preferences: beginner mode, auto-tap, etc.

const Settings = {
  defaults: {
    beginnerMode: true,
    autoTap: false,
    showGraveyard: true,
    confirmActions: true,
  },

  // Load from localStorage or use defaults
  load() {
    try {
      const saved = JSON.parse(localStorage.getItem('mtg_settings') || '{}');
      return { ...this.defaults, ...saved };
    } catch {
      return { ...this.defaults };
    }
  },

  // Save current settings
  save(settings) {
    localStorage.setItem('mtg_settings', JSON.stringify(settings));
  },

  // Get a single setting
  get(key) {
    return this.load()[key];
  },

  // Set a single setting
  set(key, value) {
    const settings = this.load();
    settings[key] = value;
    this.save(settings);
  },

  // Toggle a boolean setting
  toggle(key) {
    const current = this.get(key);
    this.set(key, !current);
    return !current;
  },
};

// ── BEGINNER MODE TIPS ──
// Explanations shown during each game phase when beginner mode is on

const PHASE_TIPS = {
  untap: {
    title: 'Untap Step',
    text: 'All your tapped permanents (lands, creatures, artifacts) untap and are ready to use again. This happens automatically at the start of each of your turns.',
  },
  upkeep: {
    title: 'Upkeep Step',
    text: 'Some cards trigger "at the beginning of your upkeep." Check your battlefield for any such effects. If none, just proceed to Draw.',
  },
  draw: {
    title: 'Draw Step',
    text: 'Draw one card from the top of your deck. You must draw unless an effect says otherwise. If your deck is empty and you need to draw, you lose the game.',
  },
  main1: {
    title: 'Main Phase 1',
    text: 'You can play one land from your hand, cast spells by paying their mana costs, and activate abilities. This is your main action phase before combat.',
  },
  combat: {
    title: 'Combat Phase',
    text: 'You may attack with any of your untapped creatures. Declare all attackers at once, then your opponent declares blockers. Unblocked creatures deal damage to the opponent directly.',
  },
  main2: {
    title: 'Main Phase 2',
    text: 'Another main phase after combat. Good for casting spells after seeing what happened in combat, or using mana you held back.',
  },
  end: {
    title: 'End Step',
    text: 'Some cards trigger "at the beginning of your end step." Check for those. Then discard down to 7 cards if you have more (hand size limit). Then your turn ends.',
  },
};

// ── TRIGGER REMINDERS ──
// Per-card reminders shown when relevant cards are on the battlefield

const TRIGGER_REMINDERS = {
  "Auntie Ool, Cursewretch": [
    { when: 'any_counter_placed', reminder: "🦂 Auntie Ool: If the counter went on YOUR creature, draw a card. If it went on an OPPONENT'S creature, they lose 1 life." },
  ],
  'Hapatra, Vizier of Poisons': [
    { when: 'any_counter_placed', reminder: '🐍 Hapatra: You cast a spell that placed -1/-1 counters — create a 1/1 Snake token with deathtouch!' },
  ],
  'Blowfly Infestation': [
    { when: 'countered_creature_dies', reminder: '🪰 Blowfly Infestation: A creature with a -1/-1 counter died — put a -1/-1 counter on target creature.' },
  ],
  'Flourishing Defenses': [
    { when: 'any_counter_placed', reminder: '🌿 Flourishing Defenses: A -1/-1 counter was placed — create a 1/1 Elf Warrior token!' },
  ],
  'The Scorpion God': [
    { when: 'countered_creature_dies', reminder: '🦂 The Scorpion God: A creature with a -1/-1 counter died — draw a card!' },
    { when: 'creature_dies', reminder: '🦂 The Scorpion God died — return it to your hand at the beginning of the next end step!' },
  ],
  'Grave Venerations': [
    { when: 'creature_dies', reminder: '⚰️ Grave Venerations: A creature you control died — each opponent loses 1 life and you gain 1 life.' },
  ],
  'Midnight Banshee': [
    { when: 'upkeep', reminder: '👻 Midnight Banshee: Beginning of your upkeep — put a -1/-1 counter on each nonblack creature.' },
  ],
  'Sinister Gnarlbark': [
    { when: 'end_step', reminder: '🌳 Sinister Gnarlbark: Beginning of your end step — draw a card and blight 1.' },
  ],
  'Evolution Sage': [
    { when: 'land_enters', reminder: '🌱 Evolution Sage: A land entered under your control — proliferate!' },
  ],
  'Oft-Nabbed Goat': [
    { when: 'opponent_activates', reminder: '🐐 Oft-Nabbed Goat: Opponent paid {1} — they draw a card, gain control of the Goat, and put a -1/-1 counter on it.' },
  ],
};
