#!/usr/bin/env tsx

import { config } from "../config";
import { getCareerStats, getLatestRace } from "../iracing";
import { IRacingClient } from "../iracing-client";

const iRacingClient = new IRacingClient({
	username: config.IRACING_USERNAME,
	password: config.IRACING_PASSWORD,
	clientId: config.IRACING_CLIENT_ID,
	clientSecret: config.IRACING_CLIENT_SECRET,
});

const formatSection = (title: string, content: string) => {
	console.log(`\n${"=".repeat(60)}`);
	console.log(`  ${title}`);
	console.log(`${"=".repeat(60)}`);
	console.log(content);
};

const displayLatestRace = async (customerId: number) => {
	const race = await getLatestRace(iRacingClient, { customerId });

	console.log(`\n🏁 ${race.driverName}'s Latest Race Results`);

	formatSection(
		"📋 Details",
		`Series: ${race.series}
Track: ${race.trackName}
Car: ${race.car?.name}
SOF: ${race.sof}
Split: ${race.split}`,
	);

	formatSection(
		"📊 Position",
		`Start: P${race.startPos}/${race.entries}
Finish: P${race.finishPos}/${race.entries}`,
	);

	formatSection(
		"📉 Statistics",
		`Laps: ${race.laps}
Incidents: ${race.incidents}
Average lap: ${race.averageLapTime}
Best race lap: ${race.bestLapTime}
Quali lap: ${race.qualifyingTime}`,
	);

	formatSection(
		"🏆 Ratings",
		`iRating: ${race.newIrating} (${race.iratingChange > 0 ? "+" : ""}${race.iratingChange})
Safety: ${race.newSubLevel} (${race.subLevelChange})`,
	);

	console.log(
		`\n🔗 Link: https://members-ng.iracing.com/web/racing/results-stats/results?subsessionid=${race.race.subsession_id}\n`,
	);
};

const displayCareerStats = async (customerId: number) => {
	const stats = await getCareerStats(iRacingClient, { customerId });

	console.log(`\n📊 ${stats.driverName}'s Career Statistics`);

	formatSection(
		"Overall Career",
		`Total Starts: ${stats.aggregatedStats.totalStarts}
Total Wins: ${stats.aggregatedStats.totalWins} (${stats.winPercentage}%)
Top 5 Finishes: ${stats.aggregatedStats.totalTop5} (${stats.top5Percentage}%)
Pole Positions: ${stats.aggregatedStats.totalPoles} (${stats.polePercentage}%)`,
	);

	formatSection(
		"🏁 Performance Metrics",
		`Total Laps: ${stats.aggregatedStats.totalLaps.toLocaleString()}
Laps Led: ${stats.aggregatedStats.totalLapsLed.toLocaleString()} (${stats.lapsLedPercentage}%)
Avg Incidents: ${stats.avgIncidents}`,
	);

	formatSection(
		`📅 This Year (${new Date().getFullYear()})`,
		`Official Sessions: ${stats.thisYearStats.num_official_sessions}
Official Wins: ${stats.thisYearStats.num_official_wins}
League Sessions: ${stats.thisYearStats.num_league_sessions}
League Wins: ${stats.thisYearStats.num_league_wins}`,
	);

	// Category breakdown
	const categoriesWithRaces = stats.categoryBreakdown.filter(
		(cat) => cat.starts > 0,
	);
	if (categoriesWithRaces.length > 0) {
		console.log(`\n${"=".repeat(60)}`);
		console.log("  Category Breakdown");
		console.log(`${"=".repeat(60)}`);

		for (const cat of categoriesWithRaces) {
			console.log(`\n${cat.category}:`);
			console.log(`  Starts: ${cat.starts}`);
			console.log(`  Wins: ${cat.wins} (${cat.winPercentage}%)`);
			console.log(`  Top 5s: ${cat.top5} (${cat.top5Percentage}%)`);
			console.log(`  Poles: ${cat.poles}`);
		}
	}

	console.log();
};

const main = async () => {
	const [command, userArg] = process.argv.slice(2);

	if (!command) {
		console.error(`
Usage: pnpm exec tsx src/scripts/cli.ts <command> [user]

Commands:
  latest_race [user]   - Get the latest race for a member
  career_stats [user]  - Get comprehensive career statistics
  recent_form [user]   - Get recent form and trend analysis

User (optional): Name of tracked user (e.g., "Dom", "Michael")
                 Defaults to first tracked user if not specified

Examples:
  pnpm exec tsx src/scripts/cli.ts latest_race Dom
  pnpm exec tsx src/scripts/cli.ts career_stats Michael
  pnpm exec tsx src/scripts/cli.ts recent_form
`);
		process.exit(1);
	}

	// Find user
	let trackedUser = config.TRACKED_USERS[0]; // Default to first user
	if (userArg) {
		const found = config.TRACKED_USERS.find(
			(u) => u.name.toLowerCase() === userArg.toLowerCase(),
		);
		if (!found) {
			console.error(
				`❌ User "${userArg}" not found in tracked users. Available users: ${config.TRACKED_USERS.map((u) => u.name).join(", ")}`,
			);
			process.exit(1);
		}
		trackedUser = found;
	}

	const customerId = Number(trackedUser.customerId);

	try {
		console.log(`\n🔄 Fetching data for ${trackedUser.name}...\n`);

		switch (command) {
			case "latest_race":
				await displayLatestRace(customerId);
				break;
			case "career_stats":
				await displayCareerStats(customerId);
				break;
			default:
				console.error(
					`❌ Unknown command: ${command}\nValid commands: latest_race, career_stats, recent_form`,
				);
				process.exit(1);
		}
	} catch (error) {
		console.error("\n❌ Error fetching data:", error);
		process.exit(1);
	}
};

main();
