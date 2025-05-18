import { type CommandInteraction, SlashCommandBuilder } from "discord.js";

export type Command = {
	data: SlashCommandBuilder;
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

export const commands = {
	ping,
};
