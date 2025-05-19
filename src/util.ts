import { REST, Routes } from "discord.js";
import { getCommands } from "./commands";
import "dotenv/config";

export const run = <A>(fn: () => A): A => {
	return fn();
};

export const config = run(() => {
	const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
	if (!DISCORD_TOKEN) {
		throw new Error("DISCORD_TOKEN is not set");
	}

	const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
	if (!DISCORD_CLIENT_ID) {
		throw new Error("DISCORD_CLIENT_ID is not set");
	}

	const IRACING_USERNAME = process.env.IRACING_USERNAME;
	if (!IRACING_USERNAME) {
		throw new Error("IRACING_USERNAME is not set");
	}

	const IRACING_PASSWORD = process.env.IRACING_PASSWORD;
	if (!IRACING_PASSWORD) {
		throw new Error("IRACING_PASSWORD is not set");
	}

	return {
		DISCORD_TOKEN,
		DISCORD_CLIENT_ID,
		IRACING_USERNAME,
		IRACING_PASSWORD,
	};
});

export type DeployCommandsProps = {
	guildId: string;
};

export async function deployCommands({ guildId }: DeployCommandsProps) {
	const commandsData = Object.values(getCommands).map(
		(command) => command.data,
	);

	const rest = new REST({ version: "10" }).setToken(config.DISCORD_TOKEN);

	try {
		console.log("Started refreshing application (/) commands.");

		await rest.put(
			Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, guildId),
			{
				body: commandsData,
			},
		);

		console.log("Successfully reloaded application (/) commands.");
	} catch (error) {
		console.error(error);
	}
}
