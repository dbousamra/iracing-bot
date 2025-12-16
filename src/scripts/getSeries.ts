import fs from "node:fs";
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

	// const x = await getLatestRace(iRacingClient, {
	// 	customerId: 404007,
	// });

	// console.log(x.qualifyingTime);
	// console.log(x.averageLapTime);
	// console.log(x.bestLapTime);

	const doc = await iRacingClient.getDoc();
	fs.writeFileSync("doc.json", JSON.stringify(doc, null, 2));
};

run();
