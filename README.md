# 🎴 Pokezam TCG Bot

A comprehensive Discord bot for Pokemon Trading Card Game collection, featuring real Pokemon TCG cards, quest systems, card fusion mechanics, and community interaction.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D16.9.0-green.svg)
![Discord.js](https://img.shields.io/badge/discord.js-v14.14.1-blue.svg)

## ✨ Features

### 🎯 Core Gameplay
- **Real Pokemon TCG Cards**: Integrated with official Pokemon TCG API
- **Card Drawing System**: Gacha-style card collection with rarity mechanics
- **Star System**: Fuse duplicate cards to create powerful star variants  
- **Set Progression**: Unlock new card sets by leveling up your profile
- **Quest System**: Daily and weekly challenges with rewards

### 📊 User Progression  
- **Leveling System**: Gain experience from drawing cards and completing quests
- **Profile Statistics**: Track collection progress, quest completion, and achievements
- **Collection Management**: Organize and view your cards with filtering options

### 🎮 Interactive Features
- **Slash Commands**: Modern Discord interface with autocomplete
- **Rich Embeds**: Beautiful card displays with images and detailed information
- **Real-time Updates**: Live quest progress and collection statistics

### 🛠️ Admin Tools
- **User Management**: Modify user coins, levels, and progress
- **Card Sync**: Update local database with latest Pokemon TCG releases
- **Bot Statistics**: Monitor usage and performance metrics

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

## 📝 Commands

### User Commands
| Command | Description |
|---------|-------------|
| `/draw` | Draw random Pokemon cards |
| `/profile [user]` | View user profile and statistics |
| `/collection [set] [user]` | Browse card collection with filters |
| `/fuse <card_name>` | Fuse duplicate cards into star variants |
| `/quest` | View and manage daily/weekly quests |
| `/help` | Show detailed command help |

### Admin Commands  
| Command | Description |
|---------|-------------|
| `/admin coins <user> <amount>` | Give coins to a user |
| `/admin level <user> <level>` | Set user level |
| `/admin stats` | View bot usage statistics |
| `/sync cards [set]` | Sync Pokemon TCG cards from API |

## 🎮 Game Mechanics

### Card Rarities
- **Common** (60% chance) - Basic cards for building collections
- **Uncommon** (25% chance) - Slightly rarer finds
- **Rare** (10% chance) - Valuable collection pieces  
- **Ultra Rare** (4% chance) - Highly sought after cards
- **Secret Rare** (1% chance) - The rarest discoveries
- **Legendary** (<1% chance) - Ultimate collection goals

### Star System
Transform duplicate cards into prestigious variants:
- **3x Base Card** → **1x Bronze Star (★)**
- **3x Bronze Star** → **1x Silver Star (★★)**
- **3x Silver Star** → **1x Gold Star (★★★)**

### Progression System
- **Levels 1-9**: Base Set access (Classic Pokemon cards)
- **Level 10+**: Jungle Set unlocked (Expansion cards)
- **Level 25+**: Fossil Set unlocked (Ancient Pokemon)
- **Level 50+**: More sets coming soon!

### Quest System
- **Daily Quests**: Reset every 24 hours
  - Draw specific numbers of cards
  - Collect certain rarities
  - Level up your profile
- **Weekly Quests**: Reset every 7 days  
  - Complete multiple daily quests
  - Fuse cards into star variants
  - Achieve collection milestones

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
npm run dev      # Start with nodemon (auto-restart)
npm run verify   # Check setup configuration
npm run db:init  # Reset database
npm run db:seed  # Seed card data
```

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