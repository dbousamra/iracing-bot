import { getCommands } from "../commands";
import { config } from "../config";
import { Db } from "../db";
import { IRacingClient } from "../iracing-client";
import { deployCommands } from "../util";

const run = async () => {
	const db = new Db(config.DB_PATH);
	await db.init();

	const iRacingClient = new IRacingClient({
		username: config.IRACING_USERNAME,
		password: config.IRACING_PASSWORD,
		clientId: config.IRACING_CLIENT_ID,
		clientSecret: config.IRACING_CLIENT_SECRET,
	});

	const commands = getCommands(iRacingClient, db);

	deployCommands({
		commands: commands,
		guildId: "1340830932470337536",
	});
};

run();
