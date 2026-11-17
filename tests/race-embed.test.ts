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
	race: { subsession_id: 12345, session_start_time: "2026-11-16T11:15:00Z" },
};

const build = (overrides: Partial<RaceEmbedInput> = {}) =>
	buildRaceEmbed({ ...catastrophicRace, ...overrides }, null).toJSON();

const field = (embed: ReturnType<typeof build>, name: string) =>
	embed.fields?.find((f) => f.name === name)?.value;

describe("buildRaceEmbed", () => {
	it("leads with the bottle-meter verdict and finish for a normal result", () => {
		const embed = build();
		expect(embed.title).toBe("💥🔥💥 CATASTROPHIC · P16 / 18");
		expect(embed.author?.name).toBe("Dominic Bou-Samra3");
		expect(embed.color).toBe(0xed4245);
		expect(embed.url).toContain("subsessionid=12345");
	});

	it("puts series and track in a heading, dropping the sponsor and repeated car", () => {
		const description = build().description ?? "";
		expect(description.split("\n")[0]).toBe(
			"### 🏁 Toyota GR86 Cup · Road Atlanta",
		);
		expect(description).toContain(
			"SOF **2098** · Split **1/2** · Avg lap **1:40.615**",
		);
		expect(description).toContain(
			"Started **P3** · expected **P4** · finished **P16**",
		);
		expect(description).toContain("**12 places below expected** with **10x**");
	});

	it("shows the car when the series name does not include it", () => {
		const description =
			build({ series: "Global Mazda MX-5 Fanatec Cup", car: { name: "GT4" } })
				.description ?? "";
		expect(description.split("\n")[0]).toBe(
			"### 🏁 Global Mazda MX-5 Fanatec Cup · Road Atlanta · GT4",
		);
	});

	it("keeps the bottle-meter explanation as subtext", () => {
		expect(build().description).toContain(
			"-# Finished P16, 12 places behind expected (P4).",
		);
	});

	it("shows key numbers as fields with direction markers", () => {
		const embed = build();
		expect(field(embed, "Finish")).toBe("**P16** 🔴 ▼13");
		expect(field(embed, "iRating")).toBe("**2681** 🔴 −92");
		expect(field(embed, "Safety")).toBe("**2.08** 🔴 −0.13");
		expect(field(embed, "Incidents")).toBe("**10x**");
		expect(field(embed, "Best lap")).toBe("`1:33.178`");
		expect(field(embed, "Quali")).toBe("`1:33.934`");
		expect(embed.fields?.every((f) => f.inline)).toBe(true);
	});

	it("marks gains in green", () => {
		const embed = build({
			startPos: 8,
			finishPos: 5,
			iratingChange: 41,
			subLevelChange: "0.07",
		});
		expect(field(embed, "Finish")).toBe("**P5** 🟢 ▲3");
		expect(field(embed, "iRating")).toBe("**2681** 🟢 +41");
		expect(field(embed, "Safety")).toBe("**2.08** 🟢 +0.07");
	});

	it.each([
		[1, "🥇 WIN · P1 / 18", 0xf1c40f, "🥇"],
		[2, "🥈 PODIUM · P2 / 18", 0xc0c7d0, "🥈"],
		[3, "🥉 PODIUM · P3 / 18", 0xcd7f32, "🥉"],
	])("highlights a P%i podium", (finishPos, title, color, medal) => {
		const embed = build({
			finishPos,
			michaelsBottleMeter: {
				level: "no-bottleo",
				levelNumber: 2,
				emoji: "🟢",
				explanation: "Clean race.",
			},
		});
		expect(embed.title).toBe(title);
		expect(embed.color).toBe(color);
		expect(
			field(embed, "Finish")?.startsWith(`${medal} **P${finishPos}**`),
		).toBe(true);
	});

	it("keeps the tier visible on a podium below expectation", () => {
		const embed = build({
			startPos: 1,
			finishPos: 3,
			iRatingRank: 1,
			michaelsBottleMeter: {
				level: "high",
				levelNumber: 4,
				emoji: "🟠",
				explanation: "Dropped from pole.",
			},
		});
		expect(embed.title).toBe("🥉 PODIUM · P3 / 18");
		expect(embed.description).toContain(
			"🟠 HIGH · **2 places below expected** with **10x**",
		);
	});

	it("colours non-podium results by bottle-meter level", () => {
		const embed = build({
			finishPos: 6,
			michaelsBottleMeter: {
				level: "low-moderate",
				levelNumber: 3,
				emoji: "🟡",
				explanation: "Meh.",
			},
		});
		expect(embed.title).toBe("🟡 LOW MODERATE · P6 / 18");
		expect(embed.color).toBe(0xfee75c);
	});

	it("leaves out expected position when the iRating rank is unknown", () => {
		const description = build({ iRatingRank: 0 }).description ?? "";
		expect(description).toContain("Started **P3** · finished **P16**");
		expect(description).not.toContain("expected **P");
		expect(description).not.toContain("above expected**");
		expect(description).not.toContain("below expected**");
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
