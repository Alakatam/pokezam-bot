# 🎴 Pokézam TCG Bot

A comprehensive Discord bot for Pokemon Trading Card Game collection featuring real Pokemon TCG cards, multi-pack systems, quest mechanics, shop items, and extensive collection management. Built with modern Discord.js v14 and production-ready cloud deployment.

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)
![Discord.js](https://img.shields.io/badge/discord.js-v14.14.1-blue.svg)
![Production](https://img.shields.io/badge/status-production%20ready-green.svg)

## ✨ Key Features

### 🎯 Card Collection System
- **14,926 Real Pokemon TCG Cards**: Complete database from Base Set to current releases
- **Multiple Pack Types**: Master Packs, Premium Packs, Vintage Packs with unique mechanics
- **Individual Card Drawing**: `/zam` command for single card collection
- **Master Set Variants**: First Edition, Shadowless, and Unlimited variants
- **Generation-Based Progression**: Unlock card generations by leveling up

### 🛒 Economy & Shop System
- **Gold Currency**: Earn gold from card draws and quests
- **Daily Rewards**: Daily gold claims with streak bonuses
- **Item Shop**: 16 different boost items and consumables
- **Inventory Management**: Use items to enhance gameplay experience
- **Active Effects**: Track boost items and their durations

### 🎯 Quest System
- **Daily, Weekly, Monthly Quests**: 9 different quest types with auto-assignment
- **Progress Tracking**: Real-time quest progress with YAML-formatted displays
- **Automatic Reset**: Smart quest reset system with hourly checking
- **Gold Rewards**: Complete quests to earn substantial gold bonuses

### 📊 Collection Management
- **Carddex Systems**: Regular and Master Set collection tracking
- **Binder View**: Visual card organization and filtering
- **Master Collection**: Specialized tracking for Master Set variants
- **Profile Statistics**: Comprehensive user statistics and achievements
- **Collection Completion**: Track progress across all card sets and generations

### 🎮 Advanced Features
- **Slash Commands**: 21 modern Discord slash commands
- **Interactive Components**: Buttons, dropdowns, and pagination
- **Rich Embeds**: Professional YAML-style displays with emojis
- **Auto Reactions**: Achievement celebrations and social engagement
- **Debug System**: Comprehensive admin debugging and monitoring

### 🛠️ Production Systems
- **Cloud Deployment**: Production-ready deployment on Render
- **Database Backup**: Automated backup and restore system
- **Error Handling**: Comprehensive error recovery and logging  
- **Health Monitoring**: Built-in health check endpoints
- **Performance Optimized**: Efficient database queries and caching

## 🚀 Quick Start

### Prerequisites
- Node.js 16.9.0 or higher
- Discord Bot Application ([Create one here](https://discord.com/developers/applications))
- Pokemon TCG API Key ([Optional - Get here](https://dev.pokemontcg.io/))

### Installation

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd Pokezam
   npm install
   ```

2. **Verify Setup**
   ```bash
   npm run verify
   ```

3. **Configure Environment**
   - Copy `.env.template` to `.env`
   - Add your Discord bot token and settings
   - See [SETUP.md](./SETUP.md) for detailed configuration

4. **Start the Bot**
   ```bash
   npm start
   ```

5. **Sync Pokemon Cards** (In Discord)
   ```
   /sync cards
   ```

📖 **Full setup guide available in [SETUP.md](./SETUP.md)**

## 📝 Commands (21 Total)

### 🎴 Card Collection
| Command | Description |
|---------|-------------|
| `/zam` | Draw a single Pokemon card with rewards |
| `/master-pack` | Open premium 5-card Master Set pack |
| `/premium-pack` | Open premium 3-card pack with enhanced rates |
| `/vintage-pack` | Open vintage 4-card pack with classic cards |

### 📊 Collection Management
| Command | Description |
|---------|-------------|
| `/profile [user]` | View comprehensive user profile and statistics |
| `/binder [generation] [user]` | Browse card collection with filtering |
| `/carddex-reg` | View regular card collection progress |
| `/carddex-master` | View Master Set collection progress |
| `/master-collection [user]` | Specialized Master Set variant tracking |

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
| `/debug` | Production debugging and system status |

### 👑 Admin Commands
| Command | Description |
|---------|-------------|
| `/admin` | Complete administrative suite for user/bot management |
| `/sync` | Database synchronization and card updates |

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
- **Level 1-4**: Generation I (Kanto region classics)
- **Level 5-9**: Generation II (Johto region)  
- **Level 10-14**: Generation III (Hoenn region)
- **Level 15-19**: Generation IV (Sinnoh region)
- **Level 20-24**: Generation V (Unova region)
- **Level 25+**: All generations unlocked

### Economy System
- **Gold Currency**: Primary currency earned from cards and quests
- **Daily Streaks**: Consecutive daily claims increase rewards
- **Item Effects**: Boost gold earnings and card rarity chances
- **Quest Rewards**: Substantial gold bonuses for completed objectives

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

## 🛠️ Development

### Project Structure
```
Pokezam/
├── commands/           # Slash command handlers
├── managers/          # Database and business logic
├── utils/             # Utility functions and APIs
├── events/            # Discord event handlers
├── database/          # Database initialization
├── index.js          # Main bot entry point
├── package.json      # Dependencies and scripts
├── .env.template     # Environment configuration template
└── SETUP.md          # Detailed setup instructions
```

### Development Scripts
```bash
npm start        # Production start
npm run dev      # Development with auto-restart
npm run verify   # Check setup configuration  
npm run db:init  # Initialize database
npm run setup    # Complete bot setup wizard
```

### Production Deployment
Pokézam is production-ready with cloud hosting support:
- **Render Deployment**: Auto-deploy with GitHub integration
- **Database Backup**: Automatic backup and restore system
- **Health Monitoring**: Built-in health check endpoints
- **Error Recovery**: Comprehensive error handling and logging

## 🐛 Troubleshooting

### Common Issues

**Bot doesn't respond to commands**
- Verify Message Content Intent is enabled
- Check bot permissions in your server
- Ensure CLIENT_ID matches your application

**Database errors**
- Delete `pokezam.db` and restart to rebuild
- Check file permissions in bot directory
- Verify SQLite3 is properly installed

**API rate limits**  
- Add Pokemon TCG API key to `.env`
- Bot includes automatic 1-second delays
- Monitor console for rate limit warnings

**Commands not appearing**
- Wait a few minutes for Discord sync
- Try re-inviting the bot with proper permissions
- Check console for command registration errors

📖 **Full troubleshooting guide in [SETUP.md](./SETUP.md)**

---

**Ready to start your Pokemon TCG collection journey?** 🎉

Follow the [setup guide](./SETUP.md) and begin collecting today!