import { config } from "../config";
import { Db } from "../db";
import { getTeamRaceData } from "../iracing";
import { IRacingClient } from "../iracing-client";
import type { ResultEntry, SessionData } from "../iracing-client";

const isTeamRace = (subsessionResults: SessionData): boolean => {
	// A race is a team race if:
	// - min_team_drivers > 1 or max_team_drivers > 1
	// - OR driver_changes is true
	// - OR any result entry has driver_results array with length > 1
	if (
		subsessionResults.min_team_drivers > 1 ||
		subsessionResults.max_team_drivers > 1 ||
		subsessionResults.driver_changes
	) {
		return true;
	}

	const raceSession = subsessionResults.session_results.find(
		(res) => res.simsession_name === "RACE",
	);

	if (!raceSession) {
		return false;
	}

	return (raceSession.results as unknown as ResultEntry[]).some(
		(res) => (res.driver_results?.length ?? 0) > 1,
	);
};

const main = async () => {
	console.log("Testing team race detection with subsession 81277794...\n");

	const iRacingClient = new IRacingClient({
		username: config.IRACING_USERNAME,
		password: config.IRACING_PASSWORD,
		clientId: config.IRACING_CLIENT_ID,
		clientSecret: config.IRACING_CLIENT_SECRET,
	});

	try {
		// Fetch the subsession data
		const subsessionResults = (await iRacingClient.getResults({
			subsession_id: 81277794,
		})) as unknown as SessionData;

		console.log("Subsession details:");
		console.log(`- Series: ${subsessionResults.series_name}`);
		console.log(`- Track: ${subsessionResults.track.track_name}`);
		console.log(`- Min team drivers: ${subsessionResults.min_team_drivers}`);
		console.log(`- Max team drivers: ${subsessionResults.max_team_drivers}`);
		console.log(`- Driver changes: ${subsessionResults.driver_changes}`);

		// Test team race detection
		const isTeam = isTeamRace(subsessionResults);
		console.log(`\nIs team race? ${isTeam}`);

		if (isTeam) {
			const raceSession = subsessionResults.session_results.find(
				(res) => res.simsession_name === "RACE",
			);

			if (raceSession) {
				const results = raceSession.results as unknown as ResultEntry[];

				// Find teams with multiple drivers
				const teamsWithMultipleDrivers = results.filter(
					(res) => (res.driver_results?.length ?? 0) > 1,
				);

				console.log(
					`\nTeams with multiple drivers: ${teamsWithMultipleDrivers.length}`,
				);

				// Show first team as example
				if (teamsWithMultipleDrivers.length > 0) {
					const firstTeam = teamsWithMultipleDrivers[0];
					console.log(`\nExample team:`);
					console.log(`- Team ID: ${firstTeam?.team_id}`);
					console.log(`- Car: ${firstTeam?.car_name}`);
					console.log(`- Position: ${firstTeam?.finish_position}`);
					console.log(
						`- Position in class: ${firstTeam?.finish_position_in_class}`,
					);
					console.log(`- Laps: ${firstTeam?.laps_complete}`);
					console.log(`- Incidents: ${firstTeam?.incidents}`);
					console.log(
						`- Driver count: ${firstTeam?.driver_results?.length ?? 0}`,
					);

					if (firstTeam?.driver_results && firstTeam.driver_results.length > 0) {
						console.log("\nDrivers:");
						for (const driver of firstTeam.driver_results) {
							console.log(
								`  - ${driver.display_name} (${driver.cust_id}): ${driver.laps_complete} laps, ${driver.incidents}x, iR ${driver.oldi_rating} -> ${driver.newi_rating} (${driver.newi_rating - driver.oldi_rating >= 0 ? "+" : ""}${driver.newi_rating - driver.oldi_rating})`,
							);
						}
					}

					// Test fetching team race data
					console.log("\n--- Testing getTeamRaceData ---");
					if (firstTeam?.team_id && firstTeam.driver_results) {
						const trackedCustomerIds = firstTeam.driver_results.map(
							(d) => d.cust_id ?? 0,
						);
						const teamRaceData = await getTeamRaceData(iRacingClient, {
							subsessionId: 81277794,
							teamId: firstTeam.team_id,
							trackedCustomerIds,
						});

						console.log("\nTeam race data:");
						console.log(`- Team name: ${teamRaceData.teamName}`);
						console.log(`- Series: ${teamRaceData.series}`);
						console.log(`- Track: ${teamRaceData.track}`);
						console.log(`- Car class: ${teamRaceData.carClass}`);
						console.log(`- SOF: ${teamRaceData.strengthOfField}`);
						console.log(
							`- Team position: P${teamRaceData.teamPosition}/${teamRaceData.totalEntries}`,
						);
						console.log(
							`- Team class position: P${teamRaceData.teamPositionInClass}/${teamRaceData.classEntries}`,
						);
						console.log(`- Total laps: ${teamRaceData.totalLaps}`);
						console.log(`- Total incidents: ${teamRaceData.totalIncidents}`);
						console.log(`- Average team iRating: ${teamRaceData.avgTeamIRating}`);
						console.log(`- Drivers: ${teamRaceData.drivers.length}`);
					}
				}
			}
		}

		console.log("\n✅ Test completed successfully!");
	} catch (error) {
		console.error("❌ Error:", error);
		process.exit(1);
	}
};

main();
