import {
	calculateBottleMeter,
	calculateMichaelsBottleMeter,
} from "./bottle-meter";
import type { Db, DriverStats } from "./db";
import type {
	DriverResult,
	IRacingClient,
	SubsessionResults,
} from "./iracing-client";
import { compact, map } from "./util";

export const formatLaptime = (laptime: number): string => {
	const microseconds = laptime * 100;
	const totalMilliseconds = Math.floor(microseconds / 1000);
	const minutes = Math.floor(totalMilliseconds / 60000);
	const seconds = Math.floor((totalMilliseconds % 60000) / 1000);
	const milliseconds = totalMilliseconds % 1000;
	return `${minutes}:${seconds.toString().padStart(2, "0")}.${milliseconds.toString().padStart(3, "0")}`;
};

export const getDriverResults = <
	A extends { cust_id?: number; driver_results?: A[] },
>(
	results: A[],
	customerId: number,
) => {
	const customerResults = [
		...results.flatMap((res) => res.driver_results ?? []),
		...results,
	];
	const customerResult = customerResults.find(
		(res) => res.cust_id === customerId,
	);

	return customerResult;
};

export const getLatestRace = async (
	iRacingClient: IRacingClient,
	options: {
		customerId: number;
	},
) => {
	const { customerId } = options;

	const customer = await iRacingClient.getMemberProfile({
		cust_id: customerId,
	});
	const recentRaces = await iRacingClient.getRecentRaces({
		cust_id: customerId,
	});

	const race = recentRaces.races[0];

	const results = await iRacingClient.getResults({
		subsession_id: race.subsession_id,
	});

	const sessionSplit = results.session_splits.findIndex(
		(split) => split.subsession_id === race.subsession_id,
	);

	const raceSession = results.session_results.find(
		(res) => res.simsession_name === "RACE",
	);

	const qualiSession = results.session_results.find(
		(res) => res.simsession_name === "QUALIFY",
	);

	const raceSessionResult = getDriverResults(
		raceSession?.results ?? [],
		customerId,
	);

	const qualiSessionResult = getDriverResults(
		qualiSession?.results ?? [],
		customerId,
	);

	const endTime = results.end_time;

	// Filter results to only those in the same car class as the driver
	const classResults =
		raceSession?.results.filter(
			(res) => res.car_class_id === race.car_class_id,
		) ?? [];
	const entries = classResults.length;

	// Extract all drivers' iRatings and positions for Michael's bottlemeter
	const allDriversData = classResults.map((res) => ({
		custId: res.cust_id ?? 0,
		oldiRating: res.oldi_rating < 0 ? 0 : res.oldi_rating,
		finishPos: res.finish_position_in_class ?? res.finish_position ?? 0,
	}));

	// Calculate rank within class by iRating
	const sortedByIrating = [...classResults].sort(
		(a, b) => (b.oldi_rating ?? 0) - (a.oldi_rating ?? 0),
	);
	const iRatingRank =
		sortedByIrating.findIndex((res) => res.cust_id === customerId) + 1;

	const driverName = customer.member_info.display_name;

	// Note: race.start_position and race.finish_position already represent class positions
	// when the race data comes from the recent races API
	const startPos = race.start_position;
	const finishPos = race.finish_position;
	const incidents = race.incidents;
	const newIrating = race.newi_rating;
	const oldIrating = race.oldi_rating;
	const iratingChange = newIrating - oldIrating;
	const oldSubLevel = race.old_sub_level / 100;
	const newSubLevel = race.new_sub_level / 100;
	const subLevelChange = (newSubLevel - oldSubLevel).toFixed(2);
	const series = race.series_name;
	const sof = race.strength_of_field;
	const trackName = race.track.track_name;
	const laps = race.laps;
	const averageLapTime = formatLaptime(raceSessionResult?.average_lap ?? 1);
	const bestLapTime = formatLaptime(raceSessionResult?.best_lap_time ?? 1);
	const qualifyingTime = qualiSessionResult?.best_qual_lap_time
		? formatLaptime(qualiSessionResult.best_qual_lap_time)
		: "No time";
	const car = results.car_classes.find(
		(c) => c.car_class_id === race.car_class_id,
	);
	const color = iratingChange > 0 ? 0x00ff00 : 0xff0000;
	const split = `${sessionSplit + 1} / ${results.session_splits.length}`;

	// Calculate bottle-meter
	const bottleMeter = calculateBottleMeter({
		startPos,
		finishPos,
		entries,
		iratingChange,
		oldSubLevel,
		newSubLevel,
		incidents,
		laps,
	});

	// Calculate Michael's bottle-meter
	const michaelsBottleMeter = calculateMichaelsBottleMeter({
		finishPos,
		oldiRating: oldIrating,
		allDriversData,
		incidents,
		laps,
	});

	return {
		driverName,
		endTime,
		startPos,
		finishPos,
		incidents,
		newIrating,
		iratingChange,
		oldSubLevel,
		newSubLevel,
		subLevelChange,
		split,
		series,
		sof,
		trackName,
		laps,
		averageLapTime,
		bestLapTime,
		qualifyingTime,
		car,
		color,
		race,
		entries,
		iRatingRank,
		bottleMeter,
		michaelsBottleMeter,
	};
};

