import {
	ChannelType,
	type CommandInteraction,
	PermissionFlagsBits,
	SlashCommandBuilder,
	type SlashCommandOptionsOnlyBuilder,
} from "discord.js";
import { config } from "./config";
import type { Db } from "./db";
import {
	getBottleLeaderboard,
	getCareerCategoryStats,
	getCareerStats,
	getLatestRace,
	getSeasonLeaderboard,
	getTeamRaceData,
} from "./iracing";
import type {
	DriverResult,
	IRacingClient,
	ResultEntry,
	SessionData,
	TeamRosterMember,
} from "./iracing-client";
import {
	createBottleLeaderboardEmbed,
	createCareerComparisonEmbed,
	createCareerStatsEmbed,
	createDriverComparisonEmbed,
	createRaceEmbed,
	createSeasonLeaderboardEmbed,
	createTeamRaceEmbed,
} from "./util";

export type Command = {
	data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
	execute: (interaction: CommandInteraction) => Promise<void>;
};

export const ping: Command = {
	data: new SlashCommandBuilder()
		.setName("ping")
		.setDescription("Replies with Pong!"),
	execute: async (interaction: CommandInteraction): Promise<void> => {
		await interaction.reply("Pong!");
	},
};

export const latestRace = (iRacingClient: IRacingClient, db: Db): Command => ({
	data: new SlashCommandBuilder()
		.setName("latest_race")
		.setDescription("Get the latest race for a team member")
		.addStringOption((option) =>
			option
				.setName("driver-name")
				.setDescription("Driver name (as it appears on iRacing)")
				.setRequired(true),
		),

	execute: async (interaction: CommandInteraction): Promise<void> => {
		if (!interaction.isChatInputCommand() || !interaction.guildId) {
			return;
		}

		const driverName = interaction.options.getString("driver-name", true);

		// Defer the reply immediately to avoid hitting the 3s timeout
		await interaction.deferReply();

		try {
			// Get guild config
			const guildConfig = await db.getGuildConfig(interaction.guildId);

			if (!guildConfig?.iracingTeamId) {
				await interaction.editReply({
					content:
						"No team configured for this server. Ask an admin to run `/team_set <team-id>`",
				});
				return;
			}

			// Fetch team roster
			const team = await iRacingClient.getTeam({
				team_id: guildConfig.iracingTeamId,
			});

			// Find driver by name
			const member = team.roster.find(
				(m) => m.display_name.toLowerCase() === driverName.toLowerCase(),
			);

			if (!member) {
				await interaction.editReply({
					content: `Driver "${driverName}" not found in team roster. Use /team_show to see available drivers.`,
				});
				return;
			}

			const customerId = member.cust_id;
			const latestRace = await getLatestRace(iRacingClient, {
				customerId,
			});
			const embed = createRaceEmbed(latestRace);
			await interaction.editReply({ embeds: [embed] });
		} catch (err) {
			console.error("Failed to fetch latest race:", err);
			await interaction.editReply({ content: "Failed to fetch race data." });
		}
	},
});

export const careerStats = (iRacingClient: IRacingClient, db: Db): Command => ({
	data: new SlashCommandBuilder()
		.setName("career_stats")
		.setDescription("Get comprehensive career statistics for a team member")
		.addStringOption((option) =>
			option
				.setName("driver-name")
				.setDescription("Driver name (as it appears on iRacing)")
				.setRequired(true),
		),

	execute: async (interaction: CommandInteraction): Promise<void> => {
		if (!interaction.isChatInputCommand() || !interaction.guildId) {
			return;
		}

		const driverName = interaction.options.getString("driver-name", true);

		// Defer the reply immediately to avoid hitting the 3s timeout
		await interaction.deferReply();

		try {
			// Get guild config
			const guildConfig = await db.getGuildConfig(interaction.guildId);

			if (!guildConfig?.iracingTeamId) {
				await interaction.editReply({
					content:
						"No team configured for this server. Ask an admin to run `/team_set <team-id>`",
				});
				return;
			}

			// Fetch team roster
			const team = await iRacingClient.getTeam({
				team_id: guildConfig.iracingTeamId,
			});

			// Find driver by name
			const member = team.roster.find(
				(m) => m.display_name.toLowerCase() === driverName.toLowerCase(),
			);

			if (!member) {
				await interaction.editReply({
					content: `Driver "${driverName}" not found in team roster. Use /team_show to see available drivers.`,
				});
				return;
			}

			const customerId = member.cust_id;
			const stats = await getCareerStats(iRacingClient, { customerId });
			const embed = createCareerStatsEmbed(stats);
			await interaction.editReply({ embeds: [embed] });
		} catch (err) {
			console.error("Failed to fetch career stats:", err);
			await interaction.editReply({
				content: "Failed to fetch career statistics.",
			});
		}
	},
});

