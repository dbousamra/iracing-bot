import IRacingSDK from "iracing-web-sdk";
import { config } from "../config";
import { getLatestRace } from "../iracing";
import { createRaceEmbed } from "../util";

const run = async () => {
	const iRacingClient = new IRacingSDK(
		config.IRACING_USERNAME,
		config.IRACING_PASSWORD,
	);
	await iRacingClient.authenticate();

	const user = config.TRACKED_USERS.find((u) => u.name === "Dom")!;

	const race = await getLatestRace(iRacingClient, {
		customerId: Number(user.customerId),
	});

	console.log(createRaceEmbed(race).data.fields);
};

run();
