import { Client, GatewayIntentBits } from "discord.js";
import { getCommands } from "./commands";
import { config } from "./config";
import { Db } from "./db";
import { IRacingClient } from "./iracing-client";
import { log, pollLatestRaces, run } from "./util";

run(async () => {
	const db = new Db(config.DB_PATH);
	await db.init();

	const iRacingClient = new IRacingClient({
		username: config.IRACING_USERNAME,
		password: config.IRACING_PASSWORD,
		clientId: config.IRACING_CLIENT_ID,
		clientSecret: config.IRACING_CLIENT_SECRET,
	});
	await iRacingClient.authenticate();

	const discordClient = new Client({
		intents: [
			GatewayIntentBits.Guilds,
			GatewayIntentBits.GuildMessages,
			GatewayIntentBits.DirectMessages,
		],
	});

	const commands = getCommands(iRacingClient, db);

	const poll = async () => {
		// Get all configured guilds
		const guildConfigs = await db.getAllGuildConfigs();

		for (const guildConfig of guildConfigs) {
			// Skip incomplete configurations
			if (!guildConfig.iracingTeamId || !guildConfig.notificationChannelId) {
				log(
					`Skipping guild ${guildConfig.guildId}: incomplete configuration`,
					{
						guildId: guildConfig.guildId,
						hasTeam: !!guildConfig.iracingTeamId,
						hasChannel: !!guildConfig.notificationChannelId,
					},
				);
				continue;
			}

			try {
				await pollLatestRaces(iRacingClient, db, discordClient, {
					guildId: guildConfig.guildId,
					teamId: guildConfig.iracingTeamId,
				});
			} catch (error) {
				log(`Error polling guild ${guildConfig.guildId}`, {
					error,
					guildId: guildConfig.guildId,
				});
			}
		}
	};

	discordClient.login(config.DISCORD_TOKEN);

	discordClient.once("ready", async () => {
		log("Discord client ready");

		// Check if migration needed
		const configs = await db.getAllGuildConfigs();
		if (configs.length === 0) {
			log(
				"No guild configurations found. Admins must run /team_set <team-id> to configure teams.",
			);
		}

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

			try {
				await command.execute(interaction);
			} catch (error) {
				console.error(
					`Error executing command ${commandName}:`,
					error,
				);
				// Try to inform the user, but don't crash if this fails too
				try {
					if (interaction.deferred || interaction.replied) {
						await interaction.editReply({
							content: "An error occurred while executing this command.",
						});
					} else {
						await interaction.reply({
							content: "An error occurred while executing this command.",
							ephemeral: true,
						});
					}
				} catch (replyError) {
					console.error(
						"Failed to send error message to user:",
						replyError,
					);
				}
			}
		}
	});
});
