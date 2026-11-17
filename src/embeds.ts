// Builders for every embed except the individual race result (race-embed.ts).
// Kept free of config / client imports so they can be unit-tested.
import { EmbedBuilder } from "discord.js";
import {
	type MichaelsBottleLevel,
	calculateTeamBottleMeter,
} from "./bottle-meter";
import type { BottleLeaderboardEntry, DriverStats } from "./db";
import {
	BOTTLE_LEVEL_COLORS,
	CACHE_FOOTER,
	COLORS,
	PODIUM,
	eventLine,
	fitLines,
	levelName,
	plural,
	rankBadge,
	resultUrl,
	signed,
	trend,
} from "./embed-format";
import type {
	CareerCategoryStats,
	GetCareerStatsResponse,
	TeamRaceData,
} from "./iracing";
import { showExplanation } from "./race-embed";

// ---------------------------------------------------------------------------
// Team race result
// ---------------------------------------------------------------------------

export const buildTeamRaceEmbed = (
	teamRace: TeamRaceData,
	getImage: (level: MichaelsBottleLevel) => string | null,
): EmbedBuilder => {
	const meter = calculateTeamBottleMeter({
		teamPosition: teamRace.teamPositionInClass,
		avgTeamIRating: teamRace.avgTeamIRating,
		classResults: teamRace.classResults,
		totalIncidents: teamRace.totalIncidents,
		totalLaps: teamRace.totalLaps,
	});

	const position = teamRace.teamPositionInClass;
	const podium = PODIUM[position];
	const tier = `${meter.emoji} ${levelName(meter.level)}`;
	const finish = `P${position} / ${teamRace.classEntries}`;

	const description = [
		`### 👥 ${teamRace.teamName} · ${finish}`,
		eventLine(teamRace.series, teamRace.track, teamRace.carClass),
		`SOF **${teamRace.strengthOfField}** · Overall **P${teamRace.teamPosition} / ${teamRace.totalEntries}**`,
		// On a podium the bottle-meter leaves the headline, so keep it here.
		...(podium ? [`-# Bottle-meter: ${tier}`] : []),
		...(showExplanation(meter) ? [`-# ${meter.explanation}`] : []),
	].join("\n");

	const drivers = teamRace.drivers
		.map(
			(d) =>
				`**${d.displayName}** · ${plural(d.lapsComplete, "lap")} · ${d.incidents}x · ${trend(d.iRatingChange)} iR · ${trend(d.subLevelChange, 2)} SR`,
		)
		.join("\n");

	const embed = new EmbedBuilder()
		.setTitle(
			podium
				? `${podium.medal} ${position === 1 ? "🏆 " : ""}${podium.label}`
				: tier,
		)
		.setURL(resultUrl(teamRace.subsessionId))
		.setColor(podium ? podium.color : BOTTLE_LEVEL_COLORS[meter.level])
		.setDescription(description)
		.addFields(
			{
				name: "Finish (class)",
				value: `${podium ? `${podium.medal} ` : ""}**P${position}**`,
				inline: true,
			},
			{ name: "Laps", value: `**${teamRace.totalLaps}**`, inline: true },
			{
				name: "Incidents",
				value: `**${teamRace.totalIncidents}x**`,
				inline: true,
			},
			{ name: "Drivers", value: drivers || "—", inline: false },
		)
		.setFooter({ text: "iRacing results" })
		.setTimestamp(new Date(teamRace.sessionStartTime));

	const image = getImage(meter.level);
	if (image) {
		embed.setImage(image);
	}

	return embed;
};

// ---------------------------------------------------------------------------
// Career stats
// ---------------------------------------------------------------------------

