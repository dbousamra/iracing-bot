#!/usr/bin/env tsx

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { config } from "../config";
import {
	type DriverResult,
	IRacingClient,
	type SearchSeriesResult,
	type SubsessionResults,
} from "../iracing-client";
import { compact, map } from "../util";

const customers = {
	"Chris Wilson6": 151465,
	"Amilie Furmań": 133234,
	"Daniel Baez": 132641,
	"Dominic Bou-Samra": 404007,
	"Janne Salminen": 592520,
	"Laurent Masson": 949802,
	"Sam Millar": 906888,

	"Aden Lennox-Bradley": 342461,

	"Bradley Whittaker": 1323000,

	"Brock Hellmech": 1199307,

	"Byren Webley": 1083104,

	"David Piljek": 900057,

	"Erik van der Bijl": 138878,

	"Fred Zufelt": 105768,

	"Jake Lennox-Bradley": 732853,

	"Jarod Mcleod": 1234205,

	"Jarrod Williams": 721800,

	"Joseph Tavora": 126395,

	"Luke Hay": 712812,
	"Matt Blee": 353389,

	"Matt Gregier": 1360582,

	"Matt Halden": 965609,

	"Michael S Cullen": 793206,

	"Tom Roberts": 616110,

	"Tom Williams6": 489441,

	"Zach Martin5": 875230,
};

const calculateStats = (
	results: {
		subsessionResults: SubsessionResults;
		driverResult: DriverResult;
	}[],
) => {
	// Filter out races with -1 iRating (not established yet)
	const validResults = results.filter(
		(result) =>
			result.driverResult.oldi_rating > 0 &&
			result.driverResult.newi_rating > 0,
	);

	const driverResults = validResults.map((result) => result.driverResult);
	const totalRaces = driverResults.length;
	const totalWins = driverResults.filter(
		(result) => result.finish_position === 1,
	).length;

	const startingIrating = driverResults[0]?.oldi_rating ?? 0;
	const endingIrating =
		driverResults[driverResults.length - 1]?.newi_rating ?? 0;
	const startingSr = driverResults[0]
		? driverResults[0].old_sub_level / 100
		: 0;
	const endingSr = driverResults[driverResults.length - 1]
		? driverResults[driverResults.length - 1].new_sub_level / 100
		: 0;
	const iratingGain = endingIrating - startingIrating;
	const srGain = endingSr - startingSr;

	const averageStartPosition =
		driverResults.reduce((acc, result) => acc + result.starting_position, 0) /
		totalRaces;
	const averageFinishPosition =
		driverResults.reduce((acc, result) => acc + result.finish_position, 0) /
		totalRaces;
	const averageIncidents =
		driverResults.reduce((acc, result) => acc + result.incidents, 0) /
		totalRaces;

	const iratingAtEachRace = validResults.map(
		({ driverResult, subsessionResults }) => ({
			x: new Date(subsessionResults.end_time).getTime(),
			y: driverResult.newi_rating - startingIrating,
		}),
	);

	// Calculate average races per day
	const firstRaceTime = validResults[0]
		? new Date(validResults[0].subsessionResults.end_time).getTime()
		: 0;
	const lastRaceTime = validResults[validResults.length - 1]
		? new Date(
				validResults[validResults.length - 1].subsessionResults.end_time,
			).getTime()
		: 0;
	const daysSpan = (lastRaceTime - firstRaceTime) / (1000 * 60 * 60 * 24);
	const avgRacesPerDay = daysSpan > 0 ? totalRaces / daysSpan : 0;

	return {
		totalRaces,
		totalWins,
		startingIrating,
		endingIrating,
		iratingGain,
		startingSr,
		endingSr,
		srGain,
		averageStartPosition,
		averageFinishPosition,
		averageIncidents,
		iratingAtEachRace,
		avgRacesPerDay,
	};
};


