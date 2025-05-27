import path from "node:path";
import { DatabaseSync } from "node:sqlite";

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
}
