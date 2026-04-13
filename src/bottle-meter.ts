export type MichaelsBottleLevel =
	| "bradbury"
	| "world-champion-hotline"
	| "no-bottleo"
	| "low-moderate"
	| "high"
	| "very-high"
	| "severe"
	| "extreme"
	| "catastrophic";

export interface MichaelsBottleMeterResult {
	level: MichaelsBottleLevel;
	levelNumber: number; // 1-8
	emoji: string;
	explanation: string;
}

export interface BottleResult {
	level: MichaelsBottleLevel;
	levelNumber: number;
	emoji: string;
	explanation: string;
}

export const calculateMichaelsBottleMeter = (raceData: {
	finishPos: number;
	oldiRating: number;
	allDriversData: { custId: number; oldiRating: number; finishPos: number }[];
	incidents: number;
	laps: number;
}): MichaelsBottleMeterResult => {
	const validDrivers = raceData.allDriversData;

	// If too few valid drivers, return default level
	if (validDrivers.length < 3) {
		throw new Error("Too few valid drivers");
	}

	// Sort drivers by starting iRating (descending) to determine expected order
	const sortedDrivers = [...validDrivers].sort((a, b) => {
		const ratingDiff = b.oldiRating - a.oldiRating;
		if (ratingDiff !== 0) return ratingDiff;
		// If iRatings are equal, maintain original order (stable sort)
		return validDrivers.indexOf(a) - validDrivers.indexOf(b);
	});

	// Find the driver's expected position based on their iRating rank
	const driverIndex = sortedDrivers.findIndex(
		(d) => d.oldiRating === raceData.oldiRating,
	);

	// If driver not found in results, return default level
	if (driverIndex === -1) {
		throw new Error("Driver not found in results");
	}

	const rank = driverIndex + 1; // 1-indexed position (expected)
	const incidents = raceData.incidents;
	const laps = raceData.laps;
	const totalCars = validDrivers.length;
	const position = raceData.finishPos;

	// Calculate chaos factor: proportion of drivers who finished 30%+ positions worse than expected
	const chaosFactor = calculateChaosFactor(sortedDrivers, totalCars);

	const { level, levelNumber, emoji, explanation } =
		calculateMichaelBottleResult({
			rank,
			incidents,
			laps,
			totalCars,
			position,
			chaosFactor,
		});

	return {
		level,
		levelNumber,
		emoji,
		explanation,
	};
};

/**
 * Calculates what proportion of drivers finished significantly worse than their
 * iRating-expected position. A high chaos factor means lots of crashes/DNFs.
 */
const calculateChaosFactor = (
	sortedByIRating: { oldiRating: number; finishPos: number }[],
	totalCars: number,
): number => {
	const threshold = Math.max(0.3 * totalCars, 3);
	let crashedCount = 0;
	for (let i = 0; i < sortedByIRating.length; i++) {
		const expectedPos = i + 1;
		const actualPos = sortedByIRating[i].finishPos;
		if (actualPos - expectedPos >= threshold) {
			crashedCount++;
		}
	}
	return crashedCount / totalCars;
};

export const calculateTeamBottleMeter = (options: {
	teamPosition: number;
	avgTeamIRating: number;
	classResults: Array<{ oldIRating: number; finishPosition: number }>;
	totalIncidents: number;
	totalLaps: number;
}): MichaelsBottleMeterResult => {
	const {
		teamPosition,
		avgTeamIRating,
		classResults,
		totalIncidents,
		totalLaps,
	} = options;

	// Sort class results by iRating to determine expected position
	const sortedByIrating = [...classResults].sort(
		(a, b) => b.oldIRating - a.oldIRating,
	);

	// Find expected position based on average team iRating
	let expectedPosition = 1;
	for (let i = 0; i < sortedByIrating.length; i++) {
		if ((sortedByIrating[i]?.oldIRating ?? 0) > avgTeamIRating) {
			expectedPosition++;
		} else {
			break;
		}
	}

	const totalCars = classResults.length;

	return calculateMichaelBottleResult({
		rank: expectedPosition,
		incidents: totalIncidents,
		laps: totalLaps,
		totalCars,
		position: teamPosition,
	});
};

