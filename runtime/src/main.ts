// npm start [characters/<id>]
//
// Loads the character and its extensions, checks every key it needs is in
// .env, prepares the model the player shows (rig/prepare.ts), serves the app's
// session socket on ws://HOST:PORT/session, and starts the player when
// HARNESS_PLAYER gives the command that opens it (player.ts).
// HOST defaults to 127.0.0.1; set HOST=0.0.0.0 to reach it from another device on the network.

import { existsSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { WebSocketServer } from "ws";
import { loadExtensions } from "./extensions.ts";
import { ManifestError, loadCharacter, requiredKeys } from "./manifest.ts";
import { manualStart, playerLog, startPlayer, type PlayerLaunch } from "./player.ts";
import { prepareModel } from "./rig/prepare.ts";
import { runSession } from "./session.ts";

function fail(message: string): never {
	console.error(message);
	process.exit(1);
}

const dir = path.resolve(process.argv[2] ?? "characters/foxglove");
const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? 8788);

let character;
try {
	character = loadCharacter(dir);
} catch (e) {
	fail(e instanceof ManifestError ? e.message : String(e));
}

if (!existsSync(character.env_file))
	fail(`${character.env_file} does not exist. Copy .env.example to .env and fill in the keys.`);
process.loadEnvFile(character.env_file);
const missing = requiredKeys(character).filter((k) => !process.env[k]);
if (missing.length) fail(`${character.env_file} is missing ${missing.join(", ")}`);

const extensions = await loadExtensions(character.extensions).catch((e: unknown) =>
	fail(e instanceof Error ? e.message : String(e)),
);

// what the player shows: a profile built into it, or the character's model
// with its animations baked in
let shown: string;
if (character.rig.kind === "profile") shown = character.rig.profile;
else {
	const rig = character.rig;
	const t0 = Date.now();
	try {
		const prepared = prepareModel(character.id, rig);
		shown = prepared.file;
		if (prepared.rebuilt)
			console.log(`prepared ${path.basename(rig.model)} with ${prepared.clips} animations in ${Date.now() - t0} ms`);
	} catch (e) {
		fail(`could not prepare ${rig.model}: ${e instanceof Error ? e.message : String(e)}`);
	}
}

const server = createServer((_req, res) => {
	res.writeHead(200, { "content-type": "text/plain" });
	res.end(`mutuals character harness: ${character.name}. The app connects to /session.\n`);
});
const wss = new WebSocketServer({ server, path: "/session" });
wss.on("connection", (ws) => runSession(ws, character, extensions));
// the socket server re-emits the HTTP server's errors, so both are handled
const listenFailed = (e: Error) => fail(`could not listen on ${host}:${port}: ${e.message}`);
server.on("error", listenFailed);
wss.on("error", listenFailed);
server.listen(port, host, () => {
	const exts = extensions.map((e) => e.name).join(", ") || "none";
	console.log(`${character.name} on ws://${host}:${port}/session (extensions: ${exts})`);
	// the player is local: loopback, unless the runtime listens on one address only
	const reach = host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host;
	const launch: PlayerLaunch = { url: `ws://${reach}:${port}/session`, character: shown };
	const where = process.env.HARNESS_PLAYER;
	if (!where) {
		console.log(`start the player with:\n  ${manualStart(launch)}`);
		return;
	}
	try {
		const stopPlayer = startPlayer(where, launch, (code) => {
			if (code) fail(`the player exited with ${code}; see ${playerLog}`);
			console.log("the player closed");
			process.exit(0);
		});
		// the player runs in its own process group, so every way out stops it
		process.on("exit", stopPlayer);
		for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) process.on(signal, () => process.exit(0));
	} catch (e) {
		fail(e instanceof Error ? e.message : String(e));
	}
});
