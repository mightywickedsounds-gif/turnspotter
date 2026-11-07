// Echo: the owner's phone assistant (README round 39). A calm, British-butler style AI voice (Bland, bland.ai) that phones
// the owner with an evening briefing on the paper bots and, outside quiet hours, a short call when something big happens.
// Runs every ~5 minutes inside the meme bot's loop (.github/workflows/meme.yml), after paper/meme.mjs.
//   needs two GitHub Actions secrets: BLAND_API_KEY and MY_PHONE (+1 and ten digits). Without them it does nothing.
//   ECHO_DRY=1 prints what it would say instead of calling.
// Writes only paper/echo.json, which is public (GitHub Pages): it never stores the phone number or call transcripts.
import fs from "node:fs";

const CFG = {
  name:"Echo", owner:"Matt", tz:"America/Chicago",
  voice:"013813f0-e96f-4c55-8c2c-b36a6d4d7916",   // "Max", a warm British voice from Bland's curated list
  briefingAt:"19:30",          // the evening briefing, local time
  quiet:[22, 8],               // no calls from 10 pm to 8 am local time
  maxCallsPerDay:3,            // briefing included
  teamMovePct:5,               // call if the whole meme team is up or down this much today
  bigTradeUsd:5,               // call about any single trade that made or lost this much
  staleMin:60,                 // call (once a day) if the meme bots haven't reported for this long
  briefingMin:3, alertMin:2,   // call length caps (minutes): every minute costs about $0.14
};
const KEY = process.env.BLAND_API_KEY || "", PHONE = process.env.MY_PHONE || "", DRY = process.env.ECHO_DRY === "1";
const F = n => new URL(`./${n}.json`, import.meta.url);
const read = n => { try{ return JSON.parse(fs.readFileSync(F(n), "utf8")); }catch(e){ return null; } };
const now = Date.now();
const local = (() => { const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {timeZone:CFG.tz, year:"numeric", month:"2-digit", day:"2-digit",
  hour:"2-digit", minute:"2-digit", hourCycle:"h23"}).formatToParts(now).map(x => [x.type, x.value]));
  return {date:`${p.year}-${p.month}-${p.day}`, h:+p.hour % 24, m:+p.minute}; })();
const S = read("echo") || {v:1, calls:[], days:{}, seenT:now};
S.days[local.date] = S.days[local.date] || {};
const day = S.days[local.date];
const callsToday = S.calls.filter(c => c.date === local.date).length;
const quiet = local.h >= CFG.quiet[0] || local.h < CFG.quiet[1];
const money = v => `${v >= 0 ? "plus" : "minus"} ${Math.abs(v) < 1 ? `${Math.round(Math.abs(v) * 100)} cents` : `$${Math.abs(v).toFixed(2)}`}`;

async function bland(path, body){
  const r = await fetch(`https://api.bland.ai/v1/${path}`, {method:body ? "POST" : "GET", signal:AbortSignal.timeout(20000),
    headers:{Authorization:`Bearer ${KEY}`, "Content-Type":"application/json"}, body:body ? JSON.stringify(body) : undefined});
  const j = await r.json().catch(() => ({})); if(!r.ok) throw new Error(`Bland ${r.status}: ${JSON.stringify(j.errors || j.message || j).slice(0, 200)}`);
  return j;
}