export const buildCareerStatsEmbed = (
	stats: GetCareerStatsResponse,
	year = new Date().getFullYear(),
): EmbedBuilder => {
	const s = stats.aggregatedStats;
	const y = stats.thisYearStats;

	const categoryFields = stats.categoryBreakdown
		.filter((cat) => cat.starts > 0)
		.map((cat) => ({
			name: cat.category,
			value: `**${cat.starts}** starts · **${cat.wins}** wins (${cat.winPercentage}%)\n**${cat.top5}** top 5s · **${cat.poles}** poles`,
			inline: true,
		}));

	return new EmbedBuilder()
		.setTitle(`📊 ${stats.driverName} · career`)
		.setColor(COLORS.info)
		.setDescription(
			`### ${plural(s.totalStarts, "start")} · ${plural(s.totalWins, "win")} (${stats.winPercentage}%)`,
		)
		.addFields(
			{
				name: "Wins",
				value: `**${s.totalWins}** (${stats.winPercentage}%)`,
				inline: true,
			},
			{
				name: "Top 5s",
				value: `**${s.totalTop5}** (${stats.top5Percentage}%)`,
				inline: true,
			},
			{
				name: "Poles",
				value: `**${s.totalPoles}** (${stats.polePercentage}%)`,
				inline: true,
			},
			{
				name: "Laps",
				value: `**${s.totalLaps.toLocaleString("en-US")}**`,
				inline: true,
			},
			{
				name: "Laps led",
				value: `**${s.totalLapsLed.toLocaleString("en-US")}** (${stats.lapsLedPercentage}%)`,
				inline: true,
			},
			{
				name: "Avg incidents",
				value: `**${stats.avgIncidents}x**`,
				inline: true,
			},
			{
				name: `📅 ${year} so far`,
				value: `Official · **${plural(y.num_official_sessions, "race")}** · **${plural(y.num_official_wins, "win")}**\nLeague · **${plural(y.num_league_sessions, "race")}** · **${plural(y.num_league_wins, "win")}**`,
				inline: false,
			},
			...categoryFields,
		)
		.setTimestamp();
};

// ---------------------------------------------------------------------------
// Season leaderboard
// ---------------------------------------------------------------------------

type SeasonOptions = {
	seasonYear: number;
	seasonQuarter: number;
	licenseCategory: string;
};

const seasonLabel = (o: SeasonOptions) =>
	`${o.seasonYear} S${o.seasonQuarter} · ${o.licenseCategory}`;

export const buildSeasonLeaderboardEmbed = (
	options: SeasonOptions & { leaderboard: DriverStats[] },
): EmbedBuilder => {
	const { leaderboard } = options;

	const lines = leaderboard.map(
		(e, i) =>
			// Race counts are left out so each driver fits on one line on phones.
			`${rankBadge(i + 1)} **${e.customerName}** · **${e.endingIrating}** iR ${trend(e.iratingGain)} · **${e.endingSr.toFixed(2)}** SR ${trend(e.srGain, 2)}`,
	);

	const totalRaces = leaderboard.reduce((acc, e) => acc + e.totalRaces, 0);
	// The list is already ranked by iRating gain, so call out safety instead.
	const bestSr = [...leaderboard].sort((a, b) => b.srGain - a.srGain)[0];

	const embed = new EmbedBuilder()
		.setTitle(`🏆 ${seasonLabel(options)} leaderboard`)
		.setColor(COLORS.leaderboard)
		.setDescription(
			lines.length ? fitLines(lines) : "No races yet this season.",
		)
		.addFields(
			{ name: "Drivers", value: `**${leaderboard.length}**`, inline: true },
			{ name: "Races", value: `**${totalRaces}**`, inline: true },
			{
				name: "Best SR gain",
				value: bestSr
					? `**${bestSr.customerName}** ${trend(bestSr.srGain, 2)}`
					: "—",
				inline: true,
			},
		)
		.setFooter({ text: CACHE_FOOTER })
		.setTimestamp();

	return embed;
};

// ---------------------------------------------------------------------------
// Bottle leaderboard
// ---------------------------------------------------------------------------

/** Drivers need this many races to be ranked on the bottle leaderboard. */
export const BOTTLE_MIN_RACES = 5;