export const calculateMichaelBottleResult = (params: {
	rank: number;
	incidents: number;
	laps: number;
	totalCars: number;
	position: number;
	chaosFactor?: number;
}): MichaelsBottleMeterResult => {
	const { rank, incidents, laps, totalCars, position, chaosFactor } = params;

	const positionDiff = position - rank;
	const expectedIncidents = Math.round(laps / 10 + 3);

	if (position <= rank - 0.25 * totalCars) {
		// Bradbury: finished way better than expected, but mostly because
		// everyone else crashed out (chaos factor >= 40% of field)
		if (chaosFactor !== undefined && chaosFactor >= 0.4) {
			return {
				level: "bradbury",
				levelNumber: 1,
				emoji: "⛸️",
				explanation: `Finished P${position}, ${Math.abs(positionDiff)} places better than expected (P${rank}). Steven Bradbury special — stayed out of trouble while ${Math.round(chaosFactor * 100)}% of the field crashed and burned around them.`,
			};
		}

		return {
			level: "world-champion-hotline",
			levelNumber: 1,
			emoji: "👑",
			explanation: `Finished P${position}, ${Math.abs(positionDiff)} places better than expected (P${rank}). Absolutely elite performance, finished ${Math.round(0.25 * totalCars)}+ positions above iRating expectation.`,
		};
	}

	if (position <= rank + 0.1 * totalCars && incidents < laps / 10 + 3) {
		return {
			level: "no-bottleo",
			levelNumber: 2,
			emoji: "🟢",
			explanation: `Finished P${position}, ${positionDiff >= 0 ? `${positionDiff} places behind` : `${Math.abs(positionDiff)} places ahead of`} expected (P${rank}). Clean race with ${incidents} incidents (under ${expectedIncidents} threshold). Well driven.`,
		};
	}

	if (position <= rank + 0.2 * totalCars) {
		return {
			level: "low-moderate",
			levelNumber: 3,
			emoji: "🟡",
			explanation: `Finished P${position}, ${positionDiff >= 0 ? `${positionDiff} places behind` : `${Math.abs(positionDiff)} places ahead of`} expected (P${rank}). ${incidents >= expectedIncidents ? `${incidents} incidents (over ${expectedIncidents} threshold) despite finishing ${positionDiff >= 0 ? "behind" : "near"} expectation.` : "Slight underperformance relative to iRating."}`,
		};
	}

	if (position <= rank + 0.3 * totalCars) {
		return {
			level: "high",
			levelNumber: 4,
			emoji: "🟠",
			explanation: `Finished P${position}, ${positionDiff} places behind expected (P${rank}). Finished ${Math.round(0.2 * totalCars)}-${Math.round(0.3 * totalCars)} positions below iRating expectation. ${incidents} incidents in ${laps} laps.`,
		};
	}

	if (position <= rank + 0.4 * totalCars) {
		return {
			level: "very-high",
			levelNumber: 5,
			emoji: "🔥",
			explanation: `Finished P${position}, ${positionDiff} places behind expected (P${rank}). Significantly underperformed iRating expectation by ${Math.round(0.3 * totalCars)}-${Math.round(0.4 * totalCars)} positions. ${incidents} incidents.`,
		};
	}

	if (position <= rank + 0.5 * totalCars) {
		return {
			level: "severe",
			levelNumber: 6,
			emoji: "🔥🔥",
			explanation: `Finished P${position}, ${positionDiff} places behind expected (P${rank}). Severely underperformed by ${Math.round(0.4 * totalCars)}-${Math.round(0.5 * totalCars)} positions. ${incidents} incidents suggest significant race struggles.`,
		};
	}

	if (position <= rank + 0.6 * totalCars) {
		return {
			level: "extreme",
			levelNumber: 7,
			emoji: "💥🔥",
			explanation: `Finished P${position}, ${positionDiff} places behind expected (P${rank}). Extreme underperformance dropping ${Math.round(0.5 * totalCars)}-${Math.round(0.6 * totalCars)} positions below expectation. ${incidents} incidents in ${laps} laps.`,
		};
	}

	return {
		level: "catastrophic",
		levelNumber: 8,
		emoji: "💥🔥💥",
		explanation: `Finished P${position}, ${positionDiff} places behind expected (P${rank}). Catastrophic race dropping ${Math.round(0.6 * totalCars)}+ positions below iRating expectation. ${incidents} incidents - things went very wrong.`,
	};
};
