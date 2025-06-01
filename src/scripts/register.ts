import IRacingSDK from "iracing-web-sdk";
import { getCommands } from "../commands";
import { config } from "../config";
import { deployCommands } from "../util";

const run = async () => {
	const iRacingClient = new IRacingSDK(
		config.IRACING_USERNAME,
		config.IRACING_PASSWORD,
	);
	await iRacingClient.authenticate();

	deployCommands({
		commands: await getCommands(iRacingClient),
		guildId: "949939970804703232",
	});
};

run();
