import { REST, Routes } from "discord.js";
import "dotenv/config";
import type { Command } from "./commands";

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
	commands: Record<string, Command>;
};

export const deployCommands = async (props: DeployCommandsProps) => {
	const commandsData = Object.values(props.commands).map(
		(command) => command.data,
	);

	const rest = new REST({ version: "10" }).setToken(config.DISCORD_TOKEN);

	try {
		console.log("Started refreshing application (/) commands.");
		console.log(commandsData.map((c) => `${c.name} - ${c.description}`));

		await rest.put(
			Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, props.guildId),
			{
				body: commandsData,
			},
		);

		console.log("Successfully reloaded application (/) commands.");
	} catch (error) {
		console.error(error);
	}
};

export function formatLaptime(laptime: number): string {
	const microseconds = laptime * 100;
	const totalMilliseconds = Math.floor(microseconds / 1000);
	const minutes = Math.floor(totalMilliseconds / 60000);
	const seconds = Math.floor((totalMilliseconds % 60000) / 1000);
	const milliseconds = totalMilliseconds % 1000;
	return `${minutes}:${seconds.toString().padStart(2, "0")}.${milliseconds.toString().padStart(3, "0")}`;
}
