import { EmbedBuilder, REST, Routes } from "discord.js";
import pino from "pino";
import type { Command } from "./commands";
import { type TrackedUser, config } from "./config";
import type { Db, DriverStats } from "./db";
import {
	type GetCareerStatsResponse,
	type GetLatestRaceResponse,
	getLatestRace,
} from "./iracing";
import type { IRacingClient } from "./iracing-client";

const logger = pino({
	level: "info",
});

export function run<A>(fn: () => A): A {
	return fn();
}

export const compact = <A>(array: (A | undefined | null)[]): A[] => {
	return array.filter((v): v is A => v !== undefined && v !== null);
};

export const map = async <A, B>(
	arr: A[],
	f: (value: A, index: number) => Promise<B>,
	options?: { concurrency: number },
): Promise<B[]> => {
	const concurrency = options?.concurrency ?? arr.length;
	const results: B[] = new Array(arr.length);
	let currentIndex = 0;

	const worker = async () => {
		while (currentIndex < arr.length) {
			const index = currentIndex++;
			// biome-ignore lint/style/noNonNullAssertion: No need to type this
			results[index] = await f(arr[index]!, index);
		}
	};

	// Launch workers based on concurrency limit
	await Promise.all(
		Array.from({ length: Math.min(concurrency, arr.length) }, worker),
	);

	return results;
};

// biome-ignore lint/suspicious/noExplicitAny: No need to type this
export const log = (message: string, payload?: any) => {
	logger.info(payload, message);
};

export const deployCommands = async (props: {
	guildId: string;
	commands: Record<string, Command>;
}) => {
	const commandsData = Object.values(props.commands).map(
		(command) => command.data,
	);

	const rest = new REST({ version: "10" }).setToken(config.DISCORD_TOKEN);

	try {
		log(
			"Started refreshing application (/) commands.",
			commandsData.map((c) => `${c.name} - ${c.description}`),
		);

		await rest.put(
			Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, props.guildId),
			{
				body: commandsData,
			},
		);

		log("Successfully reloaded application (/) commands.");
	} catch (error) {
		console.error(error);
	}
};

export const createRaceEmbed = (race: GetLatestRaceResponse) => {
	const embed = new EmbedBuilder()
		.setTitle(`${race.driverName}'s race results`)
		.setColor(race.color)
		.addFields(
			{
				name: "📋 • __Details__",
				value: `Series » \`${race.series}\`\nTrack » \`${race.trackName}\`\nCar » \`${race.car?.name}\`\nSOF » \`${race.sof}\`\nSplit » \`${race.split}\`\nClass rank » \`${race.iRatingRank}/${race.entries}\``,
			},
			{
				name: "📊 • __Position__",
				value: `Start » \`${race.startPos}/${race.entries}\`\nFinish » \`${race.finishPos}/${race.entries}\``,
			},
			{
				name: "📉 • __Statistics__",
				value: `Laps » \`${race.laps}\`\nIncidents » \`${race.incidents}\`\nAverage lap » \`${race.averageLapTime}\`\nBest race lap » \`${race.bestLapTime}\`\nQuali lap » \`${race.qualifyingTime}\``,
			},
			{
				name: `${race.bottleMeter.emoji} • __Bottle-Meter (Original)__`,
				value: `Level » \`${race.bottleMeter.level.toUpperCase()}\` (${race.bottleMeter.score}/100)`,
				inline: true,
			},
			{
				name: `${race.michaelsBottleMeter.emoji} • Bottle-Meter (Michael's)`,
				value: `${race.michaelsBottleMeter.level.toUpperCase()}\n\n${race.michaelsBottleMeter.explanation}`,
				inline: false,
			},
			{
				name: "🏆 • __Ratings__",
				value: `iRating » \`${race.newIrating}\` **(${race.iratingChange})**\nSafety » \`${race.newSubLevel}\` **(${race.subLevelChange})**`,
			},
			{
				name: "🔗 • Link",
				value: `[View on iRacing.com](https://members-ng.iracing.com/web/racing/results-stats/results?subsessionid=${race.race.subsession_id})`,
			},
		)
		.setTimestamp(new Date(race.race.session_start_time));

	// Add Zak Brown image when world-champion-hotline is achieved
	if (race.michaelsBottleMeter.level === "world-champion-hotline") {
		embed.setImage(
			"https://news.dupontregistry.com/wp-content/uploads/2025/11/Zak-Brown-scaled.jpg",
		);
	}

	return embed;
};