export const buildBottleLeaderboardEmbed = (
	options: SeasonOptions & { leaderboard: BottleLeaderboardEntry[] },
): EmbedBuilder => {
	const { leaderboard } = options;
	const pct = (n: number, races: number) =>
		races > 0 ? `${Math.round((n / races) * 100)}%` : "0%";

	// Small samples would top a percentage ranking (1 hotline in 1 race = 100%),
	// so only drivers with enough races are ranked; the rest are listed below.
	const ranked = leaderboard.filter((e) => e.totalRaces >= BOTTLE_MIN_RACES);
	const unranked = leaderboard.filter((e) => e.totalRaces < BOTTLE_MIN_RACES);

	const counts = (e: BottleLeaderboardEntry) =>
		`👑 **${e.worldChampionCount}** · ⛸️ **${e.bradburyCount ?? 0}** · 💥 **${e.catastrophicCount}**`;

	const lines = [
		...ranked.map(
			(e, i) =>
				`${rankBadge(i + 1)} **${e.customerName}** · ${counts(e)} · ${pct(e.worldChampionCount, e.totalRaces)} 👑`,
		),
		...(unranked.length
			? [
					"",
					`-# Fewer than ${BOTTLE_MIN_RACES} races, not ranked`,
					...unranked.map(
						(e) =>
							`• ${e.customerName} · ${counts(e)} · ${plural(e.totalRaces, "race")}`,
					),
				]
			: []),
	];

	const sum = (pick: (e: BottleLeaderboardEntry) => number) =>
		leaderboard.reduce((acc, e) => acc + pick(e), 0);
	const totalRaces = sum((e) => e.totalRaces);

	return new EmbedBuilder()
		.setTitle(`🍾 ${seasonLabel(options)} bottle leaderboard`)
		.setColor(COLORS.bottle)
		.setDescription(
			[
				`-# 👑 World Champion Hotline · ⛸️ Bradbury · 💥 Catastrophic · ranked by 👑 rate · ${plural(totalRaces, "race")} in total`,
				"",
				lines.length ? fitLines(lines, 3800) : "No races yet this season.",
			].join("\n"),
		)
		.addFields(
			{
				name: "👑 Hotlines",
				value: `**${sum((e) => e.worldChampionCount)}**`,
				inline: true,
			},
			{
				name: "⛸️ Bradburys",
				value: `**${sum((e) => e.bradburyCount ?? 0)}**`,
				inline: true,
			},
			{
				name: "💥 Catastrophes",
				value: `**${sum((e) => e.catastrophicCount)}**`,
				inline: true,
			},
		)
		.setFooter({ text: CACHE_FOOTER })
		.setTimestamp();
};

// ---------------------------------------------------------------------------
// Head-to-head comparisons
// ---------------------------------------------------------------------------

// A single head-to-head row. `winner` marks who wins it; `counts: false`
// shows the row for context but excludes it from the verdict tally.
export type ComparisonRow = {
	label: string;
	a: string;
	b: string;
	winner: "A" | "B" | "=";
	counts?: boolean;
};

export const compareMetric = (
	a: number,
	b: number,
	higherIsBetter: boolean,
): "A" | "B" | "=" => {
	if (a === b) return "=";
	const aWins = higherIsBetter ? a > b : a < b;
	return aWins ? "A" : "B";
};

const SIDE_A = "🟦";
const SIDE_B = "🟧";

const comparisonLine = (row: ComparisonRow) => {
	const a = row.winner === "A" ? `**${row.a}**` : row.a;
	const b = row.winner === "B" ? `**${row.b}**` : row.b;
	const mark =
		row.counts === false
			? "▫️"
			: row.winner === "A"
				? SIDE_A
				: row.winner === "B"
					? SIDE_B
					: "⬜";
	return `${mark} ${row.label} · ${a} vs ${b}`;
};

