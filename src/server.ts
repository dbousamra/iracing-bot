import crypto from "node:crypto";
import http from "node:http";
import { isAxiosError } from "axios";
import { config } from "./config";
import type { IRacingClient } from "./iracing-client";
import { log } from "./util";

// Friends all share Dom's single iRacing account budget. A hammering client
// could get the account 429'd or flagged, so cap the overall request rate with
// a simple token bucket (no dependency). Refills RATE_CAPACITY tokens per
// RATE_WINDOW_MS, shared across every caller.
const RATE_CAPACITY = 10;
const RATE_WINDOW_MS = 1000;
let tokens = RATE_CAPACITY;
let lastRefill = 0;

function allowRequest(now: number): boolean {
	if (lastRefill === 0) {
		lastRefill = now;
	}
	const elapsed = now - lastRefill;
	if (elapsed > 0) {
		tokens = Math.min(RATE_CAPACITY, tokens + (elapsed / RATE_WINDOW_MS) * RATE_CAPACITY);
		lastRefill = now;
	}
	if (tokens >= 1) {
		tokens -= 1;
		return true;
	}
	return false;
}

/**
 * Constant-time comparison of the presented key against the configured secret.
 * Guards against timing attacks and length mismatches.
 */
function keyMatches(presented: string): boolean {
	const a = Buffer.from(presented);
	const b = Buffer.from(config.PROXY_API_KEY);
	if (a.length !== b.length) {
		return false;
	}
	return crypto.timingSafeEqual(a, b);
}

/** Extract the bearer token / api key from request headers, if present. */
function extractKey(req: http.IncomingMessage): string | null {
	const auth = req.headers.authorization;
	if (auth?.startsWith("Bearer ")) {
		return auth.slice("Bearer ".length).trim();
	}
	const apiKey = req.headers["x-api-key"];
	if (typeof apiKey === "string" && apiKey.length > 0) {
		return apiKey;
	}
	return null;
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
	const payload = JSON.stringify(body);
	res.writeHead(status, {
		"Content-Type": "application/json",
		"Content-Length": Buffer.byteLength(payload),
	});
	res.end(payload);
}

/**
 * Start an HTTP server that proxies authenticated requests to the iRacing Data
 * API. Friends present the shared PROXY_API_KEY; the server injects Dom's
 * iRacing auth server-side (via the shared, already-authenticated client),
 * forwards to iRacing, follows the S3/chunk links, and returns final JSON.
 */
export function startProxyServer(client: IRacingClient): void {
	const server = http.createServer(async (req, res) => {
		const method = req.method ?? "GET";
		const url = req.url ?? "/";

		// Health check for Fly — no auth, cheap, does not touch iRacing.
		if (method === "GET" && (url === "/health" || url === "/health/")) {
			res.writeHead(200, { "Content-Type": "text/plain" });
			res.end("ok");
			return;
		}

		if (!url.startsWith("/data")) {
			sendJson(res, 404, { error: "not found" });
			return;
		}

		if (method !== "GET") {
			// The iRacing Data API is GET-only.
			sendJson(res, 405, { error: "method not allowed" });
			return;
		}

		// Auth: presented key must match the shared secret.
		const presented = extractKey(req);
		if (!presented || !keyMatches(presented)) {
			log("Proxy unauthorized", { url });
			sendJson(res, 401, { error: "unauthorized" });
			return;
		}

		// Shared rate limit across all friends.
		if (!allowRequest(Date.now())) {
			log("Proxy rate limited", { url });
			sendJson(res, 429, { error: "rate limited, slow down" });
			return;
		}

		// Strip the leading `/data` prefix; DATA_API_BASE_URL already ends in
		// `/data`, so the remaining path + query is exactly what request() needs.
		const endpoint = url.slice("/data".length) || "/";

		try {
			const data = await client.proxy(endpoint);
			log("Proxy ok", { endpoint });
			sendJson(res, 200, data);
		} catch (error) {
			if (isAxiosError(error) && error.response) {
				log("Proxy upstream error", {
					endpoint,
					status: error.response.status,
				});
				sendJson(res, error.response.status, {
					error: "iracing upstream error",
					status: error.response.status,
					data: error.response.data,
				});
				return;
			}
			log("Proxy error", { endpoint, error });
			sendJson(res, 502, { error: "bad gateway" });
		}
	});

	server.listen(config.PORT, () => {
		log(`Proxy server listening on port ${config.PORT}`);
	});

	server.on("error", (error) => {
		log("Proxy server error", { error });
	});
}
