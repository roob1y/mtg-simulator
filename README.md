# MTG Simulator

A browser-based Magic: The Gathering deck builder and simulator.

## Project Structure

```
mtg-simulator/
├── index.html              # Main entry point
├── css/
│   └── style.css           # All styling
├── js/
│   ├── scryfall.js         # Scryfall API integration
│   ├── deck.js             # Deck management (add/remove/save/load/validate)
│   ├── main.js             # UI logic and interactions
│   └── opponents/          # AI opponent scripts (Phase 3)
│       ├── aggro.js        # Aggro opponent (coming Phase 3)
│       └── control.js      # Control opponent (coming Phase 3)
└── data/
    └── decks/              # Exported deck JSON files (future)
```

## How to Run

Just open `index.html` in any browser. No server needed.
Requires internet connection for Scryfall card images and search.

## Phases

### Phase 1 — Deck Builder (COMPLETE)

- Search cards via Scryfall API
- Add/remove cards from deck
- Card preview with full art and oracle text
- Deck validation (100 cards, commander check, land count warning)
- Save/load multiple decks via localStorage
- Color identity tracking

### Phase 2 — Game Engine (IN PROGRESS)

- Shuffle and draw opening hand
- Play lands and cast spells
- Track battlefield, hand, graveyard, exile, commander zone
- Life total tracking
- Turn phases (untap, upkeep, draw, main, combat, end)
- Mana pool tracking
- Basic combat — declare attackers and blockers

### Phase 3 — Simulated Opponent (PLANNED)

- Scripted AI opponents with different play styles
- Aggro opponent — floods board with cheap creatures
- Control opponent — plays removal and board wipes
- Expandable — add new opponent scripts easily

### Phase 4 — UI Redesign (PLANNED)

- Full visual redesign, dark MTG theme
- Card animations and hover effects
- Mobile optimisation

### Phase 5 — The Stack (PLANNED)

- Priority passing
- Instant speed responses
- Counterspells

### Phase 6 — Keywords (PLANNED)

- Automatic handling of deathtouch, lifelink, trample, flying etc

### Phase 7 — Triggers (PLANNED)

- Automatic trigger detection for common card effects

### Phase 8 — Full Rules Compliance (PLANNED)

- Layers system
- Replacement effects
- State based actions

Create a new file in `js/opponents/` following this template:

```javascript
const OpponentAggro = {
  name: 'Aggressive Bot',
  description: 'Floods the board with cheap creatures',
  deck: [
    /* card names */
  ],
  // play logic...
};
```

## Card Data

All card data comes from the free Scryfall API (https://scryfall.com).
No API key required.
