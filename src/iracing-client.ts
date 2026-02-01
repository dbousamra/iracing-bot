import crypto from "node:crypto";
import axios, { type AxiosInstance } from "axios";
import { log } from "./util";

const OAUTH_BASE_URL = "https://oauth.iracing.com";
const DATA_API_BASE_URL = "https://members-ng.iracing.com/data";

export interface TokenResponse {
	access_token: string;
	token_type: string;
	expires_in: number;
	refresh_token?: string;
	refresh_token_expires_in?: number;
	scope?: string;
}

export interface MemberProfile {
	member_info: {
		display_name: string;
		cust_id: number;
	};
}

export interface RecentRace {
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
	season_year: number;
	season_quarter: number;
}

export interface RecentRaces {
	races: RecentRace[];
}

export interface SessionResult {
	simsession_name: string;
	results: DriverResult[];
}

export interface SessionSplit {
	subsession_id: number;
}

export interface CarClass {
	car_class_id: number;
	name: string;
}

export interface SubsessionResults {
	session_splits: SessionSplit[];
	session_results: SessionResult[];
	end_time: string;
	car_classes: CarClass[];
}

// Career Stats Types
export interface CareerStat {
	avg_finish_position: number;
	avg_incidents: number;
	category: string;
	category_id: number;
	laps: number;
	laps_led: number;
	poles: number;
	starts: number;
	top5: number;
	win_percentage: number;
	wins: number;
}

export interface MemberCareerStats {
	cust_id: number;
	stats: CareerStat[];
}

export interface MemberSummary {
	cust_id: number;
	this_year: {
		num_league_sessions: number;
		num_league_wins: number;
		num_official_sessions: number;
		num_official_wins: number;
	};
}

export interface MemberRecap {
	cust_id: number;
	stats: {
		avg_finish_position: number;
		avg_start_position: number;
		favorite_car: {
			car_id: number;
			car_name: string;
		};
		favorite_track: {
			track_id: number;
			track_name: string;
		};
		laps: number;
		laps_led: number;
		starts: number;
		top5: number;
		wins: number;
	};
}

export interface SessionData {
	allowed_licenses?: AllowedLicense[];
	associated_subsession_ids: number[];
	can_protest: boolean;
	car_classes: CarClass[];
	caution_type: number;
	cooldown_minutes: number;
	corners_per_lap: number;
	damage_model: number;
	driver_change_param1: number;
	driver_change_param2: number;
	driver_change_rule: number;
	driver_changes: boolean;
	end_time: string;
	event_average_lap: number;
	event_best_lap_time: number;
	event_laps_complete: number;
	event_strength_of_field: number;
	event_type: number;
	event_type_name: string;
	heat_info_id: number;
	host_id?: number;
	league_id?: number;
	league_name?: string;
	league_season_id?: number;
	league_season_name?: string;
	license_category: string;
	license_category_id: number;
	limit_minutes: number;
	max_team_drivers: number;
	max_weeks: number;
	min_team_drivers: number;
	num_caution_laps: number;
	num_cautions: number;
	num_drivers: number;
	num_laps_for_qual_average: number;
	num_laps_for_solo_average: number;
	num_lead_changes: number;
	official_session: boolean;
	points_type: string;
	private_session_id: number;
	race_summary: RaceSummary;
	race_week_num: number;
	restrict_results?: boolean;
	results_restricted: boolean;
	season_id: number;
	season_name: string;
	season_quarter: number;
	season_short_name: string;
	season_year: number;
	series_id: number;
	series_logo?: string;
	series_name: string;
	series_short_name: string;
	session_id: number;
	session_name?: string;
	session_results: SessionResult[];
	session_splits: SessionSplit[];
	special_event_type: number;
	start_time: string;
	subsession_id: number;
	track: Track;
	track_state: TrackState;
	weather: Weather;
}

export interface AllowedLicense {
	group_name: string;
	license_group: number;
	max_license_level: number;
	min_license_level: number;
	parent_id: number;
}

export interface CarClass {
	car_class_id: number;
	cars_in_class: CarInClass[];
	name: string;
	num_entries: number;
	short_name: string;
	strength_of_field: number;
}

export interface CarInClass {
	car_id: number;
}

