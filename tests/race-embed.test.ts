import { describe, expect, it } from "vitest";
import { type RaceEmbedInput, buildRaceEmbed } from "../src/race-embed";

// The real race that prompted the redesign (Road Atlanta, P3 -> P16).
const catastrophicRace: RaceEmbedInput = {
	driverName: "Dominic Bou-Samra3",
	series: "Toyota GR86 Cup by SIMAGIC",
	trackName: "Road Atlanta",
	car: { name: "Toyota GR86" },
	sof: 2098,
	split: "1 / 2",
	startPos: 3,
	finishPos: 16,
	entries: 18,
	iRatingRank: 4,
	incidents: 10,
	laps: 10,
	raceLaps: 10,
	averageLapTime: "1:40.615",
	bestLapTime: "1:33.178",
	qualifyingTime: "1:33.934",
	newIrating: 2681,
	iratingChange: -92,
	newSubLevel: 2.08,
	subLevelChange: "-0.13",
	michaelsBottleMeter: {
		level: "catastrophic",
		levelNumber: 8,
		emoji: "💥🔥💥",
		explanation:
			"Finished P16, 12 places behind expected (P4). Catastrophic race dropping 11+ positions below iRating expectation. 10 incidents - things went very wrong.",
	},
	recentFinishes: [16, 2, 4, 7, 5],
	race: { subsession_id: 12345, session_start_time: "2026-11-16T11:15:00Z" },
};

const build = (overrides: Partial<RaceEmbedInput> = {}) =>
	buildRaceEmbed({ ...catastrophicRace, ...overrides }, null).toJSON();

const field = (embed: ReturnType<typeof build>, name: string) =>
	embed.fields?.find((f) => f.name === name)?.value;

const lines = (embed: ReturnType<typeof build>) =>
	(embed.description ?? "").split("\n");

describe("buildRaceEmbed", () => {
	it("puts the verdict in the title, coloured by bottle-meter level", () => {
		const embed = build();
		expect(embed.title).toBe("💥🔥💥 CATASTROPHIC · 12 places below expected");
		expect(embed.color).toBe(0xed4245);
		expect(embed.url).toContain("subsessionid=12345");
	});

	it("makes the driver and finish the big heading, then the event", () => {
		expect(lines(build()).slice(0, 3)).toEqual([
			"### Dominic Bou-Samra3 · P16 / 18",
			"🏁 **Toyota GR86 Cup** · Road Atlanta",
			"SOF **2098** · Split **1/2**",
		]);
	});

	it("shows the car when the series name does not include it", () => {
		expect(
			lines(
				build({ series: "Global Mazda MX-5 Cup", car: { name: "GT4" } }),
			)[1],
		).toBe("🏁 **Global Mazda MX-5 Cup** · Road Atlanta · GT4");
	});

	it("drops a car the series already names, and the iRacing prefix", () => {
		expect(
			lines(
				build({
					series: "iRacing Porsche Cup - Fixed",
					trackName: "Long Beach Street Circuit",
					car: { name: "Porsche 911 Cup (992.2)" },
				}),
			)[1],
		).toBe("🏁 **Porsche Cup - Fixed** · Long Beach Street Circuit");
	});

	it("drops the explanation when it only repeats the numbers", () => {
		expect(build().description).not.toContain("Finished P16");
	});

	it("keeps the explanation for story levels like Bradbury", () => {
		const embed = build({
			finishPos: 5,
			michaelsBottleMeter: {
				level: "bradbury",
				levelNumber: 1,
				emoji: "⛸️",
				explanation: "Finished P5 ... Steven Bradbury special.",
			},
		});
		expect(embed.description).toContain(
			"-# Finished P5 ... Steven Bradbury special.",
		);
	});

	it("shows key numbers as fields with direction markers", () => {
		const embed = build();
		expect(field(embed, "Finish")).toBe("**P16** 🔴 ▼13\nfrom P3 · exp. P4");
		expect(field(embed, "iRating")).toBe("**2681**\n🔴 −92");
		expect(field(embed, "Safety")).toBe("**2.08**\n🔴 −0.13");
		expect(field(embed, "Incidents")).toBe("**10x**");
		expect(field(embed, "Laps")).toBe("**10** / 10");
		expect(field(embed, "Lap times")).toBe(
			"best `1:33.178`\navg `1:40.615`\nquali `1:33.934`",
		);
	});

	it("flags laps down when the driver did not finish the distance", () => {
		expect(field(build({ laps: 7, raceLaps: 10 }), "Laps")).toBe(
			"**7** / 10\n🔴 3 laps down",
		);
	});

	it("shows recent form, latest first, with medals", () => {
		expect(field(build(), "Form (latest first)")).toBe(
			"**P16** · 🥈P2 · P4 · P7 · P5",
		);
	});

	it("leaves form out when there is no history", () => {
		expect(field(build({ recentFinishes: [16] }), "Form (latest first)")).toBe(
			undefined,
		);
	});

	it("marks gains in green", () => {
		const embed = build({
			startPos: 8,
			finishPos: 5,
			iratingChange: 41,
			subLevelChange: "0.07",
		});
		expect(field(embed, "Finish")).toBe("**P5** 🟢 ▲3\nfrom P8 · exp. P4");
		expect(field(embed, "iRating")).toBe("**2681**\n🟢 +41");
		expect(field(embed, "Safety")).toBe("**2.08**\n🟢 +0.07");
	});

	it.each([
		[1, "🥇", "WIN", 0xf1c40f],
		[2, "🥈", "PODIUM", 0xc0c7d0],
		[3, "🥉", "PODIUM", 0xcd7f32],
	])("highlights a P%i podium", (finishPos, medal, label, color) => {
		const embed = build({
			startPos: 5,
			finishPos,
			michaelsBottleMeter: {
				level: "no-bottleo",
				levelNumber: 2,
				emoji: "🟢",
				explanation: "Finished well.",
			},
		});
		expect(embed.title).toMatch(
			new RegExp(`^${medal} (🏆 )?${label} · [0-9]+ places? above expected$`),
		);
		expect(lines(embed)[0]).toBe(`### Dominic Bou-Samra3 · P${finishPos} / 18`);
		expect(embed.color).toBe(color);
		expect(
			field(embed, "Finish")?.startsWith(`${medal} **P${finishPos}**`),
		).toBe(true);
		expect(embed.description).toContain("-# Bottle-meter: 🟢 NO BOTTLEO");
	});

	it("still calls out a podium below expectation", () => {
		const embed = build({ startPos: 1, finishPos: 3, iRatingRank: 1 });
		expect(embed.title).toBe("🥉 PODIUM · 2 places below expected");
		expect(embed.description).toContain("-# Bottle-meter: 💥🔥💥 CATASTROPHIC");
	});

	it("leaves out expected position when the iRating rank is unknown", () => {
		const embed = build({ iRatingRank: 0 });
		expect(embed.title).toBe("💥🔥💥 CATASTROPHIC");
		expect(field(embed, "Finish")).toBe("**P16** 🔴 ▼13\nfrom P3");
	});

	it("adds the reaction image when there is one", () => {
		const embed = buildRaceEmbed(
			catastrophicRace,
			"https://example.com/img.png",
		).toJSON();
		expect(embed.image?.url).toBe("https://example.com/img.png");
		expect(embed.footer?.text).toBe("iRacing results");
		expect(embed.timestamp).toBe("2026-11-16T11:15:00.000Z");
	});
});
