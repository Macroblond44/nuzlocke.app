# Advanced Recommendations System

## Overview

This document describes the advanced recommendation system that uses precise damage calculations to provide more accurate battle recommendations for Nuzlocke runs.

## Architecture

### Components

1. **@smogon/calc** - Official Pokémon damage calculator
   - Industry-standard calculation engine
   - Supports all generations and mechanics
   - Accurate damage formulas

2. **npoint.io Data Source** - Dynamic-Calc's Radical Red data
   - Complete trainer rosters with exact sets
   - Includes moves, abilities, items, EVs, IVs
   - Maintained by the Dynamic-Calc community

3. **Advanced Recommendation Endpoint** - `/api/recommendations/advanced.json`
   - Performs 1v1 calculations between user's Pokémon and rival Pokémon
   - Calculates best moves, damage ranges, and win probabilities
   - Returns ranked recommendations

## How It Works

### 1. Data Flow

```
User's Pokémon (from /box) → Advanced Endpoint
                                    ↓
                          @smogon/calc calculations
                                    ↓
                          Rival Pokémon (from league.json)
                                    ↓
                          Ranked Recommendations
```

### 2. Calculation Process

For each user Pokémon vs each rival Pokémon:

1. **Create Pokémon objects** with stats, abilities, items, natures
2. **Test all user's moves** against the rival Pokémon
3. **Find best move** with highest damage
4. **Calculate metrics**:
   - Damage range (min-max)
   - Hits to KO
   - Win probability
   - Can OHKO/2HKO

5. **Rank matchups** by win probability

### 3. Recommendation Algorithm

The system calculates an **overall score** for each user Pokémon based on:

- **Average win probability** across all matchups
- **OHKO bonus** (+10 points) if can OHKO at least one rival
- **2HKO bonus** (+5 points per matchup) for multiple 2HKO matchups

Pokémon are ranked by overall score (0-100).

## API Endpoints

### GET `/api/radred-calc-data.json`

Fetches Radical Red calculation data from npoint.io.

**Query Parameters:**
- `mode` - `normal` or `hardcore` (default: `normal`)

**Response:**
```json
{
  "Charizard": {
    "Lvl 85 Champion - Pokemon League": {
      "item": "Charizardite-Y",
      "level": "85",
      "moves": ["Fire Blast", "Solar Beam", "Focus Blast", "Roost"],
      "nature": "Timid",
      "ability": "Drought"
    }
  }
}
```

### POST `/api/recommendations/advanced.json`

Calculates advanced recommendations using damage calculations.

**Request Body:**
```json
{
  "userPokemon": [
    {
      "name": "Charizard",
      "level": 50,
      "ability": "Blaze",
      "nature": "Timid",
      "moves": ["Fire Blast", "Air Slash", "Dragon Pulse", "Roost"],
      "evs": { "hp": 0, "atk": 0, "def": 0, "spa": 252, "spd": 4, "spe": 252 },
      "ivs": { "hp": 31, "atk": 0, "def": 31, "spa": 31, "spd": 31, "spe": 31 },
      "item": "Life Orb"
    }
  ],
  "rivalPokemon": [
    {
      "name": "Blastoise",
      "level": 50,
      "ability": "Torrent",
      "nature": "Modest",
      "moves": [
        { "name": "Hydro Pump", "type": "water", "power": 110, "damage_class": "special" },
        { "name": "Ice Beam", "type": "ice", "power": 90, "damage_class": "special" }
      ],
      "item": "Leftovers"
    }
  ]
}
```

**Response:**
```json
{
  "recommendations": [
    {
      "pokemon": "Charizard",
      "level": 50,
      "overallScore": 85,
      "matchups": [
        {
          "rivalName": "Blastoise",
          "rivalLevel": 50,
          "bestMove": "Dragon Pulse",
          "damageRange": [85, 100],
          "hitsToKO": 2,
          "winProbability": 80,
          "canOHKO": false,
          "canTwoHKO": true,
          "damagePercent": 58
        }
      ]
    }
  ],
  "method": "advanced",
  "timestamp": "2025-10-10T22:00:00.000Z"
}
```

## Integration with UI

The UI will have a filter to switch between recommendation methods:

1. **Basic** (existing system) - Type matchups and coverage
2. **Advanced** (new system) - Damage calculations

The advanced method provides:
- ✅ More accurate recommendations
- ✅ Best move to use
- ✅ Exact damage ranges
- ✅ Win probabilities
- ✅ OHKO/2HKO indicators

## Data Sources

### Radical Red 4.1 Data IDs

- **Normal Mode**: `ced457ba9aa55731616c`
- **Hardcore Mode**: `e91164d90d06a009e6cc`

### npoint.io Format

The data from npoint.io follows this structure:

```json
{
  "PokemonSpecies": {
    "Lvl X Trainer Name - Location": {
      "item": "Item Name",
      "level": "X",
      "moves": ["Move1", "Move2", "Move3", "Move4"],
      "nature": "Nature",
      "ability": "Ability Name",
      "sub_index": 0
    }
  }
}
```

## Future Enhancements

1. **Field conditions** - Weather, terrain, hazards
2. **Speed calculations** - Who moves first
3. **Priority moves** - Account for priority
4. **Switch recommendations** - Best Pokémon to switch in
5. **Multi-battle scenarios** - Full team vs full team
6. **AI predictions** - Predict rival's best move

## Credits

- **@smogon/calc** - Smogon University's official damage calculator
- **Dynamic-Calc** - [hzla/Dynamic-Calc](https://github.com/hzla/Dynamic-Calc) for Radical Red data
- **npoint.io** - JSON storage service for romhack data

## License

This implementation uses MIT-licensed libraries and publicly available data.

