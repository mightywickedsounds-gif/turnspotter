// Turn Spotter paper trader: simulates Trench.io-style up/down trades with fake money,
// using the exact model code from index.html. Runs every 5 minutes on GitHub's servers
// (.github/workflows/paper-trade.yml keeps one job awake and calls this in a loop) and saves its ledger to paper/ledger.json.
//
// Trench doesn't publish its formulas, so this uses the standard model for these apps:
//   profit = stake x multiplier x price move (in the called direction), minus a fee
//   bust   = lose the whole stake if price moves 1/multiplier against you before expiry
// Realistic since version 2 (README round 24): it buys at the ask and sells at the bid (the real spread at
// the time), checks for a bust on every 1-minute candle, and only acts on calls from closed candles.
import fs from "node:fs";

const CFG = {
  start: 50,            // fake dollars
  stakePct: 0.10,       // risk 10% of the balance per trade
  minStake: 1,
  feeStakePct: 1,       // 1% of the stake per trade (assumed; Trench shows its real fee on the ticket)
  bustBuffer: 3,        // bust price sits 3x the typical move away
  maxMult: 50,
  coins: ["BTC", "ETH", "SOL", "XRP", "DOGE"],
  tf: "15m", tfMin: 15, lookMin: 60, conf: 0.55, need: 2000,   // same as the site's defaults
};
const H = CFG.lookMin / CFG.tfMin;
const LEDGER = new URL("./ledger.json", import.meta.url);

// load the model straight from the website so the simulator and the site can never drift apart
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const logic = html.split("/*LOGIC-START*/")[1].split("/*LOGIC-END*/")[0];
const { analyze } = new Function(`${logic}; return { analyze };`)();

async function getJSON(url){ const r = await fetch(url, {signal:AbortSignal.timeout(20000)});   // never hang on a stuck request
  if(!r.ok) throw new Error(`HTTP ${r.status} ${url}`); return r.json(); }
async function binanceUS(coin){
  let out = [], end = null;
  while(out.length < CFG.need){
    const lim = Math.min(1000, CFG.need - out.length);
    const d = await getJSON(`https://api.binance.us/api/v3/klines?symbol=${coin}USDT&interval=${CFG.tf}&limit=${lim}` + (end ? `&endTime=${end}` : ""));
    if(!d.length) break;
    const c = d.map(k => ({t:k[0], o:+k[1], h:+k[2], l:+k[3], c:+k[4], v:+k[5]}));
    out = c.concat(out); end = c[0].t - 1;
    if(d.length < lim) break;
  }
  return out;
}
async function coinbase(coin){
  const g = CFG.tfMin * 60; let end = Math.floor(Date.now()/1000), out = [];
  for(let i=0; i<8 && out.length < CFG.need; i++){
    const start = end - 300*g;
    const d = await getJSON(`https://api.exchange.coinbase.com/products/${coin}-USD/candles?granularity=${g}&start=${new Date(start*1000).toISOString()}&end=${new Date(end*1000).toISOString()}`);
    if(!d.length) break;
    out = d.map(r => ({t:r[0]*1000, l:+r[1], h:+r[2], o:+r[3], c:+r[4], v:+r[5]})).sort((a,b)=>a.t-b.t).concat(out); end = start;
  }
  const seen = new Set(); return out.filter(k => !seen.has(k.t) && seen.add(k.t)).sort((a,b)=>a.t-b.t);
}
async function candles(coin){
  const closed = c => c.filter(k => k.t + CFG.tfMin * 60000 <= Date.now());   // only finished candles
  try{ const c = await binanceUS(coin); if(c.length > 500) return {c:closed(c), src:"Binance US"}; }catch(e){ console.log(coin, "Binance US failed:", e.message); }
  return {c:closed(await coinbase(coin)), src:"Coinbase"};
}
// the live best bid and ask, from the same exchange as the candles
async function book(coin, src){
  try{
    if(src === "Binance US"){ const b = await getJSON(`https://api.binance.us/api/v3/ticker/bookTicker?symbol=${coin}USDT`); return {bid:+b.bidPrice, ask:+b.askPrice}; }
    const b = await getJSON(`https://api.exchange.coinbase.com/products/${coin}-USD/ticker`); return {bid:+b.bid, ask:+b.ask};
  }catch(e){ return null; }
}
// 1-minute candles from `from` to `to`, to check for a bust minute by minute
async function minutes(coin, src, from, to){
  try{
    if(src === "Binance US"){ const d = await getJSON(`https://api.binance.us/api/v3/klines?symbol=${coin}USDT&interval=1m&startTime=${from}&endTime=${to}&limit=1000`);
      return d.map(k => ({t:k[0], o:+k[1], h:+k[2], l:+k[3], c:+k[4]})); }
    const d = await getJSON(`https://api.exchange.coinbase.com/products/${coin}-USD/candles?granularity=60&start=${new Date(from).toISOString()}&end=${new Date(to).toISOString()}`);
    return d.map(r => ({t:r[0]*1000, l:+r[1], h:+r[2], o:+r[3], c:+r[4]})).sort((a,b) => a.t - b.t);
  }catch(e){ return null; }
}

// version 1 (no spread, 15-minute bust checks) is archived in ledger-v1.json; anything older than version 2 starts fresh
const old = fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, "utf8")) : null;
const L = old && old.version >= 2 ? old
  : {version: 2, start: CFG.start, balance: CFG.start, startedAt: Date.now(), trades: [], equity: [], config: CFG};
