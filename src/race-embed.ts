import { EmbedBuilder } from "discord.js";
import type {
	MichaelsBottleLevel,
	MichaelsBottleMeterResult,
} from "./bottle-meter";
import {
	BOTTLE_LEVEL_COLORS,
	PODIUM,
	eventLine,
	levelName,
	placesMoved,
	plural,
	resultUrl,
	trend,
} from "./embed-format";

export { BOTTLE_LEVEL_COLORS } from "./embed-format";

/**
 * The fields of a race result the embed needs. `GetLatestRaceResponse` fits
 * this shape; keeping it narrow lets the embed be built and tested without
 * touching config or the iRacing client.
 */
export interface RaceEmbedInput {
	driverName: string;
	series: string;
	trackName: string;
	car?: { name?: string } | null;
	sof: number;
	split: string;
	startPos: number;
	finishPos: number;
	entries: number;
	iRatingRank: number;
	incidents: number;
	/** Laps the driver completed. */
	laps: number;
	/** Race distance for the class (most laps completed by anyone in it). */
	raceLaps?: number;
	averageLapTime: string;
	bestLapTime: string;
	qualifyingTime: string;
	newIrating: number;
	iratingChange: number;
	newSubLevel: number;
	subLevelChange: string | number;
	michaelsBottleMeter: MichaelsBottleMeterResult;
	/** Latest first, including this race. */
	recentFinishes?: number[];
	race: { subsession_id: number; session_start_time: string };
}

// Levels whose explanation says something the numbers don't (the joke, or why
// there's no result). For the rest it just repeats the finish and expectation.
const STORY_LEVELS: MichaelsBottleLevel[] = [
	"bradbury",
	"dnf",
	"first-lap-disaster",
];

export const showExplanation = (meter: MichaelsBottleMeterResult) =>
	STORY_LEVELS.includes(meter.level) ||
	!meter.explanation.startsWith("Finished P");

const vsExpected = (expected: number, finish: number) => {
	const diff = expected - finish;
	if (diff > 0) return `${plural(diff, "place")} above expected`;
	if (diff < 0) return `${plural(-diff, "place")} below expected`;
	return "right on expected";
};

const formLine = (finishes: number[]) =>
	finishes
		.map((p, i) => {
			const medal = PODIUM[p]?.medal ?? "";
			const text = `${medal}P${p}`;
			return i === 0 ? `**${text}**` : text;
		})
		.join(" · ");

export const buildRaceEmbed = (
	race: RaceEmbedInput,
	image: string | null,
): EmbedBuilder => {
	const podium = PODIUM[race.finishPos];
	const meter = race.michaelsBottleMeter;
	const finish = `P${race.finishPos} / ${race.entries}`;
	const hasExpected = race.iRatingRank > 0;
	const expectation = hasExpected
		? ` · ${vsExpected(race.iRatingRank, race.finishPos)}`
		: "";

	// The verdict sits in the (linked) title; who raced and where they finished
	// is the big heading, since that's what teammates scan for.
	const title = podium
		? `${podium.medal} ${race.finishPos === 1 ? "🏆 " : ""}${podium.label}${expectation}`
		: `${meter.emoji} ${levelName(meter.level)}${expectation}`;

	const headline = `### ${race.driverName} · ${finish}`;

	const description = [
		headline,
		eventLine(race.series, race.trackName, race.car?.name),
		`SOF **${race.sof}** · Split **${race.split.replace(/\s/g, "")}**`,
		// On a podium the bottle-meter leaves the headline, so keep it here.
		...(podium
			? [`-# Bottle-meter: ${meter.emoji} ${levelName(meter.level)}`]
			: []),
		...(showExplanation(meter) ? [`-# ${meter.explanation}`] : []),
	].join("\n");

	const fields = [
		{
			name: "Finish",
			value: `${podium ? `${podium.medal} ` : ""}**P${race.finishPos}** ${placesMoved(race.startPos, race.finishPos)}\nfrom P${race.startPos}${hasExpected ? ` · exp. P${race.iRatingRank}` : ""}`,
			inline: true,
		},
		{
			name: "iRating",
			value: `**${race.newIrating}**\n${trend(race.iratingChange)}`,
			inline: true,
		},
		{
			name: "Safety",
			value: `**${race.newSubLevel.toFixed(2)}**\n${trend(Number(race.subLevelChange), 2)}`,
			inline: true,
		},
		{
			name: "Laps",
			value:
				race.raceLaps && race.raceLaps > race.laps
					? `**${race.laps}** / ${race.raceLaps}\n🔴 ${plural(race.raceLaps - race.laps, "lap")} down`
					: `**${race.laps}**${race.raceLaps ? ` / ${race.raceLaps}` : ""}`,
			inline: true,
		},
		{ name: "Incidents", value: `**${race.incidents}x**`, inline: true },
		{
			name: "Lap times",
			value: `best \`${race.bestLapTime}\`\navg \`${race.averageLapTime}\`\nquali \`${race.qualifyingTime}\``,
			inline: true,
		},
	];

	if (race.recentFinishes && race.recentFinishes.length > 1) {
		fields.push({
			name: "Form (latest first)",
			value: formLine(race.recentFinishes),
			inline: false,
		});
	}

	const embed = new EmbedBuilder()
		.setTitle(title)
		.setURL(resultUrl(race.race.subsession_id))
		.setColor(podium ? podium.color : BOTTLE_LEVEL_COLORS[meter.level])
		.setDescription(description)
		.addFields(fields)
		.setFooter({ text: "iRacing results" })
		.setTimestamp(new Date(race.race.session_start_time));

	if (image) {
		embed.setImage(image);
	}

	return embed;
};
