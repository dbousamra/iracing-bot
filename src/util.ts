import { EmbedBuilder, REST, Routes } from "discord.js";
import pino from "pino";
import type { Command } from "./commands";
import { type TrackedUser, config } from "./config";
import type { Db } from "./db";
import {
	type GetCareerStatsResponse,
	type GetLatestRaceResponse,
	type GetRecentFormResponse,
	getLatestRace,
} from "./iracing";
import type { IRacingClient } from "./iracing-client";

const logger = pino({
	level: "info",
});

export function run<A>(fn: () => A): A {
	return fn();
}

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
	return new EmbedBuilder()
		.setTitle(`${race.driverName}'s race results`)
		.setColor(race.color)
		.addFields(
			{
				name: "📋 • __Details__",
				value: `Series » \`${race.series}\`\nTrack » \`${race.trackName}\`\nCar » \`${race.car?.name}\`\nSOF » \`${race.sof}\`\nSplit » \`${race.split}\``,
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
				value: `Level » \`${race.michaelsBottleMeter.level.toUpperCase()}\` (${race.michaelsBottleMeter.score}/100)\nExpected P${race.michaelsBottleMeter.factors.expectedPosition} → P${race.michaelsBottleMeter.factors.actualPosition}`,
				inline: true,
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

export const createRecentFormEmbed = (form: GetRecentFormResponse) => {
	// Create a summary of last 10 races
	const raceSummary = form.raceMetrics
		.map((race, index) => {
			const posChange = race.positionChange;
			const posChangeStr =
				posChange > 0 ? `+${posChange}` : posChange < 0 ? `${posChange}` : "±0";
			const irChangeStr =
				race.iratingChange > 0
					? `+${race.iratingChange}`
					: `${race.iratingChange}`;

			// Use emoji for position trends
			const trendEmoji = posChange > 0 ? "📈" : posChange < 0 ? "📉" : "➡️";

			return `${index + 1}. **${race.series}**\n   Position: \`P${race.startPos} → P${race.finishPos}\` ${trendEmoji} (\`${posChangeStr}\`)\n   iRating: \`${irChangeStr}\` | Inc: \`${race.incidents}\` | SOF: \`${race.sof}\``;
		})
		.join("\n\n");

	// Favorite car and track from recap
	const favoriteCarName = form.recap.stats.favorite_car.car_name;
	const favoriteTrackName = form.recap.stats.favorite_track.track_name;

	return new EmbedBuilder()
		.setTitle(`${form.driverName}'s Recent Form (Last 10 Races)`)
		.setColor(form.trendColor)
		.addFields(
			{
				name: "📈 • __Trend Analysis__",
				value: `Current iRating » \`${form.currentIrating}\`\nTotal iR Change » \`${form.trends.totalIratingChange >= 0 ? "+" : ""}${form.trends.totalIratingChange}\`\nAvg iR Change/Race » \`${Number(form.trends.avgIratingChange) >= 0 ? "+" : ""}${form.trends.avgIratingChange}\`\nWins » \`${form.trends.wins}/10\`\nTop 5s » \`${form.trends.top5}/10\``,
			},
			{
				name: "📊 • __Average Performance__",
				value: `Avg Finish » \`P${form.trends.avgFinishPos}\`\nAvg Start » \`P${form.trends.avgStartPos}\`\nAvg Incidents » \`${form.trends.avgIncidents}\`\nAvg SOF » \`${form.trends.avgSof}\`\nPositions Gained » \`${form.trends.positionsGained}\``,
			},
			{
				name: "⭐ • __Preferences__",
				value: `Favorite Car » \`${favoriteCarName}\`\nFavorite Track » \`${favoriteTrackName}\``,
			},
			{
				name: "🏁 • __Race History__",
				value:
					raceSummary.length > 1024
						? `${raceSummary.substring(0, 1021)}...`
						: raceSummary,
			},
		)
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
