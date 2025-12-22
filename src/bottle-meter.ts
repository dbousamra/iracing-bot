export type BottleLevel = "moderate" | "high" | "extreme" | "catastrophic";

export type MichaelsBottleLevel =
	| "world-champion-hotline"
	| "no-bottle"
	| "low-moderate"
	| "high"
	| "very-high"
	| "severe"
	| "extreme"
	| "catastrophic";

export interface BottleMeterResult {
	level: BottleLevel;
	score: number; // Raw score 0-100
	factors: {
		positionLoss: number; // 0-30 points
		iRatingLoss: number; // 0-30 points
		safetyRatingLoss: number; // 0-20 points
		incidents: number; // 0-20 points
	};
	emoji: string;
}

export interface MichaelsBottleMeterResult {
	level: MichaelsBottleLevel;
	levelNumber: number; // 1-8
	emoji: string;
}

export const calculateBottleMeter = (raceData: {
	startPos: number;
	finishPos: number;
	entries: number;
	iratingChange: number;
	oldSubLevel: number;
	newSubLevel: number;
	incidents: number;
	laps: number;
}): BottleMeterResult => {
	const factors = {
		positionLoss: 0,
		iRatingLoss: 0,
		safetyRatingLoss: 0,
		incidents: 0,
	};

	// 1. Position Loss (0-30 points)
	const positionDrop = raceData.finishPos - raceData.startPos;
	const percentageDrop = (positionDrop / raceData.entries) * 100;

	if (percentageDrop > 75) {
		factors.positionLoss = 30;
	} else if (percentageDrop > 50) {
		factors.positionLoss = 20;
	} else if (percentageDrop > 25) {
		factors.positionLoss = 10;
	} else if (percentageDrop > 10) {
		factors.positionLoss = 5;
	}

	// Bonuses for catastrophic position losses
	if (raceData.startPos <= 3 && raceData.finishPos > raceData.entries - 5) {
		factors.positionLoss += 10;
	}
	if (raceData.startPos === 1 && raceData.finishPos > 10) {
		factors.positionLoss += 15;
	}
	factors.positionLoss = Math.min(30, factors.positionLoss);

	// 2. iRating Loss (0-30 points)
	const irChange = raceData.iratingChange;
	if (irChange < -150) {
		factors.iRatingLoss = 30;
	} else if (irChange < -100) {
		factors.iRatingLoss = 23;
	} else if (irChange < -50) {
		factors.iRatingLoss = 15;
	} else if (irChange < -20) {
		factors.iRatingLoss = 8;
	} else if (irChange < 0) {
		factors.iRatingLoss = 3;
	}

	// 3. Safety Rating Loss (0-20 points)
	const srChange = raceData.newSubLevel - raceData.oldSubLevel;
	if (srChange < 0) {
		// Each 0.1 SR loss = 4 points
		factors.safetyRatingLoss = Math.min(20, Math.abs(srChange) * 40);

		// Check for license demotion
		const oldLicense = Math.floor(raceData.oldSubLevel);
		const newLicense = Math.floor(raceData.newSubLevel);
		if (newLicense < oldLicense) {
			factors.safetyRatingLoss += 10;
		}
		factors.safetyRatingLoss = Math.min(20, factors.safetyRatingLoss);
	}

	// 4. Incidents (0-20 points)
	const inc = raceData.incidents;
	if (inc >= 16) {
		factors.incidents = 20;
	} else if (inc >= 11) {
		factors.incidents = 15;
	} else if (inc >= 7) {
		factors.incidents = 10;
	} else if (inc >= 4) {
		factors.incidents = 5;
	}

	// Bonus for excessive incidents relative to laps
	if (inc > raceData.laps / 2) {
		factors.incidents += 5;
	}
	factors.incidents = Math.min(20, factors.incidents);

	// Calculate total and round to avoid floating point precision issues
	const totalScore = Math.round(
		Object.values(factors).reduce((sum, val) => sum + val, 0),
	);

	// Determine level (Australian fire warning system)
	let level: BottleLevel;
	let emoji: string;

	if (totalScore <= 35) {
		level = "moderate";
		emoji = "🟢";
	} else if (totalScore <= 60) {
		level = "high";
		emoji = "🟡";
	} else if (totalScore <= 80) {
		level = "extreme";
		emoji = "🔥";
	} else {
		level = "catastrophic";
		emoji = "💥🔥💥";
	}

	return {
		level,
		score: totalScore,
		factors,
		emoji,
	};
};

export interface BottleResult {
	level: MichaelsBottleLevel;
	levelNumber: number;
	emoji: string;
}

export const calculateMichaelsBottleMeter = (raceData: {
	finishPos: number;
	oldiRating: number;
	allDriversData: { custId: number; oldiRating: number; finishPos: number }[];
	incidents: number;
	laps: number;
}): MichaelsBottleMeterResult => {
	// Filter out drivers with missing or zero iRating
	const validDrivers = raceData.allDriversData.filter((d) => d.oldiRating > 0);

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

	const { level, levelNumber, emoji } = calculateMichaelBottleResult({
		rank,
		incidents,
		laps,
		totalCars,
		position,
	});

	return {
		level,
		levelNumber,
		emoji,
	};
};

export const calculateMichaelBottleResult = (params: {
	rank: number;
	incidents: number;
	laps: number;
	totalCars: number;
	position: number;
}): MichaelsBottleMeterResult => {
	const { rank, incidents, laps, totalCars, position } = params;

	if (position <= rank - 0.25 * totalCars) {
		return { level: "world-champion-hotline", levelNumber: 1, emoji: "👑" };
	}

	if (position <= rank + 0.1 * totalCars && incidents < laps / 10 + 3) {
		return { level: "no-bottle", levelNumber: 2, emoji: "🟢" };
	}

	if (position <= rank + 0.2 * totalCars) {
		return { level: "low-moderate", levelNumber: 3, emoji: "🟡" };
	}

	if (position <= rank + 0.3 * totalCars) {
		return { level: "high", levelNumber: 4, emoji: "🟠" };
	}

	if (position <= rank + 0.4 * totalCars) {
		return { level: "very-high", levelNumber: 5, emoji: "🔥" };
	}

	if (position <= rank + 0.5 * totalCars) {
		return { level: "severe", levelNumber: 6, emoji: "🔥🔥" };
	}

	if (position <= rank + 0.6 * totalCars) {
		return { level: "extreme", levelNumber: 7, emoji: "💥🔥" };
	}

	return { level: "catastrophic", levelNumber: 8, emoji: "💥🔥💥" };
};
