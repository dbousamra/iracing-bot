import { IRacingClient } from "../api/iracing/client";
import { getCommands } from "../commands";
import { deployCommands } from "../util";
import { config } from "../util";

const run = () => {
	deployCommands({
		commands: getCommands(
			new IRacingClient(config.IRACING_USERNAME, config.IRACING_PASSWORD),
		),
		guildId: "949939970804703232",
	});
};

run();
