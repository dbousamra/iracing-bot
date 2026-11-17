import { describe, expect, it } from "vitest";
import type { BottleLeaderboardEntry, DriverStats } from "../src/db";
import { fitLines } from "../src/embed-format";
import {
	buildBottleLeaderboardEmbed,
	buildCareerComparisonEmbed,
	buildCareerStatsEmbed,
	buildDriverComparisonEmbed,
	buildSeasonLeaderboardEmbed,
	buildTeamRaceEmbed,
	buildTeamShowEmbed,
} from "../src/embeds";
import type { GetCareerStatsResponse, TeamRaceData } from "../src/iracing";

const driver = (o: Partial<DriverStats>): DriverStats => ({
	customerId: 1,
	customerName: "Driver",
	totalRaces: 10,
	totalWins: 1,
	startingIrating: 2000,
	endingIrating: 2100,
	iratingGain: 100,
	startingSr: 2,
	endingSr: 2.5,
	srGain: 0.5,
	averageStartPosition: 5,
	averageFinishPosition: 4,
	averageIncidents: 2,
	avgRacesPerDay: 1,
	...o,
});

const season = {
	seasonYear: 2026,
	seasonQuarter: 4,
	licenseCategory: "Sports Car",
};

describe("buildTeamRaceEmbed", () => {
	const teamRace: TeamRaceData = {
		subsessionId: 99,
		teamId: 7,
		teamName: "EnduroTech",
		series: "IMSA Endurance Series by SIMAGIC",
		track: "Sebring",
		carClass: "GT3",
		strengthOfField: 2500,
		sessionStartTime: "2026-11-16T11:15:00Z",
		teamPosition: 9,
		teamPositionInClass: 2,
		totalLaps: 120,
		totalIncidents: 6,
		drivers: [
			{
				customerId: 1,
				displayName: "Alex",
				lapsComplete: 60,
				incidents: 2,
				oldIRating: 2000,
				newIRating: 2040,
				iRatingChange: 40,
				oldSubLevel: 2,
				newSubLevel: 2.1,
				subLevelChange: 0.1,
			},
			{
				customerId: 2,
				displayName: "Sam",
				lapsComplete: 60,
				incidents: 4,
				oldIRating: 2100,
				newIRating: 2090,
				iRatingChange: -10,
				oldSubLevel: 3,
				newSubLevel: 2.95,
				subLevelChange: -0.05,
			},
		],
		avgTeamIRating: 2050,
		classResults: [
			{ oldIRating: 2600, finishPosition: 1 },
			{ oldIRating: 2050, finishPosition: 2 },
			{ oldIRating: 2400, finishPosition: 3 },
			{ oldIRating: 1900, finishPosition: 4 },
		],
		totalEntries: 30,
		classEntries: 4,
	};

	it("leads with team and class finish, podium highlighted", () => {
		const embed = buildTeamRaceEmbed(teamRace, () => null).toJSON();
		expect(embed.title).toBe("🥈 PODIUM");
		expect(embed.color).toBe(0xc0c7d0);
		const lines = (embed.description ?? "").split("\n");
		expect(lines[0]).toBe("### 👥 EnduroTech · P2 / 4");
		expect(lines[1]).toBe("🏁 **IMSA Endurance Series** · Sebring · GT3");
		expect(lines[2]).toBe("SOF **2500** · Overall **P9 / 30**");
	});

	it("lists each driver on one line", () => {
		const embed = buildTeamRaceEmbed(teamRace, () => null).toJSON();
		expect(embed.fields?.find((f) => f.name === "Drivers")?.value).toBe(
			"**Alex** · 60 laps · 2x · 🟢 **+40** iR · 🟢 **+0.10** SR\n**Sam** · 60 laps · 4x · 🔴 **−10** iR · 🔴 **−0.05** SR",
		);
	});
});

