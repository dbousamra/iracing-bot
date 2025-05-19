import {
	type CommandInteraction,
	SlashCommandBuilder,
	type SlashCommandOptionsOnlyBuilder,
} from "discord.js";
import type { IRacingClient } from "./api/iracing/client";

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

export const latestRace = (client: IRacingClient): Command => ({
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

		const latestRace = await client.getMemberRecentRaces(customerId);
		const race = latestRace.races[0];

		await interaction.reply(`Finished in position ${race.finish_position}`);
	},
});

export const getCommands = (client: IRacingClient): Record<string, Command> => {
	return {
		ping,
		latest_race: latestRace(client),
	};
};
