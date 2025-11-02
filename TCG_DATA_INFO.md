# Cloud Hosting Setup - TCG Data Management

This repository is optimized for cloud hosting platforms like Render, Railway, Heroku, etc.

## TCG Data Strategy

Instead of including the large `tcg-data` folder (18+ MB) in the repository, the bot now:

1. **Downloads essential TCG data on startup** using `scripts/downloadTCGData.js`
2. **Falls back to live API calls** if download fails
3. **Uses smart caching** to minimize API requests

## Essential Sets Downloaded

The bot automatically downloads these popular sets on first startup:
- Base Set (base1)
- Jungle (base2) 
- Fossil (base3)
- Scarlet & Violet Base (sv1)
- Paldea Evolved (sv2)
- Sword & Shield Base (swsh1)
- Sun & Moon Base (sm1)

## Benefits

✅ **Faster deployments** - No large files to upload
✅ **Always up-to-date** - Downloads latest TCG data
✅ **Hosting-friendly** - Under repository size limits
✅ **Reliable fallback** - API calls if download fails
✅ **Bandwidth efficient** - Caches data locally

## For Local Development

If you want the full TCG data locally, you can:
1. Run `node scripts/downloadTCGData.js`
2. Or remove `tcg-data/` from `.gitignore`