export interface RaceSummary {
	average_lap: number;
	field_strength: number;
	has_opt_path: boolean;
	heat_info_id?: number;
	laps_complete: number;
	num_caution_laps: number;
	num_cautions: number;
	num_lead_changes: number;
	num_opt_laps: number;
	special_event_type: number;
	special_event_type_text: string;
	subsession_id: number;
}

export interface ResultEntry {
	aggregate_champ_points: number;
	ai: boolean;
	average_lap: number;
	best_lap_num: number;
	best_lap_time: number;
	best_nlaps_num: number;
	best_nlaps_time: number;
	best_qual_lap_at: string;
	best_qual_lap_num: number;
	best_qual_lap_time: number;
	car_class_id: number;
	car_class_name: string;
	car_class_short_name: string;
	car_id: number;
	car_name: string;
	carcfg: number;
	champ_points: number;
	class_interval: number;
	country_code: string;
	cust_id: number;
	display_name: string;
	division: number;
	division_name?: string;
	driver_results?: DriverResult[];
	drop_race: boolean;
	finish_position: number;
	finish_position_in_class: number;
	flair_id: number;
	flair_name: string;
	flair_shortname: string;
	friend: boolean;
	helmet: Helmet;
	incidents: number;
	interval: number;
	laps_complete: number;
	laps_lead: number;
	league_agg_points: number;
	league_points: number;
	license_change_oval: number;
	license_change_road: number;
	livery: Livery;
	max_pct_fuel_fill: number;
	new_cpi: number;
	new_license_level: number;
	new_sub_level: number;
	new_ttrating: number;
	newi_rating: number;
	old_cpi: number;
	old_license_level: number;
	old_sub_level: number;
	old_ttrating: number;
	oldi_rating: number;
	opt_laps_complete: number;
	position: number;
	qual_lap_time: number;
	reason_out: string;
	reason_out_id: number;
	starting_position: number;
	starting_position_in_class: number;
	suit?: Suit;
	team_id?: number;
	watched: boolean;
	weight_penalty_kg: number;
}

export interface DriverResult {
	aggregate_champ_points: number;
	ai: boolean;
	average_lap: number;
	best_lap_num: number;
	best_lap_time: number;
	best_nlaps_num: number;
	best_nlaps_time: number;
	best_qual_lap_at: string;
	best_qual_lap_num: number;
	best_qual_lap_time: number;
	car_class_id: number;
	car_class_name: string;
	car_class_short_name: string;
	car_id: number;
	car_name: string;
	carcfg: number;
	champ_points: number;
	class_interval: number;
	country_code: string;
	cust_id: number;
	display_name: string;
	division: number;
	drop_race: boolean;
	finish_position: number;
	finish_position_in_class: number;
	flair_id: number;
	flair_name: string;
	flair_shortname: string;
	friend: boolean;
	helmet: Helmet;
	incidents: number;
	interval: number;
	laps_complete: number;
	laps_lead: number;
	league_agg_points: number;
	league_points: number;
	license_change_oval: number;
	license_change_road: number;
	livery: Livery;
	max_pct_fuel_fill: number;
	new_cpi: number;
	new_license_level: number;
	new_sub_level: number;
	new_ttrating: number;
	newi_rating: number;
	old_cpi: number;
	old_license_level: number;
	old_sub_level: number;
	old_ttrating: number;
	oldi_rating: number;
	opt_laps_complete: number;
	position: number;
	qual_lap_time: number;
	reason_out: string;
	reason_out_id: number;
	starting_position: number;
	starting_position_in_class: number;
	suit: Suit;
	team_id: number;
	watched: boolean;
	weight_penalty_kg: number;
}

export interface Helmet {
	color1: string;
	color2: string;
	color3: string;
	face_type: number;
	helmet_type: number;
	pattern: number;
}

export interface Suit {
	color1: string;
	color2: string;
	color3: string;
	pattern: number;
}

export interface Livery {
	car_id: number;
	car_number: string;
	color1: string;
	color2: string;
	color3: string;
	number_color1: string;
	number_color2: string;
	number_color3: string;
	number_font: number;
	number_slant: number;
	pattern: number;
	rim_type: number;
	sponsor1: number;
	sponsor2: number;
	wheel_color: string | null;
}

