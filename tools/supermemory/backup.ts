import { backup } from "node:sqlite";
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { config, credentials } from "../../extensions/supermemory/config.ts";
import { Store } from "../../extensions/supermemory/store.ts";

// The independently retained deletion ledger is intentionally NOT in the backup.
// Stop all memory processes before restore. This command refuses an active lease.
const [mode, configFile, envFile, archiveFile] = process.argv.slice(2);
if (!["create", "restore"].includes(mode) || !configFile || !envFile || !archiveFile) throw new Error("Usage: backup.ts <create|restore> <config.yaml> <.env> <archive>");
process.loadEnvFile(path.resolve(envFile));
const c = config(parse(readFileSync(configFile, "utf8")));
const { encryptionKey } = credentials(c);
if (mode === "restore" && !existsSync(path.join(c.dir, "deletions.jsonl"))) throw new Error("Restore requires the independently retained deletion ledger");
const store = new Store(c.dir, encryptionKey);
const tmp = path.join(c.dir, `backup-${process.pid}.sqlite`);
let closed = false;
try {
	if (mode === "create") {
		await backup(store.db, tmp);
		writeFileSync(archiveFile, store.seal({ version: 1, sqlite: readFileSync(tmp).toString("base64") }) + "\n", { mode: 0o600, flag: "wx" });
	} else {
		const lease = store.db.prepare("SELECT expires FROM leases WHERE id=1").get() as { expires: number } | undefined;
		if (lease && lease.expires > Date.now()) throw new Error("Stop the runtime/worker and wait for its lease before restoring");
		if (!existsSync(path.join(c.dir, "deletions.jsonl"))) throw new Error("Restore requires the independently retained deletion ledger, including an empty ledger for a new store");
		const archive = store.open<{ version: number; sqlite: string }>(readFileSync(archiveFile, "utf8").trim());
		if (archive.version !== 1) throw new Error("Unsupported backup format");
		writeFileSync(tmp, Buffer.from(archive.sqlite, "base64"), { mode: 0o600, flag: "wx" });
		store.close(); closed = true;
		for (const suffix of ["-wal", "-shm"]) rmSync(store.file + suffix, { force: true });
		renameSync(tmp, store.file);
		// Opening applies current deletion barriers to the older snapshot, purging
		// restored personal data for relationships erased since the backup.
		const restored = new Store(c.dir, encryptionKey);
		restored.db.prepare("DELETE FROM leases").run();
		restored.close();
	}
	console.log(mode === "create" ? "Encrypted backup created. Retain the deletion ledger independently." : "Backup restored with current deletion barriers; affected relationships remain paused.");
} finally { rmSync(tmp, { force: true }); if (!closed) store.close(); }
