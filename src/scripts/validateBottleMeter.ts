#!/usr/bin/env tsx
/**
 * Data validation for the Bottle-Meter leaderboard.
 *
 * Replays a season race by race through the bot's own Bottle-Meter code and
 * reports:
 *  - whether iRacing's /results/get finish positions are 0- or 1-based
 *    (checked against /results/search_series for the same race),
 *  - level counts exactly as /bottle_leaderboard computes them today,
 *  - level counts with positions normalised to 1-based,
 *  - the chaos-factor distribution and near-miss Bradburys.
 *
 * Goes through the bot's authenticated proxy, so it needs no iRacing login:
 *   PROXY_API_KEY=... (in .env.local or the environment)
 *   PROXY_URL=https://iracing-bot.fly.dev   (default)
 *
 * Usage:
 *   pnpm tsx src/scripts/validateBottleMeter.ts --team 12345 --year 2026 --quarter 3 --category "Sports Car"
 *   pnpm tsx src/scripts/validateBottleMeter.ts --cust 111,222 --year 2026 --quarter 3
 */
import { config as loadEnv } from "dotenv";
import {
	type MichaelsBottleLevel,
	calculateMichaelsBottleMeter,
} from "../bottle-meter";

loadEnv({ path: [".env.local", ".env"] });

const PROXY_URL = (
	process.env.PROXY_URL ?? "https://iracing-bot.fly.dev"
).replace(/\/$/, "");
const PROXY_API_KEY = process.env.PROXY_API_KEY;
if (!PROXY_API_KEY) {
	console.error("PROXY_API_KEY is not set (put it in .env.local).");
	process.exit(1);
}

const arg = (name: string, fallback?: string) => {
	const i = process.argv.indexOf(`--${name}`);
	return i >= 0 ? process.argv[i + 1] : fallback;
};

const year = Number(arg("year", `${new Date().getFullYear()}`));
const quarter = Number(arg("quarter", "1"));
const category = arg("category", "Sports Car") as string;
const teamId = arg("team");
const custArg = arg("cust");
const verbose = process.argv.includes("--verbose");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// The proxy allows ~10 req/s shared with everyone; stay well under it.
let last = 0;
const get = async <T>(endpoint: string): Promise<T> => {
	for (let attempt = 0; attempt < 5; attempt++) {
		const wait = last + 250 - Date.now();
		if (wait > 0) await sleep(wait);
		last = Date.now();
		const res = await fetch(`${PROXY_URL}/data${endpoint}`, {
			headers: { "x-api-key": PROXY_API_KEY },
		});
		if (res.status === 429) {
			await sleep(2000);
			continue;
		}
		if (!res.ok) {
			throw new Error(`${res.status} ${endpoint}: ${await res.text()}`);
		}
		return (await res.json()) as T;
	}
	throw new Error(`Rate limited too often: ${endpoint}`);
};

type Result = {
	cust_id?: number;
	display_name?: string;
	car_class_id: number;
	finish_position: number;
	finish_position_in_class?: number;
	oldi_rating: number;
	incidents: number;
	laps_complete: number;
	driver_results?: Result[];
};
type Subsession = {
	session_results: { simsession_name: string; results: Result[] }[];
};
type SearchRow = {
	subsession_id: number;
	start_time: string;
	license_category: string;
	finish_position: number;
	finish_position_in_class?: number;
	series_name?: string;
};

const subsessionCache = new Map<number, Subsession>();
const getSubsession = async (id: number) => {
	const hit = subsessionCache.get(id);
	if (hit) return hit;
	const data = await get<Subsession>(`/results/get?subsession_id=${id}`);
	subsessionCache.set(id, data);
	return data;
};

type Row = {
	driver: string;
	subsessionId: number;
	series: string;
	n: number;
	searchFinish: number;
	resultsFinish: number;
	classMinFinish: number;
	shift: number;
	asIs: { level: MichaelsBottleLevel; chaos: number; rank: number };
	fixed: { level: MichaelsBottleLevel; chaos: number; rank: number };
};

