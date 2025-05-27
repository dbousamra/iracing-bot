import fs from "node:fs";
import path from "node:path";
import { EmbedBuilder, REST, Routes } from "discord.js";
import type IRacingSDK from "iracing-web-sdk";
import pino from "pino";
import type { Command } from "./commands";
import { config } from "./config";
import { type GetLatestRaceResponse, getLatestRace } from "./iracing";

const logger = pino({
	level: "info",
});

export function run<A>(fn: () => A): A {
	return fn();
}

// biome-ignore lint/suspicious/noExplicitAny: No need to type this
export const log = (message: string, payload?: any) => {
	logger.info(payload, message);
};

export const withJsonFile = async <T>(
	fn: (data: T) => Promise<T>,
): Promise<void> => {
	const fullPath = path.join(config.DB_PATH, "db.json");

	// create the directory if it doesn't exist
	await fs.promises.stat(config.DB_PATH).catch(() => {
		return fs.promises.mkdir(config.DB_PATH);
	});

	// create the file if it doesn't exist
	await fs.promises.stat(fullPath).catch(() => {
		return fs.promises.writeFile(fullPath, JSON.stringify({}, null, 2));
	});

	const content = await fs.promises.readFile(fullPath, "utf-8");
	const data = JSON.parse(content);
	const result = await fn(data);
	if (result) {
		await fs.promises.writeFile(fullPath, JSON.stringify(result, null, 2));
	}
};

export const deployCommands = async (props: {
	guildId: string;
	commands: Record<string, Command>;
}) => {
	const commandsData = Object.values(props.commands).map(
		(command) => command.data,
	);

	const rest = new REST({ version: "10" }).setToken(config.DISCORD_TOKEN);

	try {
		log(
			"Started refreshing application (/) commands.",
			commandsData.map((c) => `${c.name} - ${c.description}`),
		);

		await rest.put(
			Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, props.guildId),
			{
				body: commandsData,
			},
		);

		log("Successfully reloaded application (/) commands.");
	} catch (error) {
		console.error(error);
	}
};

export const createRaceEmbed = (race: GetLatestRaceResponse) => {
	return new EmbedBuilder()
		.setTitle(`${race.driverName}'s race results`)
		.setColor(race.color)
		.addFields(
			{
				name: "📋 • __Details__",
				value: `Series » \`${race.series}\`\nTrack » \`${race.trackName}\`\nCar » \`${race.car?.name}\``,
			},
			{
				name: "📊 • __Position__",
				value: `Start » \`${race.startPos}/${race.entries}\`\nFinish » \`${race.finishPos}/${race.entries}\`\n`,
			},
			{
				name: "📉 • __Statistics__",
				value: `Laps » \`${race.laps}\`\nIncidents » \`${race.incidents}\`\nSOF » \`${race.sof}\`\nAverage lap » \`${race.averageLapTime}\`\nBest race lap » \`${race.bestLapTime}\`\nQuali lap » \`${race.qualifyingTime}\``,
			},
			{
				name: "🏆 • __Ratings__",
				value: `iRating » \`${race.newIrating}\` **(${race.iratingChange})**\nSafety » \`${race.newSubLevel}\` **(${race.subLevelChange})**`,
			},
			{
				name: "🔗 • Link",
				value: `[View on iRacing.com](https://members-ng.iracing.com/web/racing/results-stats/results?subsessionid=${race.race.subsession_id})`,
			},
		)
		.setTimestamp(new Date(race.race.session_start_time));
};

export const pollLatestRaces = async (
	iRacing: IRacingSDK,
	options: {
		trackedUsers: number[];
		onLatestRace: (race: GetLatestRaceResponse) => Promise<void>;
	},
) => {
	const { trackedUsers } = options;

	for (const customerId of trackedUsers) {
		const race = await getLatestRace(iRacing, { customerId });

		await withJsonFile(async (data: Record<string, number[]>) => {
			const customerRaces = data[customerId] || [];
			const subsessionId = race.race.subsession_id;

			if (customerRaces.includes(subsessionId)) {
				log(
					`Skipping race ${subsessionId} for ${customerId} because it's already been sent.`,
					{
						subsessionId,
					},
				);

				return data;
			}

			customerRaces.push(subsessionId);
			data[customerId] = customerRaces;

			log(`Found new race for ${customerId}.`, {
				subsessionId,
			});

			await options.onLatestRace(race);

			return data;
		});
	}
};
