import crypto from "node:crypto";
import Axios, { type AxiosInstance } from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import type { MemberRecentRacesResponse } from "./types";

export class IRacingClient {
	private axios: AxiosInstance;
	private username: string;
	private password: string;
	private jar: CookieJar;
	private loggedIn = false;

	constructor(username: string, password: string) {
		const normalized = username.trim().toLowerCase();
		const hash = crypto
			.createHash("sha256")
			.update(password + normalized)
			.digest();

		this.username = username;
		this.password = hash.toString("base64");
		this.jar = new CookieJar();
		this.axios = wrapper(
			Axios.create({
				baseURL: "https://members-ng.iracing.com",
				withCredentials: true,
				jar: this.jar,
				headers: {
					"Content-Type": "application/json",
				},
			}),
		);
	}

	async login(): Promise<void> {
		if (this.loggedIn) {
			return;
		}

		await this.axios.post("/auth", {
			email: this.username,
			password: this.password,
		});
		this.loggedIn = true;
	}

	async get<T = unknown>(
		url: string,
		params?: Record<string, unknown>,
	): Promise<T> {
		await this.login();
		const response = await this.axios.get(url, { params });
		// If the response contains a 'link', fetch the actual data
		if (response.data && typeof response.data.link === "string") {
			const s3Response = await Axios.get(response.data.link);
			return s3Response.data as T;
		}
		return response.data as T;
	}

	async getMemberRecentRaces(
		custId: number,
	): Promise<MemberRecentRacesResponse> {
		return this.get("/data/stats/member_recent_races", {
			cust_id: custId,
		});
	}
}
