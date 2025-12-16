import { Client, GatewayIntentBits } from "discord.js";
import { getCommands } from "./commands";
import { config } from "./config";
import { Db } from "./db";
import { IRacingClient } from "./iracing-client";
import { createRaceEmbed, log, pollLatestRaces, run } from "./util";

run(async () => {
	// turning off console logs because the iracingSDK logs a lot of stuff
	// console.log = () => {};

	const db = new Db(config.DB_PATH);
	await db.init();

	const iRacingClient = new IRacingClient({
		username: config.IRACING_USERNAME,
		password: config.IRACING_PASSWORD,
		clientId: config.IRACING_CLIENT_ID,
		clientSecret: config.IRACING_CLIENT_SECRET,
	});

	const discordClient = new Client({
		intents: [
			GatewayIntentBits.Guilds,
			GatewayIntentBits.GuildMessages,
			GatewayIntentBits.DirectMessages,
		],
	});

	const commands = getCommands(iRacingClient);

	const poll = async () => {
		await pollLatestRaces(iRacingClient, db, {
			trackedUsers: config.TRACKED_USERS,
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
		log("Discord client ready");
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
			log(`Executing command ${commandName}`, { options: interaction.options });

			await command.execute(interaction);
		}
	});
});
