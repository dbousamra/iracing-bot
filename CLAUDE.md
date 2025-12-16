# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Discord bot that monitors iRacing race results for tracked users and posts updates to a Discord channel. The bot polls the iRacing API for recent races and posts formatted embeds with race statistics, iRating changes, and safety rating updates.

## Commands

### Development
- `pnpm dev` - Run the bot in development mode with hot reload (uses tsx watch)
- `pnpm build` - Compile TypeScript to JavaScript (outputs to `dist/`)
- `pnpm start` - Run the compiled bot from `dist/index.js`

### Scripts
- `tsx src/scripts/register.ts` - Register Discord slash commands with the guild

### Code Quality
- Uses Biome for linting and formatting
- Biome config enforces tabs for indentation and double quotes for strings
- No dedicated lint or format commands in package.json; use Biome directly if needed

## Architecture

### Core Components

**src/index.ts** - Main entry point
- Initializes the SQLite database, iRacing client, and Discord client
- Sets up a polling interval (default 5 minutes) to check for new races
- Handles Discord slash command interactions

**src/iracing-client.ts** - iRacing API client
- Custom OAuth2 implementation using `password_limited` grant flow
- Handles token refresh automatically
- API requests return S3 links; the client fetches data from S3 in a second request
- Key methods: `getMemberProfile()`, `getRecentRaces()`, `getResults()`

**src/iracing.ts** - Business logic for fetching and formatting race data
- `getLatestRace()` fetches a customer's most recent race and enriches it with session results
- Calculates iRating changes, safety rating changes, split information, and lap times
- Returns formatted data ready for display

**src/db.ts** - SQLite database wrapper
- Uses Node's built-in `node:sqlite` (DatabaseSync)
- Tracks which races have been posted to Discord to avoid duplicates
- Single table: `customer_races` with `(customer_id, subsession_id)` primary key

**src/commands.ts** - Discord slash command definitions
- `ping` - Simple health check command
- `latest_race` - Manually fetch latest race for a tracked user

**src/util.ts** - Utilities
- `createRaceEmbed()` - Formats race data as a Discord embed
- `pollLatestRaces()` - Main polling loop that checks all tracked users
- `deployCommands()` - Registers slash commands with Discord API

**src/config.ts** - Configuration management
- Loads environment variables using dotenv
- Validates required env vars on startup
- Hardcoded `TRACKED_USERS` array maps Discord user IDs to iRacing customer IDs

### Data Flow

1. Bot polls `IRacingClient.getRecentRaces()` for each tracked user every 5 minutes
2. For each user's latest race, checks `db.hasCustomerRace()` to see if already posted
3. If new, fetches full race details via `getLatestRace()` which calls `IRacingClient.getResults()`
4. Formats race data into Discord embed and posts to configured channel
5. Stores subsession ID in database to prevent duplicate posts

### Authentication Flow

The iRacing OAuth2 flow is non-standard:
1. Hash password with username as salt (SHA-256, base64 encoded)
2. Hash client secret with client ID as salt
3. POST to OAuth endpoint with hashed credentials
4. Store access token and refresh token with expiry times
5. Auto-refresh tokens when expired (with 1-minute buffer)

## Environment Variables

Required variables (all must be set):
- `DISCORD_TOKEN` - Discord bot token
- `DISCORD_CLIENT_ID` - Discord application client ID
- `DISCORD_CHANNEL_ID` - Channel ID where race results are posted
- `IRACING_USERNAME` - iRacing account username
- `IRACING_PASSWORD` - iRacing account password
- `IRACING_CLIENT_ID` - iRacing OAuth client ID (string format)
- `IRACING_CLIENT_SECRET` - iRacing OAuth client secret (string format)
- `DB_PATH` - Path to directory where SQLite database will be stored

Optional variables:
- `POLL_INTERVAL` - Milliseconds between polls (default: 300000 / 5 minutes)

## Important Notes

- The bot uses tracked users hardcoded in `src/config.ts`. To add/remove users, modify the `TRACKED_USERS` array.
- The database only tracks which races have been posted; it doesn't store race data.
- iRacing API returns S3 links with expiry times; data must be fetched immediately.
- Discord embed colors are green for iRating gains, red for losses.
- The bot defers slash command replies to avoid 3-second timeout on API calls.
