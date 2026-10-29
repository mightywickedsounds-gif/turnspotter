// Turn Spotter Bot Arena: five strategies trade Bitcoin 24/7 with $50 of fake money each (README round 32).
// Runs inside the paper-trading loop on GitHub every ~5 minutes and replays every finished 1-minute Coinbase candle it
// hasn't seen yet. Each bot decides at a minute's close, gets in at the next minute's open, and cashes out at that
// minute's close, Trench-style: x100, 10% of its balance per trade, 1% of the stake as a fee, and a bust if the
// minute's low/high reaches 1% against it. Saves paper/arena.json.
import fs from "node:fs";

const CFG = {start: 50, mult: 100, stakePct: .10, feePct: 1, minStake: 1};
const FILE = new URL("./arena.json", import.meta.url);
const BOTS = {
  scalper:  {name: "Scalper",        desc: "Goes with a strong 3-minute swing (over 2× normal)"},
  fader:    {name: "Streak Fader",   desc: "Bets against 5 same-colour candles in a row"},
  breakout: {name: "Breakout Bro",   desc: "Trades the break of a tight 30-minute range"},
  bull:     {name: "Always Bullish", desc: "Bets UP every 30 minutes, no matter what"},
  flipper:  {name: "Coin Flipper",   desc: "Random direction every 30 minutes: the control"},
};

async function getJSON(url){ const r = await fetch(url, {signal: AbortSignal.timeout(20000)}); if(!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }
// Coinbase's BTC-USD trades every second; Binance US is so thin that many minutes have no trades at all
async function minutes(){
  try{
    const end = Math.floor(Date.now() / 60000) * 60, out = [];
    for(let i = 0; i < 3; i++){ const e2 = end - i * 300 * 60, s = e2 - 300 * 60;
      const d = await getJSON(`https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=60&start=${new Date(s * 1000).toISOString()}&end=${new Date(e2 * 1000).toISOString()}`);
      out.push(...d.map(r => ({t: r[0] * 1000, l: +r[1], h: +r[2], o: +r[3], c: +r[4]}))); }
    const seen = new Set(); return {src: "Coinbase", C: out.filter(k => !seen.has(k.t) && seen.add(k.t)).sort((a, b) => a.t - b.t)};
  }catch(e){
    const d = await getJSON("https://api.binance.us/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=1000");
    return {src: "Binance US", C: d.map(k => ({t: k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4]}))};
  }
}
// a fixed pseudo-random number per minute, so a replayed minute always flips the same way
const rand = t => { let x = Math.floor(t / 60000) * 2654435761 % 4294967296; x ^= x >>> 13; x = Math.imul(x, 1597334677) >>> 0; return (x % 10000) / 10000; };

// what each bot wants to do at the close of candle i: +1 UP, -1 DOWN, 0 nothing
function decide(id, C, i, sd){
  const k = C[i];
  if(id === "scalper"){ if(i < 3 || !(sd > 0)) return 0; const z = Math.log(k.c / C[i - 3].c) / (sd * Math.sqrt(3)); return z > 2 ? 1 : z < -2 ? -1 : 0; }
  if(id === "fader"){ if(i < 5) return 0; const col = j => Math.sign(C[j].c - C[j].o), c0 = col(i);
    if(!c0) return 0; for(let j = i - 4; j <= i; j++) if(col(j) !== c0) return 0;
    return i >= 5 && col(i - 5) === c0 ? 0 : -c0; }   // exactly the 5th in a row, once per streak
  if(id === "breakout"){ if(i < 31) return 0; let hi = -Infinity, lo = Infinity;
    for(let j = i - 30; j < i; j++){ hi = Math.max(hi, C[j].h); lo = Math.min(lo, C[j].l); }
    if((hi - lo) / k.c >= .003) return 0; return k.c > hi ? 1 : k.c < lo ? -1 : 0; }
  const every30 = Math.floor((k.t + 60000) / 60000) % 30 === 0;
  if(id === "bull") return every30 ? 1 : 0;
  if(id === "flipper") return every30 ? (rand(k.t) < .5 ? 1 : -1) : 0;
  return 0;
}

const {src, C} = await minutes();
const now = Date.now(), done = C.filter(k => k.t + 60000 <= now);
if(done.length < 300){ console.log("arena: not enough 1-minute candles"); process.exit(0); }
const L = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8"))
  : {start: CFG.start, startedAt: now, config: CFG, lastT: done.at(-1).t, bots: Object.fromEntries(Object.entries(BOTS).map(([id, b]) =>
      [id, {...b, balance: CFG.start, trades: 0, wins: 0, busts: 0, best: 0, worst: 0, recent: [], equity: [{t: now, v: CFG.start}]}]))};
const before = Object.values(L.bots).map(b => b.trades).join();

// typical 1-minute move over the last 4 hours, for the Scalper
const sdAt = i => { const r = []; for(let j = Math.max(1, i - 239); j <= i; j++){ const x = Math.log(done[j].c / done[j - 1].c); if(x) r.push(x); }
  if(r.length < 30) return NaN; const m = r.reduce((a, b) => a + b, 0) / r.length; return Math.sqrt(r.reduce((a, b) => a + (b - m) ** 2, 0) / (r.length - 1)); };

// replay every minute we haven't seen: decide at candle i's close, trade candle i+1
for(let i = 240; i < done.length - 1; i++){
  if(done[i + 1].t <= L.lastT) continue;   // already replayed
  const sd = sdAt(i), n = done[i + 1];
  for(const [id, b] of Object.entries(L.bots)){
    const dir = decide(id, done, i, sd); if(!dir) continue;
    const stake = +Math.max(CFG.minStake, b.balance * CFG.stakePct).toFixed(2); if(b.balance < stake) continue;
    const worst = dir > 0 ? n.l / n.o - 1 : 1 - n.h / n.o, fee = stake * CFG.feePct / 100;
    const busted = worst <= -1 / CFG.mult;
    const pnl = +((busted ? -stake : Math.max(-stake, stake * CFG.mult * dir * (n.c / n.o - 1))) - fee).toFixed(4);
    b.balance = +(b.balance + pnl).toFixed(4); b.trades++; if(pnl > 0) b.wins++; if(busted) b.busts++;
    b.best = Math.max(b.best, pnl); b.worst = Math.min(b.worst, pnl);
    b.recent.push({t: n.t, dir, pnl, busted}); if(b.recent.length > 20) b.recent.shift();
  }
  L.lastT = n.t;
}
for(const b of Object.values(L.bots)){ b.equity.push({t: now, v: +b.balance.toFixed(2)}); if(b.equity.length > 2500) b.equity.splice(0, b.equity.length - 2500); }
L.lastRun = now; L.price = done.at(-1).c; L.src = src;
fs.writeFileSync(FILE, JSON.stringify(L, null, 1));
if(Object.values(L.bots).map(b => b.trades).join() !== before) console.log("TRADES_CHANGED");
console.log("arena: " + Object.values(L.bots).map(b => `${b.name} $${b.balance.toFixed(2)} (${b.trades})`).join(" | "));