export const createCareerStatsEmbed = (stats: GetCareerStatsResponse) => {
	// Category breakdown fields
	const categoryFields = stats.categoryBreakdown
		.filter((cat) => cat.starts > 0) // Only show categories with races
		.map((cat) => ({
			name: `${cat.category}`,
			value: `Starts » \`${cat.starts}\`\nWins » \`${cat.wins}\` (\`${cat.winPercentage}%\`)\nTop 5s » \`${cat.top5}\` (\`${cat.top5Percentage}%\`)\nPoles » \`${cat.poles}\``,
			inline: true,
		}));

	return new EmbedBuilder()
		.setTitle(`${stats.driverName}'s Career Statistics`)
		.setColor(0x3498db) // Blue color for career stats
		.addFields(
			{
				name: "📊 • __Overall Career__",
				value: `Total Starts » \`${stats.aggregatedStats.totalStarts}\`\nTotal Wins » \`${stats.aggregatedStats.totalWins}\` (\`${stats.winPercentage}%\`)\nTop 5 Finishes » \`${stats.aggregatedStats.totalTop5}\` (\`${stats.top5Percentage}%\`)\nPole Positions » \`${stats.aggregatedStats.totalPoles}\` (\`${stats.polePercentage}%\`)`,
			},
			{
				name: "🏁 • __Performance Metrics__",
				value: `Total Laps » \`${stats.aggregatedStats.totalLaps.toLocaleString()}\`\nLaps Led » \`${stats.aggregatedStats.totalLapsLed.toLocaleString()}\` (\`${stats.lapsLedPercentage}%\`)\nAvg Incidents » \`${stats.avgIncidents}\``,
			},
			{
				name: `📅 • __This Year (${new Date().getFullYear()})__`,
				value: `Official Sessions » \`${stats.thisYearStats.num_official_sessions}\`\nOfficial Wins » \`${stats.thisYearStats.num_official_wins}\`\nLeague Sessions » \`${stats.thisYearStats.num_league_sessions}\`\nLeague Wins » \`${stats.thisYearStats.num_league_wins}\``,
			},
			...categoryFields,
		)
		.setTimestamp();
};

export const createSeasonLeaderboardEmbed = (options: {
	leaderboard: DriverStats[];
	seasonYear: number;
	seasonQuarter: number;
	licenseCategory: string;
}) => {
	const { leaderboard, seasonYear, seasonQuarter, licenseCategory } = options;

	// Create leaderboard table - show all users
	// Using diff format for color coding: + = green (gains), - = red (losses)
	const leaderboardLines = leaderboard.map((entry, index) => {
		const rank = `${index + 1}.`.padEnd(3, " ");
		const name = entry.customerName.padEnd(20, " ");
		const irGain =
			entry.iratingGain >= 0
				? `+${entry.iratingGain}`.padStart(6, " ")
				: entry.iratingGain.toString().padStart(6, " ");
		const srGain =
			entry.srGain >= 0
				? `+${entry.srGain.toFixed(2)}`.padStart(6, " ")
				: entry.srGain.toFixed(2).padStart(6, " ");

		// Prefix with + or - for diff syntax highlighting
		const prefix = entry.iratingGain >= 0 ? "+" : "-";
		return `${prefix} ${rank} ${name} ${irGain}iR | ${srGain} SR`;
	});

	const leaderboardText = "```diff\n" + leaderboardLines.join("\n") + "\n```";

	// Calculate total stats
	const totalRaces = leaderboard.reduce(
		(acc, entry) => acc + entry.totalRaces,
		0,
	);
	const totalDrivers = leaderboard.length;

	return new EmbedBuilder()
		.setTitle(
			`${seasonYear} Season ${seasonQuarter} - ${licenseCategory} Leaderboard`,
		)
		.setColor(0xffd700) // Gold color for leaderboard
		.setDescription(leaderboardText)
		.addFields({
			name: "📊 • Summary",
			value: `Total Drivers » \`${totalDrivers}\`\nTotal Races » \`${totalRaces}\``,
			inline: false,
		})
		.setFooter({
			text: "Data cached for 24 hours. Use refresh:true to force update.",
		})
		.setTimestamp();
};

export const pollLatestRaces = async (
	iRacingClient: IRacingClient,
	db: Db,
	options: {
		trackedUsers: TrackedUser[];
		onLatestRace: (race: GetLatestRaceResponse) => Promise<void>;
	},
) => {
	const { trackedUsers } = options;

	for (const trackedUser of trackedUsers) {
		const customerId = Number(trackedUser.customerId);

		try {
			const race = await getLatestRace(iRacingClient, { customerId });
			const subsessionId = race.race.subsession_id;

			const hasBeenSeen = await db.hasCustomerRace(customerId, subsessionId);

			if (hasBeenSeen) {
				log(
					`Skipping race ${subsessionId} for ${customerId} (${trackedUser.name}) because it's already been sent.`,
					{ subsessionId },
				);
				continue;
			}

			await db.addCustomerRace(customerId, subsessionId);
			log(`Found new race for ${customerId} (${trackedUser.name}).`, {
				subsessionId,
			});
			await options.onLatestRace(race);
		} catch (error) {
			log(
				`Error polling latest race for ${customerId} (${trackedUser.name}).`,
				{
					error,
				},
			);
		}
	}
};
