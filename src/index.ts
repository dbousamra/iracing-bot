import { Client, GatewayIntentBits } from "discord.js";
import { IRacingClient } from "./api/iracing/client";
import { getCommands } from "./commands";
import { config, deployCommands } from "./util";

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.DirectMessages,
	],
});

const commands = getCommands(
	new IRacingClient(config.IRACING_USERNAME, config.IRACING_PASSWORD),
);

client.once("ready", () => {
	console.log("Discord bot is ready! 🤖");
});

client.on("guildCreate", async (guild) => {
	await deployCommands({ guildId: guild.id });
});

client.on("interactionCreate", async (interaction) => {
	if (!interaction.isCommand()) {
		return;
	}

	const { commandName } = interaction;
	if (commands[commandName as keyof typeof commands]) {
		const command = commands[commandName as keyof typeof commands];
		await command.execute(interaction);
	}
});

client.login(config.DISCORD_TOKEN);
