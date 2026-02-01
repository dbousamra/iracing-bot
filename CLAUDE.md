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

## Important Notes

- The database only tracks which races have been posted; it doesn't store race data.
- iRacing API returns S3 links with expiry times; data must be fetched immediately.
- Discord embed colors are green for iRating gains, red for losses.
- The bot defers slash command replies to avoid 3-second timeout on API calls.