export interface WeatherResult {
	avg_cloud_cover_pct: number;
	avg_rel_humidity: number;
	avg_skies: number;
	avg_temp: number;
	avg_wind_dir: number;
	avg_wind_speed: number;
	fog_time_pct: number;
	max_cloud_cover_pct: number;
	max_fog: number;
	max_temp: number;
	max_wind_speed: number;
	min_cloud_cover_pct: number;
	min_temp: number;
	min_wind_speed: number;
	precip_mm: number;
	precip_mm2hr_before_session: number;
	precip_time_pct: number;
	simulated_start_time: string;
	temp_units: number;
	wind_units: number;
}

export interface SessionSplit {
	event_strength_of_field: number;
	subsession_id: number;
}

export interface Track {
	category?: string;
	category_id?: number;
	config_name?: string;
	track_id: number;
	track_name: string;
}

export interface TrackState {
	leave_marbles: boolean;
	practice_rubber: number;
	qualify_rubber: number;
	race_rubber: number;
	warmup_rubber: number;
}

export interface Weather {
	allow_fog: boolean;
	fog: number;
	precip_mm2hr_before_final_session: number;
	precip_mm_final_session: number;
	precip_option: number;
	precip_time_pct: number;
	rel_humidity: number;
	simulated_start_time: string;
	skies: number;
	temp_units: number;
	temp_value: number;
	time_of_day: number;
	track_water: number;
	type: number;
	version: number;
	weather_var_initial: number;
	weather_var_ongoing: number;
	wind_dir: number;
	wind_units: number;
	wind_value: number;
}

export interface SearchSeriesResult {
	car_class_id: number;
	car_class_name: string;
	car_class_short_name: string;
	car_id: number;
	car_name: string;
	car_name_abbreviated: string;
	champ_points: number;
	cust_id: number;
	driver_changes: boolean;
	drop_race: boolean;
	end_time: string;
	start_time: string;
	event_average_lap: number;
	event_best_lap_time: number;
	event_laps_complete: number;
	event_strength_of_field: number;
	event_type: number;
	event_type_name: string;
	finish_position: number;
	finish_position_in_class: number;
	incidents: number;
	laps_complete: number;
	laps_led: number;
	license_category: string;
	license_category_id: number;
	num_caution_laps: number;
	num_cautions: number;
	num_drivers: number;
	num_lead_changes: number;
	official_session: boolean;
	race_week_num: number;
	season_id: number;
	season_license_group: number;
	season_license_group_name: string;
	season_quarter: number;
	season_year: number;
	series_id: number;
	series_name: string;
	series_short_name: string;
	session_id: number;
	subsession_id: number;
	starting_position: number;
	starting_position_in_class: number;
	track: {
		track_id: number;
		track_name: string;
		config_name?: string;
	};
	winner_ai: boolean;
	winner_group_id: number;
	winner_name: string;
}

export interface TeamRosterMember {
	admin: boolean;
	cust_id: number;
	display_name: string;
	helmet: Helmet;
	owner: boolean;
}

