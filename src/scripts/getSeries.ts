import { config } from "../config";
import { getLatestRace } from "../iracing";
import { IRacingClient } from "../iracing-client";

const run = async () => {
	const iRacingClient = new IRacingClient({
		username: config.IRACING_USERNAME,
		password: config.IRACING_PASSWORD,
		clientId: config.IRACING_CLIENT_ID,
		clientSecret: config.IRACING_CLIENT_SECRET,
	});

	const latestRace = await getLatestRace(iRacingClient, {
		customerId: 404007,
	});
	console.log(latestRace);
};

run();
