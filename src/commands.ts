import {
	type CommandInteraction,
	SlashCommandBuilder,
	type SlashCommandOptionsOnlyBuilder,
} from "discord.js";
import { config } from "./config";
import { getLatestRace, getCareerStats, getRecentForm } from "./iracing";
import type { IRacingClient } from "./iracing-client";
import {
	createRaceEmbed,
	createCareerStatsEmbed,
	createRecentFormEmbed,
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

export const recentForm = (iRacingClient: IRacingClient): Command => ({
	data: new SlashCommandBuilder()
		.setName("recent_form")
		.setDescription("Get recent form and trend analysis for a member")
		.addUserOption((option) =>
			option
				.setName("user")
				.setDescription("The user to get recent form for")
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
			const form = await getRecentForm(iRacingClient, { customerId });
			const embed = createRecentFormEmbed(form);
			await interaction.editReply({ embeds: [embed] });
		} catch (err) {
			await interaction.editReply({
				content: "Failed to fetch recent form data.",
			});
		}
	},
});

export const getCommands = (iRacingClient: IRacingClient) => {
	return {
		ping,
		latest_race: latestRace(iRacingClient),
		career_stats: careerStats(iRacingClient),
		recent_form: recentForm(iRacingClient),
	};
};
