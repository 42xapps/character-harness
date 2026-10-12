// npm start [characters/<id>]
//
// Loads the character and its extensions, checks every key it needs is in
// .env, and serves the app's session socket on ws://HOST:PORT/session.
// HOST defaults to 127.0.0.1; set HOST=0.0.0.0 to reach it from another device on the network.

import { existsSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { WebSocketServer } from "ws";
import { loadExtensions } from "./extensions.ts";
import { ManifestError, loadCharacter, requiredKeys } from "./manifest.ts";
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
});