describe("buildCareerStatsEmbed", () => {
	it("puts the headline numbers first", () => {
		const stats = {
			driverName: "Alex",
			aggregatedStats: {
				totalStarts: 312,
				totalWins: 24,
				totalTop5: 88,
				totalPoles: 15,
				totalLaps: 12345,
				totalLapsLed: 1234,
				totalIncidents: 600,
			},
			winPercentage: "7.7",
			top5Percentage: "28.2",
			polePercentage: "4.8",
			lapsLedPercentage: "10.0",
			avgIncidents: "1.92",
			categoryBreakdown: [
				{
					category: "Road",
					starts: 300,
					wins: 24,
					top5: 80,
					poles: 15,
					winPercentage: "8.0",
					top5Percentage: "26.7",
				},
				{
					category: "Oval",
					starts: 0,
					wins: 0,
					top5: 0,
					poles: 0,
					winPercentage: "0.0",
					top5Percentage: "0.0",
				},
			],
			thisYearStats: {
				num_official_sessions: 40,
				num_official_wins: 3,
				num_league_sessions: 1,
				num_league_wins: 0,
			},
		} as unknown as GetCareerStatsResponse;
		const embed = buildCareerStatsEmbed(stats, 2026).toJSON();
		expect(embed.title).toBe("📊 Alex · career");
		expect(embed.description).toBe("### 312 starts · 24 wins (7.7%)");
		expect(embed.fields?.find((f) => f.name === "Laps")?.value).toBe(
			"**12,345**",
		);
		expect(embed.fields?.find((f) => f.name === "📅 2026 so far")?.value).toBe(
			"Official · **40 races** · **3 wins**\nLeague · **1 race** · **0 wins**",
		);
		expect(embed.fields?.some((f) => f.name === "Oval")).toBe(false);
	});
});

describe("buildSeasonLeaderboardEmbed", () => {
	const embed = () =>
		buildSeasonLeaderboardEmbed({
			...season,
			leaderboard: [
				driver({ customerName: "Alex", endingIrating: 2800, iratingGain: 120 }),
				driver({ customerName: "Sam", iratingGain: -40, srGain: 0.9 }),
				driver({ customerName: "Jo", iratingGain: 0 }),
				driver({ customerName: "Kim" }),
			],
		}).toJSON();

	it("ranks drivers in lines with medals and bold values", () => {
		const lines = (embed().description ?? "").split("\n");
		expect(embed().title).toBe("🏆 2026 S4 · Sports Car leaderboard");
		expect(lines[0]).toBe(
			"🥇 **Alex** · **2800** iR 🟢 **+120** · **2.50** SR 🟢 **+0.50**",
		);
		expect(lines[1]).toBe(
			"🥈 **Sam** · **2100** iR 🔴 **−40** · **2.50** SR 🟢 **+0.90**",
		);
		expect(lines[2]).toContain("🥉 **Jo** · **2100** iR ⚪ **±0**");
		expect(lines[3].startsWith("4. **Kim**")).toBe(true);
	});

	it("calls out the best SR gain", () => {
		expect(embed().fields?.find((f) => f.name === "Best SR gain")?.value).toBe(
			"**Sam** 🟢 **+0.90**",
		);
	});

	it("handles an empty season", () => {
		expect(
			buildSeasonLeaderboardEmbed({ ...season, leaderboard: [] }).toJSON()
				.description,
		).toBe("No races yet this season.");
	});
});

describe("buildBottleLeaderboardEmbed", () => {
	const entry = (
		o: Partial<BottleLeaderboardEntry>,
	): BottleLeaderboardEntry => ({
		customerId: 1,
		customerName: "Alex",
		totalRaces: 15,
		worldChampionCount: 3,
		bradburyCount: 0,
		catastrophicCount: 0,
		...o,
	});
	const embed = () =>
		buildBottleLeaderboardEmbed({
			...season,
			leaderboard: [
				entry({
					customerName: "Valentin Ozhiganov",
					totalRaces: 1,
					worldChampionCount: 1,
				}),
				entry({
					customerName: "Sam Millar2",
					totalRaces: 89,
					worldChampionCount: 17,
					bradburyCount: 1,
					catastrophicCount: 3,
				}),
				entry({
					customerName: "Luke Hay3",
					totalRaces: 69,
					worldChampionCount: 18,
					catastrophicCount: 4,
				}),
				entry({
					customerName: "Bradley Whittaker",
					totalRaces: 25,
					worldChampionCount: 11,
				}),
			],
		}).toJSON();

	it("opens with the hall of shame, ranked by catastrophe rate", () => {
		const lines = (embed().description ?? "").split("\n");
		expect(lines.slice(0, 3)).toEqual([
			"### 💥 Hall of shame",
			"1. **Luke Hay3** · **4** 💥 in 69 races (6%)",
			"2. **Sam Millar2** · **3** 💥 in 89 races (3%)",
		]);
	});

	it("ranks by hotline rate in lines, small samples unranked below", () => {
		const lines = (embed().description ?? "").split("\n");
		const start = lines.findIndex((l) => l.includes("ranked by 👑 rate"));
		expect(lines[start]).toBe(
			"-# 👑 World Champion Hotline · ⛸️ Bradbury · 💥 Catastrophic · ranked by 👑 rate · 184 races in total",
		);
		expect(lines.slice(start + 2)).toEqual([
			"🥇 **Bradley Whittaker** · 👑 **11** · ⛸️ **0** · 💥 **0** · 44% 👑",
			"🥈 **Luke Hay3** · 👑 **18** · ⛸️ **0** · 💥 **4** · 26% 👑",
			"🥉 **Sam Millar2** · 👑 **17** · ⛸️ **1** · 💥 **3** · 19% 👑",
			"",
			"-# Fewer than 5 races, not ranked",
			"• Valentin Ozhiganov · 👑 **1** · ⛸️ **0** · 💥 **0** · 1 race",
		]);
		expect(embed().fields?.map((f) => f.value)).toEqual([
			"**47**",
			"**1**",
			"**7**",
		]);
	});

	it("says so when nobody has a catastrophe", () => {
		expect(
			buildBottleLeaderboardEmbed({
				...season,
				leaderboard: [entry({})],
			}).toJSON().description,
		).toContain("Nobody has bottled it yet this season. 👏");
	});
});

