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

	const IRACING_USERNAME = process.env.IRACING_USERNAME;
	if (!IRACING_USERNAME) {
		throw new Error("IRACING_USERNAME is not set");
	}

	const IRACING_PASSWORD = process.env.IRACING_PASSWORD;
	if (!IRACING_PASSWORD) {
		throw new Error("IRACING_PASSWORD is not set");
	}

	const IRACING_CLIENT_ID = process.env.IRACING_CLIENT_ID;
	if (!IRACING_CLIENT_ID) {
		throw new Error("IRACING_CLIENT_ID is not set");
	}

	const IRACING_CLIENT_SECRET = process.env.IRACING_CLIENT_SECRET;
	if (!IRACING_CLIENT_SECRET) {
		throw new Error("IRACING_CLIENT_SECRET is not set");
	}

	const DB_PATH = process.env.DB_PATH;
	if (!DB_PATH) {
		throw new Error("DB_PATH is not set");
	}

	const POLL_INTERVAL = Number.parseInt(
		process.env.POLL_INTERVAL ?? (60 * 1000 * 5).toString(),
	);

	return {
		DISCORD_TOKEN,
		DISCORD_CLIENT_ID,
		IRACING_USERNAME,
		IRACING_PASSWORD,
		IRACING_CLIENT_ID,
		IRACING_CLIENT_SECRET,
		DB_PATH,
		POLL_INTERVAL,
	};
});
