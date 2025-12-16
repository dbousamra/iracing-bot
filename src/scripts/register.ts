import { getCommands } from "../commands";
import { config } from "../config";
import { IRacingClient } from "../iracing-client";
import { deployCommands } from "../util";

const run = async () => {
	const iRacingClient = new IRacingClient({
		username: config.IRACING_USERNAME,
		password: config.IRACING_PASSWORD,
		clientId: config.IRACING_CLIENT_ID,
		clientSecret: config.IRACING_CLIENT_SECRET,
	});

	const commands = getCommands(iRacingClient);

	deployCommands({
		commands: commands,
		guildId: "949939970804703232",
	});
};

run();
