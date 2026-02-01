import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export type DriverStats = {
	customerId: number;
	customerName: string;
	totalRaces: number;
	totalWins: number;
	startingIrating: number;
	endingIrating: number;
	iratingGain: number;
	startingSr: number;
	endingSr: number;
	srGain: number;
	averageStartPosition: number;
	averageFinishPosition: number;
	averageIncidents: number;
	avgRacesPerDay: number;
};

export class Db {
	private db: DatabaseSync;

	constructor(dbPath: string) {
		this.db = new DatabaseSync(path.join(dbPath, "db.sqlite"));
	}

	async init() {
		await this.db.exec(`
			CREATE TABLE IF NOT EXISTS customer_races (
				customer_id INTEGER NOT NULL,
				subsession_id INTEGER NOT NULL,
				PRIMARY KEY (customer_id, subsession_id)
			) STRICT;
		`);

		await this.db.exec(`
			CREATE TABLE IF NOT EXISTS season_leaderboard_cache (
				cache_key TEXT PRIMARY KEY,
				data TEXT NOT NULL,
				cached_at INTEGER NOT NULL
			) STRICT;
		`);
	}

	async addCustomerRace(customerId: number, subsessionId: number) {
		const stmt = this.db.prepare(
			"INSERT OR IGNORE INTO customer_races (customer_id, subsession_id) VALUES (?, ?)",
		);
		stmt.run(customerId, subsessionId);
	}

	async hasCustomerRace(
		customerId: number,
		subsessionId: number,
	): Promise<boolean> {
		const stmt = this.db.prepare(
			"SELECT 1 FROM customer_races WHERE customer_id = ? AND subsession_id = ?",
		);
		return !!stmt.get(customerId, subsessionId);
	}

	async getLeaderboardCache(
		cacheKey: string,
	): Promise<{ data: DriverStats[]; cachedAt: number } | null> {
		const stmt = this.db.prepare(
			"SELECT data, cached_at FROM season_leaderboard_cache WHERE cache_key = ?",
		);
		const row = stmt.get(cacheKey) as
			| { data: string; cached_at: number }
			| undefined;

		if (!row) {
			return null;
		}

		const nowSeconds = Math.floor(Date.now() / 1000);
		const ageSeconds = nowSeconds - row.cached_at;
		const TWENTY_FOUR_HOURS = 24 * 60 * 60;

		// Return null if cache is stale (> 24 hours)
		if (ageSeconds > TWENTY_FOUR_HOURS) {
			return null;
		}

		return {
			data: JSON.parse(row.data),
			cachedAt: row.cached_at,
		};
	}

	async setLeaderboardCache(
		cacheKey: string,
		data: DriverStats[],
	): Promise<void> {
		const nowSeconds = Math.floor(Date.now() / 1000);
		const stmt = this.db.prepare(`
			INSERT INTO season_leaderboard_cache (cache_key, data, cached_at)
			VALUES (?, ?, ?)
			ON CONFLICT(cache_key) DO UPDATE SET
				data = excluded.data,
				cached_at = excluded.cached_at
		`);

		stmt.run(cacheKey, JSON.stringify(data), nowSeconds);
	}
}
