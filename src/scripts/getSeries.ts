import IRacingSDK from "iracing-web-sdk";
import { config } from "../config";
import { getLatestRace } from "../iracing";

const run = async () => {
	const iRacingClient = new IRacingSDK(
		config.IRACING_USERNAME,
		config.IRACING_PASSWORD,
	);
	await iRacingClient.authenticate();

	const x = await getLatestRace({
		customerId: 769513,
	});

	console.log(x);
};

run();