const iRacingClient = new IRacingClient({
	username: config.IRACING_USERNAME,
	password: config.IRACING_PASSWORD,
	clientId: config.IRACING_CLIENT_ID,
	clientSecret: config.IRACING_CLIENT_SECRET,
});
const run = async () => {
	const customerStats: Array<{
		name: string;
		iratingGain: number;
		totalRaces: number;
		startingIrating: number;
		endingIrating: number;
		avgRacesPerDay: number;
		startingSr: number;
		endingSr: number;
		srGain: number;
	}> = [];

	const cacheFile = "race_data_cache.json";

	let cachedData: Record<
		string,
		{
			subsessionResults: SubsessionResults;
			driverResult: DriverResult;
		}[]
	> = {};

	// Check if cache file exists and load it
	if (existsSync(cacheFile)) {
		console.log("📦 Loading data from cache file...");
		const cacheContent = readFileSync(cacheFile, "utf-8");
		cachedData = JSON.parse(cacheContent);
	}

	for (const [name, customer] of Object.entries(customers)) {
		try {
			let results: {
				subsessionResults: SubsessionResults;
				driverResult: DriverResult;
			}[];

			// Check if we have cached data for this customer
			if (cachedData[customer.toString()]) {
				console.log(`✅ Using cached data for ${name}`);
				results = cachedData[customer.toString()];
			} else {
				console.log(`⬇️  Downloading data for ${name}...`);

				const seriesResults = await iRacingClient.searchSeries({
					cust_id: customer.toString(),
					season_year: "2026",
					season_quarter: "1",
					official_only: "true",
					event_types: "5",
				});

				// Filter to only include Sports Car races
				const sportsCarRaces = seriesResults.filter(
					(race) => race.license_category === "Sports Car",
				);

				const lastRaces = sportsCarRaces.sort(
					(a, b) =>
						new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
				);

				results = compact(
					await map(
						lastRaces,
						async (race) => {
							const subsessionResults = await iRacingClient.getResults({
								subsession_id: race.subsession_id,
							});

							const driverResult =
								subsessionResults.session_results
									.find((result) => result.simsession_name === "RACE")
									?.results.find(
										(result) =>
											result.cust_id?.toString() === customer.toString(),
									) ?? undefined;

							if (!driverResult) {
								return undefined;
							}

							return { subsessionResults, driverResult };
						},
						{ concurrency: 8 },
					),
				);

				// Cache the results
				cachedData[customer.toString()] = results;
				writeFileSync(cacheFile, JSON.stringify(cachedData, null, 2));
				console.log(`💾 Cached data for ${name}`);
			}

			const stats = calculateStats(results);
			console.log(stats);

			customerStats.push({
				name,
				iratingGain: stats.iratingGain,
				totalRaces: stats.totalRaces,
				startingIrating: stats.startingIrating,
				endingIrating: stats.endingIrating,
				avgRacesPerDay: stats.avgRacesPerDay,
				startingSr: stats.startingSr,
				endingSr: stats.endingSr,
				srGain: stats.srGain,
			});
		} catch (error) {
			console.error(`\n❌ Error fetching data for customer ${name}:`, error);
		}
	}

	// Sort and display leaderboard
	const sortedStats = customerStats.sort(
		(a, b) => b.iratingGain - a.iratingGain,
	);
	console.log("\n\n🏆 iRating Gain Leaderboard - 2026 Season 1\n");
	console.log(
		"Rank | Driver                      | Start iR | End iR | iR Δ     | Start SR | End SR | SR Δ  | Races | Avg/Day",
	);
	console.log(
		"-----|-----------------------------|---------:|-------:|---------:|---------:|-------:|------:|------:|--------:",
	);
	sortedStats.forEach((stat, index) => {
		const rank = (index + 1).toString().padStart(4, " ");
		const name = stat.name.padEnd(26, " ");
		const startIr = stat.startingIrating.toString().padStart(8, " ");
		const endIr = stat.endingIrating.toString().padStart(6, " ");
		const irGain =
			stat.iratingGain >= 0
				? `+${stat.iratingGain}`.padStart(9, " ")
				: stat.iratingGain.toString().padStart(9, " ");
		const startSr = stat.startingSr.toFixed(2).padStart(8, " ");
		const endSr = stat.endingSr.toFixed(2).padStart(6, " ");
		const srGain =
			stat.srGain >= 0
				? `+${stat.srGain.toFixed(2)}`.padStart(6, " ")
				: stat.srGain.toFixed(2).padStart(6, " ");
		const races = stat.totalRaces.toString().padStart(5, " ");
		const avgPerDay = stat.avgRacesPerDay.toFixed(2).padStart(7, " ");

		// Color the row based on gain/loss
		const color = stat.iratingGain >= 0 ? "\x1b[32m" : "\x1b[31m";
		const reset = "\x1b[0m";
		console.log(
			`${color}${rank} | ${name} | ${startIr} | ${endIr} | ${irGain} | ${startSr} | ${endSr} | ${srGain} | ${races} | ${avgPerDay}${reset}`,
		);
	});
};

run();