describe("comparison embeds", () => {
	it("shows the verdict first and bolds each row's winner", () => {
		const embed = buildDriverComparisonEmbed({
			...season,
			driverA: driver({
				customerName: "Alex",
				totalWins: 3,
				averageIncidents: 1.5,
			}),
			driverB: driver({
				customerName: "Sam",
				totalWins: 1,
				averageIncidents: 2.5,
			}),
		}).toJSON();
		const lines = (embed.description ?? "").split("\n");
		expect(embed.title).toBe("⚔️ Alex vs Sam");
		expect(lines[0]).toBe("### 🏆 Alex leads 2–0");
		expect(lines[1]).toBe("-# 2026 S4 · Sports Car · 🟦 Alex · 🟧 Sam");
		expect(lines).toContain("🟦 Wins · **3** vs 1");
		expect(lines).toContain("🟦 Avg incidents · **1.50** vs 2.50");
		expect(lines).toContain("⬜ Races · 10 vs 10");
		expect(embed.color).toBe(0x3498db);
	});

	it("adds the head-to-head record for shared races", () => {
		const embed = buildDriverComparisonEmbed({
			...season,
			driverA: driver({ customerName: "Alex" }),
			driverB: driver({ customerName: "Sam" }),
			headToHead: { aheadA: 4, aheadB: 7 },
		}).toJSON();
		expect(embed.fields?.[0]).toEqual({
			name: "🤝 Finished ahead",
			value: "🟦 Alex 4 – **7** Sam 🟧",
			inline: false,
		});
	});

	it("keeps volume rows out of the career verdict", () => {
		const base = {
			customerId: 1,
			starts: 100,
			wins: 5,
			winPercentage: 5,
			top5: 20,
			poles: 3,
			laps: 2000,
			lapsLed: 100,
			avgFinishPosition: 6,
			avgIncidents: 2,
		};
		const embed = buildCareerComparisonEmbed({
			driverA: { ...base, customerName: "Alex", starts: 500, laps: 9000 },
			driverB: { ...base, customerName: "Sam" },
			licenseCategory: "Formula",
		}).toJSON();
		const lines = (embed.description ?? "").split("\n");
		expect(lines[0]).toBe("### 🤝 Dead heat 0–0");
		expect(lines).toContain("▫️ Starts · **500** vs 100");
	});
});

describe("buildTeamShowEmbed", () => {
	it("previews the first ten drivers", () => {
		const roster = Array.from({ length: 12 }, (_, i) => ({
			display_name: `D${i + 1}`,
		}));
		const embed = buildTeamShowEmbed({
			team: { team_name: "EnduroTech", team_id: 7, roster_count: 12, roster },
			notificationChannelId: "123",
		}).toJSON();
		const rosterField =
			embed.fields?.find((f) => f.name === "Roster")?.value ?? "";
		expect(rosterField.split("\n")).toHaveLength(11);
		expect(rosterField.endsWith("-# …and 2 more")).toBe(true);
		expect(embed.fields?.find((f) => f.name === "Posts to")?.value).toBe(
			"<#123>",
		);
	});
});

describe("fitLines", () => {
	it("cuts off with a count when lines exceed the limit", () => {
		const lines = Array.from({ length: 100 }, (_, i) =>
			`line ${i}`.padEnd(50, "."),
		);
		const out = fitLines(lines, 500);
		expect(out.length).toBeLessThanOrEqual(500);
		expect(out.split("\n").at(-1)).toMatch(/^-# …and \d+ more$/);
	});
});