export const seasonLeaderboard = (
	iRacingClient: IRacingClient,
	db: Db,
): Command => ({
	data: new SlashCommandBuilder()
		.setName("season_leaderboard")
		.setDescription("View season leaderboard for team drivers")
		.addIntegerOption((option) =>
			option
				.setName("year")
				.setDescription("Season year (e.g., 2026)")
				.setRequired(true),
		)
		.addIntegerOption((option) =>
			option
				.setName("quarter")
				.setDescription("Season quarter (1-4)")
				.setRequired(true)
				.setMinValue(1)
				.setMaxValue(4),
		)
		.addStringOption((option) =>
			option
				.setName("category")
				.setDescription("License category")
				.setRequired(true)
				.addChoices(
					{ name: "Sports Car", value: "Sports Car" },
					{ name: "Oval", value: "Oval" },
					{ name: "Formula", value: "Formula" },
					{ name: "Dirt Road", value: "Dirt Road" },
					{ name: "Dirt Oval", value: "Dirt Oval" },
				),
		)
		.addIntegerOption((option) =>
			option
				.setName("team-id")
				.setDescription("Team ID (defaults to server's configured team)")
				.setRequired(false),
		)
		.addBooleanOption((option) =>
			option
				.setName("refresh")
				.setDescription("Force refresh data from iRacing (ignores cache)")
				.setRequired(false),
		),

	execute: async (interaction: CommandInteraction): Promise<void> => {
		if (!interaction.isChatInputCommand() || !interaction.guildId) {
			return;
		}

		const year = interaction.options.getInteger("year", true);
		const quarter = interaction.options.getInteger("quarter", true);
		const category = interaction.options.getString("category", true);
		let teamId = interaction.options.getInteger("team-id");
		const forceRefresh = interaction.options.getBoolean("refresh") ?? false;

		// Defer immediately - this may take time
		await interaction.deferReply();

		try {
			// If no team-id provided, use guild's configured team
			if (!teamId) {
				const guildConfig = await db.getGuildConfig(interaction.guildId);
				teamId = guildConfig?.iracingTeamId ?? null;

				if (!teamId) {
					await interaction.editReply({
						content:
							"No team configured. Ask an admin to run /team_set or provide a team-id parameter.",
					});
					return;
				}
			}

			// Fetch roster
			const team = await iRacingClient.getTeam({ team_id: teamId });
			const customerIds = team.roster.map((m) => m.cust_id);
			const customerNames = Object.fromEntries(
				team.roster.map((m) => [m.cust_id, m.display_name]),
			);

			const leaderboard = await getSeasonLeaderboard(iRacingClient, db, {
				seasonYear: year,
				seasonQuarter: quarter,
				licenseCategory: category,
				forceRefresh,
				customerIds,
				customerNames,
			});

			if (leaderboard.length === 0) {
				await interaction.editReply({
					content: `No race data found for ${year} Q${quarter} (${category})`,
				});
				return;
			}

			const embed = createSeasonLeaderboardEmbed({
				leaderboard,
				seasonYear: year,
				seasonQuarter: quarter,
				licenseCategory: category,
			});

			await interaction.editReply({ embeds: [embed] });
		} catch (err) {
			console.error("Failed to fetch season leaderboard:", err);
			try {
				await interaction.editReply({
					content:
						"Failed to fetch season leaderboard data. Please try again later.",
				});
			} catch (interactionError) {
				console.error(
					"Failed to edit reply (interaction likely expired):",
					interactionError,
				);
			}
		}
	},
});

