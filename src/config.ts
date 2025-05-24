import "dotenv/config";
import { run } from "./util";

export const config = run(() => {
	const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
	if (!DISCORD_TOKEN) {
		throw new Error("DISCORD_TOKEN is not set");
	}

	const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
	if (!DISCORD_CLIENT_ID) {
		throw new Error("DISCORD_CLIENT_ID is not set");
	}

	const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
	if (!DISCORD_CHANNEL_ID) {
		throw new Error("DISCORD_CHANNEL_ID is not set");
	}

	const IRACING_USERNAME = process.env.IRACING_USERNAME;
	if (!IRACING_USERNAME) {
		throw new Error("IRACING_USERNAME is not set");
	}

	const IRACING_PASSWORD = process.env.IRACING_PASSWORD;
	if (!IRACING_PASSWORD) {
		throw new Error("IRACING_PASSWORD is not set");
	}

	const TRACKED_USERS = [404007];
	const POLL_INTERVAL = 1000 * 60 * 5;

	return {
		DISCORD_TOKEN,
		DISCORD_CLIENT_ID,
		DISCORD_CHANNEL_ID,
		IRACING_USERNAME,
		IRACING_PASSWORD,
		POLL_INTERVAL,
		TRACKED_USERS,
	};
});