const now = Date.now(), before = L.trades.map(t => t.status).join();
L.status = {};   // per-coin snapshot: why it is or isn't trading right now

for(const coin of CFG.coins){
  let data;
  try{ data = await candles(coin); }catch(e){ console.log(coin, "no data:", e.message); continue; }
  const C = data.c; if(C.length < 500) continue;

  // 1) settle open trades: a bust on any 1-minute candle, otherwise close when the hour is up
  for(const t of L.trades.filter(t => t.coin === coin && t.status === "open")){
    const M = await minutes(coin, data.src, t.openedAt, Math.min(now, t.expiresAt)); if(!M) continue;
    const hit = M.find(k => k.t + 60000 > t.openedAt && k.t < t.expiresAt && (t.dir > 0 ? k.l <= t.bustPrice : k.h >= t.bustPrice));
    if(hit){ Object.assign(t, {status:"busted", exitPrice:t.bustPrice, pnl:-t.stake, closedAt:Math.max(hit.t, t.openedAt)}); }
    else if(now >= t.expiresAt){
      // sell at the bid (or buy back at the ask) if we're on time; if the job was late, use the price at expiry minus half the spread
      const b = now - t.expiresAt < 10 * 60000 ? await book(coin, data.src) : null, half = (t.spread || 0) / 2;
      const atEnd = (await minutes(coin, data.src, t.expiresAt, t.expiresAt + 5 * 60000) || [])[0];
      const exit = b ? (t.dir > 0 ? b.bid : b.ask) : atEnd ? atEnd.o * (1 - t.dir * half) : C[C.length-1].c * (1 - t.dir * half);
      const move = t.dir * (exit / t.entry - 1);
      const pnl = Math.max(-t.stake, t.stake * t.mult * move - t.fee);
      Object.assign(t, {status: pnl > 0 ? "won" : "lost", exitPrice: exit, pnl: +pnl.toFixed(4), closedAt: t.expiresAt});
    }
    if(t.status !== "open"){ L.balance = +(L.balance + t.stake + t.pnl).toFixed(4); console.log("closed", coin, t.status, t.pnl); }
  }

  // 2) open a trade on a fresh call (made on the last closed candle or the one before)
  if(L.trades.some(t => t.coin === coin && t.status === "open")) continue;
  const A = analyze(C, Math.round(1440 / CFG.tfMin), H, CFG.conf, new Map());
  const n = C.length, fresh = A.sigs.filter(s => s.i >= n - 2).pop();   // a call on the last closed candle (or the one before, if a check was missed)
  { const q = A.P[n-1], last = A.P.slice(n-400).filter(Boolean), share = f => +(last.filter(f).length / last.length).toFixed(3);
    const done = A.sigs.filter(s => s.win !== undefined);
    L.status[coin] = {src: data.src, candles: n, price: C[n-1].c, experience: +q.exp.toFixed(3), liveLearner: +q.trend.toFixed(3),
      record: isNaN(q.record) ? null : +q.record.toFixed(3), call: q.modelUp ? "UP" : q.modelDown ? "DOWN" : "WAIT",
      // over the last 400 candles (~4 days): how often a call was on
      last400: {call: share(p => p.modelUp || p.modelDown), bounceOrRollover: share(p => p.up || p.down)},
      backtest: {calls: done.length, right: done.length ? +(done.filter(s => s.win).length / done.length).toFixed(3) : null}}; }
  if(!fresh) continue;
  const p = A.P[n-1] || A.P[fresh.i];
  const stake = +Math.max(CFG.minStake, L.balance * CFG.stakePct).toFixed(2);
  if(L.balance < stake) continue;
  const move = isNaN(p.move) ? 0.01 : p.move;
  const mult = Math.max(1, Math.min(CFG.maxMult, Math.floor(1 / (CFG.bustBuffer * move))));
  const b = await book(coin, data.src); if(!b || !(b.ask > b.bid)) continue;
  const entry = fresh.dir > 0 ? b.ask : b.bid, spread = (b.ask - b.bid) / ((b.ask + b.bid) / 2);   // pay the real spread
  const fee = +(stake * CFG.feeStakePct / 100).toFixed(4);
  L.balance = +(L.balance - stake).toFixed(4);
  L.trades.push({id: `${coin}-${now}`, coin, dir: fresh.dir, entry, spread: +spread.toFixed(6), stake, mult, fee,
    bustPrice: +(entry * (1 - fresh.dir / mult)).toPrecision(8), openedAt: now, expiresAt: now + CFG.lookMin*60000,
    experience: +p.exp.toFixed(3), source: data.src, status: "open"});
  console.log("opened", coin, fresh.dir > 0 ? "UP" : "DOWN", `$${stake} x${mult} @ ${entry}`);
}

const openStake = L.trades.filter(t => t.status === "open").reduce((s,t) => s + t.stake, 0);
L.equity.push({t: now, value: +(L.balance + openStake).toFixed(2)});
if(L.equity.length > 3000) L.equity.splice(0, L.equity.length - 3000);
L.lastRun = now;
fs.writeFileSync(LEDGER, JSON.stringify(L, null, 1));
if(L.trades.map(t => t.status).join() !== before) console.log("TRADES_CHANGED");   // the workflow saves right away when a trade opens or closes
const closed = L.trades.filter(t => t.status !== "open");
console.log(`balance $${L.balance.toFixed(2)} + $${openStake.toFixed(2)} in open trades | ${closed.length} closed, ${closed.filter(t => t.pnl > 0).length} won`);