// ── what's going on: plain-English notes Echo can speak from ──
const M = read("meme"), Tr = read("trend"), A = read("arena");
const notes = [], urgent = [];
if(M && M.bots){
  const team = Object.values(M.bots), today = team.reduce((a, b) => a + (b.day ? b.day.pnl || 0 : 0), 0);
  const startEq = team.reduce((a, b) => a + (b.day ? b.day.startEq || b.start : b.start), 0), pct = startEq ? today / startEq * 100 : 0;
  const total = team.reduce((a, b) => a + (b.value ?? b.cash), 0), start = team.reduce((a, b) => a + b.start, 0);
  const byDay = [...team].sort((a, b) => (b.day ? b.day.pnl || 0 : 0) - (a.day ? a.day.pnl || 0 : 0));
  const n = k => team.filter(b => b.shift === k).length, held = team.reduce((a, b) => a + b.positions.length, 0);
  const closed24 = team.flatMap(b => b.closed.filter(c => now - c.closedAt < 864e5)), won = closed24.filter(c => c.pnl > 0).length;
  const rugs24 = closed24.filter(c => /^rug/.test(c.reason || "")).length;
  notes.push(`The meme coin team: ${team.length} paper-money bots, ${money(today)} today (${pct >= 0 ? "up" : "down"} ${Math.abs(pct).toFixed(1)} percent), $${total.toFixed(2)} in total against $${start.toFixed(0)} at the start.`,
    `Best today: ${byDay[0].name}, ${money(byDay[0].day ? byDay[0].day.pnl || 0 : 0)}. Worst today: ${byDay.at(-1).name}, ${money(byDay.at(-1).day ? byDay.at(-1).day.pnl || 0 : 0)}.`,
    `In the last 24 hours they closed ${closed24.length} trades, ${won} of them winners${rugs24 ? `, and bailed out of ${rugs24} coins that looked like rug pulls` : ""}. They are holding ${held} coins right now.`,
    `Shifts: ${n("on")} on shift${n("locked") ? `, ${n("locked")} locked in their daily goal` : ""}${n("brake") ? `, ${n("brake")} hit the loss brake` : ""}${n("off") ? `, ${n("off")} switched off` : ""}.`);
  if(M.rugStats) notes.push(`The Rug Desk's last scan: ${M.rugStats.passed} coins passed every check and ${M.rugStats.rejected} were rejected.`);
  if(pct >= CFG.teamMovePct && !day.up){ urgent.push(`the meme team is up ${pct.toFixed(1)} percent today, ${money(today)}`); day.up = true; }
  if(pct <= -CFG.teamMovePct && !day.down){ urgent.push(`the meme team is down ${Math.abs(pct).toFixed(1)} percent today, ${money(today)}`); day.down = true; }
  for(const e of (M.tape || []).filter(e => e.t > S.seenT && /^(sell|rug)$/.test(e.kind || ""))){
    const m = /([+-])\$(\d+\.\d+)/.exec(e.txt || ""), v = m ? (m[1] === "-" ? -1 : 1) * +m[2] : 0;
    if(Math.abs(v) >= CFG.bigTradeUsd) urgent.push(`big trade: ${e.txt}`); }
  if(now - M.lastRun > CFG.staleMin * 6e4 && !day.stale){ urgent.push(`the meme bots haven't reported in for ${Math.round((now - M.lastRun) / 6e4)} minutes, so something may be stuck on GitHub`); day.stale = true; }
}
if(Tr){ const h = Object.keys(Tr.holdings || {}); notes.push(`The trend bot is ${h.length ? `holding ${h.join(", ")}` : "in cash, waiting for coins to climb back above their 50-day average"}.`); }
if(A && A.bots){ const best = Object.values(A.bots).sort((a, b) => b.balance - a.balance)[0]; notes.push(`In the Bot Arena, ${best.name} leads with $${best.balance.toFixed(2)}.`); }

// ── the brief Bland's voice follows ──
const brief = kind => `You are ${CFG.name}, ${CFG.owner}'s personal AI assistant and the phone voice of Claude Code, the AI on his computer. You sound like a refined, calm, quietly witty British AI butler: polished, warm, efficient, with a light dry humour. Call him "${CFG.owner}" or now and then "sir". You are an AI, and he knows it.

${kind === "briefing" ? `This is his evening briefing on Turn Spotter, his paper-money trading bots. Give it in under a minute: the team's result today, the best and worst bot, then one line on the rest.` : `This is a short heads-up call about: ${urgent.join("; ")}. Tell him that first, in one or two sentences, then give one line of context from the notes.`}

Notes (the only facts you know; never invent numbers):
${notes.map(x => "- " + x).join("\n")}
- All of this is paper money: no real money is at risk.