export const compareDrivers = (
	iRacingClient: IRacingClient,
	db: Db,
): Command => ({
	data: new SlashCommandBuilder()
		.setName("compare_drivers")
		.setDescription(
			"Compare two team drivers head-to-head (omit year/quarter for all-time)",
		)
		.addStringOption((option) =>
			option
				.setName("driver-one")
				.setDescription("First driver name (as it appears on iRacing)")
				.setRequired(true),
		)
		.addStringOption((option) =>
			option
				.setName("driver-two")
				.setDescription("Second driver name (as it appears on iRacing)")
				.setRequired(true),
		)
		.addStringOption((option) =>
			option
				.setName("category")
				.setDescription("License category")
				.setRequired(true)
				.addChoices(
					{ name: "Sports Car", value: "Sports Car" },
					{ name: "Oval", value: "Oval" },
					{ name: "Formula", value: "Formula" },
					{ name: "Dirt Road", value: "Dirt Road" },
					{ name: "Dirt Oval", value: "Dirt Oval" },
				),
		)
		.addIntegerOption((option) =>
			option
				.setName("year")
				.setDescription("Season year (e.g., 2026). Omit for all-time career")
				.setRequired(false),
		)
		.addIntegerOption((option) =>
			option
				.setName("quarter")
				.setDescription("Season quarter (1-4). Omit for all-time career")
				.setRequired(false)
				.setMinValue(1)
				.setMaxValue(4),
		)
		.addBooleanOption((option) =>
			option
				.setName("refresh")
				.setDescription(
					"Force refresh data from iRacing (ignores cache, season only)",
				)
				.setRequired(false),
		),

	execute: async (interaction: CommandInteraction): Promise<void> => {
		if (!interaction.isChatInputCommand() || !interaction.guildId) {
			return;
		}

		const driverOneName = interaction.options.getString("driver-one", true);
		const driverTwoName = interaction.options.getString("driver-two", true);
		const category = interaction.options.getString("category", true);
		const year = interaction.options.getInteger("year");
		const quarter = interaction.options.getInteger("quarter");
		const forceRefresh = interaction.options.getBoolean("refresh") ?? false;

		// year + quarter are all-or-nothing: both present = season comparison,
		// both absent = all-time career comparison.
		if ((year === null) !== (quarter === null)) {
			await interaction.reply({
				content:
					"Provide both `year` and `quarter` for a season comparison, or omit both for an all-time career comparison.",
				ephemeral: true,
			});
			return;
		}

		// Defer immediately - this may take time
		await interaction.deferReply();

		try {
			const guildConfig = await db.getGuildConfig(interaction.guildId);

			if (!guildConfig?.iracingTeamId) {
				await interaction.editReply({
					content:
						"No team configured for this server. Ask an admin to run `/team_set <team-id>`",
				});
				return;
			}

			// Fetch team roster and resolve both drivers by name
			const team = await iRacingClient.getTeam({
				team_id: guildConfig.iracingTeamId,
			});

			const findMember = (name: string) =>
				team.roster.find(
					(m) => m.display_name.toLowerCase() === name.toLowerCase(),
				);

			const memberOne = findMember(driverOneName);
			const memberTwo = findMember(driverTwoName);

			const missing = [
				memberOne ? null : driverOneName,
				memberTwo ? null : driverTwoName,
			].filter((n): n is string => n !== null);

			if (missing.length > 0) {
				await interaction.editReply({
					content: `Driver(s) not found in team roster: ${missing
						.map((n) => `"${n}"`)
						.join(", ")}. Use /team_show to see available drivers.`,
				});
				return;
			}

			if (memberOne && memberTwo && memberOne.cust_id === memberTwo.cust_id) {
				await interaction.editReply({
					content: "Please pick two different drivers to compare.",
				});
				return;
			}

			// memberOne/memberTwo are guaranteed defined here (missing check above)
			const driverOne = memberOne as TeamRosterMember;
			const driverTwo = memberTwo as TeamRosterMember;

			if (year === null || quarter === null) {
				// All-time: pull each driver's lifetime career stats for the
				// category. Independent per-driver fetches, so run them together.
				const [careerA, careerB] = await Promise.all([
					getCareerCategoryStats(iRacingClient, {
						customerId: driverOne.cust_id,
						customerName: driverOne.display_name,
						licenseCategory: category,
					}),
					getCareerCategoryStats(iRacingClient, {
						customerId: driverTwo.cust_id,
						customerName: driverTwo.display_name,
						licenseCategory: category,
					}),
				]);

				if (!careerA || !careerB) {
					const noData = [
						careerA ? null : driverOne.display_name,
						careerB ? null : driverTwo.display_name,
					]
						.filter((n): n is string => n !== null)
						.map((n) => `"${n}"`)
						.join(", ");
					await interaction.editReply({
						content: `No all-time ${category} race data found for ${noData}.`,
					});
					return;
				}

				const embed = createCareerComparisonEmbed({
					driverA: careerA,
					driverB: careerB,
					licenseCategory: category,
				});

				await interaction.editReply({ embeds: [embed] });
				return;
			}

			// Season comparison. Reuse the season leaderboard computation - it
			// already produces per-driver DriverStats for a year/quarter/category.
			const customerIds = [driverOne.cust_id, driverTwo.cust_id];
			const customerNames = {
				[driverOne.cust_id]: driverOne.display_name,
				[driverTwo.cust_id]: driverTwo.display_name,
			};

			const stats = await getSeasonLeaderboard(iRacingClient, db, {
				seasonYear: year,
				seasonQuarter: quarter,
				licenseCategory: category,
				forceRefresh,
				customerIds,
				customerNames,
			});

			const driverA = stats.find((s) => s.customerId === driverOne.cust_id);
			const driverB = stats.find((s) => s.customerId === driverTwo.cust_id);

			if (!driverA || !driverB) {
				const noData = [
					driverA ? null : driverOne.display_name,
					driverB ? null : driverTwo.display_name,
				]
					.filter((n): n is string => n !== null)
					.map((n) => `"${n}"`)
					.join(", ");
				await interaction.editReply({
					content: `No race data found for ${noData} in ${year} Q${quarter} (${category}).`,
				});
				return;
			}

			const embed = createDriverComparisonEmbed({
				driverA,
				driverB,
				seasonYear: year,
				seasonQuarter: quarter,
				licenseCategory: category,
			});

			await interaction.editReply({ embeds: [embed] });
		} catch (err) {
			console.error("Failed to compare drivers:", err);
			try {
				await interaction.editReply({
					content: "Failed to fetch driver comparison data.",
				});
			} catch (interactionError) {
				console.error(
					"Failed to edit reply (interaction likely expired):",
					interactionError,
				);
			}
		}
	},
});

