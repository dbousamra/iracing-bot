import { Client, GatewayIntentBits } from "discord.js";
import { getCommands } from "./commands";
import { config } from "./config";
import { Db } from "./db";
import { IRacingClient } from "./iracing-client";
import { log, pollLatestRaces, run } from "./util";

// Keep the process alive on unexpected errors. Without these, a single
// unhandled promise rejection (e.g. a transient iRacing/Discord/DB failure
// outside an existing try/catch) crashes Node. Fly's restart policy is
// `on-failure` with `max_retries: 10`, so a handful of such crashes over a
// day or two exhausts the retries and leaves the machine permanently dead.
process.on("unhandledRejection", (reason) => {
	log("Unhandled promise rejection", { error: reason });
});

process.on("uncaughtException", (error) => {
	log("Uncaught exception", { error });
});

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
		// Get all configured guilds. Guard the whole cycle: this runs from
		// setInterval, so any rejection here would otherwise be unhandled.
		let guildConfigs: Awaited<ReturnType<typeof db.getAllGuildConfigs>>;
		try {
			guildConfigs = await db.getAllGuildConfigs();
		} catch (error) {
			log("Error loading guild configs during poll", { error });
			return;
		}

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

	// discord.js emits 'error'/'shardError' on websocket/gateway problems.
	// An 'error' event with no listener is rethrown by Node and crashes the
	// process, so always keep listeners attached.
	discordClient.on("error", (error) => {
		log("Discord client error", { error });
	});

	discordClient.on("shardError", (error) => {
		log("Discord shard error", { error });
	});

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
