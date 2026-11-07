// Offline native-player compatibility probe; no provider keys or API calls.
import { WebSocketServer } from "ws";
const port = Number(process.env.SMOKE_PORT ?? 18789);
const server = new WebSocketServer({ host: "0.0.0.0", port });
let accepted = false, replied = false, voiced = false, offered = false;
let completed = false;
const deadline = setTimeout(() => { console.error("FAIL: native protocol probe timed out"); process.exit(1); }, 90000);
server.on("connection", (ws, req) => {
  const offers = req.url.endsWith("/offers");
  const send = (message) => ws.send(JSON.stringify(message));
  if (!offers) send({ t: "mode", text: "remote", v: 1 });
  ws.on("message", (data, binary) => {
    if (binary) return;
    const m = JSON.parse(data.toString());
    if (offers && m.t === "status" && m.voice === "idle" && !offered) {
      offered = true;
      send({ t: "offer", id: 1, epoch: m.epoch, text: "Native compatibility probe.", source: "game" });
    }
    if (offers && m.t === "ack" && m.id === 1 && m.accepted) {
      accepted = true; console.log("PASS: native player accepted a service/game offer");
    }
    if (!offers && m.t === "llm") {
      replied = true;
      const entries = [{ role: "assistant", content: "", tool_calls: [{ id: "probe", name: "probe", arguments: "{}" }] },
        { role: "tool", tool_call_id: "probe", content: "ok" }];
      send({ t: "llm_calls", id: m.id, entries });
      send({ t: "llm_delta", id: m.id, text: "Compatibility confirmed." });
      send({ t: "llm_done", id: m.id, entries: [...entries, { role: "assistant", content: "Compatibility confirmed." }] });
      console.log("PASS: offered turn reached the native conversation pipeline");
    }
    if (!offers && m.t === "tts") {
      voiced = true;
      send({ t: "tts_alignment", id: m.id, alignment: { characters: ["a"], character_start_times_seconds: [0], character_end_times_seconds: [0.1] } });
      send({ t: "beat", id: m.id, bt: 0, emotion: "happy", talk: "none", gesture: "wave", camera: "close-up" });
      const pcm = Buffer.alloc(4801); pcm[0] = m.id & 255; ws.send(pcm);
      send({ t: "tts_done", id: m.id });
      console.log("PASS: native player requested speech after tool-result messages");
    }
    if (accepted && replied && voiced && !completed) {
      completed = true;
      clearTimeout(deadline);
      console.log("PASS: offers, tool messages, speech alignment and performance cues delivered");
      setTimeout(() => process.exit(0), 8000);
    }
  });
});
console.log("Native probe listening on port " + port + "; launch with /session/ios-smoke");