export const bottleLeaderboard = (
	iRacingClient: IRacingClient,
	db: Db,
): Command => ({
	data: new SlashCommandBuilder()
		.setName("bottle_leaderboard")
		.setDescription(
			"View bottle meter leaderboard - catastrophic vs world champion counts",
		)
		.addIntegerOption((option) =>
			option
				.setName("year")
				.setDescription("Season year (e.g., 2026)")
				.setRequired(true),
		)
		.addIntegerOption((option) =>
			option
				.setName("quarter")
				.setDescription("Season quarter (1-4)")
				.setRequired(true)
				.setMinValue(1)
				.setMaxValue(4),
		)
		.addStringOption((option) =>
			option
				.setName("category")
				.setDescription("License category")
				.setRequired(true)
				.addChoices(
					{ name: "Sports Car", value: "Sports Car" },
					{ name: "Oval", value: "Oval" },
					{ name: "Formula", value: "Formula" },
					{ name: "Dirt Road", value: "Dirt Road" },
					{ name: "Dirt Oval", value: "Dirt Oval" },
				),
		)
		.addIntegerOption((option) =>
			option
				.setName("team-id")
				.setDescription("Team ID (defaults to server's configured team)")
				.setRequired(false),
		)
		.addBooleanOption((option) =>
			option
				.setName("refresh")
				.setDescription("Force refresh data from iRacing (ignores cache)")
				.setRequired(false),
		),

	execute: async (interaction: CommandInteraction): Promise<void> => {
		if (!interaction.isChatInputCommand() || !interaction.guildId) {
			return;
		}

		const year = interaction.options.getInteger("year", true);
		const quarter = interaction.options.getInteger("quarter", true);
		const category = interaction.options.getString("category", true);
		let teamId = interaction.options.getInteger("team-id");
		const forceRefresh = interaction.options.getBoolean("refresh") ?? false;

		await interaction.deferReply();

		try {
			if (!teamId) {
				const guildConfig = await db.getGuildConfig(interaction.guildId);
				teamId = guildConfig?.iracingTeamId ?? null;

				if (!teamId) {
					await interaction.editReply({
						content:
							"No team configured. Ask an admin to run /team_set or provide a team-id parameter.",
					});
					return;
				}
			}

			const team = await iRacingClient.getTeam({ team_id: teamId });
			const customerIds = team.roster.map((m) => m.cust_id);
			const customerNames = Object.fromEntries(
				team.roster.map((m) => [m.cust_id, m.display_name]),
			);

			const leaderboard = await getBottleLeaderboard(iRacingClient, db, {
				seasonYear: year,
				seasonQuarter: quarter,
				licenseCategory: category,
				forceRefresh,
				customerIds,
				customerNames,
			});

			if (leaderboard.length === 0) {
				await interaction.editReply({
					content: `No race data found for ${year} Q${quarter} (${category})`,
				});
				return;
			}

			const embed = createBottleLeaderboardEmbed({
				leaderboard,
				seasonYear: year,
				seasonQuarter: quarter,
				licenseCategory: category,
			});

			await interaction.editReply({ embeds: [embed] });
		} catch (err) {
			console.error("Failed to fetch bottle leaderboard:", err);
			try {
				await interaction.editReply({
					content:
						"Failed to fetch bottle leaderboard data. Please try again later.",
				});
			} catch (interactionError) {
				console.error(
					"Failed to edit reply (interaction likely expired):",
					interactionError,
				);
			}
		}
	},
});

