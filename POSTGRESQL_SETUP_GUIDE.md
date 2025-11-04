# PostgreSQL Database Setup for Render Deployment

## Overview
This guide explains how to set up PostgreSQL database persistence for your Pokezam bot on Render, solving the critical issue where all user data (levels, gold, cards) resets on every deployment.

## Problem Summary
- **Issue**: Render uses ephemeral storage, causing complete data loss on deployments
- **Impact**: All user progress (trainer levels, card collections, gold) resets to zero
- **Solution**: PostgreSQL database for persistent storage across deployments

## Prerequisites
1. Render account with your bot repository connected
2. PostgreSQL database service (can be created on Render)

## Step 1: Create PostgreSQL Database on Render

1. **Go to Render Dashboard**
   - Navigate to https://dashboard.render.com
   - Click "New +" → "PostgreSQL"

2. **Configure Database**
   - Name: `pokezam-database` (or your preferred name)
   - Database: `pokezam`
   - User: `pokezam_user`
   - Region: Same as your bot service
   - Plan: Choose based on your needs (Free tier available)

3. **Note Connection Details**
   After creation, save these values from the "Info" tab:
   - **Internal Database URL**: For connecting from Render services
   - **External Database URL**: For local development/migration

## Step 2: Update Environment Variables

In your Render Web Service (bot) settings:

```env
NODE_ENV=production
DATABASE_URL=postgresql://username:password@hostname:port/database
DISCORD_TOKEN=your_discord_token
GUILD_ID=your_guild_id
CLIENT_ID=your_client_id
POKEMON_TCG_API_KEY=your_api_key
```

**Important**: Use the **Internal Database URL** from your PostgreSQL service for `DATABASE_URL`

## Step 3: Deploy Updated Bot

1. **Push your updated code** to your repository:
   - The bot now uses `DatabaseManager.js` which automatically selects PostgreSQL in production
   - PostgreSQL schema and migration tools are included

2. **Deploy on Render**:
   - Your bot service will automatically redeploy
   - Check logs to confirm PostgreSQL connection

## Step 4: Initialize Database Schema

The bot will automatically create tables on first run, but you can also manually run:

```bash
# On your local machine with access to production database
npm run migrate
```

## Step 5: Migrate Existing Data (Optional)

If you have existing SQLite data to migrate:

1. **Set environment variables locally**:
   ```env
   DATABASE_URL=your_external_postgresql_url
   ```

2. **Run migration script**:
   ```bash
   npm run migrate
   ```

## Verification

After deployment, verify persistence:

1. Use `/start` command to register a user
2. Use `/daily` to claim rewards and gain gold
3. Open some packs with `/zam`
4. **Trigger a deployment** (push a small change)
5. **Check your progress** - it should persist!

## Troubleshooting

### Connection Errors
- Verify `DATABASE_URL` is the Internal Database URL
- Check PostgreSQL service is running
- Ensure both services are in the same region

### Schema Errors
- Check bot logs for table creation errors
- Manually run migration script if needed
- Verify PostgreSQL version compatibility

### Performance Issues
- Monitor database metrics in Render dashboard
- Consider upgrading PostgreSQL plan if needed
- Optimize queries if experiencing slowdowns

## Environment Configuration

### Development (SQLite)
```env
NODE_ENV=development
# No DATABASE_URL needed - uses local SQLite
```

### Production (PostgreSQL)
```env
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:port/db
```

## Database Features

### Automatic Selection
- **Development**: Uses SQLite (`pokemon_tcg.db`)
- **Production**: Uses PostgreSQL (from `DATABASE_URL`)

### Migration Support
- Automatic schema creation
- Data migration tools
- Backup and restore capabilities

### Performance Optimizations
- Connection pooling
- Prepared statements
- Optimized indexes

## Support

If you encounter issues:

1. **Check Render logs** for connection/schema errors
2. **Verify environment variables** are set correctly
3. **Test database connection** using migration script
4. **Monitor PostgreSQL metrics** for performance issues

## Success Criteria

✅ **Bot starts without errors**
✅ **Users can register and claim daily rewards**
✅ **Card collections persist across deployments**
✅ **Trainer levels and gold remain stable**
✅ **No data loss on bot restarts/deployments**

---

**Critical Note**: This PostgreSQL setup is essential for production use. Without persistent storage, your bot will lose all user progress on every deployment, making it unusable for your community.