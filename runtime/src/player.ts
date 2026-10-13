// Starts the player app next to the runtime, so `npm start` is the whole thing.
// HARNESS_PLAYER is the command that opens the player, run by the shell from
// the harness folder: the player binary's path, or any command line that stays
// running while the player is open (on macOS, the binary inside the .app, not
// `open -a`). Unset, the runtime only serves, and prints what the player needs
// to connect.
//
// The player gets HARNESS_URL and HARNESS_CHARACTER in its environment. Its
// output goes to .cache/player.log; closing the player stops the runtime, and
// stopping the runtime closes the player.

import { spawn } from "node:child_process";
import { mkdirSync, openSync } from "node:fs";
import path from "node:path";

const LOG = path.resolve(import.meta.dirname, "../../.cache/player.log");
// where the player's output goes, as the console shows it
export const playerLog = path.relative(process.cwd(), LOG);

export interface PlayerLaunch {
	url: string; // the runtime's session socket
	character: string; // a prepared model file, or the name of a profile cooked into the player
}

// what to give the player when starting it by hand, for the console
export function manualStart(launch: PlayerLaunch): string {
	return `HARNESS_URL=${launch.url} HARNESS_CHARACTER=${JSON.stringify(launch.character)}`;
}

// Starts the player; the returned stop() closes it and anything it started.
export function startPlayer(
	command: string,
	launch: PlayerLaunch,
	onExit: (code: number | null, signal: NodeJS.Signals | null) => void,
): () => void {
	mkdirSync(path.dirname(LOG), { recursive: true });
	const log = openSync(LOG, "w");
	const child = spawn(command, {
		shell: true,
		env: { ...process.env, HARNESS_URL: launch.url, HARNESS_CHARACTER: launch.character },
		stdio: ["ignore", log, log],
		// its own process group, so stopping it reaches whatever the command starts
		detached: true,
	});
	child.on("exit", (code, signal) => onExit(code, signal));
	child.on("error", (e) => {
		console.error(`could not start the player: ${e.message}`);
		onExit(1, null);
	});
	console.log(`player starting (log: ${playerLog})`);
	return () => {
		try {
			if (child.pid) process.kill(-child.pid, "SIGTERM");
		} catch {
			// already gone
		}
	};
}
