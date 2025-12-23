import type { IRacingClient } from "./iracing-client";
import {
	calculateBottleMeter,
	calculateMichaelsBottleMeter,
} from "./bottle-meter";

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
		oldiRating: res.oldi_rating ?? 0,
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

/**
 * Get recent form with trend analysis for up to 50 recent races
 */
export const getRecentForm = async (
	iRacingClient: IRacingClient,
	options: {
		customerId: number;
	},
) => {
	const { customerId } = options;

	const [customer, recentRaces] = await Promise.all([
		iRacingClient.getMemberProfile({ cust_id: customerId }),
		iRacingClient.getRecentRaces({ cust_id: customerId }),
	]);

	const driverName = customer.member_info.display_name;

	// Note: The iRacing API doesn't support pagination for this endpoint.
	// We request up to 50 races, but the API may return fewer depending on
	// what's available for this member.
	const maxRaces = 50;
	const racesToAnalyze = recentRaces.races.slice(0, maxRaces);

	// Calculate trend metrics
	const raceMetrics = racesToAnalyze.map((race) => {
		const iratingChange = race.newi_rating - race.oldi_rating;
		const positionChange = race.start_position - race.finish_position;
		const srChange = (race.new_sub_level - race.old_sub_level) / 100;
		return {
			subsessionId: race.subsession_id,
			series: race.series_name,
			track: race.track.track_name,
			startPos: race.start_position,
			finishPos: race.finish_position,
			positionChange,
			iRating: race.newi_rating,
			iratingChange,
			incidents: race.incidents,
			sof: race.strength_of_field,
			sessionStartTime: race.session_start_time,
			srChange,
		};
	});

	// Calculate trends
	const totalIratingChange = raceMetrics.reduce(
		(acc, race) => acc + race.iratingChange,
		0,
	);
	const avgIratingChange = (totalIratingChange / raceMetrics.length).toFixed(0);
	const avgFinishPos =
		raceMetrics.reduce((acc, race) => acc + race.finishPos, 0) /
		raceMetrics.length;
	const avgStartPos =
		raceMetrics.reduce((acc, race) => acc + race.startPos, 0) /
		raceMetrics.length;
	const avgIncidents =
		raceMetrics.reduce((acc, race) => acc + race.incidents, 0) /
		raceMetrics.length;
	const avgSof =
		raceMetrics.reduce((acc, race) => acc + race.sof, 0) / raceMetrics.length;

	// Calculate SR metrics
	const totalSrChange = raceMetrics.reduce(
		(acc, race) => acc + race.srChange,
		0,
	);
	const avgSrChange = (totalSrChange / raceMetrics.length).toFixed(2);

	const wins = raceMetrics.filter((r) => r.finishPos === 1).length;
	const top5 = raceMetrics.filter((r) => r.finishPos <= 5).length;
	const positionsGained = raceMetrics.reduce(
		(acc, race) => acc + Math.max(0, race.positionChange),
		0,
	);

	// Calculate number of races in last 30 days
	const thirtyDaysAgo = new Date();
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
	const racesLast30Days = raceMetrics.filter(
		(race) => new Date(race.sessionStartTime) >= thirtyDaysAgo,
	).length;

	// Determine trend color: green if gaining iRating, red if losing
	const trendColor = totalIratingChange >= 0 ? 0x00ff00 : 0xff0000;

	// Get current iRating from most recent race
	const currentIrating = raceMetrics[0]?.iRating ?? 0;

	return {
		driverName,
		currentIrating,
		raceMetrics,
		trends: {
			totalIratingChange,
			avgIratingChange,
			avgFinishPos: avgFinishPos.toFixed(1),
			avgStartPos: avgStartPos.toFixed(1),
			avgIncidents: avgIncidents.toFixed(2),
			avgSof: Math.round(avgSof),
			totalSrChange: totalSrChange.toFixed(2),
			avgSrChange,
			racesLast30Days,
			wins,
			top5,
			positionsGained,
		},
		trendColor,
	};
};

export type GetRecentFormResponse = Awaited<ReturnType<typeof getRecentForm>>;
