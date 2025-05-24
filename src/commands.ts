import {
	type CommandInteraction,
	SlashCommandBuilder,
	type SlashCommandOptionsOnlyBuilder,
} from "discord.js";
import type IRacingSDK from "iracing-web-sdk";
import { getLatestRace } from "./iracing";
import { createRaceEmbed } from "./util";

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

export const latestRace = (iRacing: IRacingSDK): Command => ({
	data: new SlashCommandBuilder()
		.setName("latest_race")
		.setDescription("Get the latest race for a member")
		.addNumberOption((option) =>
			option
				.setName("customer_id")
				.setDescription("The customer ID of the member")
				.setRequired(true),
		),
	execute: async (interaction: CommandInteraction): Promise<void> => {
		if (!interaction.isChatInputCommand()) {
			return;
		}

		const customerId = interaction.options.getNumber("customer_id");

		if (!customerId) {
			await interaction.reply("Customer ID is required");
			return;
		}

		// Defer the reply immediately to avoid hitting the 3s timeout
		await interaction.deferReply();

		try {
			const latestRace = await getLatestRace(iRacing, {
				customerId,
			});
			const embed = createRaceEmbed(latestRace);
			await interaction.editReply({ embeds: [embed] });
		} catch (err) {
			await interaction.editReply({ content: "Failed to fetch race data." });
		}
	},
});

export const getCommands = (iRacing: IRacingSDK): Record<string, Command> => {
	return {
		ping,
		latest_race: latestRace(iRacing),
	};
};
