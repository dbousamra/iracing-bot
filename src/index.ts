import { Client, GatewayIntentBits } from "discord.js";
import IRacingSDK from "iracing-web-sdk";
import { getCommands } from "./commands";
import { config } from "./config";
import { createRaceEmbed, pollLatestRaces, run } from "./util";

run(async () => {
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

	const poll = async () => {
		await pollLatestRaces(iRacingClient, {
			trackedUsers: config.TRACKED_USERS,
			pollInterval: config.POLL_INTERVAL,
			onLatestRace: async (race) => {
				const channel = await discordClient.channels.fetch(
					config.DISCORD_CHANNEL_ID,
				);

				if (channel?.isSendable()) {
					const embed = createRaceEmbed(race);
					if (channel.isSendable()) {
						await channel.send({ embeds: [embed] });
					}
				}
			},
		});
	};

	discordClient.login(config.DISCORD_TOKEN);

	discordClient.once("ready", async () => {
		console.log("Discord bot is ready! 🤖");
		setInterval(poll, config.POLL_INTERVAL);
		poll();
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
});
