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
		customerId: 404007,
	});

	console.log(x.qualifyingTime);
	console.log(x.averageLapTime);
	console.log(x.bestLapTime);
};

run();
