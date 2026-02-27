#!/usr/bin/env tsx

import { config } from "../config";
import { Db } from "../db";
import { getBottleLeaderboard } from "../iracing";
import { IRacingClient } from "../iracing-client";

const main = async () => {
	const [yearArg, quarterArg, categoryArg, teamIdArg] =
		process.argv.slice(2);

	if (!yearArg || !quarterArg || !categoryArg || !teamIdArg) {
		console.error(`
Usage: tsx src/scripts/testBottleLeaderboard.ts <year> <quarter> <category> <team-id>

Arguments:
  year       Season year (e.g., 2026)
  quarter    Season quarter (1-4)
  category   License category (e.g., "Sports Car", "Oval", "Formula")
  team-id    iRacing team ID

Examples:
  tsx src/scripts/testBottleLeaderboard.ts 2026 1 "Sports Car" 12345
  tsx src/scripts/testBottleLeaderboard.ts 2025 4 Formula 12345
`);
		process.exit(1);
	}

	const year = Number(yearArg);
	const quarter = Number(quarterArg);
	const category = categoryArg;
	const teamId = Number(teamIdArg);

	if (Number.isNaN(year) || Number.isNaN(quarter) || Number.isNaN(teamId)) {
		console.error("❌ year, quarter, and team-id must be numbers");
		process.exit(1);
	}

	const iRacingClient = new IRacingClient({
		username: config.IRACING_USERNAME,
		password: config.IRACING_PASSWORD,
		clientId: config.IRACING_CLIENT_ID,
		clientSecret: config.IRACING_CLIENT_SECRET,
	});

	const db = new Db(config.DB_PATH);
	await db.init();

	console.log(
		`\n🔄 Fetching bottle leaderboard for ${year} Q${quarter} ${category} (team ${teamId})...\n`,
	);

	const team = await iRacingClient.getTeam({ team_id: teamId });
	const customerIds = team.roster.map((m) => m.cust_id);
	const customerNames = Object.fromEntries(
		team.roster.map((m) => [m.cust_id, m.display_name]),
	);

	console.log(
		`Team: ${team.team_name} (${team.roster_count} members)\n`,
	);

	const leaderboard = await getBottleLeaderboard(iRacingClient, db, {
		seasonYear: year,
		seasonQuarter: quarter,
		licenseCategory: category,
		forceRefresh: true,
		customerIds,
		customerNames,
	});

	if (leaderboard.length === 0) {
		console.log("No race data found.");
		process.exit(0);
	}

	// Print table
	const header = "Name                     | WCH         | CAT         | Races";
	const separator = "-".repeat(header.length);

	console.log(`\n${"=".repeat(65)}`);
	console.log(
		`  ${year} Season ${quarter} - ${category} Bottle Leaderboard`,
	);
	console.log(`${"=".repeat(65)}`);
	console.log(header);
	console.log(separator);

	for (const entry of leaderboard) {
		const name = entry.customerName.padEnd(24, " ");
		const wchPct = ((entry.worldChampionCount / entry.totalRaces) * 100).toFixed(0);
		const catPct = ((entry.catastrophicCount / entry.totalRaces) * 100).toFixed(0);
		const wch = `${entry.worldChampionCount} (${wchPct}%)`.padEnd(11, " ");
		const cat = `${entry.catastrophicCount} (${catPct}%)`.padEnd(11, " ");
		const races = entry.totalRaces.toString();
		const indicator =
			entry.worldChampionCount >= entry.catastrophicCount ? "🟢" : "🔴";
		console.log(`${indicator} ${name} | ${wch} | ${cat} | ${races}`);
	}

	console.log(separator);

	const totalRaces = leaderboard.reduce((acc, e) => acc + e.totalRaces, 0);
	const totalWCH = leaderboard.reduce(
		(acc, e) => acc + e.worldChampionCount,
		0,
	);
	const totalCAT = leaderboard.reduce(
		(acc, e) => acc + e.catastrophicCount,
		0,
	);

	console.log(`\nSummary:`);
	console.log(`  Total Races: ${totalRaces}`);
	console.log(`  Total 👑 World Champion Hotline: ${totalWCH}`);
	console.log(`  Total 💥🔥💥 Catastrophic: ${totalCAT}`);
	console.log();
};

main();
