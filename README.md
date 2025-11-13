# 🎴 Pokézam TCG Bot

The ultimate Discord bot for Pokemon Trading Card Game enthusiasts! Collect authentic Pokemon TCG cards, complete quests, build your collection, manage your own card shop, and compete with friends in an immersive Pokemon card collecting experience.

![Pokemon TCG](https://img.shields.io/badge/Pokemon-TCG%20Bot-yellow.svg)
![Discord](https://img.shields.io/badge/Discord-Bot-blue.svg)
![Cards](https://img.shields.io/badge/Cards-14,926-green.svg)
![Status](https://img.shields.io/badge/Status-Online-brightgreen.svg)

## ✨ Key Features

### 🎯 Card Collection System
- **14,926 Real Pokemon TCG Cards**: Complete database from Base Set to current releases
- **Multiple Pack Types**: Master Packs, Premium Packs, Vintage Packs with unique mechanics
- **Individual Card Drawing**: `/zam` command for single card collection with 5-second cooldown
- **Master Set Variants**: First Edition, Shadowless, and Unlimited variants
- **Generation-Based Progression**: Unlock card generations by leveling up

### 🏬 Collector Shop System (NEW!)
- **Run Your Own Card Shop**: Build and manage departments that generate passive income
- **5 Unique Departments**: Trade Counter (coins), Bulk Bin (cards), Premium Crate (packs), Expert Grader (upgrades), Glass Display Case (quality boosts)
- **Shop Hours Mechanic**: Departments operate for limited hours daily (4h-12h), close after operating hours
- **Daily Variance System**: Business fluctuates with busy days (1.3x) and slow days (0.7x)
- **Progressive Upgrades**: Level up departments to 15 for increased generation and capacity
- **Strategic Collection**: Can only collect rewards when shop closes, encouraging active timing

### 🛒 Economy & Shop System
- **Gold Currency**: Earn gold from card draws, quests, and your collector shop
- **Daily Rewards**: Daily gold claims with progressive streak bonuses
- **Item Shop**: 16 different boost items and consumables across 4 categories
- **Inventory Management**: Use items to enhance gameplay experience
- **Active Effects Tracking**: Monitor boost items and their durations with `/active-boosts`

### 🎯 Quest System
- **Daily, Weekly, Monthly Quests**: 9 different quest types with auto-assignment
- **Progress Tracking**: Real-time quest progress with YAML-formatted displays
- **Automatic Reset**: Smart quest reset system with hourly checking
- **Gold Rewards**: Complete quests to earn substantial gold bonuses (150-50,000 gold)

### 📊 Collection Management
- **Carddex Systems**: Regular and Master Set collection tracking
- **Binder View**: Visual card organization and filtering by generation
- **Master Collection**: Specialized tracking for Master Set variants
- **Profile Statistics**: Comprehensive user statistics, achievements, and collection progress
- **Set Completion Tracking**: Track progress across all card sets and generations

### 🎮 User Experience
- **Slash Commands**: 25+ easy-to-use Discord slash commands
- **Interactive Interface**: Buttons, dropdowns, and smooth navigation
- **Beautiful Displays**: Rich embeds with emojis and YAML-formatted layouts
- **Achievement Celebrations**: Auto reactions for special moments and rare pulls
- **Mobile Optimized**: Clean interface that works great on all devices
- **Pagination System**: Navigate large collections with intuitive button controls

## 🚀 Getting Started

### Add Pokézam to Your Server
1. **Invite Pokézam** to your Discord server
2. Use `/start` to begin your Pokemon TCG collection journey
3. Try `/zam` to draw your first Pokemon card!
4. Build your `/collector` shop and start generating passive income!

### First Steps
- `/start` - Initialize your collector profile and get Welcome Charm (125 uses)
- `/help` - Learn about all available commands  
- `/zam` - Draw a Pokemon card and earn rewards
- `/collector` - Set up your card shop departments
- `/profile` - View your collection statistics and level

## 📝 Commands (25+ Total)

### 🎴 Card Collection
| Command | Description |
|---------|-------------|
| `/zam` | Draw a single Pokemon card with rewards (5s cooldown) |
| `/master-pack` | Open premium 5-card Master Set pack |
| `/premium-pack` | Open premium 3-card pack with enhanced rates |
| `/vintage-pack` | Open vintage 4-card pack with classic cards |

### 🏬 Collector Shop (NEW!)
| Command | Description |
|---------|-------------|
| `/collector` | View shop status, departments, and collect rewards |
| `/collector collect` | Collect from all departments (only when shops are closed) |
| `/collector upgrade <dept>` | Upgrade department level (max 15) |
| `/collector upgrade shop` | Increase global shop level cap |

### 📊 Collection Management
| Command | Description |
|---------|-------------|
| `/profile [user]` | View comprehensive user profile and statistics |
| `/binder [generation] [user]` | Browse card collection with filtering |
| `/carddex-reg` | View regular card collection progress |
| `/carddex-master` | View Master Set collection progress |
| `/master-collection [user]` | Specialized Master Set variant tracking |
| `/leaderboard` | View community rankings across multiple categories |

### 🎯 Quests & Economy
| Command | Description |
|---------|-------------|
| `/quest` | View and manage daily/weekly/monthly quests |
| `/daily` | Claim daily gold rewards with streak bonuses |
| `/shop [category]` | Browse and purchase boost items |
| `/inventory` | View and use your items and consumables |
| `/use <item>` | Activate boost items and consumables |
| `/active-boosts` | View currently active item effects |

### 🛠️ Utility & Help
| Command | Description |
|---------|-------------|
| `/start` | Begin your Pokemon TCG collection journey |
| `/help` | Comprehensive command help and guides |
| `/faq` | Frequently asked questions and tips |
| `/sync` | Synchronize TCG data (admin only) |



## 🎮 Game Mechanics

### Card Rarity System
Your collection features authentic Pokemon TCG rarities:
- **Common** 📄 - Foundation cards for every collection
- **Uncommon** 🎴 - Solid additions with decent value
- **Rare** ⭐ - Valuable cards with good rewards
- **Holo Rare** ✨ - Shimmering holographic cards
- **Ultra Rare** 💎 - Highly coveted discoveries
- **Secret/Legendary** 🏆 - The ultimate collection goals

### Master Set Variants
Experience the complete Pokemon TCG collecting with authentic variants:
- **Unlimited Edition** - Standard release cards
- **First Edition** 🥇 - Limited first print runs with premium value
- **Shadowless** 👻 - Classic Base Set cards without drop shadows
- **Error Cards** ⚠️ - Rare misprints and production errors

### Generation Progression System
Unlock card generations as you level up:
- **Level 1**: Generation I (Kanto region classics)
- **Level 10**: Generation II (Johto region)
- **Level 20**: Generation II e-Card Series
- **Level 35**: Generation III (Hoenn region)
- **Level 60**: Generation IV Diamond & Pearl
- **Level 80**: Generation IV Platinum
- **Level 90**: Generation IV HeartGold & SoulSilver
- **Level 110**: Generation V (Unova region)
- **Level 130**: Generation VI (Kalos region)
- **Level 150**: Generation VII (Alola region)
- **Level 170**: Generation VIII (Galar region)
- **Level 200**: Generation IX (Paldea region)

### Economy System
- **Gold Currency**: Primary currency earned from cards, quests, and collector shop
- **Daily Streaks**: Consecutive daily claims increase rewards
- **Item Effects**: Boost gold earnings and card rarity chances
- **Quest Rewards**: Substantial gold bonuses (150-50,000 gold)
- **Passive Income**: Collector shop generates gold even while offline

### Collector Shop System (NEW!)
Build and manage your own Pokemon card shop empire:

**Departments Available:**
- **💰 Trade Counter** (Level 1+) - Generates gold coins passively
  - Level 15 Max: 466,704 gold per day
  - 4h base hours → 12h max operating hours
- **🃏 Bulk Bin** (Level 5+) - Produces random Pokemon cards
  - Generates cards with rarity rolls
  - Time-gated production
- **📦 Premium Crate** (Level 10+) - Creates premium card packs
  - Higher quality pack generation
  - Limited daily production
- **🎓 Expert Grader** (Level 15+) - Increases card upgrade chances
  - Boost: +5% per level (max +75%)
  - Passive bonus department
- **💎 Glass Display Case** (Level 20+) - Improves card quality chances
  - Boost: +3% per level (max +45%)
  - Passive bonus department

**Shop Hours Mechanic:**
- Departments open when you collect rewards
- Operate for limited hours (4h-12h based on level)
- Close automatically after operating hours elapse
- Can only collect when shop is closed
- Strategic timing rewards active players

**Daily Variance:**
- 🔥 Extremely Busy Day: 1.2x-1.3x generation
- 📈 Busy Day: 1.1x-1.19x generation
- 📊 Normal Day: 0.95x-1.09x generation
- 📉 Slow Day: 0.8x-0.94x generation
- 😴 Very Slow Day: 0.7x-0.79x generation

**Progression:**
- Level Cap: 15 for all departments
- Shop Level: Must be upgraded to unlock department levels
- Upgrade Costs: Increase exponentially with level
- Balanced for long-term gameplay

### Quest Mechanics
**Auto-Assignment System**: Quests automatically assigned when completed
- **Daily Quests** (24h reset): The Collector, The Curator, The Climber
- **Weekly Quests** (7d reset): The Marathoner, The Socialite, Weekend Warrior  
- **Monthly Quests** (30d reset): The Specialist, The Completionist, The Veteran

### Shop & Items System
**16 Different Items** across 4 categories:
- **Gold Boosts**: Amulet Coin, Golden Horseshoe, Fortune Charm
- **Luck Boosts**: Collector's Charm, Master's Token, Shiny Charm  
- **Pack Boosts**: Booster Box, Premium Ticket, Vintage Key
- **Special Items**: Welcome Charm, Mystery Box, Golden Ticket

## � Why Choose Pokézam?

✅ **Authentic Pokemon TCG Experience** - Real cards from official sets  
✅ **Active Development** - Regular updates and new features  
✅ **User-Friendly** - Easy commands and intuitive interface  
✅ **Engaging Gameplay** - Quests, achievements, and progression  
✅ **Collector Shop System** - Build your own card shop empire  
✅ **Passive Income** - Earn rewards even when offline  
✅ **Community Features** - View others' collections and compete  
✅ **Mobile Optimized** - Works perfectly on Discord mobile  
✅ **Strategic Depth** - Shop hours, variance, and timing mechanics  

## 📞 Support & Community

**Need Help?**
- Use `/help` in Discord for command assistance
- Check `/faq` for common questions and detailed guides
- Report bugs or issues through Discord

**Features Coming Soon:**
- Additional TCG set expansions
- Achievement system enhancements
- Collector shop competitive leaderboards
- Trading system between players

---

**Ready to catch 'em all?** 🎉

Start your Pokemon TCG collection journey today and build your card shop empire!
