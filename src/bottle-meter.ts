export type BottleLevel = "none" | "low" | "moderate" | "high" | "catastrophic";

export interface BottleMeterResult {
	level: BottleLevel;
	score: number; // Raw score 0-100
	factors: {
		positionLoss: number; // 0-30 points
		iRatingLoss: number; // 0-30 points
		safetyRatingLoss: number; // 0-20 points
		incidents: number; // 0-20 points
	};
	description: string;
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
	if (
		raceData.startPos <= 3 &&
		raceData.finishPos > raceData.entries - 5
	) {
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

	// Calculate total
	const totalScore = Object.values(factors).reduce(
		(sum, val) => sum + val,
		0,
	);

	// Determine level
	let level: BottleLevel;
	let description: string;
	let emoji: string;

	if (totalScore <= 15) {
		level = "none";
		description = "Clean performance";
		emoji = "✅";
	} else if (totalScore <= 35) {
		level = "low";
		description = "Minor mistakes";
		emoji = "⚠️";
	} else if (totalScore <= 60) {
		level = "moderate";
		description = "Noticeable underperformance";
		emoji = "🍾";
	} else if (totalScore <= 80) {
		level = "high";
		description = "Significant bottling detected";
		emoji = "🍾🍾";
	} else {
		level = "catastrophic";
		description = "COMPLETE BOTTLE JOB";
		emoji = "💥🍾💥";
	}

	return {
		level,
		score: totalScore,
		factors,
		description,
		emoji,
	};
};
