import { calculateMichaelsBottleMeter } from "./bottle-meter";
import type { BottleLeaderboardEntry, Db, DriverStats } from "./db";
import type {
	DriverResult,
	IRacingClient,
	ResultEntry,
	SessionData,
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
		michaelsBottleMeter,
	};
};

export type GetLatestRaceResponse = Awaited<ReturnType<typeof getLatestRace>>;

export interface TeamRaceData {
	subsessionId: number;
	teamId: number;
	teamName: string;
	series: string;
	track: string;
	carClass: string;
	strengthOfField: number;
	sessionStartTime: string;
	teamPosition: number;
	teamPositionInClass: number;
	totalLaps: number;
	totalIncidents: number;
	drivers: Array<{
		customerId: number;
		displayName: string;
		lapsComplete: number;
		incidents: number;
		oldIRating: number;
		newIRating: number;
		iRatingChange: number;
		oldSubLevel: number;
		newSubLevel: number;
		subLevelChange: number;
	}>;
	avgTeamIRating: number;
	classResults: Array<{ oldIRating: number; finishPosition: number }>;
	totalEntries: number;
	classEntries: number;
}

export const getTeamRaceData = async (
	iRacingClient: IRacingClient,
	options: {
		subsessionId: number;
		teamId: number;
		trackedCustomerIds: number[];
	},
): Promise<TeamRaceData> => {
	const { subsessionId, teamId, trackedCustomerIds } = options;

	const results = (await iRacingClient.getResults({
		subsession_id: subsessionId,
	})) as unknown as SessionData;

	const raceSession = results.session_results.find(
		(res) => res.simsession_name === "RACE",
	);

	if (!raceSession) {
		throw new Error("No race session found");
	}

	// Find the team entry - cast results to ResultEntry[] since that's the actual type
	const teamEntry = (raceSession.results as unknown as ResultEntry[]).find(
		(res) => res.team_id === teamId,
	);

	if (!teamEntry) {
		throw new Error(`Team ${teamId} not found in race results`);
	}

	// Extract driver data for tracked drivers
	const drivers =
		teamEntry.driver_results
			?.filter((driver: DriverResult) =>
				trackedCustomerIds.includes(driver.cust_id ?? 0),
			)
			.map((driver: DriverResult) => ({
				customerId: driver.cust_id ?? 0,
				displayName: driver.display_name,
				lapsComplete: driver.laps_complete,
				incidents: driver.incidents,
				oldIRating: driver.oldi_rating,
				newIRating: driver.newi_rating,
				iRatingChange: driver.newi_rating - driver.oldi_rating,
				oldSubLevel: driver.old_sub_level / 100,
				newSubLevel: driver.new_sub_level / 100,
				subLevelChange: driver.new_sub_level / 100 - driver.old_sub_level / 100,
			})) ?? [];

	// Calculate average team iRating
	const avgTeamIRating =
		drivers.length > 0
			? drivers.reduce((acc: number, d) => acc + d.oldIRating, 0) /
				drivers.length
			: 0;

	// Get class results for bottle meter calculation
	const classResults = (raceSession.results as unknown as ResultEntry[])
		.filter((res) => res.car_class_id === teamEntry.car_class_id)
		.map((res) => ({
			oldIRating: res.oldi_rating,
			finishPosition: res.finish_position_in_class,
		}));

	const carClass = results.car_classes.find(
		(c) => c.car_class_id === teamEntry.car_class_id,
	);

	return {
		subsessionId,
		teamId,
		teamName: teamEntry.car_name,
		series: results.season_name,
		track: results.track.track_name,
		carClass: carClass?.name ?? teamEntry.car_class_name,
		strengthOfField: results.event_strength_of_field,
		sessionStartTime: results.start_time,
		teamPosition: teamEntry.finish_position,
		teamPositionInClass: teamEntry.finish_position_in_class,
		totalLaps: teamEntry.laps_complete,
		totalIncidents: teamEntry.incidents,
		drivers,
		avgTeamIRating,
		classResults,
		totalEntries: raceSession.results.length,
		classEntries: classResults.length,
	};
};

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
		customerIds: number[];
		customerNames?: Record<number, string>;
	},
): Promise<DriverStats[]> => {
	const {
		seasonYear,
		seasonQuarter,
		licenseCategory,
		forceRefresh,
		customerIds,
		customerNames,
	} = options;

	// Use provided customerIds or fall back to hardcoded list
	const customersToFetch = Object.fromEntries(
		customerIds.map((id) => [customerNames?.[id] ?? id.toString(), id]),
	);

	// Build cache key (include customerIds in key if provided)
	const cacheKey = customerIds
		? `${seasonYear}_${seasonQuarter}_${licenseCategory.replace(/ /g, "_")}_custom_${customerIds.sort().join("_")}`
		: `${seasonYear}_${seasonQuarter}_${licenseCategory.replace(/ /g, "_")}`;

	// Check cache first (unless force refresh)
	if (!forceRefresh) {
		const cached = await db.getLeaderboardCache(cacheKey);
		if (cached) {
			console.log(`Using cached leaderboard data for ${cacheKey}`);
			return cached.data;
		}
	}

	console.log(`Fetching fresh leaderboard data for ${cacheKey}...`);

	// Fetch data for all customers
	const customerStats: DriverStats[] = [];

	for (const [name, customerId] of Object.entries(customersToFetch)) {
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

export const getBottleLeaderboard = async (
	iRacingClient: IRacingClient,
	db: Db,
	options: {
		seasonYear: number;
		seasonQuarter: number;
		licenseCategory: string;
		forceRefresh?: boolean;
		customerIds: number[];
		customerNames?: Record<number, string>;
	},
): Promise<BottleLeaderboardEntry[]> => {
	const {
		seasonYear,
		seasonQuarter,
		licenseCategory,
		forceRefresh,
		customerIds,
		customerNames,
	} = options;

	const customersToFetch = Object.fromEntries(
		customerIds.map((id) => [customerNames?.[id] ?? id.toString(), id]),
	);

	const cacheKey = `bottle_${seasonYear}_${seasonQuarter}_${licenseCategory.replace(/ /g, "_")}_${customerIds.sort().join("_")}`;

	if (!forceRefresh) {
		const cached = await db.getBottleLeaderboardCache(cacheKey);
		if (cached) {
			console.log(`Using cached bottle leaderboard data for ${cacheKey}`);
			return cached.data;
		}
	}

	console.log(`Fetching fresh bottle leaderboard data for ${cacheKey}...`);

	const entries: BottleLeaderboardEntry[] = [];

	for (const [name, customerId] of Object.entries(customersToFetch)) {
		try {
			console.log(`⬇️  Downloading bottle data for ${name}...`);

			const seriesResults = await iRacingClient.searchSeries({
				cust_id: customerId.toString(),
				season_year: seasonYear.toString(),
				season_quarter: seasonQuarter.toString(),
				official_only: "true",
				event_types: "5",
			});

			const categoryRaces = seriesResults.filter(
				(race) => race.license_category === licenseCategory,
			);

			const sortedRaces = categoryRaces.sort(
				(a, b) =>
					new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
			);

			const bottleResults = compact(
				await map(
					sortedRaces,
					async (race) => {
						const subsessionResults = await iRacingClient.getResults({
							subsession_id: race.subsession_id,
						});

						const raceSession = subsessionResults.session_results.find(
							(result) => result.simsession_name === "RACE",
						);

						if (!raceSession) return undefined;

						const driverResult = raceSession.results.find(
							(result) =>
								result.cust_id?.toString() === customerId.toString(),
						);

						if (!driverResult) return undefined;

						const classResults = raceSession.results.filter(
							(res) => res.car_class_id === driverResult.car_class_id,
						);

						if (classResults.length < 3) return undefined;

						const allDriversData = classResults.map((res) => ({
							custId: res.cust_id ?? 0,
							oldiRating: res.oldi_rating < 0 ? 0 : res.oldi_rating,
							finishPos:
								res.finish_position_in_class ?? res.finish_position ?? 0,
						}));

						try {
							return calculateMichaelsBottleMeter({
								finishPos:
									driverResult.finish_position_in_class ??
									driverResult.finish_position ??
									0,
								oldiRating:
									driverResult.oldi_rating < 0
										? 0
										: driverResult.oldi_rating,
								allDriversData,
								incidents: driverResult.incidents,
								laps: driverResult.laps_complete,
							});
						} catch {
							return undefined;
						}
					},
					{ concurrency: 8 },
				),
			);

			let catastrophicCount = 0;
			let worldChampionCount = 0;

			for (const result of bottleResults) {
				if (result.level === "catastrophic") catastrophicCount++;
				if (result.level === "world-champion-hotline") worldChampionCount++;
			}

			if (bottleResults.length > 0) {
				entries.push({
					customerId,
					customerName: name,
					totalRaces: bottleResults.length,
					catastrophicCount,
					worldChampionCount,
				});
			}
		} catch (error) {
			console.error(`❌ Error fetching bottle data for ${name}:`, error);
		}
	}

	// Sort by catastrophic count descending (biggest bottlers on top)
	const sorted = entries.sort(
		(a, b) => b.catastrophicCount - a.catastrophicCount,
	);

	await db.setBottleLeaderboardCache(cacheKey, sorted);
	console.log(`✅ Cached bottle leaderboard data for ${cacheKey}`);

	return sorted;
};
