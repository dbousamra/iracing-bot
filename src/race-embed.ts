import { EmbedBuilder } from "discord.js";
import type {
	MichaelsBottleLevel,
	MichaelsBottleMeterResult,
} from "./bottle-meter";

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
	averageLapTime: string;
	bestLapTime: string;
	qualifyingTime: string;
	newIrating: number;
	iratingChange: number;
	newSubLevel: number;
	subLevelChange: string | number;
	michaelsBottleMeter: MichaelsBottleMeterResult;
	race: { subsession_id: number; session_start_time: string };
}

const PODIUM: Record<number, { medal: string; label: string; color: number }> =
	{
		1: { medal: "🥇", label: "WIN", color: 0xf1c40f },
		2: { medal: "🥈", label: "PODIUM", color: 0xc0c7d0 },
		3: { medal: "🥉", label: "PODIUM", color: 0xcd7f32 },
	};

/** Colour bar for non-podium finishes, following each level's own emoji. */
export const BOTTLE_LEVEL_COLORS: Record<MichaelsBottleLevel, number> = {
	"world-champion-hotline": 0x57f287,
	bradbury: 0x57f287,
	"no-bottleo": 0x3ba55d,
	"low-moderate": 0xfee75c,
	high: 0xf0883e,
	"very-high": 0xe67e22,
	severe: 0xe74c3c,
	extreme: 0xed4245,
	catastrophic: 0xed4245,
	"first-lap-disaster": 0xed4245,
	dnf: 0x80848e,
};

const MINUS = "−";

const levelName = (level: MichaelsBottleLevel) =>
	level.replace(/-/g, " ").toUpperCase();

const signed = (n: number, dp = 0) => {
	const abs = Math.abs(n).toFixed(dp);
	if (Number(abs) === 0) return `±${abs}`;
	return n > 0 ? `+${abs}` : `${MINUS}${abs}`;
};

const trend = (n: number, dp = 0) => {
	if (Number(Math.abs(n).toFixed(dp)) === 0) return `⚪ ${signed(n, dp)}`;
	return `${n > 0 ? "🟢" : "🔴"} ${signed(n, dp)}`;
};

const placesMoved = (start: number, finish: number) => {
	const gained = start - finish;
	if (gained > 0) return `🟢 ▲${gained}`;
	if (gained < 0) return `🔴 ▼${-gained}`;
	return "⚪ ±0";
};

const vsExpected = (expected: number, finish: number) => {
	const diff = expected - finish;
	const places = (k: number) => `${k} place${k === 1 ? "" : "s"}`;
	if (diff > 0) return `**${places(diff)} above expected**`;
	if (diff < 0) return `**${places(-diff)} below expected**`;
	return "**right on expected**";
};

/** "Toyota GR86 Cup by SIMAGIC" -> "Toyota GR86 Cup" */
const stripSponsor = (series: string) =>
	series.replace(/\s+(?:by|presented by|powered by)\s+.+$/i, "").trim();

export const buildRaceEmbed = (
	race: RaceEmbedInput,
	image: string | null,
): EmbedBuilder => {
	const podium = PODIUM[race.finishPos];
	const meter = race.michaelsBottleMeter;
	const tier = `${meter.emoji} ${levelName(meter.level)}`;
	const finish = `P${race.finishPos} / ${race.entries}`;
	const hasExpected = race.iRatingRank > 0;

	const title = podium
		? `${podium.medal} ${podium.label} · ${finish}`
		: `${tier} · ${finish}`;

	const series = stripSponsor(race.series);
	const carName = race.car?.name;
	const showCar =
		!!carName && !series.toLowerCase().includes(carName.toLowerCase());
	const event = [series, race.trackName, showCar ? carName : null]
		.filter(Boolean)
		.join(" · ");

	const verdict = hasExpected
		? `${vsExpected(race.iRatingRank, race.finishPos)} with **${race.incidents}x**`
		: `**${race.incidents}x**`;

	const description = [
		`### 🏁 ${event}`,
		`SOF **${race.sof}** · Split **${race.split.replace(/\s/g, "")}** · Avg lap **${race.averageLapTime}**`,
		"",
		`Started **P${race.startPos}**${hasExpected ? ` · expected **P${race.iRatingRank}**` : ""} · finished **P${race.finishPos}**`,
		// On a podium the tier leaves the title, so keep it visible here.
		podium ? `${tier} · ${verdict}` : verdict,
		`-# ${meter.explanation}`,
	].join("\n");

	const embed = new EmbedBuilder()
		.setAuthor({ name: race.driverName })
		.setTitle(title)
		.setURL(
			`https://members-ng.iracing.com/web/racing/results-stats/results?subsessionid=${race.race.subsession_id}`,
		)
		.setColor(podium ? podium.color : BOTTLE_LEVEL_COLORS[meter.level])
		.setDescription(description)
		.addFields(
			{
				name: "Finish",
				value: `${podium ? `${podium.medal} ` : ""}**P${race.finishPos}** ${placesMoved(race.startPos, race.finishPos)}`,
				inline: true,
			},
			{
				name: "iRating",
				value: `**${race.newIrating}** ${trend(race.iratingChange)}`,
				inline: true,
			},
			{
				name: "Safety",
				value: `**${race.newSubLevel.toFixed(2)}** ${trend(Number(race.subLevelChange), 2)}`,
				inline: true,
			},
			{ name: "Incidents", value: `**${race.incidents}x**`, inline: true },
			{ name: "Best lap", value: `\`${race.bestLapTime}\``, inline: true },
			{ name: "Quali", value: `\`${race.qualifyingTime}\``, inline: true },
		)
		.setFooter({ text: "iRacing results" })
		.setTimestamp(new Date(race.race.session_start_time));

	if (image) {
		embed.setImage(image);
	}

	return embed;
};
