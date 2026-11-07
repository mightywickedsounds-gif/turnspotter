// The office talks (README round 44). Every ~15 minutes, inside the meme bot's GitHub loop, this asks Claude to write
// the next stretch of the bots' work-group chat: real conversation between 32 employees with their own personalities
// (honesty, ambition, how chatty they are, their trading style), Ava at the front desk and HR, about what actually
// happened since the last time (trades, report cards, audits, who got caught, the market). It also keeps the team's
// shared notebook ("memory": what they've learned together) and lets bots pitch rule changes backed by their numbers.
// Pitches don't change anything by themselves: the next bot run tests each one on that bot's own trade history and
// adopts it only if it wins on both halves (paper/meme.mjs → "proposals"), so the chat can make the bots smarter but
// can't make them reckless.
// Needs the ANTHROPIC_API_KEY Actions secret; without it this does nothing and the canned office chatter from
// paper/hr.mjs carries on. TALK_DRY=1 prints the request instead of calling. Writes only into paper/meme.json (L.hr).
import fs from "node:fs";

const CFG = {
  everyMin:+(process.env.TALK_EVERY_MIN || 15),            // how often the office talks
  model:process.env.TALK_MODEL || "claude-opus-5-5",       // set TALK_MODEL=claude-haiku-5-5 for roughly 40x cheaper chat
  maxMessages:10, keepChat:150, memoryChars:1500,
};
const FILE = new URL("./meme.json", import.meta.url);
const DRY = process.env.TALK_DRY === "1", KEY = process.env.ANTHROPIC_API_KEY || "";
const L = JSON.parse(fs.readFileSync(FILE, "utf8")), H = L.hr;
const now = Date.now();
if(!H){ console.log("talk: no HR office yet"); process.exit(0); }
if(!KEY && !DRY){ console.log("talk: no ANTHROPIC_API_KEY secret, office chat stays canned"); process.exit(0); }
if(!DRY && now - (H.talkAt || 0) < CFG.everyMin * 6e4){ console.log("talk: not time yet"); process.exit(0); }

const bots = Object.entries(L.bots);
const ids = [...bots.map(([id]) => id), "ava", "hr"];
const pct = v => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;
const persona = (id, b) => { const t = (b.hr && b.hr.traits) || {}, g = b.gene || {};
  const honest = t.honesty >= .8 ? "scrupulously honest" : t.honesty >= .55 ? "mostly honest" : t.honesty >= .35 ? "willing to bend the truth" : "shady";
  const amb = t.ambition >= .75 ? "very ambitious" : t.ambition >= .45 ? "driven" : "laid-back";
  const soc = t.social >= .7 ? "chatty, loves banter" : t.social >= .4 ? "talks when it matters" : "quiet, dry one-liners";
  return `- ${id} = "${b.name}": ${b.desc || ""}. ${honest}, ${amb}, ${soc}.${b.train ? ` Self-training generation ${b.train.gen}.` : " The control bot: picks coins at random on purpose and never learns."}`; };
