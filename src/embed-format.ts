// Shared formatting for every embed the bot posts, so they all read the same:
// the headline in the title, key numbers bold, and 🟢 / 🔴 for direction.
import type { MichaelsBottleLevel } from "./bottle-meter";

export const MINUS = "−";

export const PODIUM: Record<
	number,
	{ medal: string; label: string; color: number }
> = {
	1: { medal: "🥇", label: "WIN", color: 0xf1c40f },
	2: { medal: "🥈", label: "PODIUM", color: 0xc0c7d0 },
	3: { medal: "🥉", label: "PODIUM", color: 0xcd7f32 },
};

/** Medal for a top-3 rank, otherwise "4." style numbering. */
export const rankBadge = (rank: number) => PODIUM[rank]?.medal ?? `${rank}.`;

/** Colour bar for non-podium results, following each level's own emoji. */
export const BOTTLE_LEVEL_COLORS: Record<MichaelsBottleLevel, number> = {
	"world-champion-hotline": 0x57f287,
	bradbury: 0x57f287,
	"no-bottleo": 0x3ba55d,
	"low-moderate": 0xfee75c,
	high: 0xf0883e,
	"very-high": 0xe67e22,
	severe: 0xe74c3c,
	extreme: 0xed4245,
	catastrophic: 0xed4245,
	"first-lap-disaster": 0xed4245,
	dnf: 0x80848e,
};

export const COLORS = {
	gain: 0x3ba55d,
	loss: 0xed4245,
	neutral: 0x80848e,
	info: 0x5865f2,
	leaderboard: 0xf1c40f,
	bottle: 0xf0883e,
	sideA: 0x3498db,
	sideB: 0xe67e22,
};

export const levelName = (level: MichaelsBottleLevel) =>
	level.replace(/-/g, " ").toUpperCase();

const isZero = (n: number, dp: number) => Number(Math.abs(n).toFixed(dp)) === 0;

/** +12 / −0.13 / ±0 with a real minus sign. */
export const signed = (n: number, dp = 0) => {
	const abs = Math.abs(n).toFixed(dp);
	if (isZero(n, dp)) return `±${abs}`;
	return n > 0 ? `+${abs}` : `${MINUS}${abs}`;
};

/** "🟢 +12", "🔴 −0.13" or "⚪ ±0". */
/** "🟢 **+12**", "🔴 **−0.13**" or "⚪ **±0**". The change is bold so it reads at a glance. */
export const trend = (n: number, dp = 0) => {
	if (isZero(n, dp)) return `⚪ **${signed(n, dp)}**`;
	return `${n > 0 ? "🟢" : "🔴"} **${signed(n, dp)}**`;
};

/** Places gained or lost from start to finish. */
export const placesMoved = (start: number, finish: number) => {
	const gained = start - finish;
	if (gained > 0) return `🟢 ▲${gained}`;
	if (gained < 0) return `🔴 ▼${-gained}`;
	return "⚪ ±0";
};

export const plural = (n: number, word: string) =>
	`${n} ${word}${n === 1 ? "" : "s"}`;

/** "Toyota GR86 Cup by SIMAGIC" -> "Toyota GR86 Cup" */
export const stripSponsor = (series: string) =>
	series.replace(/\s+(?:by|presented by|powered by)\s+.+$/i, "").trim();

const words = (s: string) => s.toLowerCase().match(/[a-z0-9]+/g) ?? [];

/**
 * True when the series name already tells you the car, e.g. "Toyota GR86 Cup"
 * for a Toyota GR86, or "Porsche Cup - Fixed" for a Porsche 911 Cup (992.2).
 */
const seriesNamesCar = (series: string, car: string) => {
	const seriesWords = new Set(words(series));
	return words(car).some((w) => w.length >= 4 && seriesWords.has(w));
};

/** "🏁 **Series** · Track[ · Car]", leaving the car out when the series names it. */
export const eventLine = (series: string, track: string, car?: string) => {
	const name = stripSponsor(series).replace(/^iRacing\s+/i, "");
	const showCar = !!car && !seriesNamesCar(name, car);
	return `🏁 **${name}** · ${[track, showCar ? car : null].filter(Boolean).join(" · ")}`;
};

export const resultUrl = (subsessionId: number) =>
	`https://members-ng.iracing.com/web/racing/results-stats/results?subsessionid=${subsessionId}`;

export const CACHE_FOOTER = "Cached for 24h · use refresh:true to update";

/**
 * Joins lines up to Discord's description limit, replacing anything that
 * doesn't fit with an "…and N more" line.
 */
export const fitLines = (lines: string[], limit = 4000) => {
	const out: string[] = [];
	let length = 0;
	for (let i = 0; i < lines.length; i++) {
		const more = `-# …and ${lines.length - i} more`;
		if (length + lines[i].length + 1 + more.length + 1 > limit) {
			out.push(more);
			break;
		}
		out.push(lines[i]);
		length += lines[i].length + 1;
	}
	return out.join("\n");
};
