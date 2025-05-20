import { Client, GatewayIntentBits } from "discord.js";
import IRacingSDK from "iracing-web-sdk";
import { getCommands } from "./commands";
import { config } from "./util";

const run = async () => {
	const iRacingClient = new IRacingSDK(
		config.IRACING_USERNAME,
		config.IRACING_PASSWORD,
	);
	await iRacingClient.authenticate();

	const commands = getCommands(iRacingClient);

	const discordClient = new Client({
		intents: [
			GatewayIntentBits.Guilds,
			GatewayIntentBits.GuildMessages,
			GatewayIntentBits.DirectMessages,
		],
	});

	discordClient.login(config.DISCORD_TOKEN);

	discordClient.once("ready", () => {
		console.log("Discord bot is ready! 🤖");
	});

	discordClient.on("interactionCreate", async (interaction) => {
		if (!interaction.isCommand()) {
			return;
		}

		const { commandName } = interaction;
		if (commands[commandName as keyof typeof commands]) {
			const command = commands[commandName as keyof typeof commands];

			console.log(
				`Executing command ${commandName}, ${JSON.stringify(interaction.options)}`,
			);

			await command.execute(interaction);
		}
	});
};

run();
