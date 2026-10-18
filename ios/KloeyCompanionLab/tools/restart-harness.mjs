// Development launcher only; the harness remains the owner of voice/model logic.
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, realpathSync, rmdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 23 || (major === 23 && minor < 6)) {
  console.error("Server restart requires Node >=23.6. Select a newer Node with NODE_BINARY.");
  process.exit(1);
}

const lab = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function findHarnessRoot(start) {
  let directory = start;
  for (let depth = 0; depth < 5; depth += 1) {
    if (existsSync(path.join(directory, "runtime/src/main.ts"))
      && existsSync(path.join(directory, "characters/foxglove/character.yaml"))) return directory;
    const sibling = path.join(directory, "character-harness");
    if (existsSync(path.join(sibling, "runtime/src/main.ts"))
      && existsSync(path.join(sibling, "characters/foxglove/character.yaml"))) return sibling;
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  return path.resolve(start, "../character-harness");
}

const harness = findHarnessRoot(lab);
const entry = path.join(harness, "runtime/src/main.ts");
const characterDir = path.join(harness, "characters/foxglove");
const handoff = process.argv[2];
const cache = path.join(harness, ".cache/iphone-server");
const lock = path.join(cache, "restart.lock");
let locked = false;
let child;
let ready = false;
let handedOff = false;
const command = (binary, args) => execFileSync(binary, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 15000 }).trim();

function listeners(port) {
  const result = spawnSync("/usr/sbin/lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], { encoding: "utf8", timeout: 15000 });
  if (result.error || (result.status !== 0 && result.status !== 1)) throw new Error("Could not inspect the server port; no processes were stopped.");
  return [...new Set(result.stdout.trim().split(/\s+/).filter(Boolean).map(Number))];
}

function isThisHarness(pid) {
  try {
    const cwd = command("/usr/sbin/lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"])
      .split("\n").find((line) => line.startsWith("n"))?.slice(1);
    const executable = command("/bin/ps", ["-p", String(pid), "-o", "comm="]);
    const args = command("/bin/ps", ["-p", String(pid), "-o", "command="]);
    return cwd && realpathSync(cwd) === realpathSync(harness)
      && path.basename(executable) === "node"
      && (args.includes(` ${entry} `) || args.endsWith(` ${entry}`)
        || /\sruntime\/src\/main\.ts(?:\s|$)/.test(args));
  } catch {
    return false;
  }
}

try {
  if (!handoff || !existsSync(entry)) throw new Error("Expected the character-harness checkout and a session output path.");
  const { loadCharacter, requiredKeys } = await import(pathToFileURL(path.join(harness, "runtime/src/manifest.ts")));
  const manifest = loadCharacter(characterDir);
  process.loadEnvFile(manifest.env_file);
  const missing = requiredKeys(manifest).filter((name) => !process.env[name]);
  if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(", ")}. The old server was left running.`);
  const character = manifest.rig.kind === "profile" ? manifest.rig.profile : undefined;
  if (typeof character !== "string") throw new Error("This lab launcher expects the existing profile-based character rig.");
  const token = process.env.HARNESS_TOKEN;
  if (!token || !/^[A-Za-z0-9_-]+$/.test(token)) throw new Error("Set a stable HARNESS_TOKEN (letters, digits, _ or -) in character-harness/.env before using --restart-server. No settings were overwritten.");
  const port = Number(process.env.PORT || 8788);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be between 1 and 65535.");
  let host = process.env.HARNESS_IOS_HOST;
  if (!host) {
    try { host = `${command("/usr/sbin/scutil", ["--get", "LocalHostName"])}.local`; } catch { /* Fall back to the Wi-Fi address. */ }
  }
  if (!host) {
    try { host = command("/usr/sbin/ipconfig", ["getifaddr", "en0"]); } catch { /* Report the explicit override below. */ }
  }
  if (!host || !/^[A-Za-z0-9.-]+$/.test(host) || host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0") {
    throw new Error("Set HARNESS_IOS_HOST to this Mac's reachable LAN hostname or IPv4 address.");
  }
  const environment = { ...process.env, HOST: "0.0.0.0", PORT: String(port), HARNESS_PLAYER: "" };
  // Catch invalid manifests/extensions before interrupting an existing conversation.
  try {
    execFileSync(process.execPath, [entry, "--check", characterDir], {
      cwd: harness, env: environment, stdio: "pipe", timeout: 60000,
    });
  } catch {
    throw new Error("Harness validation failed. Run npm run check -- characters/foxglove in character-harness; the old server was left running.");
  }
  mkdirSync(cache, { recursive: true, mode: 0o700 });
  try { mkdirSync(lock, { mode: 0o700 }); locked = true; } catch {
    throw new Error(`Another restart is in progress. If an earlier launcher crashed, check it has stopped before removing ${lock}.`);
  }
  const pids = listeners(port);
  if (pids.some((pid) => !isThisHarness(pid))) {
    throw new Error(`Port ${port} belongs to another or unverified process. Stop it yourself or choose PORT; nothing was stopped.`);
  }
  for (const pid of pids) {
    if (!isThisHarness(pid)) throw new Error("The server process changed during inspection; restart cancelled.");
    process.kill(pid, "SIGTERM");
  }
  const stopDeadline = Date.now() + 8000;
  while (listeners(port).length) {
    if (Date.now() >= stopDeadline) throw new Error("The old server did not release its port. No force-kill was used; stop it manually and retry.");
    await delay(200);
  }
  const log = path.join(cache, `${new Date().toISOString().replace(/[:.]/g, "-")}.log`);
  const output = openSync(log, "wx", 0o600);
  let ended = false;
  let startError;
  try {
    child = spawn(process.execPath, [entry, characterDir], {
      cwd: harness, env: environment, detached: true, stdio: ["ignore", output, output],
    });
    child.on("exit", () => { ended = true; });
    child.on("error", (error) => { startError = error; });
  } finally {
    closeSync(output);
  }
  const startDeadline = Date.now() + 45000;
  while (!ready) {
    if (ended || startError || Date.now() >= startDeadline) throw new Error(`The new server did not become ready. Inspect the private runtime log: ${log}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(1000) });
      ready = response.ok && (await response.text()).startsWith(`mutuals character harness: ${manifest.name}.`)
        && listeners(port).includes(child.pid);
    } catch { /* The process is still starting. */ }
    if (!ready) await delay(200);
  }
  const session = { url: `ws://${host}:${port}/session/${token}`, character };
  writeFileSync(handoff, JSON.stringify(session), { mode: 0o600 });
  writeFileSync(path.join(cache, "server.json"), JSON.stringify({ pid: child.pid, port, log }), { mode: 0o600 });
  handedOff = true;
  child.unref();
  console.log(`Conversation server ready (PID ${child.pid}, port ${port}). Latest voice/prompt loaded; previous in-memory history was reset.`);
  console.log(`The server stays running after this script exits. Runtime log: ${log}`);
} catch (error) {
  if (child && !handedOff) {
    try { child.kill("SIGTERM"); } catch { /* Already stopped. */ }
  }
  if (child) child.unref();
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (locked) rmdirSync(lock);
}
