import {
	ChannelType,
	type CommandInteraction,
	PermissionFlagsBits,
	SlashCommandBuilder,
	type SlashCommandOptionsOnlyBuilder,
} from "discord.js";
import { config } from "./config";
import type { Db } from "./db";
import { getCareerStats, getLatestRace, getSeasonLeaderboard } from "./iracing";
import type { IRacingClient } from "./iracing-client";
import {
	createCareerStatsEmbed,
	createRaceEmbed,
	createSeasonLeaderboardEmbed,
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

export const latestRace = (
	iRacingClient: IRacingClient,
	db: Db,
): Command => ({
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

export const careerStats = (
	iRacingClient: IRacingClient,
	db: Db,
): Command => ({
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
		season_leaderboard: seasonLeaderboard(iRacingClient, db),
		team_set: teamSet(iRacingClient, db),
		team_show: teamShow(iRacingClient, db),
		team_set_channel: teamSetChannel(db),
	};
};