export const teamSet = (iRacingClient: IRacingClient, db: Db): Command => ({
	data: new SlashCommandBuilder()
		.setName("team_set")
		.setDescription("Configure the iRacing team for this Discord server")
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
		.addIntegerOption((option) =>
			option
				.setName("team-id")
				.setDescription("The iRacing team ID to track")
				.setRequired(true),
		),

	execute: async (interaction: CommandInteraction): Promise<void> => {
		if (!interaction.isChatInputCommand() || !interaction.guildId) {
			return;
		}

		const teamId = interaction.options.getInteger("team-id", true);

		// Defer the reply immediately
		await interaction.deferReply();

		try {
			// Verify team exists and bot has access
			const team = await iRacingClient.getTeam({ team_id: teamId });

			// Save to database
			await db.setGuildTeam(interaction.guildId, teamId);

			await interaction.editReply({
				embeds: [
					{
						title: "Team Configuration Updated",
						description: `Successfully configured team tracking for **${team.team_name}**`,
						fields: [
							{ name: "Team ID", value: team.team_id.toString(), inline: true },
							{
								name: "Roster Count",
								value: team.roster_count.toString(),
								inline: true,
							},
						],
						color: 0x00ff00,
					},
				],
			});
		} catch (err) {
			console.error("Failed to set team:", err);
			await interaction.editReply({
				content:
					"Failed to configure team. The team may not exist, or the bot owner may not be a member of this team.",
			});
		}
	},
});

export const teamShow = (iRacingClient: IRacingClient, db: Db): Command => ({
	data: new SlashCommandBuilder()
		.setName("team_show")
		.setDescription("Display current team configuration and roster preview"),

	execute: async (interaction: CommandInteraction): Promise<void> => {
		if (!interaction.isChatInputCommand() || !interaction.guildId) {
			return;
		}

		// Defer the reply immediately
		await interaction.deferReply();

		try {
			// Fetch guild config
			const guildConfig = await db.getGuildConfig(interaction.guildId);

			if (!guildConfig?.iracingTeamId) {
				await interaction.editReply({
					content:
						"No team configured for this server. Ask an admin to run `/team_set <team-id>`",
				});
				return;
			}

			// Fetch fresh roster
			const team = await iRacingClient.getTeam({
				team_id: guildConfig.iracingTeamId,
			});

			// Get first 10 members for preview
			const rosterPreview = team.roster
				.slice(0, 10)
				.map((m) => m.display_name)
				.join("\n");

			const moreMembers =
				team.roster_count > 10 ? `\n...and ${team.roster_count - 10} more` : "";

			await interaction.editReply({
				embeds: [
					{
						title: `Team: ${team.team_name}`,
						fields: [
							{ name: "Team ID", value: team.team_id.toString(), inline: true },
							{
								name: "Roster Count",
								value: team.roster_count.toString(),
								inline: true,
							},
							{
								name: "Notification Channel",
								value: guildConfig.notificationChannelId
									? `<#${guildConfig.notificationChannelId}>`
									: "Not set",
								inline: true,
							},
							{
								name: "Roster Preview",
								value: rosterPreview + moreMembers,
								inline: false,
							},
						],
						color: 0x0099ff,
					},
				],
			});
		} catch (err) {
			console.error("Failed to show team:", err);
			await interaction.editReply({
				content: "Failed to fetch team information. Please try again later.",
			});
		}
	},
});

