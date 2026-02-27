#!/usr/bin/env tsx

import { config } from "../config";
import { IRacingClient } from "../iracing-client";

const iRacingClient = new IRacingClient({
	username: config.IRACING_USERNAME,
	password: config.IRACING_PASSWORD,
	clientId: config.IRACING_CLIENT_ID,
	clientSecret: config.IRACING_CLIENT_SECRET,
});

const main = async () => {
	const [custIdArg, daysArg] = process.argv.slice(2);

	if (!custIdArg || !daysArg) {
		console.error(`
Usage: tsx src/scripts/raceCount.ts <customer-id> <days>

Examples:
  tsx src/scripts/raceCount.ts 404007 7    # last 7 days
  tsx src/scripts/raceCount.ts 404007 30   # last 30 days
  tsx src/scripts/raceCount.ts 404007 1    # last 24 hours
`);
		process.exit(1);
	}

	const customerId = Number(custIdArg);
	if (Number.isNaN(customerId)) {
		console.error(`Invalid customer ID: ${custIdArg}`);
		process.exit(1);
	}

	const days = Number(daysArg);
	if (Number.isNaN(days) || days <= 0) {
		console.error(`Invalid number of days: ${daysArg}`);
		process.exit(1);
	}

	const now = new Date();
	const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

	console.log(
		`\nFetching races for customer ${customerId} in the last ${days} day(s)...\n`,
	);

	const results = await iRacingClient.searchSeries({
		cust_id: customerId.toString(),
		start_range_begin: start.toISOString(),
		start_range_end: now.toISOString(),
		event_types: "5",
	});

	console.log(`Total races: ${results.length}`);

	if (results.length > 0) {
		// Group by series
		const bySeries = new Map<string, number>();
		for (const r of results) {
			const count = bySeries.get(r.series_name) ?? 0;
			bySeries.set(r.series_name, count + 1);
		}

		console.log("\nBreakdown by series:");
		const sorted = [...bySeries.entries()].sort((a, b) => b[1] - a[1]);
		for (const [series, count] of sorted) {
			console.log(`  ${series}: ${count}`);
		}
	}
};

main().catch((err) => {
	console.error("Error:", err);
	process.exit(1);
});
