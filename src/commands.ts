import {
	type CommandInteraction,
	SlashCommandBuilder,
	type SlashCommandOptionsOnlyBuilder,
} from "discord.js";
import { config } from "./config";
import type { Db } from "./db";
import {
	getCareerStats,
	getLatestRace,
	getSeasonLeaderboard,
} from "./iracing";
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

export const latestRace = (iRacingClient: IRacingClient): Command => ({
	data: new SlashCommandBuilder()
		.setName("latest_race")
		.setDescription("Get the latest race for a member")
		.addUserOption((option) =>
			option
				.setName("user")
				.setDescription("The user to get latest race for")
				.setRequired(true),
		),

	execute: async (interaction: CommandInteraction): Promise<void> => {
		if (!interaction.isChatInputCommand()) {
			return;
		}

		const user = interaction.options.getUser("user");

		if (!user) {
			await interaction.reply("User is required");
			return;
		}

		const trackedUser = config.TRACKED_USERS.find(
			(trackedUser) => trackedUser.discordId === user.id,
		);

		if (!trackedUser) {
			await interaction.reply("Could not find user in tracked users. Ask dom");
			return;
		}

		// Defer the reply immediately to avoid hitting the 3s timeout
		await interaction.deferReply();

		try {
			const customerId = Number(trackedUser.customerId);
			const latestRace = await getLatestRace(iRacingClient, {
				customerId,
			});
			const embed = createRaceEmbed(latestRace);
			await interaction.editReply({ embeds: [embed] });
		} catch (err) {
			await interaction.editReply({ content: "Failed to fetch race data." });
		}
	},
});

export const careerStats = (iRacingClient: IRacingClient): Command => ({
	data: new SlashCommandBuilder()
		.setName("career_stats")
		.setDescription("Get comprehensive career statistics for a member")
		.addUserOption((option) =>
			option
				.setName("user")
				.setDescription("The user to get career stats for")
				.setRequired(true),
		),

	execute: async (interaction: CommandInteraction): Promise<void> => {
		if (!interaction.isChatInputCommand()) {
			return;
		}

		const user = interaction.options.getUser("user");

		if (!user) {
			await interaction.reply("User is required");
			return;
		}

		const trackedUser = config.TRACKED_USERS.find(
			(trackedUser) => trackedUser.discordId === user.id,
		);

		if (!trackedUser) {
			await interaction.reply("Could not find user in tracked users. Ask dom");
			return;
		}

		// Defer the reply immediately to avoid hitting the 3s timeout
		await interaction.deferReply();

		try {
			const customerId = Number(trackedUser.customerId);
			const stats = await getCareerStats(iRacingClient, { customerId });
			const embed = createCareerStatsEmbed(stats);
			await interaction.editReply({ embeds: [embed] });
		} catch (err) {
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
		.setDescription("View season leaderboard for all tracked drivers")
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
					{ name: "Road", value: "Road" },
					{ name: "Oval", value: "Oval" },
					{ name: "Dirt Road", value: "Dirt Road" },
					{ name: "Dirt Oval", value: "Dirt Oval" },
				),
		)
		.addBooleanOption((option) =>
			option
				.setName("refresh")
				.setDescription("Force refresh data from iRacing (ignores cache)")
				.setRequired(false),
		),

	execute: async (interaction: CommandInteraction): Promise<void> => {
		if (!interaction.isChatInputCommand()) {
			return;
		}

		const year = interaction.options.getInteger("year", true);
		const quarter = interaction.options.getInteger("quarter", true);
		const category = interaction.options.getString("category", true);
		const forceRefresh = interaction.options.getBoolean("refresh") ?? false;

		// Defer immediately - this may take time
		await interaction.deferReply();

		try {
			const leaderboard = await getSeasonLeaderboard(iRacingClient, db, {
				seasonYear: year,
				seasonQuarter: quarter,
				licenseCategory: category,
				forceRefresh,
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
			await interaction.editReply({
				content:
					"Failed to fetch season leaderboard data. Please try again later.",
			});
		}
	},
});

export const getCommands = (iRacingClient: IRacingClient, db: Db) => {
	return {
		ping,
		latest_race: latestRace(iRacingClient),
		career_stats: careerStats(iRacingClient),
		season_leaderboard: seasonLeaderboard(iRacingClient, db),
	};
};
