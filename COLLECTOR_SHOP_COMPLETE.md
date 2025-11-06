# Collector's Shop Feature - Complete Implementation

## Overview
The Collector's Shop is a tycoon-style idle game feature where players run their own virtual card shop. Departments passively generate resources (coins, cards, packs) 24/7, even while offline. Players must log in to collect resources before storage fills up.

## Command: `/collector`

### Subcommands

1. **`/collector status`**
   - Shows global shop level and upgrade cost
   - Lists all unlocked departments with current generation rates
   - Displays storage capacity and time until full
   - Shows locked departments and their unlock requirements

2. **`/collector collect`**
   - Collects all generated resources from all departments
   - Awards coins directly to player's balance
   - Generates Common cards and adds to collection
   - Resets department storage and restarts generation

3. **`/collector upgrade`**
   - Upgrades global shop level by 1
   - Cost: 1000g * (1.5 ^ current_level)
   - Unlocks new departments at specific levels
   - Raises department level cap to match shop level

4. **`/collector upgrade-dept <department>`**
   - Upgrades a specific department's level
   - Department level cannot exceed shop level
   - Increases generation rate and storage capacity
   - Each department has unique upgrade costs

## Departments

### 1. 💰 Trade Counter
- **Unlock:** Shop Level 1 (Auto-unlocked on first use)
- **Generates:** Coins
- **Progression:**
  - Level 1: 50 coins/hr | 500 capacity (fills in 10h)
  - Level 2: 75 coins/hr | 750 capacity
  - Level 10: 500 coins/hr | 5,000 capacity
- **Upgrade Cost:** 500g base * (1.3 ^ level)

### 2. 📦 Bulk Bin
- **Unlock:** Shop Level 5
- **Generates:** Common Cards
- **Progression:**
  - Level 1: 0.25 cards/hr (1 per 4h) | 6 capacity (fills in 24h)
  - Level 2: 0.33 cards/hr (1 per 3h) | 8 capacity
  - Level 8: 1 card/hr | 24 capacity
- **Upgrade Cost:** 2000g base * (1.4 ^ level)

### 3. 💎 Glass Display Case
- **Unlock:** Shop Level 10
- **Generates:** Passive Rarity Upgrade Chance
- **Progression:**
  - Level 1: 1% chance to upgrade Common → Uncommon
  - Level 2: 1.5% chance
  - Level 6+: 5% Common → Uncommon + 0.5% Common → Holo Rare
- **Upgrade Cost:** 5000g base * (1.5 ^ level)
- **Note:** Passive buff, no capacity/storage

### 4. 🎁 Pack Storage Room
- **Unlock:** Shop Level 15
- **Generates:** Sealed Booster Packs
- **Progression:**
  - Level 1: 1% chance/hr to find pack | 1 capacity
  - Level 2: 1.2% chance/hr
  - Level 6: 2% chance/hr | 2 capacity
- **Upgrade Cost:** 10000g base * (1.6 ^ level)

### 5. ⭐ Expert Grader
- **Unlock:** Shop Level 20
- **Generates:** Passive Quality Boost
- **Progression:**
  - Level 1: 5% quality boost on collection
  - Each level: +2% quality boost
- **Upgrade Cost:** 15000g base * (1.7 ^ level)
- **Note:** Passive buff, no capacity/storage

## Game Mechanics

### Passive Generation
- **24/7 Generation:** Resources generate continuously, online or offline
- **Time-Based:** System calculates hours elapsed since last collection
- **Capacity Limited:** Generation stops when storage is full
- **No Loss:** Resources wait safely until player collects

### Global Shop Level System
- **Gating Mechanism:** Departments cannot exceed shop level
- **Progressive Unlocks:** New departments unlock at specific shop levels
- **Exponential Costs:** Each shop upgrade costs 1.5x more than previous
- **Example Costs:**
  - Level 1→2: 1,000g
  - Level 2→3: 1,500g
  - Level 5→6: 5,063g
  - Level 10→11: 38,443g

### Department Upgrades
- **Independent Costs:** Each department has unique upgrade progression
- **Level Cap:** Cannot exceed global shop level
- **Consistent Fill Times:** Storage designed to fill in set hours
  - Trade Counter: 10 hours
  - Bulk Bin: 24 hours
  - Pack Storage: Variable (chance-based)

## Database Schema

### `collector_shops`
Stores global shop data per user:
```sql
user_id TEXT PRIMARY KEY
shop_level INTEGER DEFAULT 1
total_upgrades INTEGER DEFAULT 0
lifetime_coins_generated BIGINT DEFAULT 0
lifetime_cards_generated INTEGER DEFAULT 0
created_at BIGINT
updated_at BIGINT
```

### `collector_departments`
Stores individual department levels:
```sql
user_id TEXT
department_id TEXT
level INTEGER DEFAULT 0
total_upgrades INTEGER DEFAULT 0
last_collected_at BIGINT
PRIMARY KEY (user_id, department_id)
```

### `collector_storage`
Stores generated resources awaiting collection:
```sql
user_id TEXT
department_id TEXT
coins_stored INTEGER DEFAULT 0
cards_stored INTEGER DEFAULT 0
packs_stored INTEGER DEFAULT 0
last_generation_at BIGINT
PRIMARY KEY (user_id, department_id)
```