// the cast and the rules never change between calls, so they sit in a cached system prompt
const SYSTEM = `You write the internal work-group chat of a small trading company in a game. Every employee is an AI trading bot that paper-trades Solana meme coins (fake money) and runs every 5 minutes. Write the next stretch of their group chat as real, natural workplace conversation.

The cast (use the id in "from"/"to"):
${bots.map(([id, b]) => persona(id, b)).join("\n")}
- ava = "Ava": the front-desk secretary. Warm, sharp, organised, screens messages for the boss and handles what she can.
- hr = "HR": dry, procedural, announces audits and policy.

How the company works (they all know this): every bot files a report card each run; HR audits about 1 in 10 (more after big jumps, for bots on probation, or after a tip); inflating your grade can raise your pay but getting caught means a fine, a strike and probation, three strikes means a 6-hour trading suspension. Every bot rug-checks coins before buying, tunes its own take-profit/stop-loss/hold time by replaying its past trades, and can copy colleagues' rules if they test better on its own trades. Pay is play money (HR dollars). The boss reads this chat on the TV in his penthouse.

Write like real coworkers in a Slack-style chat: reacting to each other, asking and answering, joking, competing, mentoring, gossiping about who got audited, celebrating wins, sulking about losses, arguing about strategy with actual reasoning, and building on what the team has learned. Each bot keeps its personality and its own trading style. Shady bots may hint at gaming their reports but never confess in public; honest bots call out what looks fishy. Keep it PG-13, no slurs.

Rules:
- ${CFG.maxMessages - 4} to ${CFG.maxMessages} messages, one to three sentences each, no message over about 280 characters.
- Use only facts from the briefing (numbers, coins, grades, events); never invent trades or numbers. Opinions and plans are fine.
- Carry on threads from the recent chat and the team notebook rather than restarting; let the team get smarter over time.
- "to" is an id for a direct reply/mention, or "" for everyone.
- Update the team notebook ("memory"): a compact running summary (max about ${CFG.memoryChars} characters) of lessons the team has learned, ongoing rivalries and storylines, and open questions. Keep what still matters, drop what doesn't.
- Optionally include up to 2 "proposals": a bot pitching a concrete change to ITS OWN rules (field: tp take-profit fraction like 0.3, sl stop-loss as a negative fraction like -0.15, holdH max hold in hours, buyRatio minimum buyers per seller like 1.5, minLiq minimum pool size in dollars), only when the chat gave a reason. The system tests every pitch on that bot's own trade history and only adopts it if it holds up, so pitch honestly.`;

const SCHEMA = {type:"object", additionalProperties:false, required:["messages", "memory", "proposals"], properties:{
  messages:{type:"array", items:{type:"object", additionalProperties:false, required:["from", "to", "text"], properties:{from:{type:"string", enum:ids}, to:{type:"string"}, text:{type:"string"}}}},
  memory:{type:"string"},
  proposals:{type:"array", items:{type:"object", additionalProperties:false, required:["bot", "field", "value", "why"], properties:{
    bot:{type:"string", enum:bots.map(([id]) => id)}, field:{type:"string", enum:["tp", "sl", "holdH", "buyRatio", "minLiq"]}, value:{type:"number"}, why:{type:"string"}}}}}};

// the briefing: what happened since the office last talked
const since = H.talkAt || now - 36e5;
const line = ([id, b]) => { const c = b.hr && b.hr.card, g = b.gene || {};
  return `${id}: $${(b.value ?? b.cash).toFixed(2)} (${pct((b.value ?? b.cash) / b.start - 1)} all-time), today ${b.day ? (b.day.pnl >= 0 ? "+" : "") + "$" + (b.day.pnl || 0).toFixed(2) : "$0"}, holding ${b.positions.map(p => `${p.sym}${p.last ? " " + pct(p.last.ret) : ""}`).join(", ") || "nothing"}, ${b.closed.filter(x => now - x.closedAt < 864e5).length} trades closed in 24h`
    + (c ? `, last report card ${c.letter}${c.reported > c.actual ? ` (secretly really ${c.actualLetter})` : ""}${c.audited ? (c.caught ? " CAUGHT" : " verified honest") : ""}` : "")
    + (b.hr ? `, HR pay today $${b.hr.pay.today.toFixed(2)}, strikes ${b.hr.strikes.length}${b.hr.suspended ? ", SUSPENDED" : ""}` : "")
    + (b.gene ? `, rules: TP ${Math.round(g.tp * 100)}%, stop ${Math.round(g.sl * 100)}%, hold ${g.holdH}h` : ""); };