export const buildComparisonEmbed = (options: {
	nameA: string;
	nameB: string;
	subtitle: string;
	rows: ComparisonRow[];
}): EmbedBuilder => {
	const { nameA, nameB, subtitle, rows } = options;

	const scored = rows.filter((r) => r.counts !== false);
	const aWins = scored.filter((r) => r.winner === "A").length;
	const bWins = scored.filter((r) => r.winner === "B").length;

	const verdict =
		aWins > bWins
			? `### 🏆 ${nameA} leads ${aWins}–${bWins}`
			: bWins > aWins
				? `### 🏆 ${nameB} leads ${bWins}–${aWins}`
				: `### 🤝 Dead heat ${aWins}–${bWins}`;

	return new EmbedBuilder()
		.setTitle(`⚔️ ${nameA} vs ${nameB}`)
		.setColor(
			aWins > bWins
				? COLORS.sideA
				: bWins > aWins
					? COLORS.sideB
					: COLORS.neutral,
		)
		.setDescription(
			[
				verdict,
				`-# ${subtitle} · ${SIDE_A} ${nameA} · ${SIDE_B} ${nameB}`,
				"",
				...rows.map(comparisonLine),
			].join("\n"),
		)
		.setTimestamp();
};

export const buildDriverComparisonEmbed = (
	options: SeasonOptions & {
		driverA: DriverStats;
		driverB: DriverStats;
		// When present, the comparison covers only races both drivers ran, and a
		// head-to-head finishing record is shown.
		headToHead?: { aheadA: number; aheadB: number };
	},
): EmbedBuilder => {
	const { driverA: a, driverB: b, headToHead } = options;

	const rows: ComparisonRow[] = [
		{
			label: "Races",
			a: `${a.totalRaces}`,
			b: `${b.totalRaces}`,
			winner: compareMetric(a.totalRaces, b.totalRaces, true),
		},
		{
			label: "Wins",
			a: `${a.totalWins}`,
			b: `${b.totalWins}`,
			winner: compareMetric(a.totalWins, b.totalWins, true),
		},
		{
			label: "iRating",
			a: `${a.endingIrating}`,
			b: `${b.endingIrating}`,
			winner: compareMetric(a.endingIrating, b.endingIrating, true),
		},
		{
			label: "iR gain",
			a: signed(a.iratingGain),
			b: signed(b.iratingGain),
			winner: compareMetric(a.iratingGain, b.iratingGain, true),
		},
		{
			label: "Safety",
			a: a.endingSr.toFixed(2),
			b: b.endingSr.toFixed(2),
			winner: compareMetric(a.endingSr, b.endingSr, true),
		},
		{
			label: "SR gain",
			a: signed(a.srGain, 2),
			b: signed(b.srGain, 2),
			winner: compareMetric(a.srGain, b.srGain, true),
		},
		{
			label: "Avg start",
			a: a.averageStartPosition.toFixed(1),
			b: b.averageStartPosition.toFixed(1),
			winner: compareMetric(
				a.averageStartPosition,
				b.averageStartPosition,
				false,
			),
		},
		{
			label: "Avg finish",
			a: a.averageFinishPosition.toFixed(1),
			b: b.averageFinishPosition.toFixed(1),
			winner: compareMetric(
				a.averageFinishPosition,
				b.averageFinishPosition,
				false,
			),
		},
		{
			label: "Avg incidents",
			a: a.averageIncidents.toFixed(2),
			b: b.averageIncidents.toFixed(2),
			winner: compareMetric(a.averageIncidents, b.averageIncidents, false),
		},
	];

	const embed = buildComparisonEmbed({
		nameA: a.customerName,
		nameB: b.customerName,
		subtitle: headToHead
			? `${seasonLabel(options)} · shared races only`
			: seasonLabel(options),
		rows,
	});

	if (headToHead) {
		const { aheadA, aheadB } = headToHead;
		const left = aheadA > aheadB ? `**${aheadA}**` : `${aheadA}`;
		const right = aheadB > aheadA ? `**${aheadB}**` : `${aheadB}`;
		embed.addFields({
			name: "🤝 Finished ahead",
			value: `${SIDE_A} ${a.customerName} ${left} – ${right} ${b.customerName} ${SIDE_B}`,
			inline: false,
		});
	} else {
		embed.setFooter({ text: CACHE_FOOTER });
	}

	return embed;
};

