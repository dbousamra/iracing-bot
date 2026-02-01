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

export type GuildConfig = {
	guildId: string;
	iracingTeamId: number | null;
	notificationChannelId: string | null;
	createdAt: number;
	updatedAt: number;
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

		await this.db.exec(`
			CREATE TABLE IF NOT EXISTS guild_config (
				guild_id TEXT PRIMARY KEY,
				iracing_team_id INTEGER,
				notification_channel_id TEXT,
				created_at INTEGER NOT NULL,
				updated_at INTEGER NOT NULL
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

	async setGuildTeam(guildId: string, teamId: number): Promise<void> {
		const nowSeconds = Math.floor(Date.now() / 1000);
		const stmt = this.db.prepare(`
			INSERT INTO guild_config (guild_id, iracing_team_id, created_at, updated_at)
			VALUES (?, ?, ?, ?)
			ON CONFLICT(guild_id) DO UPDATE SET
				iracing_team_id = excluded.iracing_team_id,
				updated_at = excluded.updated_at
		`);

		stmt.run(guildId, teamId, nowSeconds, nowSeconds);
	}

	async getGuildConfig(guildId: string): Promise<GuildConfig | null> {
		const stmt = this.db.prepare(
			"SELECT guild_id, iracing_team_id, notification_channel_id, created_at, updated_at FROM guild_config WHERE guild_id = ?",
		);
		const row = stmt.get(guildId) as
			| {
					guild_id: string;
					iracing_team_id: number | null;
					notification_channel_id: string | null;
					created_at: number;
					updated_at: number;
			  }
			| undefined;

		if (!row) {
			return null;
		}

		return {
			guildId: row.guild_id,
			iracingTeamId: row.iracing_team_id,
			notificationChannelId: row.notification_channel_id,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		};
	}

	async setGuildChannel(guildId: string, channelId: string): Promise<void> {
		const nowSeconds = Math.floor(Date.now() / 1000);
		const stmt = this.db.prepare(`
			INSERT INTO guild_config (guild_id, notification_channel_id, created_at, updated_at)
			VALUES (?, ?, ?, ?)
			ON CONFLICT(guild_id) DO UPDATE SET
				notification_channel_id = excluded.notification_channel_id,
				updated_at = excluded.updated_at
		`);

		stmt.run(guildId, channelId, nowSeconds, nowSeconds);
	}

	async getAllGuildConfigs(): Promise<GuildConfig[]> {
		const stmt = this.db.prepare(
			"SELECT guild_id, iracing_team_id, notification_channel_id, created_at, updated_at FROM guild_config",
		);
		const rows = stmt.all() as {
			guild_id: string;
			iracing_team_id: number | null;
			notification_channel_id: string | null;
			created_at: number;
			updated_at: number;
		}[];

		return rows.map((row) => ({
			guildId: row.guild_id,
			iracingTeamId: row.iracing_team_id,
			notificationChannelId: row.notification_channel_id,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		}));
	}
}