export interface TeamGetResponse {
	about: string;
	created: string;
	team_id: number;
	team_name: string;
	roster: TeamRosterMember[];
	roster_count: number;
	is_member: boolean;
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
			const timeUntilExpiry = Math.floor(
				(this.tokenExpiresAt - now) / 1000 / 60,
			);
			return;
		}

		// Check if we can refresh the token
		if (
			this.refreshToken &&
			this.refreshTokenExpiresAt &&
			now < this.refreshTokenExpiresAt - 60000
		) {
			log("Access token expired, using refresh token");
			await this.refreshAccessToken();
			return;
		}

		// Need to authenticate from scratch
		if (this.refreshToken) {
			log("Refresh token expired, authenticating from scratch");
		} else {
			log("No tokens available, authenticating from scratch");
		}
		await this.authenticate();
	}

	/**
	 * Authenticate using password_limited grant
	 */
	async authenticate(): Promise<void> {
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

		log("Received token response:", {
			expires_in: response.data.expires_in,
			refresh_token_expires_in: response.data.refresh_token_expires_in,
			limit: response.headers["ratelimit-limit"],
			remaining: response.headers["ratelimit-remaining"],
			reset: response.headers["ratelimit-reset"],
		});

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

		// Hash the client secret just like in authenticate()
		const hashedClientSecret = this.hashValue(
			this.options.clientSecret,
			this.options.clientId,
		);

		const params = new URLSearchParams({
			grant_type: "refresh_token",
			client_id: this.options.clientId,
			client_secret: hashedClientSecret,
			refresh_token: this.refreshToken,
		});

		log("Attempting to refresh token...");

		const response = await axios.post<TokenResponse>(
			`${OAUTH_BASE_URL}/oauth2/token`,
			params.toString(),
			{
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
				},
			},
		);

		log("Token refresh successful:", {
			expires_in: response.data.expires_in,
			refresh_token_expires_in: response.data.refresh_token_expires_in,
		});

		this.accessToken = response.data.access_token;
		this.refreshToken = response.data.refresh_token ?? this.refreshToken;
		this.tokenExpiresAt = Date.now() + response.data.expires_in * 1000;
		this.refreshTokenExpiresAt = response.data.refresh_token_expires_in
			? Date.now() + response.data.refresh_token_expires_in * 1000
			: this.refreshTokenExpiresAt;
	}

	/**
	 * Make an authenticated request to the iRacing data API
	 * The API returns a link to S3 where the actual data is stored
	 */
	private async request<T>(endpoint: string): Promise<T> {
		await this.ensureAuthenticated();

		// First request to the data API to get the S3 link
		const response = await this.client.get<{
			link?: string;
			expires: string;
			data: {
				chunk_info?: { base_download_url: string; chunk_file_names: string[] };
			};
		}>(`${DATA_API_BASE_URL}${endpoint}`, {
			headers: {
				Authorization: `Bearer ${this.accessToken}`,
			},
		});

		// Second request to fetch the actual data from S3
		if (response.data.link) {
			const dataResponse = await this.client.get<T>(response.data.link);
			return dataResponse.data;
		}

		if (response.data.data?.chunk_info) {
			const { base_download_url, chunk_file_names } =
				response.data.data.chunk_info;

			const chunks = await Promise.all(
				chunk_file_names.map((chunk) =>
					this.client.get<T>(`${base_download_url}${chunk}`),
				),
			);

			return chunks.flatMap((chunk) => chunk.data) as T;
		}

		return response.data as T;
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
			`/stats/member_recent_races?cust_id=${options.cust_id}`,
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

	/**
	 * Get member career statistics
	 */
	async getMemberCareerStats(options: {
		cust_id: number;
	}): Promise<MemberCareerStats> {
		return this.request<MemberCareerStats>(
			`/stats/member_career?cust_id=${options.cust_id}`,
		);
	}

	/**
	 * Get member summary with this year's session counts
	 */
	async getMemberSummary(options: { cust_id: number }): Promise<MemberSummary> {
		return this.request<MemberSummary>(
			`/stats/member_summary?cust_id=${options.cust_id}`,
		);
	}

	/**
	 * Get member recap with statistical trends
	 */
	async getMemberRecap(options: { cust_id: number }): Promise<MemberRecap> {
		return this.request<MemberRecap>(
			`/stats/member_recap?cust_id=${options.cust_id}`,
		);
	}

	/**
	 * Search for series results with optional filters
	 */
	async searchSeries(options: {
		category_ids?: string;
		cust_id: string;
		event_types?: string;
		finish_range_begin?: string;
		finish_range_end?: string;
		official_only?: string;
		race_week_num?: string;
		season_quarter?: string;
		season_year?: string;
		series_id?: string;
		start_range_begin?: string;
		start_range_end?: string;
		team_id?: string;
	}): Promise<SearchSeriesResult[]> {
		const params = new URLSearchParams(options);

		return this.request<SearchSeriesResult[]>(
			`/results/search_series?${params.toString()}`,
		);
	}

	/**
	 * Get team information including roster
	 */
	async getTeam(options: {
		team_id: number;
		include_licenses?: boolean;
	}): Promise<TeamGetResponse> {
		const params = new URLSearchParams({
			team_id: options.team_id.toString(),
		});

		if (options.include_licenses !== undefined) {
			params.append("include_licenses", options.include_licenses.toString());
		}

		return this.request<TeamGetResponse>(
			`/team/get?${params.toString()}`,
		);
	}

	/**
	 * Get the documentation for the iRacing API
	 */
	async getDoc() {
		// biome-ignore lint/suspicious/noExplicitAny: No need to type this
		return this.request<any>("/doc");
	}
}
