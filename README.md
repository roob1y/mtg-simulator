Now let's update the README. Here's the updated version reflecting Phase 3 complete:
markdown# MTG Simulator

A browser-based Magic: The Gathering deck builder and simulator.

## Project Structure

mtg-simulator/
├── index.html # Main entry point
├── css/
│ ├── style.css # Deck builder styling
│ └── game.css # Game board styling
├── js/
│ ├── scryfall.js # Scryfall API integration
│ ├── deck.js # Deck management (add/remove/save/load/validate) + AIDeck
│ ├── settings.js # User preferences + phase tips + trigger reminders
│ ├── gamelog.js # Game event logging
│ ├── player.js # Player state (hand, battlefield, graveyard, mana)
│ ├── combat.js # Combat phase (attackers, blockers, damage)
│ ├── ai.js # AI coordinator — delegates to opponent scripts
│ ├── game.js # Core game engine and turn structure
│ ├── gameui.js # Game board rendering and UI interactions
│ ├── main.js # Deck builder UI, search, navigation
│ └── opponents/
│ ├── aggro.js # Aggro opponent — floods board, always attacks
│ ├── control.js # Control opponent — holds back, attacks when ahead
│ └── midrange.js # Midrange opponent — attacks profitably, values trades
└── data/
└── decks/ # Exported deck JSON files (future)

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
- Import decklist from text (supports Moxfield/Archidekt format with set codes)

### Phase 2 — Game Engine (COMPLETE)

- Shuffle and draw opening hand
- Play lands and cast spells
- Track battlefield, hand, graveyard, exile, commander zone
- Life total tracking
- Turn phases (untap, upkeep, draw, main, combat, end)
- Mana pool tracking
- Basic combat — declare attackers and blockers
- First strike, double strike, trample, deathtouch
- Commander tax tracking
- Beginner mode with phase tips and trigger reminders
- Transform DFC support (e.g. Bloodline Keeper)
- MDFC support (e.g. Sunken Hollow)

### Phase 3 — Simulated Opponent (COMPLETE)

- Three AI opponents with distinct play styles:
  - **Aggro** — floods board with cheap creatures, attacks every turn
  - **Control** — plays defensively, only attacks when ahead on board
  - **Midrange** — attacks opportunistically, values profitable trades
- Opponent deck builder — build, import, save, load custom AI decks
- Import any deck by pasting a decklist (Moxfield/Archidekt format supported)
- Set-specific card imports preserve exact printings (e.g. WHO set)
- Strategy selector — pick AI play style independently of deck contents
- AI uses custom deck when provided, falls back to default deck per strategy
- Expandable — add new opponents in `js/opponents/` following existing pattern

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

## Adding New AI Opponents

Create a new file in `js/opponents/` following this template:

```javascript
const OpponentMyStyle = {
  name: 'My Bot',
  description: 'Description of play style',

  attack(player, humanPlayer) {
    // attack logic here
  },

  getDeckList() {
    return [{ name: 'Card Name', qty: 1 }];
  },
};
```

Then add it to the strategy selector in `index.html` and `main.js`.

## Card Data

All card data comes from the free Scryfall API (https://scryfall.com).
No API key required.

## Known Limitations

- No stack — instants and counterspells cannot respond to spells (Phase 5)
- Transform DFCs enter as front face only — no manual transform yet
- AI does not cast non-creature spells meaningfully (board wipes excepted)
- No keyword automation — lifelink, flying etc tracked manually