export type GetLatestRaceResponse = Awaited<ReturnType<typeof getLatestRace>>;

/**
 * Get comprehensive career statistics for a member
 */
export const getCareerStats = async (
	iRacingClient: IRacingClient,
	options: {
		customerId: number;
	},
) => {
	const { customerId } = options;

	const [customer, careerStats, summary] = await Promise.all([
		iRacingClient.getMemberProfile({ cust_id: customerId }),
		iRacingClient.getMemberCareerStats({ cust_id: customerId }),
		iRacingClient.getMemberSummary({ cust_id: customerId }),
	]);

	const driverName = customer.member_info.display_name;

	// Aggregate stats across all categories
	const aggregatedStats = careerStats.stats.reduce(
		(acc, stat) => {
			acc.totalStarts += stat.starts;
			acc.totalWins += stat.wins;
			acc.totalTop5 += stat.top5;
			acc.totalPoles += stat.poles;
			acc.totalLaps += stat.laps;
			acc.totalLapsLed += stat.laps_led;
			acc.totalIncidents += stat.avg_incidents * stat.starts;
			return acc;
		},
		{
			totalStarts: 0,
			totalWins: 0,
			totalTop5: 0,
			totalPoles: 0,
			totalLaps: 0,
			totalLapsLed: 0,
			totalIncidents: 0,
		},
	);

	// Calculate overall percentages
	const winPercentage =
		aggregatedStats.totalStarts > 0
			? (
					(aggregatedStats.totalWins / aggregatedStats.totalStarts) *
					100
				).toFixed(1)
			: "0.0";
	const top5Percentage =
		aggregatedStats.totalStarts > 0
			? (
					(aggregatedStats.totalTop5 / aggregatedStats.totalStarts) *
					100
				).toFixed(1)
			: "0.0";
	const polePercentage =
		aggregatedStats.totalStarts > 0
			? (
					(aggregatedStats.totalPoles / aggregatedStats.totalStarts) *
					100
				).toFixed(1)
			: "0.0";
	const lapsLedPercentage =
		aggregatedStats.totalLaps > 0
			? (
					(aggregatedStats.totalLapsLed / aggregatedStats.totalLaps) *
					100
				).toFixed(1)
			: "0.0";
	const avgIncidents =
		aggregatedStats.totalStarts > 0
			? (aggregatedStats.totalIncidents / aggregatedStats.totalStarts).toFixed(
					2,
				)
			: "0.00";

	// Break down by category (Oval, Road, Dirt Oval, Dirt Road)
	const categoryBreakdown = careerStats.stats.map((stat) => ({
		category: stat.category,
		starts: stat.starts,
		wins: stat.wins,
		top5: stat.top5,
		poles: stat.poles,
		winPercentage: stat.win_percentage.toFixed(1),
		top5Percentage:
			stat.starts > 0 ? ((stat.top5 / stat.starts) * 100).toFixed(1) : "0.0",
	}));

	return {
		driverName,
		aggregatedStats,
		winPercentage,
		top5Percentage,
		polePercentage,
		lapsLedPercentage,
		avgIncidents,
		categoryBreakdown,
		thisYearStats: summary.this_year,
	};
};

