import type { IRacingClient } from "./iracing-client";

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

	const driverName = customer.member_info.display_name;

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
	};
};

export type GetLatestRaceResponse = Awaited<ReturnType<typeof getLatestRace>>;
