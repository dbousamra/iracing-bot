import { type Client, EmbedBuilder, REST, Routes } from "discord.js";
import pino from "pino";
import type { Command } from "./commands";
import { config } from "./config";
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
				name: `${race.michaelsBottleMeter.emoji} • Bottle-Meter`,
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
			"https://images.ps-aws.com/c?url=https%3A%2F%2Fd3cm515ijfiu6w.cloudfront.net%2Fwp-content%2Fuploads%2F2025%2F03%2F20140136%2Fzak-brown-mclaren-australian-gp-2025-planetf1-1320x742.jpg",
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

	const header = "  Name                   | IR        | SR         | R  ";

	const leaderboardLines = leaderboard.map((entry) => {
		const name = entry.customerName.padEnd(22, " ");
		const irGainStr =
			entry.iratingGain >= 0
				? `+${entry.iratingGain}`
				: entry.iratingGain.toString();
		const ir = `${entry.endingIrating} ${irGainStr}`.padEnd(9, " ");
		const srGainStr =
			entry.srGain >= 0
				? `+${entry.srGain.toFixed(2)}`
				: entry.srGain.toFixed(2);
		const sr = `${entry.endingSr.toFixed(2)} ${srGainStr}`.padEnd(10, " ");
		const races = entry.totalRaces.toString().padEnd(3, " ");

		// Prefix with + or - for diff syntax highlighting
		const prefix = entry.iratingGain >= 0 ? "+" : "-";
		return `${prefix} ${name} | ${ir} | ${sr} | ${races}`;
	});

	const leaderboardText =
		// biome-ignore lint/style/useTemplate: <explanation>
		"```diff\n" + header + "\n" + leaderboardLines.join("\n") + "\n```";

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
	discordClient: Client,
	options: {
		guildId: string;
		teamId: number;
	},
) => {
	const { guildId, teamId } = options;

	try {
		// Fetch team roster
		const team = await iRacingClient.getTeam({ team_id: teamId });
		const customerIds = team.roster.map((m) => m.cust_id);

		log(`Polling ${customerIds.length} team members for guild ${guildId}`, {
			teamName: team.team_name,
			teamId: team.team_id,
		});

		for (const customerId of customerIds) {
			try {
				const race = await getLatestRace(iRacingClient, { customerId });
				const subsessionId = race.race.subsession_id;

				const hasBeenSeen = await db.hasCustomerRace(
					customerId,
					subsessionId,
					guildId,
				);

				if (hasBeenSeen) {
					log(
						`Skipping race ${subsessionId} for customer ${customerId} in guild ${guildId} because it's already been sent.`,
						{ subsessionId, guildId },
					);
					continue;
				}

				await db.addCustomerRace(customerId, subsessionId, guildId);

				// Fetch guild config to get notification channel
				const guildConfig = await db.getGuildConfig(guildId);

				if (!guildConfig?.notificationChannelId) {
					log(`No notification channel set for guild ${guildId}`, {
						guildId,
					});
					continue;
				}

				// Post to channel
				const channel = await discordClient.channels.fetch(
					guildConfig.notificationChannelId,
				);

				if (channel?.isSendable()) {
					const embed = createRaceEmbed(race);
					await channel.send({ embeds: [embed] });
					log(`Posted race ${subsessionId} for customer ${customerId}`, {
						subsessionId,
						customerId,
						guildId,
					});
				}
			} catch (error) {
				log(`Error polling latest race for customer ${customerId}`, {
					error,
					customerId,
				});
			}
		}
	} catch (error) {
		log(`Error fetching team roster for guild ${guildId}`, {
			error,
			guildId,
			teamId,
		});
	}
};