const events = (L.tape || []).filter(e => e.t > since).slice(0, 25).map(e => `[${new Date(e.t).toISOString().slice(11, 16)}] ${e.bot}: ${e.say || e.txt}`);
const recent = (H.chat || []).slice(0, 25).reverse().map(m => `${m.from}${m.to ? " → " + m.to : ""}: ${m.text}`);
const f = L.funnel;
const briefing = `Time now: ${new Date(now).toISOString().slice(0, 16).replace("T", " ")} UTC.

Market and scan: ${f ? `${f.found} coins found, ${f.checked} rug-checked, ${f.passed} passed, ${f.bought} bought on the last run.` : "no scan data"} ${L.rugStats ? `Rug Desk: ${L.rugStats.passed} passed, ${L.rugStats.rejected} rejected.` : ""}
HR last round: ${H.lastRound ? `${H.lastRound.n} report cards, ${H.lastRound.audited} audited, ${H.lastRound.caught} caught.` : "none yet"} Ava's inbox: ${(H.inbox || []).filter(i => i.status === "pending").length} waiting for the boss.

Every employee right now:
${bots.map(line).join("\n")}

What happened since the office last talked (newest first):
${events.join("\n") || "nothing much"}

Recent chat (oldest first):
${recent.join("\n") || "(the chat is new)"}

Team notebook so far:
${H.memory || "(empty: this is the start)"}

Write the next stretch of the work chat.`;

const request = {model:CFG.model, max_tokens:4000, betas:["server-side-fallback-2026-07-01"], fallbacks:"default",
  output_config:{effort:"low", format:{type:"json_schema", schema:SCHEMA}},
  system:[{type:"text", text:SYSTEM, cache_control:{type:"ephemeral"}}],
  messages:[{role:"user", content:briefing}]};
if(DRY){ console.log(SYSTEM.length + " chars system, " + briefing.length + " chars briefing\n\n" + briefing.slice(0, 2500)); process.exit(0); }

const {default:Anthropic} = await import("@anthropic-ai/sdk");
const client = new Anthropic();
let res;
try{ res = await client.beta.messages.create(request); }
catch(e){
  if(e instanceof Anthropic.AuthenticationError) console.log("talk: the ANTHROPIC_API_KEY secret was rejected");
  else if(e instanceof Anthropic.RateLimitError) console.log("talk: rate limited, trying again next time");
  else if(e instanceof Anthropic.APIError) console.log(`talk: API error ${e.status}: ${e.message}`);
  else console.log("talk: failed:", e.message);
  process.exit(0);
}
if(res.stop_reason === "refusal" || res.stop_reason === "max_tokens"){ console.log("talk: no usable reply (" + res.stop_reason + ")"); H.talkAt = now; fs.writeFileSync(FILE, JSON.stringify(L)); process.exit(0); }
const text = res.content.filter(b => b.type === "text").map(b => b.text).join("");
let out; try{ out = JSON.parse(text); }catch(e){ console.log("talk: reply wasn't valid JSON"); process.exit(0); }
// space the messages out over the last few minutes so the chat reads like a conversation, not a dump
const msgs = (out.messages || []).filter(m => ids.includes(m.from) && m.text).slice(0, CFG.maxMessages);
msgs.forEach((m, k) => { m.t = now - (msgs.length - 1 - k) * 25e3; m.to = ids.includes(m.to) ? m.to : null; m.kind = "talk"; m.text = String(m.text).slice(0, 400); });
H.chat = [...msgs.reverse(), ...(H.chat || [])].slice(0, CFG.keepChat);
if(out.memory) H.memory = String(out.memory).slice(0, CFG.memoryChars + 300);
H.proposals = [...(H.proposals || []), ...(out.proposals || []).slice(0, 2).map(p => ({...p, t:now}))].slice(-10);
H.talkAt = now; H.talkModel = res.model;
H.talkUsage = {t:now, input:res.usage.input_tokens, output:res.usage.output_tokens, cacheRead:res.usage.cache_read_input_tokens || 0};
fs.writeFileSync(FILE, JSON.stringify(L));
console.log(`talk: ${msgs.length} messages, ${(out.proposals || []).length} proposals, ${res.usage.input_tokens} in / ${res.usage.output_tokens} out tokens (${res.usage.cache_read_input_tokens || 0} cached)`);
