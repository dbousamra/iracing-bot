import crypto from "node:crypto";
import axios, { type AxiosInstance } from "axios";

const OAUTH_BASE_URL = "https://oauth.iracing.com";
const DATA_API_BASE_URL = "https://members-ng.iracing.com/data";

interface TokenResponse {
	access_token: string;
	token_type: string;
	expires_in: number;
	refresh_token?: string;
	refresh_token_expires_in?: number;
	scope?: string;
}

interface MemberProfile {
	member_info: {
		display_name: string;
		cust_id: number;
	};
}

interface RecentRace {
	subsession_id: number;
	start_position: number;
	finish_position: number;
	incidents: number;
	newi_rating: number;
	oldi_rating: number;
	old_sub_level: number;
	new_sub_level: number;
	series_name: string;
	strength_of_field: number;
	track: {
		track_name: string;
	};
	laps: number;
	car_class_id: number;
	session_start_time: string;
}

interface RecentRaces {
	races: RecentRace[];
}

interface DriverResult {
	cust_id?: number;
	driver_results?: DriverResult[];
	average_lap?: number;
	best_lap_time?: number;
	best_qual_lap_time?: number;
	car_class_id?: number;
}

interface SessionResult {
	simsession_name: string;
	results: DriverResult[];
}

interface SessionSplit {
	subsession_id: number;
}

interface CarClass {
	car_class_id: number;
	name: string;
}

interface SubsessionResults {
	session_splits: SessionSplit[];
	session_results: SessionResult[];
	end_time: string;
	car_classes: CarClass[];
}

export type IRacingClientOptions = {
	username: string;
	password: string;
	clientId: string;
	clientSecret: string;
};

export class IRacingClient {
	private accessToken: string | null = null;
	private refreshToken: string | null = null;
	private tokenExpiresAt: number | null = null;
	private refreshTokenExpiresAt: number | null = null;
	private client: AxiosInstance;
	private options: IRacingClientOptions;

	constructor(options: IRacingClientOptions) {
		this.options = options;
		this.client = axios.create({
			headers: {
				"Content-Type": "application/json",
			},
		});
	}

	/**
	 * Hash a value using SHA-256 and encode as base64
	 */
	private hashValue(value: string, salt: string): string {
		const hash = crypto.createHash("sha256");
		hash.update(value + salt.toLowerCase());
		return hash.digest("base64");
	}

	/**
	 * Get access token, refreshing if necessary
	 */
	private async ensureAuthenticated(): Promise<void> {
		const now = Date.now();

		// Check if we have a valid access token
		if (
			this.accessToken &&
			this.tokenExpiresAt &&
			now < this.tokenExpiresAt - 60000
		) {
			return;
		}

		// Check if we can refresh the token
		if (
			this.refreshToken &&
			this.refreshTokenExpiresAt &&
			now < this.refreshTokenExpiresAt - 60000
		) {
			await this.refreshAccessToken();
			return;
		}

		// Need to authenticate from scratch
		await this.authenticate();
	}

	/**
	 * Authenticate using password_limited grant
	 */
	private async authenticate(): Promise<void> {
		const hashedPassword = this.hashValue(
			this.options.password,
			this.options.username,
		);
		const hashedClientSecret = this.hashValue(
			this.options.clientSecret,
			this.options.clientId,
		);

		const params = new URLSearchParams({
			grant_type: "password_limited",
			client_id: this.options.clientId,
			client_secret: hashedClientSecret,
			username: this.options.username,
			password: hashedPassword,
			scope: "iracing.auth",
		});

		const response = await axios.post<TokenResponse>(
			`${OAUTH_BASE_URL}/oauth2/token`,
			params.toString(),
			{
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
				},
			},
		);

		this.accessToken = response.data.access_token;
		this.refreshToken = response.data.refresh_token ?? null;
		this.tokenExpiresAt = Date.now() + response.data.expires_in * 1000;
		this.refreshTokenExpiresAt = response.data.refresh_token_expires_in
			? Date.now() + response.data.refresh_token_expires_in * 1000
			: null;
	}

	/**
	 * Refresh access token using refresh_token grant
	 */
	private async refreshAccessToken(): Promise<void> {
		if (!this.refreshToken) {
			throw new Error("No refresh token available");
		}

		const params = new URLSearchParams({
			grant_type: "refresh_token",
			client_id: this.options.clientId,
			client_secret: this.options.clientSecret,
			refresh_token: this.refreshToken,
		});

		const response = await axios.post<TokenResponse>(
			`${OAUTH_BASE_URL}/oauth2/token`,
			params.toString(),
			{
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
				},
			},
		);

		this.accessToken = response.data.access_token;
		this.refreshToken = response.data.refresh_token ?? this.refreshToken;
		this.tokenExpiresAt = Date.now() + response.data.expires_in * 1000;
		this.refreshTokenExpiresAt = response.data.refresh_token_expires_in
			? Date.now() + response.data.refresh_token_expires_in * 1000
			: this.refreshTokenExpiresAt;
	}

	/**
	 * Make an authenticated request to the iRacing data API
	 */
	private async request<T>(endpoint: string): Promise<T> {
		await this.ensureAuthenticated();

		const response = await this.client.get<T>(
			`${DATA_API_BASE_URL}${endpoint}`,
			{
				headers: {
					Authorization: `Bearer ${this.accessToken}`,
				},
			},
		);

		return response.data;
	}

	/**
	 * Get member profile
	 */
	async getMemberProfile(options: { cust_id: number }): Promise<MemberProfile> {
		return this.request<MemberProfile>(
			`/member/profile?cust_id=${options.cust_id}`,
		);
	}

	/**
	 * Get recent races for a customer
	 */
	async getRecentRaces(options: { cust_id: number }): Promise<RecentRaces> {
		return this.request<RecentRaces>(
			`/results/recent_races?cust_id=${options.cust_id}`,
		);
	}

	/**
	 * Get subsession results
	 */
	async getResults(options: {
		subsession_id: number;
	}): Promise<SubsessionResults> {
		return this.request<SubsessionResults>(
			`/results/get?subsession_id=${options.subsession_id}`,
		);
	}
}