export const showRace = (iRacingClient: IRacingClient, db: Db): Command => ({
	data: new SlashCommandBuilder()
		.setName("show_race")
		.setDescription("Display race results for any subsession by ID")
		.addIntegerOption((option) =>
			option
				.setName("subsession-id")
				.setDescription("The subsession ID to display results for")
				.setRequired(true),
		),

	execute: async (interaction: CommandInteraction): Promise<void> => {
		if (!interaction.isChatInputCommand() || !interaction.guildId) {
			return;
		}

		const subsessionId = interaction.options.getInteger("subsession-id", true);

		// Defer the reply immediately to avoid hitting the 3s timeout
		await interaction.deferReply();

		try {
			// Fetch subsession data
			const subsessionResults = (await iRacingClient.getResults({
				subsession_id: subsessionId,
			})) as unknown as SessionData;

			// Helper function to detect team races
			const isTeamRace = (): boolean => {
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

			if (isTeamRace()) {
				// Team race - show all teams or just the first one for preview
				const raceSession = subsessionResults.session_results.find(
					(res) => res.simsession_name === "RACE",
				);

				if (!raceSession) {
					await interaction.editReply({
						content: "No race session found in this subsession.",
					});
					return;
				}

				const results = raceSession.results as unknown as ResultEntry[];
				const teamsWithMultipleDrivers = results.filter(
					(res) => (res.driver_results?.length ?? 0) > 1,
				);

				if (teamsWithMultipleDrivers.length === 0) {
					await interaction.editReply({
						content: "No team entries found in this race.",
					});
					return;
				}

				// Get guild config to see if we should filter to tracked drivers
				const guildConfig = await db.getGuildConfig(interaction.guildId);
				let trackedCustomerIds: number[] = [];

				if (guildConfig?.iracingTeamId) {
					try {
						const team = await iRacingClient.getTeam({
							team_id: guildConfig.iracingTeamId,
						});
						trackedCustomerIds = team.roster.map((m) => m.cust_id);
					} catch (err) {
						// If we can't fetch the team, just show all drivers
						console.error("Failed to fetch team roster:", err);
					}
				}

				// Find teams that have at least one tracked driver (or show first team if no tracking)
				let teamToShow = teamsWithMultipleDrivers[0];

				if (trackedCustomerIds.length > 0) {
					// Find first team with tracked drivers
					for (const team of teamsWithMultipleDrivers) {
						if (!team) continue;
						const hasTrackedDriver = team.driver_results?.some(
							(driver: DriverResult) =>
								trackedCustomerIds.includes(driver.cust_id ?? 0),
						);
						if (hasTrackedDriver) {
							teamToShow = team;
							break;
						}
					}
				}

				if (!teamToShow?.team_id) {
					await interaction.editReply({
						content: "Could not find a valid team entry to display.",
					});
					return;
				}

				// Get all drivers on this team (or just tracked ones if filtering)
				const driversOnTeam =
					teamToShow.driver_results?.map((d: DriverResult) => d.cust_id ?? 0) ??
					[];
				const driversToShow =
					trackedCustomerIds.length > 0
						? driversOnTeam.filter((id) => trackedCustomerIds.includes(id))
						: driversOnTeam;

				if (driversToShow.length === 0) {
					await interaction.editReply({
						content: "No drivers found on this team to display.",
					});
					return;
				}

				// Fetch team race data
				const teamRaceData = await getTeamRaceData(iRacingClient, {
					subsessionId,
					teamId: teamToShow.team_id,
					trackedCustomerIds: driversToShow,
				});

				const embed = createTeamRaceEmbed(teamRaceData);

				const totalTeams = teamsWithMultipleDrivers.length;
				const message =
					totalTeams > 1
						? `Showing results for one team. This race had ${totalTeams} teams total.`
						: "";

				await interaction.editReply({
					content: message || undefined,
					embeds: [embed],
				});
			} else {
				// Individual race - need to determine which driver to show
				const raceSession = subsessionResults.session_results.find(
					(res) => res.simsession_name === "RACE",
				);

				if (!raceSession?.results || raceSession.results.length === 0) {
					await interaction.editReply({
						content: "No race results found in this subsession.",
					});
					return;
				}

				// For individual races, we need a customer ID - try to find a tracked driver
				const guildConfig = await db.getGuildConfig(interaction.guildId);
				let customerIdToShow: number | undefined;

				if (guildConfig?.iracingTeamId) {
					try {
						const team = await iRacingClient.getTeam({
							team_id: guildConfig.iracingTeamId,
						});
						const trackedCustomerIds = team.roster.map((m) => m.cust_id);

						// Find first tracked driver in this race
						const results = raceSession.results as unknown as ResultEntry[];
						for (const result of results) {
							if (trackedCustomerIds.includes(result.cust_id)) {
								customerIdToShow = result.cust_id;
								break;
							}
						}
					} catch (err) {
						console.error("Failed to fetch team roster:", err);
					}
				}

				// If no tracked driver found, show the winner
				if (!customerIdToShow) {
					const results = raceSession.results as unknown as ResultEntry[];
					const winner = results.find((r) => r.finish_position === 1);
					customerIdToShow = winner?.cust_id;
				}

				if (!customerIdToShow) {
					await interaction.editReply({
						content: "Could not find a driver to display results for.",
					});
					return;
				}

				// Fetch individual race data
				const race = await getLatestRace(iRacingClient, {
					customerId: customerIdToShow,
				});

				// Verify it's the correct subsession
				if (race.race.subsession_id !== subsessionId) {
					await interaction.editReply({
						content: `This subsession (${subsessionId}) is not the latest race for the selected driver. Showing their latest race instead (${race.race.subsession_id}).`,
					});
				}

				const embed = createRaceEmbed(race);
				await interaction.editReply({ embeds: [embed] });
			}
		} catch (err) {
			console.error("Failed to fetch race data:", err);
			await interaction.editReply({
				content:
					"Failed to fetch race data. The subsession may not exist or may not be accessible.",
			});
		}
	},
});

export const teamSetChannel = (db: Db): Command => ({
	data: new SlashCommandBuilder()
		.setName("team_set_channel")
		.setDescription("Set the notification channel for race results")
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
		.addChannelOption((option) =>
			option
				.setName("channel")
				.setDescription("The channel to post race results to")
				.setRequired(true)
				.addChannelTypes(ChannelType.GuildText),
		),

	execute: async (interaction: CommandInteraction): Promise<void> => {
		if (!interaction.isChatInputCommand() || !interaction.guildId) {
			return;
		}

		const channel = interaction.options.getChannel("channel", true);

		try {
			// Save to database
			await db.setGuildChannel(interaction.guildId, channel.id);

			await interaction.reply({
				content: `Notification channel set to <#${channel.id}>!`,
				ephemeral: true,
			});
		} catch (err) {
			console.error("Failed to set channel:", err);
			await interaction.reply({
				content: "Failed to set notification channel. Please try again later.",
				ephemeral: true,
			});
		}
	},
});

export const getCommands = (iRacingClient: IRacingClient, db: Db) => {
	return {
		ping,
		latest_race: latestRace(iRacingClient, db),
		career_stats: careerStats(iRacingClient, db),
		compare_drivers: compareDrivers(iRacingClient, db),
		season_leaderboard: seasonLeaderboard(iRacingClient, db),
		bottle_leaderboard: bottleLeaderboard(iRacingClient, db),
		show_race: showRace(iRacingClient, db),
		team_set: teamSet(iRacingClient, db),
		team_show: teamShow(iRacingClient, db),
		team_set_channel: teamSetChannel(db),
	};
};