export const buildCareerComparisonEmbed = (options: {
	driverA: CareerCategoryStats;
	driverB: CareerCategoryStats;
	licenseCategory: string;
}): EmbedBuilder => {
	const { driverA: a, driverB: b, licenseCategory } = options;

	const rows: ComparisonRow[] = [
		// Volume rows: shown for context but excluded from the verdict tally,
		// since more starts/laps reflects activity rather than skill.
		{
			label: "Starts",
			a: `${a.starts}`,
			b: `${b.starts}`,
			winner: compareMetric(a.starts, b.starts, true),
			counts: false,
		},
		{
			label: "Wins",
			a: `${a.wins}`,
			b: `${b.wins}`,
			winner: compareMetric(a.wins, b.wins, true),
		},
		{
			label: "Win %",
			a: a.winPercentage.toFixed(1),
			b: b.winPercentage.toFixed(1),
			winner: compareMetric(a.winPercentage, b.winPercentage, true),
		},
		{
			label: "Top 5s",
			a: `${a.top5}`,
			b: `${b.top5}`,
			winner: compareMetric(a.top5, b.top5, true),
		},
		{
			label: "Poles",
			a: `${a.poles}`,
			b: `${b.poles}`,
			winner: compareMetric(a.poles, b.poles, true),
		},
		{
			label: "Avg finish",
			a: a.avgFinishPosition.toFixed(1),
			b: b.avgFinishPosition.toFixed(1),
			winner: compareMetric(a.avgFinishPosition, b.avgFinishPosition, false),
		},
		{
			label: "Avg incidents",
			a: a.avgIncidents.toFixed(2),
			b: b.avgIncidents.toFixed(2),
			winner: compareMetric(a.avgIncidents, b.avgIncidents, false),
		},
		{
			label: "Laps",
			a: a.laps.toLocaleString("en-US"),
			b: b.laps.toLocaleString("en-US"),
			winner: compareMetric(a.laps, b.laps, true),
			counts: false,
		},
		{
			label: "Laps led",
			a: a.lapsLed.toLocaleString("en-US"),
			b: b.lapsLed.toLocaleString("en-US"),
			winner: compareMetric(a.lapsLed, b.lapsLed, true),
			counts: false,
		},
	];

	return buildComparisonEmbed({
		nameA: a.customerName,
		nameB: b.customerName,
		subtitle: `All-time career · ${licenseCategory}`,
		rows,
	});
};

// ---------------------------------------------------------------------------
// Team configuration
// ---------------------------------------------------------------------------

export const buildTeamSetEmbed = (team: {
	team_name: string;
	team_id: number;
	roster_count: number;
}): EmbedBuilder =>
	new EmbedBuilder()
		.setTitle(`✅ Now tracking ${team.team_name}`)
		.setColor(COLORS.gain)
		.setDescription("Race results for this team will post automatically.")
		.addFields(
			{ name: "Team ID", value: `**${team.team_id}**`, inline: true },
			{ name: "Drivers", value: `**${team.roster_count}**`, inline: true },
		);

export const buildTeamShowEmbed = (options: {
	team: {
		team_name: string;
		team_id: number;
		roster_count: number;
		roster: { display_name: string }[];
	};
	notificationChannelId: string | null;
}): EmbedBuilder => {
	const { team, notificationChannelId } = options;
	const preview = team.roster.slice(0, 10).map((m) => `• ${m.display_name}`);
	if (team.roster_count > 10) {
		preview.push(`-# …and ${team.roster_count - 10} more`);
	}

	return new EmbedBuilder()
		.setTitle(`👥 ${team.team_name}`)
		.setColor(COLORS.info)
		.addFields(
			{ name: "Team ID", value: `**${team.team_id}**`, inline: true },
			{ name: "Drivers", value: `**${team.roster_count}**`, inline: true },
			{
				name: "Posts to",
				value: notificationChannelId
					? `<#${notificationChannelId}>`
					: "Not set",
				inline: true,
			},
			{ name: "Roster", value: preview.join("\n") || "—", inline: false },
		);
};
