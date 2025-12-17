import { describe, expect, it } from "vitest";
import {
	type MichaelsBottleLevel,
	calculateMichaelBottleResult,
} from "../src/bottle-meter";

describe("calculateMichaelBottleResult", () => {
	describe("Level 1: World Champion Hotline", () => {
		it("should return world-champion when finishing way better than expected", () => {
			// Expected P10 in 20-car field, finish P5 or better
			// position <= rank - 0.25*totalCars => position <= 10 - 5 => position <= 5
			const result = calculateMichaelBottleResult({
				rank: 10,
				incidents: 0,
				laps: 20,
				totalCars: 20,
				position: 5,
			});
			expect(result.level).toBe("world-champion");
			expect(result.levelNumber).toBe(1);
			expect(result.emoji).toBe("👑");
		});

		it("should return world-champion for exact boundary", () => {
			const result = calculateMichaelBottleResult({
				rank: 10,
				incidents: 0,
				laps: 20,
				totalCars: 20,
				position: 5,
			});
			expect(result.levelNumber).toBe(1);
		});
	});

	describe("Level 2: No Bottle-o", () => {
		it("should return no-bottle when at expected position with low incidents", () => {
			// Expected P5, finish P7 (within 0.1*20 = 2 positions)
			// Incidents: 2 (< 20/10 + 3 = 5)
			const result = calculateMichaelBottleResult({
				rank: 5,
				incidents: 2,
				laps: 20,
				totalCars: 20,
				position: 7,
			});
			expect(result.level).toBe("no-bottle");
			expect(result.levelNumber).toBe(2);
			expect(result.emoji).toBe("🟢");
		});

		it("should NOT return no-bottle if incidents too high", () => {
			// Expected P5, finish P7, but 6 incidents (>= laps/10 + 3 = 5)
			const result = calculateMichaelBottleResult({
				rank: 5,
				incidents: 6,
				laps: 20,
				totalCars: 20,
				position: 7,
			});
			expect(result.level).not.toBe("no-bottle");
		});

		it("should return no-bottle at exact incident boundary", () => {
			// Incidents exactly at threshold (< laps/10 + 3)
			const result = calculateMichaelBottleResult({
				rank: 5,
				incidents: 4,
				laps: 20,
				totalCars: 20,
				position: 7,
			});
			expect(result.level).toBe("no-bottle");
		});
	});

	describe("Level 3: Low-Moderate", () => {
		it("should return low-moderate when finishing slightly behind", () => {
			// Expected P5, finish P9 (within 0.2*20 = 4 positions)
			const result = calculateMichaelBottleResult({
				rank: 5,
				incidents: 10,
				laps: 20,
				totalCars: 20,
				position: 9,
			});
			expect(result.level).toBe("low-moderate");
			expect(result.levelNumber).toBe(3);
			expect(result.emoji).toBe("🟡");
		});
	});

	describe("Level 4: High", () => {
		it("should return high when finishing moderately behind", () => {
			// Expected P5, finish P11 (within 0.3*20 = 6 positions)
			const result = calculateMichaelBottleResult({
				rank: 5,
				incidents: 0,
				laps: 20,
				totalCars: 20,
				position: 11,
			});
			expect(result.level).toBe("high");
			expect(result.levelNumber).toBe(4);
			expect(result.emoji).toBe("🟠");
		});
	});

	describe("Level 5: Very High", () => {
		it("should return very-high when finishing well behind", () => {
			// Expected P5, finish P13 (within 0.4*20 = 8 positions)
			const result = calculateMichaelBottleResult({
				rank: 5,
				incidents: 0,
				laps: 20,
				totalCars: 20,
				position: 13,
			});
			expect(result.level).toBe("very-high");
			expect(result.levelNumber).toBe(5);
			expect(result.emoji).toBe("🔥");
		});
	});

	describe("Level 6: Severe", () => {
		it("should return severe when finishing far behind", () => {
			// Expected P5, finish P15 (within 0.5*20 = 10 positions)
			const result = calculateMichaelBottleResult({
				rank: 5,
				incidents: 0,
				laps: 20,
				totalCars: 20,
				position: 15,
			});
			expect(result.level).toBe("severe");
			expect(result.levelNumber).toBe(6);
			expect(result.emoji).toBe("🔥🔥");
		});
	});

	describe("Level 7: Extreme", () => {
		it("should return extreme when finishing very far behind", () => {
			// Expected P5, finish P17 (within 0.6*20 = 12 positions)
			const result = calculateMichaelBottleResult({
				rank: 5,
				incidents: 0,
				laps: 20,
				totalCars: 20,
				position: 17,
			});
			expect(result.level).toBe("extreme");
			expect(result.levelNumber).toBe(7);
			expect(result.emoji).toBe("💥🔥");
		});
	});

	describe("Level 8: Catastrophic", () => {
		it("should return catastrophic when finishing way behind", () => {
			// Expected P5, finish P18 (> 0.6*20 = 12 positions behind)
			const result = calculateMichaelBottleResult({
				rank: 5,
				incidents: 0,
				laps: 20,
				totalCars: 20,
				position: 18,
			});
			expect(result.level).toBe("catastrophic");
			expect(result.levelNumber).toBe(8);
			expect(result.emoji).toBe("💥🔥💥");
		});

		it("should return catastrophic for last place from front", () => {
			// Expected P1, finish last
			const result = calculateMichaelBottleResult({
				rank: 1,
				incidents: 0,
				laps: 20,
				totalCars: 20,
				position: 20,
			});
			expect(result.level).toBe("catastrophic");
			expect(result.levelNumber).toBe(8);
		});
	});

	describe("Edge cases", () => {
		it("should handle small field sizes", () => {
			// 10-car field, expected P3, finish P5
			const result = calculateMichaelBottleResult({
				rank: 3,
				incidents: 0,
				laps: 15,
				totalCars: 10,
				position: 5,
			});
			expect(result.levelNumber).toBeGreaterThanOrEqual(1);
			expect(result.levelNumber).toBeLessThanOrEqual(8);
		});

		it("should handle finishing at expected position exactly", () => {
			// Expected P10, finish P10
			const result = calculateMichaelBottleResult({
				rank: 10,
				incidents: 2,
				laps: 20,
				totalCars: 20,
				position: 10,
			});
			expect(result.level).toBe("no-bottle");
		});

		it("should handle zero incidents", () => {
			const result = calculateMichaelBottleResult({
				rank: 5,
				incidents: 0,
				laps: 20,
				totalCars: 20,
				position: 7,
			});
			expect(result.level).toBe("no-bottle");
		});

		it("should handle fractional calculations correctly", () => {
			// Test boundary conditions with fractional thresholds
			// Expected P7 in 15-car field
			// 0.1*15 = 1.5, so position <= 8.5 should trigger no-bottle (if incidents low)
			const result = calculateMichaelBottleResult({
				rank: 7,
				incidents: 2,
				laps: 20,
				totalCars: 15,
				position: 8,
			});
			expect(result.level).toBe("no-bottle");
		});
	});

	describe("Smoke test", () => {
		const data = [
			"6,25,49,26,55,world-champion",
			"21,19,42,26,44,world-champion",
			"6,58,7,3,7,world-champion",
			"4,114,37,10,37,world-champion",
			"9,62,21,6,46,world-champion",
			"20,71,31,3,31,world-champion",

			"0,132,11,10,31,no-bottle",
			"8,99,38,42,52,no-bottle",
			"11,90,31,32,36,no-bottle",
			"15,121,24,22,28,no-bottle",
			"6,36,1,1,15,no-bottle",
			"2,85,24,22,39,no-bottle",

			"20,78,22,26,27,low-moderate",
			"15,21,16,16,49,low-moderate",
			"17,98,3,2,8,low-moderate",
			"21,20,8,4,26,low-moderate",
			"20,45,4,4,8,low-moderate",

			"7,117,21,33,43,high",
			"6,12,7,21,60,high",
			"3,112,1,10,36,high",
			"6,46,4,11,32,high",
			"10,79,42,60,60,high",

			"12,91,18,28,30,very-high",
			"20,104,10,17,19,very-high",
			"4,130,3,7,10,very-high",
			"11,101,19,34,42,very-high",
			"18,8,6,20,42,very-high",

			"6,28,19,39,39,extreme",
			"7,22,18,43,48,extreme",
			"15,58,6,36,59,extreme",
			"19,18,4,27,42,extreme",

			"15,82,3,9,12,severe",
			"4,46,20,48,58,severe",
			"12,35,1,23,50,severe",
			"22,94,12,29,38,severe",
			"8,121,14,29,31,severe",
			"4,40,3,6,6,severe",
			"14,31,6,12,14,severe",
			"3,24,14,30,34,severe",

			"4,64,4,28,32,catastrophic",
			"21,48,1,7,9,catastrophic",
			"13,63,12,57,58,catastrophic",
			"24,69,4,30,43,catastrophic",
			"19,139,2,19,21,catastrophic",
		].map((line) => {
			const [incidents, laps, rank, position, totalCars, level] =
				line.split(",");
			return {
				rank: Number.parseInt(rank),
				incidents: Number.parseInt(incidents),
				laps: Number.parseInt(laps),
				totalCars: Number.parseInt(totalCars),
				position: Number.parseInt(position),
				level: level as MichaelsBottleLevel,
			};
		});

		it("should return the correct level for a given position", () => {
			for (const d of data) {
				const result = calculateMichaelBottleResult(d);
				expect(
					result.level,
					`Expected LEVEL=${d.level} for RANK=${d.rank}, INC=${d.incidents}, LAPS=${d.laps}, CARS=${d.totalCars}, POS=${d.position}`,
				).toBe(d.level);
			}
		});
	});
});
