// Turn Spotter trend bot: $50 of fake money, plain spot buying (no leverage), five coins.
// Once a day, after the daily candle closes at 00:00 UTC, it holds each coin whose price closed above its
// 50-day average and keeps the rest in cash. Each coin gets a fifth of the money when it's bought.
// Tested on 2023-07..2026-10 daily candles in research/experiments8.py (README round 24).
// It pays the live spread (buys at the ask, sells at the bid) and a 0.1% exchange fee on every buy and sell.
// Runs inside the same GitHub loop as paper/trader.mjs and saves paper/trend.json.
import fs from "node:fs";

const CFG = {start: 50, coins: ["BTC", "ETH", "SOL", "XRP", "DOGE"], avgDays: 50, feePct: 0.1};
const FILE = new URL("./trend.json", import.meta.url);
const DAY = 86400000;

async function getJSON(url){ const r = await fetch(url); if(!r.ok) throw new Error(`HTTP ${r.status} ${url}`); return r.json(); }
async function daily(coin){
  try{ const d = await getJSON(`https://api.binance.us/api/v3/klines?symbol=${coin}USDT&interval=1d&limit=${CFG.avgDays + 10}`);
    return {src:"Binance US", c:d.map(k => ({t:k[0], c:+k[4]}))}; }
  catch(e){ const d = await getJSON(`https://api.exchange.coinbase.com/products/${coin}-USD/candles?granularity=86400`);
    return {src:"Coinbase", c:d.map(r => ({t:r[0] * 1000, c:+r[4]})).sort((a, b) => a.t - b.t)}; }
}
async function book(coin, src){
  if(src === "Binance US"){ const b = await getJSON(`https://api.binance.us/api/v3/ticker/bookTicker?symbol=${coin}USDT`); return {bid:+b.bidPrice, ask:+b.askPrice}; }
  const b = await getJSON(`https://api.exchange.coinbase.com/products/${coin}-USD/ticker`); return {bid:+b.bid, ask:+b.ask};
}

const L = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8"))
  : {start: CFG.start, cash: CFG.start, startedAt: Date.now(), holdings: {}, trades: [], equity: [], lastDay: null, status: {}, config: CFG};
const now = Date.now(), today = Math.floor(now / DAY) * DAY, before = JSON.stringify(L.holdings);
const info = {};
for(const coin of CFG.coins){
  try{
    const d = await daily(coin), closed = d.c.filter(k => k.t + DAY <= now);
    if(closed.length < CFG.avgDays) continue;
    const last = closed.slice(-CFG.avgDays), avg = last.reduce((s, k) => s + k.c, 0) / last.length, close = last.at(-1).c;
    info[coin] = {src:d.src, up:close > avg, close, avg, b:await book(coin, d.src)};
    L.status[coin] = {close, avg50: +avg.toPrecision(6), trend: close > avg ? "UP" : "DOWN", bid: info[coin].b.bid, ask: info[coin].b.ask};
  }catch(e){ console.log(coin, "no data:", e.message); }
}
const value = () => L.cash + Object.entries(L.holdings).reduce((s, [c, h]) => s + h.qty * (info[c] ? info[c].b.bid : h.entry), 0);

// once per day: sell what fell below its average, then buy what's above it
if(L.lastDay !== today && Object.keys(info).length === CFG.coins.length){
  for(const [coin, h] of Object.entries(L.holdings)){
    if(info[coin].up) continue;
    const px = info[coin].b.bid, gross = h.qty * px, fee = gross * CFG.feePct / 100;
    L.cash += gross - fee; delete L.holdings[coin];
    L.trades.push({t:now, coin, side:"sell", price:px, qty:h.qty, fee:+fee.toFixed(4), pnl:+(gross - fee - h.cost).toFixed(4)});
    console.log("sold", coin, px);
  }
  const slot = value() / CFG.coins.length;
  for(const coin of CFG.coins){
    if(!info[coin].up || L.holdings[coin]) continue;
    const spend = Math.min(slot, L.cash); if(spend < 1) continue;
    const px = info[coin].b.ask, fee = spend * CFG.feePct / 100, qty = (spend - fee) / px;
    L.cash -= spend; L.holdings[coin] = {qty, entry:px, cost:spend, at:now};
    L.trades.push({t:now, coin, side:"buy", price:px, qty, fee:+fee.toFixed(4)});
    console.log("bought", coin, px);
  }
  L.lastDay = today;
}
if(Object.keys(info).length){ L.equity.push({t:now, value:+value().toFixed(2)}); if(L.equity.length > 3000) L.equity.splice(0, L.equity.length - 3000); }
L.cash = +L.cash.toFixed(4); L.lastRun = now;
fs.writeFileSync(FILE, JSON.stringify(L, null, 1));
if(JSON.stringify(L.holdings) !== before) console.log("TRADES_CHANGED");
console.log(`trend bot: $${value().toFixed(2)} (cash $${L.cash.toFixed(2)}, holding ${Object.keys(L.holdings).join(", ") || "nothing"})`);
