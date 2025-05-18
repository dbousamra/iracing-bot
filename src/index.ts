import { Client, GatewayIntentBits } from "discord.js";
import { commands } from "./commands";
import { config, deployCommands } from "./util";

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.DirectMessages,
	],
});

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
		commands[commandName as keyof typeof commands].execute(interaction);
	}
});

client.login(config.DISCORD_TOKEN);