// Mirrors calculateChaosFactor in bottle-meter.ts so the report can show it.
const chaosFactor = (drivers: { oldiRating: number; finishPos: number }[]) => {
	const sorted = [...drivers].sort((a, b) => b.oldiRating - a.oldiRating);
	const threshold = Math.max(0.3 * drivers.length, 3);
	const crashed = sorted.filter((d, i) => d.finishPos - (i + 1) >= threshold);
	return crashed.length / drivers.length;
};

const evaluate = (
	custId: number,
	classResults: Result[],
	driver: Result,
	shift: number,
) => {
	const allDriversData = classResults.map((r) => ({
		custId: r.cust_id ?? 0,
		oldiRating: r.oldi_rating < 0 ? 0 : r.oldi_rating,
		finishPos: (r.finish_position_in_class ?? r.finish_position ?? 0) + shift,
	}));
	const meter = calculateMichaelsBottleMeter({
		custId,
		finishPos:
			(driver.finish_position_in_class ?? driver.finish_position ?? 0) + shift,
		allDriversData,
		incidents: driver.incidents,
		laps: driver.laps_complete,
	});
	const sorted = [...allDriversData].sort(
		(a, b) => b.oldiRating - a.oldiRating,
	);
	return {
		level: meter.level,
		chaos: chaosFactor(allDriversData),
		rank: sorted.findIndex((d) => d.custId === custId) + 1,
	};
};

