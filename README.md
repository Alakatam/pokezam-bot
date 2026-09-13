# Pokézam TCG Bot

Pokézam is a Discord Pokémon TCG-style collection game. Trainers draw cards, build collections, complete quests, earn gold, open packs, use boosts, and compete through progression and leaderboards.

Pokézam is a fan-made, non-commercial project and is not affiliated with Nintendo, Game Freak, Creatures Inc., or The Pokémon Company.

## Current Features

- Card draws with rarity-based XP and gold rewards
- Pokémon TCG card collection and binder browsing
- Regular and Master Card Dex views
- Master Set variant tracking
- Generation-based progression from Generation I through Generation IX
- Daily, weekly, and monthly quests
- Daily rewards with streak bonuses
- Item shop, inventory, consumable items, and active effects
- Premium, Vintage, and Master pack commands
- Risky Deal gambling flow with Vex
- Trainer profiles, detailed `/stats`, achievements, and leaderboards
- Interactive buttons, select menus, pagination, and Discord embeds
- PostgreSQL production support with SQLite development support
- HTTP health and metrics endpoints for hosting platforms

## Getting Started

1. Invite the bot to a Discord server with application command permissions.
2. Run `/start` to create a trainer and receive the starter package.
3. Use `/zam` to draw cards and earn rewards.
4. Use `/quest` and `/daily` to build XP and gold.
5. Use `/profile`, `/stats`, `/binder`, and `/carddex-reg` to track progress.
6. Keep drawing Holo-rarity or higher cards for a chance to discover a Store Key.

## Commands

### Collection and Progression

| Command | Purpose |
| --- | --- |
| `/start` | Start onboarding and claim starter rewards |
| `/zam` | Draw one random card; has a five-second cooldown |
| `/profile [user]` | View a trainer profile and progression summary |
| `/stats [user]` | View draw totals, rarity history, Risky Deals, currencies, collection totals, and Collector production |
| `/binder` | Browse owned cards with filters and pagination |
| `/carddex-reg` | Browse the regular Card Dex and ownership progress |
| `/carddex-master` | Browse Master Set variant progress |
| `/master-collection [user]` | View Master Set collection statistics |
| `/leaderboard` | Compare trainers by supported ranking categories |

### Packs and Economy

| Command | Purpose |
| --- | --- |
| `/premium-pack` | Open a premium card pack |
| `/vintage-pack` | Open a Vintage Pack focused on classic cards |
| `/master-pack` | Open a Master Pack with premium variants |
| `/daily` | Claim progressive daily rewards and streak bonuses |
| `/shop [category]` | Browse and purchase items |
| `/inventory [user]` | View trainer inventory and usable items |
| `/use <item>` | Activate a consumable or boost item |
| `/active-boosts` | View active item effects |
| `/risky_deal` | Risk an owned card for a chance at a different rarity |

### Collector Shop

`/collector` is a single dashboard command with no subcommands.

The Collector Shop is permanently unlocked by finding a **Store Key**. A Holo-rarity or higher card has a **1 in 300** chance to reveal one during `/zam`. Once found, the Store Key is saved in inventory and does not need to be consumed.

The dashboard provides buttons to collect generated resources, upgrade the global shop, inspect departments, and upgrade individual departments. Departments use levels, generation rates, storage capacity, operating hours, and daily variance.

### Help and Administration

| Command | Purpose |
| --- | --- |
| `/help` | Open the command hub and category navigation |
| `/faq` | View frequently asked questions |
| `/sync` | Admin command for TCG data synchronization |
| `/admin` | Owner/admin management commands, monitoring, backups, user tools, and resets |

## Stats Tracking

`/stats` reports total card draws, rarity draw history, cards currently owned by rarity, unique and total card quantities, completed Risky Deals, current gold and coins, and Collector lifetime production.

Historical rarity and Risky Deal totals from before these counters existed cannot be reconstructed reliably.

## Configuration

Keep secrets in a local `.env` file or your hosting provider's environment settings. Never commit tokens, passwords, or API keys.

```dotenv
DISCORD_TOKEN=your_discord_bot_token
CLIENT_ID=your_application_id
ADMIN_USER_ID=your_discord_user_id
DATABASE_URL=your_postgresql_connection_string
DATABASE_PATH=./pokezam.db
NODE_ENV=development
GUILD_ID=your_test_server_id
USE_GLOBAL_COMMANDS=false
```

Production selects PostgreSQL when `NODE_ENV=production`, `DATABASE_URL` is set, or `USE_POSTGRESQL=true`. Otherwise, the bot uses SQLite.

## Local Development

```bash
npm install
npm test
npm start
```

Useful scripts:

```bash
npm run dev
npm run prod
npm run setup
npm run db:init
npm run load:all
npm run fix:schema
```

## Deployment

The active deployment branch is `clean-main`.

```text
Build Command: npm install
Start Command: npm run prod
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for Render setup, environment variables, migrations, health endpoints, and troubleshooting.

## Terms and Privacy

GitHub Pages-ready policy pages are available in [`docs/`](docs/):

- [Terms of Service](docs/tos.html)
- [Privacy Policy](docs/privacy.html)
- [Policy landing page](docs/index.html)

## License

This project is released under the MIT license declared in `package.json`.
