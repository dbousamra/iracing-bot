import {
	type CommandInteraction,
	EmbedBuilder,
	SlashCommandBuilder,
	type SlashCommandOptionsOnlyBuilder,
} from "discord.js";
import type IRacingSDK from "iracing-web-sdk";
import { formatLaptime } from "./util";

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
			const [customer, recentRaces] = await Promise.all([
				iRacing.getMemberProfile({ cust_id: customerId }),
				iRacing.getRecentRaces({ cust_id: customerId }),
			]);

			const race = recentRaces.races[0];

			const results = await iRacing.getResults({
				subsession_id: race.subsession_id,
			});

			const sessionResults = results.session_results.find(
				(res) => res.simsession_name === "RACE",
			);
			const sessionResult = sessionResults?.results.find(
				(res) => res.cust_id === customerId,
			);
			const entries = sessionResults?.results.length ?? 0;
			const driverName = customer.member_info.display_name;
			const startPos = race.start_position;
			const finishPos = race.finish_position;
			const incidents = race.incidents;
			const newIrating = race.newi_rating;
			const oldIrating = race.oldi_rating;
			const iratingChange = newIrating - oldIrating;
			const oldSubLevel = race.old_sub_level / 100;
			const newSubLevel = race.new_sub_level / 100;
			const subLevelChange = (newSubLevel - oldSubLevel).toFixed(2);
			const series = race.series_name;
			const sof = race.strength_of_field;
			const trackName = race.track.track_name;
			const laps = race.laps;
			const averageLapTime = formatLaptime(sessionResult?.average_lap ?? 1);
			const bestLapTime = formatLaptime(sessionResult?.best_lap_time ?? 1);
			const qualifyingTime =
				race.qualifying_time > 0
					? formatLaptime(race.qualifying_time)
					: "No time";
			const car = results.car_classes.find(
				(c) => c.car_class_id === race.car_class_id,
			);
			const color = iratingChange > 0 ? 0x00ff00 : 0xff0000;

			const embed = new EmbedBuilder()
				.setTitle(`${driverName}'s race results`)
				.setColor(color)
				.addFields(
					{
						name: "📋 • __Details__",
						value: `Series » \`${series}\`\nTrack » \`${trackName}\`\nCar » \`${car?.name}\``,
					},
					{
						name: "📊 • __Position__",
						value: `Start » \`${startPos}/${entries}\`\nFinish » \`${finishPos}/${entries}\`\n`,
					},
					{
						name: "📉 • __Statistics__",
						value: `Laps » \`${laps}\`\nIncidents » \`${incidents}\`\nSOF » \`${sof}\`\nAverage lap » \`${averageLapTime}\`\nBest race lap » \`${bestLapTime}\`\nQuali lap » \`${qualifyingTime}\``,
					},
					{
						name: "🏆 • __Ratings__",
						value: `iRating » \`${newIrating}\` **(${iratingChange})**\nSafety » \`${newSubLevel}\` **(${subLevelChange})**`,
					},
					{
						name: "🔗 • Link",
						value: `[View on iRacing.com](https://members-ng.iracing.com/web/racing/results-stats/results?subsessionid=${race.subsession_id})`,
					},
				);

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