## Technical Implementation

### Files Created/Modified

**New Files:**
1. `database/CollectorShopManager.js` - Core manager class
2. `commands/collector.js` - Command implementation
3. `COLLECTOR_SHOP_COMPLETE.md` - This documentation

**Modified Files:**
1. `index.js` - Added CollectorShopManager initialization and button handlers
   - Lines 82-91: Import and initialize CollectorShopManager
   - Lines 95-96: Initialize collector shop tables
   - Lines 758-801: Handle collector button interactions
   - Line 911: Pass collectorShopManager to commands

### Key Methods

**CollectorShopManager:**
- `initializeTables()` - Create database tables
- `getOrCreateShop(userId)` - Get/create user shop with Trade Counter
- `calculateGeneration(deptId, level, hours)` - Calculate passive generation
- `getDepartmentStatus(userId, deptId, level)` - Get current storage state
- `collectDepartment(userId, deptId)` - Collect from single department
- `collectAll(userId)` - Collect from all departments
- `upgradeShopLevel(userId, gold)` - Upgrade global shop
- `upgradeDepartment(userId, deptId, gold)` - Upgrade specific department
- `getPassiveBuffs(userId)` - Get Glass Case/Expert Grader buffs

### Generation Formulas

**Coins (Trade Counter):**
```javascript
rate = baseGeneration * (generationGrowth ^ (level - 1))
capacity = baseCapacity * (capacityGrowth ^ (level - 1))
generated = min(rate * hoursElapsed, capacity)
```

**Cards (Bulk Bin):**
```javascript
rate = baseGeneration * (generationGrowth ^ (level - 1))
capacity = baseCapacity * (capacityGrowth ^ (level - 1))
generated = floor(min(rate * hoursElapsed, capacity))
```

**Packs (Pack Storage):**
```javascript
chance = baseChance + (chanceGrowth * (level - 1))
capacity = floor(baseCapacity + (capacityGrowth * (level - 1)))
// Roll for each hour elapsed
for each hour:
    if (random < chance && packs < capacity):
        packs++
```

## Progression Examples

### Early Game (Levels 1-5)
1. Start with Trade Counter Level 1
2. Collect 50g/hr passively
3. Save 1,000g for Shop Level 2 upgrade
4. Continue upgrading Trade Counter
5. Reach Shop Level 5 → Unlock Bulk Bin

### Mid Game (Levels 5-10)
1. Balance Trade Counter and Bulk Bin upgrades
2. Build up coin generation for Shop Level 10
3. Collect Common cards passively
4. Save ~38,000g for Level 10 upgrade
5. Unlock Glass Display Case for rarity upgrades

### Late Game (Levels 10-20)
1. Push for Shop Level 15 (Pack Storage Room)
2. Max out Trade Counter for maximum coin generation
3. Upgrade Glass Case to Level 6 for Holo chance
4. Work toward Shop Level 20 (Expert Grader)
5. Balance all departments for optimal passive income

## Balance Considerations

### Generation Rates
- **Trade Counter:** Primary coin source, aggressive scaling
- **Bulk Bin:** Slow but steady card generation (check-in daily)
- **Pack Storage:** Low chance, high value (premium reward)

### Upgrade Costs
- **Exponential Growth:** Prevents maxing out too quickly
- **Different Curves:** Each department scales uniquely
- **Shop Level Gate:** Forces strategic progression

### Time Gates
- **10h Fill Time:** Trade Counter rewards frequent players
- **24h Fill Time:** Bulk Bin rewards daily login
- **Variable:** Pack Storage creates excitement

## Future Enhancements (Optional)

### Potential Additions:
1. **Prestige System:** Reset shop for permanent bonuses
2. **Department Specializations:** Choose upgrade paths
3. **Combo Bonuses:** Synergies between departments
4. **Limited Events:** Temporary boost periods
5. **Shop Decorations:** Cosmetic upgrades
6. **Achievement Rewards:** Unlock special departments
7. **Trading Post:** Player-to-player resource exchange

### Integration Points:
- Glass Case buffs could apply to `/zam` draws
- Expert Grader could improve quest rewards
- Pack Storage could find rare vintage packs
- Trade Counter could offer bulk sales

## Testing Checklist

- [x] CollectorShopManager class created
- [x] Database tables defined and initialized
- [x] /collector status displays correctly
- [x] /collector collect awards resources properly
- [x] /collector upgrade increases shop level
- [x] /collector upgrade-dept respects level cap
- [ ] Passive generation calculations verified
- [ ] Department unlock timing correct
- [ ] Button interactions work properly
- [ ] Long-term balance testing
- [ ] Production deployment

## Deployment Notes

1. **Database Migration:** Tables auto-create on first run
2. **No Breaking Changes:** Existing features unaffected
3. **Performance:** Calculations happen on-demand, minimal overhead
4. **Compatibility:** PostgreSQL and SQLite support built-in
5. **User Experience:** Locked until `/start` completed

---

**Implementation Status:** ✅ Complete and ready for testing
**Created:** November 5, 2025
**Feature Type:** Idle/Tycoon Progression System
