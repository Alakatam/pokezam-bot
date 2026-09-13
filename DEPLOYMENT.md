# Deploying Pokézam to Render

This guide describes the current Render deployment for the Pokézam Discord bot.

## Prerequisites

- GitHub access to the repository
- A Render account connected to GitHub
- A Discord application and bot token
- A Discord user ID for `ADMIN_USER_ID`
- A PostgreSQL database for production persistence

Never commit `.env`, Discord tokens, database passwords, or API keys. Configure secrets in Render's Environment settings instead.

## Render Service

Create a Render **Web Service** connected to:

```text
Repository: Alakatam/pokezam-bot
Branch: clean-main
Environment: Node
Build Command: npm install
Start Command: npm run prod
```

The bot starts an HTTP health server so Render can detect a live web service. The port comes from `PORT`, with `3000` as the local fallback.

## Environment Variables

Configure these in Render. Do not paste real values into documentation or commit them to Git:

```dotenv
DISCORD_TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_application_id
ADMIN_USER_ID=your_discord_user_id
DATABASE_URL=your_postgresql_connection_string
NODE_ENV=production
```

Recommended command registration settings:

```dotenv
GUILD_ID=your_test_server_id
USE_GLOBAL_COMMANDS=false
```

Guild registration makes command changes available quickly. Global command registration can take longer to propagate.

Optional variables include `POKEMON_TCG_API_KEY`, `PORT`, `RENDER_EXTERNAL_HOSTNAME`, `DATABASE_BACKUP_URL`, `LOG_LEVEL`, and `TEST_GUILD_ID`.

## Database Behavior

The bot selects PostgreSQL when `NODE_ENV=production`, `DATABASE_URL` is present, or `USE_POSTGRESQL=true`. SQLite is used for local development when those conditions are false.

On PostgreSQL startup, the bot applies idempotent schema repairs for known production migrations, including user statistics and rarity tracking. Card data may also load progressively after the Discord client becomes ready.

Back up production data before migrations or admin reset commands.

## Health and Metrics

The service exposes:

```text
/health
/metrics
```

`/health` reports bot readiness, uptime, memory, Discord ping, loaded commands, startup warnings, and command metrics. `/metrics` includes the loaded command names.

## Deploying Updates

Push tested changes to `clean-main`:

```bash
npm test
git add <files>
git commit -m "describe the change"
git push origin clean-main
```

Render should automatically deploy the new commit when automatic deploys are enabled. Check the Render Events and Logs tabs for build, migration, and startup results.

## Troubleshooting

### Commands do not appear

- Verify `CLIENT_ID` is set.
- Set `GUILD_ID` to a test server for fast registration.
- Confirm `USE_GLOBAL_COMMANDS=false` for guild registration.
- Check deployment logs for Discord login or registration errors.

### Database column or table errors

- Confirm `DATABASE_URL` points to the intended PostgreSQL database.
- Restart the service so startup migrations can run.
- Check logs for migration failures.
- Do not manually delete production tables without a backup.

### Bot is offline

- Verify `DISCORD_TOKEN` was regenerated if it was ever exposed.
- Confirm the Render service is running and the Discord application is enabled.
- Check `/health` and the Render logs.

### Render sleeps or restarts

Use Render metrics and logs first. An external uptime monitor can request `/health` where appropriate, but it does not replace a reliable production hosting plan.

## GitHub Pages Policies

The public policy pages are stored in `docs/`:

- `docs/index.html`
- `docs/tos.html`
- `docs/privacy.html`

In GitHub, open **Settings → Pages**, select **Deploy from a branch**, choose `clean-main`, and select the `/docs` folder.
