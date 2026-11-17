import { type Client, type EmbedBuilder, REST, Routes } from "discord.js";
import pino from "pino";
import type { MichaelsBottleLevel } from "./bottle-meter";
import type { Command } from "./commands";
import { config } from "./config";
import type { BottleLeaderboardEntry, Db, DriverStats } from "./db";
import {
	buildBottleLeaderboardEmbed,
	buildCareerComparisonEmbed,
	buildCareerStatsEmbed,
	buildDriverComparisonEmbed,
	buildSeasonLeaderboardEmbed,
	buildTeamRaceEmbed,
} from "./embeds";
import {
	type CareerCategoryStats,
	type GetCareerStatsResponse,
	type GetLatestRaceResponse,
	type TeamRaceData,
	getLatestRace,
	getTeamRaceData,
} from "./iracing";
import type {
	DriverResult,
	IRacingClient,
	ResultEntry,
	SessionData,
} from "./iracing-client";
import { buildRaceEmbed } from "./race-embed";

const logger = pino({
	level: "info",
	serializers: {
		error: pino.stdSerializers.err,
	},
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

const pickRandom = <T>(items: T[]): T =>
	items[Math.floor(Math.random() * items.length)] as T;

const celebrationImages = [
	"https://i.postimg.cc/m2Ny25b1/zak1.jpg",
	"https://i.postimg.cc/4NbQNSJc/zak2.jpg",
	"https://i.postimg.cc/TYqJY4Ry/zak3.png",
	"https://i.postimg.cc/qMXxM5kn/zak4.jpg",
	"https://i.postimg.cc/KvrDvHZM/zak5.jpg",
	"https://i.postimg.cc/pXYJX62z/zak6.png",
];

const catastrophicImages = [
	"https://i.postimg.cc/VLBWLVYb/bottle.jpg",
	"https://i.postimg.cc/Bn4Kb35n/alonso.webp",
	"https://i.postimg.cc/x1nz8QGL/toto1.jpg",
	"https://i.postimg.cc/9QC702PZ/toto2.webp",
	"https://i.postimg.cc/T3fD1xjy/toto3.webp",
	"https://i.postimg.cc/nr9k0Cbg/images.png",
	"https://i.postimg.cc/JnSQscrM/792763700-1390710113189189-4154878671650087959-n.png",
];

const getBottleMeterImage = (level: MichaelsBottleLevel): string | null => {
	if (level === "bradbury")
		return "https://i.postimg.cc/yYSSthdx/890669308-1897316878095858-5015546690262811352-n.jpg";
	if (level === "dnf")
		return "https://i.postimg.cc/BbMQ5Hbx/Clean-Shot-2026-06-03-at-21-23-07-2x.png";
	if (level === "first-lap-disaster")
		return "https://i.postimg.cc/QdnKZGXq/Clean-Shot-2026-06-03-at-21-22-22-2x.png";
	if (level === "world-champion-hotline") return pickRandom(celebrationImages);
	if (level === "catastrophic") return pickRandom(catastrophicImages);
	return null;
};

const isTeamRace = (subsessionResults: SessionData): boolean => {
	// A race is a team race if:
	// - min_team_drivers > 1 or max_team_drivers > 1
	// - OR driver_changes is true
	// - OR any result entry has driver_results array with length > 1
	if (
		subsessionResults.min_team_drivers > 1 ||
		subsessionResults.max_team_drivers > 1 ||
		subsessionResults.driver_changes
	) {
		return true;
	}

	const raceSession = subsessionResults.session_results.find(
		(res) => res.simsession_name === "RACE",
	);

	if (!raceSession) {
		return false;
	}

	return (raceSession.results as unknown as ResultEntry[]).some(
		(res) => (res.driver_results?.length ?? 0) > 1,
	);
};

const getTeamIdForCustomer = (
	subsessionResults: SessionData,
	customerId: number,
): number | undefined => {
	const raceSession = subsessionResults.session_results.find(
		(res) => res.simsession_name === "RACE",
	);

	if (!raceSession) {
		return undefined;
	}

	// Check in main results
	for (const result of raceSession.results as unknown as ResultEntry[]) {
		if (result.cust_id === customerId && result.team_id) {
			return result.team_id;
		}

		// Check in driver_results
		if (result.driver_results) {
			const driverResult = result.driver_results.find(
				(dr: DriverResult) => dr.cust_id === customerId,
			);
			if (driverResult) {
				return result.team_id;
			}
		}
	}

	return undefined;
};

const findTrackedDriversOnTeam = (
	subsessionResults: SessionData,
	teamId: number,
	trackedCustomerIds: number[],
): number[] => {
	const raceSession = subsessionResults.session_results.find(
		(res) => res.simsession_name === "RACE",
	);

	if (!raceSession) {
		return [];
	}

	const teamEntry = (raceSession.results as unknown as ResultEntry[]).find(
		(res) => res.team_id === teamId,
	);

	if (!teamEntry?.driver_results) {
		return [];
	}

	return teamEntry.driver_results
		.filter((driver: DriverResult) =>
			trackedCustomerIds.includes(driver.cust_id ?? 0),
		)
		.map((driver: DriverResult) => driver.cust_id ?? 0);
};

export const createTeamRaceEmbed = (teamRace: TeamRaceData): EmbedBuilder =>
	buildTeamRaceEmbed(teamRace, getBottleMeterImage);

export const createRaceEmbed = (race: GetLatestRaceResponse) =>
	buildRaceEmbed(race, getBottleMeterImage(race.michaelsBottleMeter.level));

export const createCareerStatsEmbed = buildCareerStatsEmbed;
export const createSeasonLeaderboardEmbed = buildSeasonLeaderboardEmbed;
export const createDriverComparisonEmbed = buildDriverComparisonEmbed;
export const createCareerComparisonEmbed = buildCareerComparisonEmbed;
export const createBottleLeaderboardEmbed = buildBottleLeaderboardEmbed;

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

		// Track which (subsessionId, teamId) pairs we've processed this cycle
		const processedTeamRaces = new Map<number, Set<number>>();

		for (const customerId of customerIds) {
			try {
				const race = await getLatestRace(iRacingClient, { customerId });
				const subsessionId = race.race.subsession_id;

				// Fetch full subsession data to detect team race
				const subsessionResults = (await iRacingClient.getResults({
					subsession_id: subsessionId,
				})) as unknown as SessionData;

				if (isTeamRace(subsessionResults)) {
					// Team race detected
					const raceTeamId = getTeamIdForCustomer(
						subsessionResults,
						customerId,
					);

					if (!raceTeamId) {
						log(
							`Could not find team ID for customer ${customerId} in subsession ${subsessionId}`,
							{ customerId, subsessionId },
						);
						continue;
					}

					// Skip if we already processed this team in this subsession
					if (processedTeamRaces.get(subsessionId)?.has(raceTeamId)) {
						log(
							`Already processed team race for subsession ${subsessionId} team ${raceTeamId}`,
							{ subsessionId, raceTeamId },
						);
						continue;
					}

					// Check if this team race was already posted
					const hasBeenPosted = await db.hasTeamRace(
						subsessionId,
						raceTeamId,
						guildId,
					);
					if (hasBeenPosted) {
						log(
							`Skipping team race ${subsessionId} team ${raceTeamId} in guild ${guildId} because it's already been sent.`,
							{ subsessionId, raceTeamId, guildId },
						);
						continue;
					}

					// Find all tracked drivers on this team
					const trackedDriversOnTeam = findTrackedDriversOnTeam(
						subsessionResults,
						raceTeamId,
						customerIds,
					);

					if (trackedDriversOnTeam.length === 0) {
						log(
							`No tracked drivers found on team ${raceTeamId} in subsession ${subsessionId}`,
							{ raceTeamId, subsessionId },
						);
						continue;
					}

					// Fetch team race data
					const teamRaceData = await getTeamRaceData(iRacingClient, {
						subsessionId,
						teamId: raceTeamId,
						trackedCustomerIds: trackedDriversOnTeam,
					});

					// Mark as posted
					await db.addTeamRace(subsessionId, raceTeamId, guildId);

					// Mark as processed in this cycle
					if (!processedTeamRaces.has(subsessionId)) {
						processedTeamRaces.set(subsessionId, new Set());
					}
					processedTeamRaces.get(subsessionId)?.add(raceTeamId);

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
						const embed = createTeamRaceEmbed(teamRaceData);
						await channel.send({ embeds: [embed] });
						log(
							`Posted team race ${subsessionId} for team ${raceTeamId} in guild ${guildId}`,
							{
								subsessionId,
								raceTeamId,
								guildId,
								trackedDrivers: trackedDriversOnTeam,
							},
						);
					}
				} else {
					// Individual race - existing logic
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