If he asks a question, answer in one or two short spoken sentences from the notes. If the notes don't cover it, say you'll leave it for Claude Code on his computer. If he asks you to change something (the bots, the settings, call times), say you'll pass it to Claude Code, which can make the change.
After the update, ask if there's anything else. When he says no, or after about two minutes, say a short, warm goodbye in character and end the call.
Speak naturally, no lists or reading out symbols, round money to the cent, no long dashes.`;
const firstSentence = kind => kind === "briefing"
  ? `Good evening, ${CFG.owner}. ${CFG.name} here, with your Turn Spotter briefing.`
  : `${CFG.owner}, it's ${CFG.name}. Sorry to interrupt, I have a quick heads-up for you.`;

async function call(kind){
  const body = {phone_number:PHONE, task:brief(kind), first_sentence:firstSentence(kind), voice:CFG.voice,
    max_duration:kind === "briefing" ? CFG.briefingMin : CFG.alertMin, wait_for_greeting:true, record:false,
    voicemail:{action:"leave_message", message:kind === "briefing"
      ? `Good evening ${CFG.owner}, it's ${CFG.name}. Your Turn Spotter briefing: ${notes[0] || "the bots are running"} The rest is on the City page. Cheerio.`
      : `${CFG.owner}, it's ${CFG.name} with a quick heads-up: ${urgent.join("; ")}. Details are on the City page.`}};
  if(DRY){ console.log(`\n[dry run] would call (${kind}):\n${body.first_sentence}\n\n${body.task}\n\nvoicemail: ${body.voicemail.message}`); return; }
  const j = await bland("calls", body);
  S.calls.push({t:now, date:local.date, kind, id:j.call_id, about:kind === "briefing" ? "evening briefing" : urgent.join("; ").slice(0, 160)});
  console.log(`Echo: ${kind} call placed`);
}

// ── decide ──
const ready = !!(KEY && PHONE);
let note = "";
const [bh, bm] = CFG.briefingAt.split(":").map(Number);
try{
  // fill in how earlier calls went (answered? price?), never the transcript
  if(ready && !DRY) for(const c of S.calls.filter(c => c.id && !c.done).slice(-3)){
    try{ const d = await bland(`calls/${c.id}`); if(d.completed) Object.assign(c, {done:true, answered:d.answered_by || "unknown", mins:+(+d.call_length || 0).toFixed(1), price:d.price}); }
    catch(e){ console.log("Echo: status check failed:", e.message); } }
  if(!ready && !DRY) note = "not set up: add BLAND_API_KEY and MY_PHONE as GitHub Actions secrets";
  else if(quiet) note = "quiet hours";
  else if(callsToday >= CFG.maxCallsPerDay) note = "daily call limit reached";
  else if(urgent.length){ await call("alert"); note = "alert"; }
  else if(!day.briefing && (local.h > bh || (local.h === bh && local.m >= bm))){ await call("briefing"); day.briefing = true; note = "briefing"; }
  else note = "nothing to call about";
  if(!quiet || !urgent.length) S.seenT = now;   // big trades during quiet hours wait for the morning
}catch(e){ note = "call failed: " + e.message; console.log("Echo:", note); }
if(quiet && urgent.length){ if(urgent.some(u => u.startsWith("the meme team is up"))) day.up = false; if(urgent.some(u => u.startsWith("the meme team is down"))) day.down = false; if(urgent.some(u => u.includes("haven't reported"))) day.stale = false; }
for(const d of Object.keys(S.days).sort().slice(0, -7)) delete S.days[d];
S.calls = S.calls.slice(-30); S.ready = ready; S.lastRun = now; S.lastNote = note; S.config = {...CFG, name:CFG.name};
if(!DRY) fs.writeFileSync(F("echo"), JSON.stringify(S));
console.log(`Echo: ${note} (${local.date} ${String(local.h).padStart(2, "0")}:${String(local.m).padStart(2, "0")} ${CFG.tz})`);