const main = async () => {
	let drivers: { id: number; name: string }[] = [];
	if (custArg) {
		drivers = custArg.split(",").map((id) => ({ id: Number(id), name: id }));
	} else if (teamId) {
		const team = await get<{
			roster: { cust_id: number; display_name: string }[];
		}>(`/team/get?team_id=${teamId}`);
		drivers = team.roster.map((m) => ({ id: m.cust_id, name: m.display_name }));
	} else {
		console.error("Pass --team <id> or --cust <id,id,...>");
		process.exit(1);
	}

	console.log(
		`Validating ${drivers.length} drivers · ${year} S${quarter} · ${category} via ${PROXY_URL}\n`,
	);

	const rows: Row[] = [];
	for (const d of drivers) {
		const search = await get<SearchRow[]>(
			`/results/search_series?cust_id=${d.id}&season_year=${year}&season_quarter=${quarter}&official_only=true&event_types=5`,
		);
		const races = search.filter((r) => r.license_category === category);
		for (const race of races) {
			const sub = await getSubsession(race.subsession_id);
			const raceSession = sub.session_results.find(
				(s) => s.simsession_name === "RACE",
			);
			const driver = raceSession?.results.find((r) => r.cust_id === d.id);
			if (!raceSession || !driver) continue; // team races are skipped, as in the bot
			const classResults = raceSession.results.filter(
				(r) => r.car_class_id === driver.car_class_id,
			);
			if (classResults.length < 3) continue;
			const classMinFinish = Math.min(
				...classResults.map(
					(r) => r.finish_position_in_class ?? r.finish_position,
				),
			);
			// Normalise to 1-based only when this race's positions start at 0.
			const shift = classMinFinish === 0 ? 1 : 0;
			try {
				rows.push({
					driver: d.name,
					subsessionId: race.subsession_id,
					series: race.series_name ?? "",
					n: classResults.length,
					searchFinish: race.finish_position_in_class ?? race.finish_position,
					resultsFinish:
						driver.finish_position_in_class ?? driver.finish_position,
					classMinFinish,
					shift,
					asIs: evaluate(d.id, classResults, driver, 0),
					fixed: evaluate(d.id, classResults, driver, shift),
				});
			} catch (err) {
				console.warn(
					`  skipped ${race.subsession_id}: ${(err as Error).message}`,
				);
			}
		}
		console.log(`  ${d.name}: ${races.length} ${category} races`);
	}

	if (rows.length === 0) {
		console.log("\nNo races found.");
		return;
	}

	// 1. Indexing check
	const zeroBasedClasses = rows.filter((r) => r.classMinFinish === 0).length;
	const searchVsResults = rows.filter(
		(r) => r.searchFinish !== r.resultsFinish,
	);
	console.log("\n== Finish position indexing ==");
	console.log(
		`Races whose class winner has finish_position_in_class = 0: ${zeroBasedClasses} / ${rows.length}`,
	);
	console.log(
		`Races where search_series and results/get disagree on the driver's finish: ${searchVsResults.length}`,
	);
	if (searchVsResults.length) {
		const diffs = new Map<number, number>();
		for (const r of searchVsResults) {
			const k = r.searchFinish - r.resultsFinish;
			diffs.set(k, (diffs.get(k) ?? 0) + 1);
		}
		console.log(
			`  search minus results: ${[...diffs].map(([k, v]) => `${k > 0 ? "+" : ""}${k} × ${v}`).join(", ")}`,
		);
	}

	// 2. Level counts
	const tally = (pick: (r: Row) => MichaelsBottleLevel) => {
		const m = new Map<string, number>();
		for (const r of rows) m.set(pick(r), (m.get(pick(r)) ?? 0) + 1);
		return m;
	};
	const asIs = tally((r) => r.asIs.level);
	const fixed = tally((r) => r.fixed.level);
	const levels = [...new Set([...asIs.keys(), ...fixed.keys()])].sort();
	console.log(
		"\n== Levels: as the leaderboard computes now vs 1-based positions ==",
	);
	console.log("level".padEnd(24), "now".padStart(6), "fixed".padStart(6));
	for (const l of levels) {
		console.log(
			l.padEnd(24),
			`${asIs.get(l) ?? 0}`.padStart(6),
			`${fixed.get(l) ?? 0}`.padStart(6),
		);
	}
	console.log("total".padEnd(24), `${rows.length}`.padStart(6));

	// 3. Chaos factor distribution
	const buckets = [0, 0.1, 0.2, 0.3, 0.4, 1.01];
	console.log(
		"\n== Chaos factor (share of field finishing ≥30% of field worse than expected) ==",
	);
	for (let i = 0; i < buckets.length - 1; i++) {
		const lo = buckets[i];
		const hi = buckets[i + 1];
		const nowCount = rows.filter(
			(r) => r.asIs.chaos >= lo && r.asIs.chaos < hi,
		).length;
		const fixedCount = rows.filter(
			(r) => r.fixed.chaos >= lo && r.fixed.chaos < hi,
		).length;
		console.log(
			`${lo.toFixed(1)}–${Math.min(hi, 1).toFixed(1)}`.padEnd(10),
			`now ${nowCount}`.padEnd(10),
			`fixed ${fixedCount}`,
		);
	}

	// 4. Near-miss Bradburys: hotline races with a chaotic-ish field
	const near = rows
		.filter(
			(r) =>
				r.fixed.level === "world-champion-hotline" && r.fixed.chaos >= 0.15,
		)
		.sort((a, b) => b.fixed.chaos - a.fixed.chaos)
		.slice(0, 15);
	console.log(
		"\n== Hotlines with the most chaotic fields (Bradbury needs chaos ≥ 0.30) ==",
	);
	for (const r of near) {
		console.log(
			`${r.driver.padEnd(22)} ss ${r.subsessionId}  ${r.n} cars  exp P${r.fixed.rank} → P${r.resultsFinish + r.shift}  chaos ${r.fixed.chaos.toFixed(2)}`,
		);
	}

	// 5. Races whose level changes with the fix
	const changed = rows.filter((r) => r.asIs.level !== r.fixed.level);
	console.log(
		`\n== Races whose level changes with 1-based positions: ${changed.length} ==`,
	);
	for (const r of verbose ? changed : changed.slice(0, 20)) {
		console.log(
			`${r.driver.padEnd(22)} ss ${r.subsessionId}  ${r.asIs.level} → ${r.fixed.level}`,
		);
	}
	if (!verbose && changed.length > 20) console.log("  (use --verbose for all)");
};

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
