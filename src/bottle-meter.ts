export type BottleLevel = "moderate" | "high" | "extreme" | "catastrophic";

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
	level: BottleLevel;
	score: number; // 0-100
	factors: {
		expectedPosition: number;
		actualPosition: number;
		positionsDropped: number;
		percentageDropped: number;
	};
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

export const calculateMichaelsBottleMeter = (raceData: {
	finishPos: number;
	oldiRating: number;
	allDriversData: { custId: number; oldiRating: number; finishPos: number }[];
}): MichaelsBottleMeterResult => {
	// Filter out drivers with missing or zero iRating
	const validDrivers = raceData.allDriversData.filter((d) => d.oldiRating > 0);

	// If too few valid drivers, return lowest level
	if (validDrivers.length < 3) {
		return {
			level: "moderate",
			score: 0,
			factors: {
				expectedPosition: raceData.finishPos,
				actualPosition: raceData.finishPos,
				positionsDropped: 0,
				percentageDropped: 0,
			},
			emoji: "❓",
		};
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

	// If driver not found in results, return lowest level
	if (driverIndex === -1) {
		return {
			level: "moderate",
			score: 0,
			factors: {
				expectedPosition: 0,
				actualPosition: raceData.finishPos,
				positionsDropped: 0,
				percentageDropped: 0,
			},
			emoji: "❓",
		};
	}

	const expectedPosition = driverIndex + 1; // 1-indexed
	const actualPosition = raceData.finishPos;
	const positionsDropped = actualPosition - expectedPosition;

	// If driver finished better than or equal to expected, lowest level
	if (positionsDropped <= 0) {
		return {
			level: "moderate",
			score: 0,
			factors: {
				expectedPosition,
				actualPosition,
				positionsDropped: 0,
				percentageDropped: 0,
			},
			emoji: "🟢",
		};
	}

	// Calculate percentage of field dropped
	const fieldSize = validDrivers.length;
	const percentageDropped = (positionsDropped / fieldSize) * 100;

	// Map percentage to 0-100 score
	let score = 0;
	if (percentageDropped <= 10) {
		score = percentageDropped * 1.5; // 0-15
	} else if (percentageDropped <= 25) {
		score = 15 + (percentageDropped - 10) * 1.33; // 15-35
	} else if (percentageDropped <= 50) {
		score = 35 + (percentageDropped - 25) * 1.0; // 35-60
	} else if (percentageDropped <= 75) {
		score = 60 + (percentageDropped - 50) * 0.8; // 60-80
	} else {
		score = 80 + (percentageDropped - 75) * 0.8; // 80-100
	}

	// Round and cap at 100
	score = Math.min(100, Math.round(score));

	// Determine level (Australian fire warning system)
	let level: BottleLevel;
	let emoji: string;

	if (score <= 35) {
		level = "moderate";
		emoji = "🟢";
	} else if (score <= 60) {
		level = "high";
		emoji = "🟡";
	} else if (score <= 80) {
		level = "extreme";
		emoji = "🔥";
	} else {
		level = "catastrophic";
		emoji = "💥🔥💥";
	}

	return {
		level,
		score,
		factors: {
			expectedPosition,
			actualPosition,
			positionsDropped,
			percentageDropped: Math.round(percentageDropped * 10) / 10, // Round to 1 decimal
		},
		emoji,
	};
};
