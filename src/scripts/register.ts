import IRacingSDK from "iracing-web-sdk";
import { getCommands } from "../commands";
import { config, deployCommands } from "../util";

const run = async () => {
	const iRacingClient = new IRacingSDK(
		config.IRACING_USERNAME,
		config.IRACING_PASSWORD,
	);
	await iRacingClient.authenticate();

	deployCommands({
		commands: getCommands(iRacingClient),
		guildId: "949939970804703232",
	});
};

run();
