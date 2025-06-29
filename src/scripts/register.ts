import { commands } from "../commands";
import { deployCommands } from "../util";

const run = async () => {
	deployCommands({
		commands: commands,
		guildId: "949939970804703232",
	});
};

run();
