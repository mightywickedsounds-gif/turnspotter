// Round 24: would the 24/7 paper bot's rules make money with realistic costs?
// Replays the paper bot on the days the Experience brain never trained on (EXPERIENCE.unseenFrom onward),
// using the exact model code from index.html:
//   - a call counts only once its 15-minute candle has closed; the bot gets in up to 5 minutes later
//     (its check-in loop), at the 1-minute open plus half the bid/ask spread
//   - busts are checked on every 1-minute candle's high/low while the trade is open
//   - exit at the 1-minute open when the hour is up, minus half the spread, and a 1% fee on the stake
// Usage: node research/paper_backtest.mjs
import fs from "node:fs";
import zlib from "node:zlib";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const logic = html.split("/*LOGIC-START*/")[1].split("/*LOGIC-END*/")[0];
const { analyze } = new Function(`${logic}; return { analyze };`)();
const unseenFrom = JSON.parse(html.split("const EXPERIENCE = ")[1].split(";\n/*MODEL-END*/")[0]).unseenFrom;

const read = f => zlib.gunzipSync(fs.readFileSync(new URL(`./data/${f}`, import.meta.url))).toString().trim().split("\n").slice(1)
  .map(r => { const a = r.split(","); return {t:+a[0] * 1000, o:+a[1], h:+a[2], l:+a[3], c:+a[4], v:+a[5]}; });
const COINS = ["BTC", "ETH", "SOL", "XRP", "DOGE"];
// typical Binance US bid/ask spread (fraction of price); alts are thinner there
const SPREAD = {BTC:.0002, ETH:.0003, SOL:.0006, XRP:.0006, DOGE:.0008};

const D = {};
for(const c of COINS){
  const q = read(`${c}USDT_15m.csv.gz`), m = read(`${c}USDT_1m.csv.gz`);
  const from = Math.max(unseenFrom, m[0].t);
  const i0 = q.findIndex(k => k.t >= from - 2500 * 900e3);
  const C = q.slice(i0), A = analyze(C, 96, 4, .55, new Map());
  D[c] = {C, A, m1:new Map(m.map(k => [k.t, k])), from, to:m.at(-1).t};
}

function run({mult:maxMult = 50, stakePct = .10, buffer = 3, costs = true, delayMin = 5, holdMin = 60} = {}){
  // every call on every coin, in time order
  const ev = [];
  for(const c of COINS){ const {C, A, from, to} = D[c];
    for(const s of A.sigs){ const at = C[s.i].t + 900e3 + delayMin * 60e3; if(at >= from && at + holdMin * 60e3 < to) ev.push({c, s, at, p:A.P[s.i]}); } }
  ev.sort((a, b) => a.at - b.at);
  let bal = 50, peak = 50, maxDD = 0; const open = [], done = [], moves = [];
  const settle = upTo => {
    for(let j = open.length - 1; j >= 0; j--){ const t = open[j]; if(t.end > upTo) continue;
      bal += t.stake + t.pnl; open.splice(j, 1); done.push(t);
      const eq = bal + open.reduce((s, x) => s + x.stake, 0); peak = Math.max(peak, eq); maxDD = Math.max(maxDD, 1 - eq / peak); } };
  for(const e of ev){
    settle(e.at);
    if(open.some(t => t.c === e.c)) continue;
    const m = D[e.c].m1, k0 = m.get(Math.floor(e.at / 60e3) * 60e3); if(!k0) continue;
    const half = costs ? SPREAD[e.c] / 2 : 0, d = e.s.dir;
    const stake = Math.max(1, bal * stakePct); if(bal < stake) continue;
    const move = isNaN(e.p.move) ? .01 : e.p.move, mult = Math.max(1, Math.min(maxMult, Math.floor(1 / (buffer * move))));
    const entry = k0.o * (1 + d * half), bust = entry * (1 - d / mult), end = k0.t + holdMin * 60e3;
    let pnl = null; const ke0 = m.get(end) || m.get(end - 60e3); if(ke0) moves.push(d * (ke0.o * (1 - d * half) / entry - 1));
    for(let t = k0.t; t < end; t += 60e3){ const k = m.get(t); if(!k) continue;
      if(d > 0 ? k.l <= bust : k.h >= bust){ pnl = -stake; break; } }
    const fee = costs ? stake * .01 : 0;
    if(pnl === null){ const ke = m.get(end) || m.get(end - 60e3); if(!ke) continue;
      const exit = ke.o * (1 - d * half); pnl = Math.max(-stake, stake * mult * d * (exit / entry - 1)) - fee; }
    else pnl -= fee;
    bal -= stake; open.push({c:e.c, stake, pnl, end, busted:pnl <= -stake});
  }
  settle(Infinity);
  const won = done.filter(t => t.pnl > 0).length;
  return {final:+bal.toFixed(2), trades:done.length, winPct:+(100 * won / done.length).toFixed(1), busts:done.filter(t => t.busted).length, avgMoveBps:+(1e4 * moves.reduce((a, b) => a + b, 0) / moves.length).toFixed(2), maxDD:+(100 * maxDD).toFixed(1)};
}

const days = ((Math.min(...COINS.map(c => D[c].to)) - Math.max(...COINS.map(c => D[c].from))) / 864e5).toFixed(1);
console.log(`Unseen days replayed: ${days} (from ${new Date(Math.max(...COINS.map(c => D[c].from))).toISOString().slice(0, 10)}), $50 start`);
const rows = {
  "paper bot as it ran (no costs, x50 cap)": run({costs:false}),
  "paper bot with realistic costs (x50 cap)": run(),
  "realistic, x20 cap": run({mult:20}),
  "realistic, x10 cap": run({mult:10}),
  "realistic, x50 cap, 5% stakes": run({stakePct:.05}),
  "realistic, x50 cap, 20% stakes": run({stakePct:.20}),
  "realistic, enter 10 min late": run({delayMin:10}),
};
console.table(rows);