export type GetCareerStatsResponse = Awaited<ReturnType<typeof getCareerStats>>;

// Hardcoded list of customers to track for season leaderboard
const customers: Record<string, number> = {
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
		avgRacesPerDay,
	};
};

export const getSeasonLeaderboard = async (
	iRacingClient: IRacingClient,
	db: Db,
	options: {
		seasonYear: number;
		seasonQuarter: number;
		licenseCategory: string;
		forceRefresh?: boolean;
	},
): Promise<DriverStats[]> => {
	const { seasonYear, seasonQuarter, licenseCategory, forceRefresh } = options;

	// Build cache key
	const cacheKey = `${seasonYear}_${seasonQuarter}_${licenseCategory.replace(/ /g, "_")}`;

	// Check cache first (unless force refresh)
	if (!forceRefresh) {
		const cached = await db.getLeaderboardCache(cacheKey);
		if (cached) {
			console.log(`Using cached leaderboard data for ${cacheKey}`);
			return cached.data;
		}
	}

	console.log(`Fetching fresh leaderboard data for ${cacheKey}...`);

	// Fetch data for all hardcoded customers
	const customerStats: DriverStats[] = [];

	for (const [name, customerId] of Object.entries(customers)) {
		try {
			console.log(`⬇️  Downloading data for ${name}...`);

			const seriesResults = await iRacingClient.searchSeries({
				cust_id: customerId.toString(),
				season_year: seasonYear.toString(),
				season_quarter: seasonQuarter.toString(),
				official_only: "true",
				event_types: "5",
			});
			// Filter to only include specified license category races
			const categoryRaces = seriesResults.filter(
				(race) => race.license_category === licenseCategory,
			);

			const sortedRaces = categoryRaces.sort(
				(a, b) =>
					new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
			);

			// Fetch detailed results for each race
			const results = compact(
				await map(
					sortedRaces,
					async (race) => {
						const subsessionResults = await iRacingClient.getResults({
							subsession_id: race.subsession_id,
						});

						const driverResult = subsessionResults.session_results
							.find((result) => result.simsession_name === "RACE")
							?.results.find(
								(result) =>
									result.cust_id?.toString() === customerId.toString(),
							);

						if (!driverResult) {
							return undefined;
						}

						return { subsessionResults, driverResult };
					},
					{ concurrency: 8 },
				),
			);

			if (results.length === 0) {
				console.log(`No races found for ${name}`);
				continue;
			}

			const stats = calculateStats(results);

			customerStats.push({
				customerId,
				customerName: name,
				totalRaces: stats.totalRaces,
				totalWins: stats.totalWins,
				startingIrating: stats.startingIrating,
				endingIrating: stats.endingIrating,
				iratingGain: stats.iratingGain,
				startingSr: stats.startingSr,
				endingSr: stats.endingSr,
				srGain: stats.srGain,
				averageStartPosition: stats.averageStartPosition,
				averageFinishPosition: stats.averageFinishPosition,
				averageIncidents: stats.averageIncidents,
				avgRacesPerDay: stats.avgRacesPerDay,
			});
		} catch (error) {
			console.error(`❌ Error fetching data for ${name}:`, error);
		}
	}

	// Sort by iRating gain (descending)
	const sortedStats = customerStats.sort(
		(a, b) => b.iratingGain - a.iratingGain,
	);

	// Store in cache
	await db.setLeaderboardCache(cacheKey, sortedStats);
	console.log(`✅ Cached leaderboard data for ${cacheKey}`);

	return sortedStats;
};
