// Turn Spotter meme-coin paper bot (README round 34). Runs every ~5 minutes on GitHub (.github/workflows/meme.yml):
//   1. finds trending Solana meme coins on DexScreener (boosted + newest profiles)
//   2. runs the rug-pull checklist from index.html (the same code the Meme tab uses) on each coin's RugCheck report
//   3. paper-trades $50 of fake money: buys only coins that pass EVERY critical check, have no warnings, and are
//      moving up (1h > +3%, 6h > 0, more buys than sells in the last hour) without already being a vertical pump
// Realistic costs: 1% swap fee each way plus price impact from the pool's size (a constant-product pool).
// Exits: +40% take profit, -20% stop, 24 h max hold, or a rug sign (pool drained by 60%+, checks now failing,
// coin gone from DexScreener). Prices are checked every ~5 minutes, so exits happen at the price seen then,
// not at the exact stop level: real rugs can happen faster than that.
// Writes only paper/meme.json. Phone alerts go to ntfy.sh when NTFY_TOPIC is set.
import fs from "node:fs";

const CFG = {start:50, stakePct:.10, minStake:2, maxOpen:4, feePct:1, tp:.40, sl:-.20, maxHoldH:24, cooldownH:24,
  momentum:{h1:3, h6:0},
  maxPump:{h1:50, h6:300},   // skip vertical pumps: buying the top makes you exit liquidity
  reportsPerRun:12, reportTtlMin:30, rugLiqDrop:.60};
const FILE = new URL("./meme.json", import.meta.url);
// Owner settings, changed from the site's City tab (paper/settings.json): on/off, risk, daily goal and loss limit.
// "real" mode isn't built yet: the bot always paper-trades (README round 35).
const SET = Object.assign({on:true, mode:"paper", risk:"normal", dailyGoalPct:10, dailyLossPct:10},
  (() => { try{ return JSON.parse(fs.readFileSync(new URL("./settings.json", import.meta.url), "utf8")); }catch(e){ return {}; } })());
CFG.stakePct = {low:.05, normal:.10, high:.20}[SET.risk] || .10;
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const code = html.split("/*MEME-START*/")[1].split("/*MEME-END*/")[0];
const { memeChecks, memePickPair, memeTrim, MEME_RULES } = new Function(`${code}; return { memeChecks, memePickPair, memeTrim, MEME_RULES };`)();
const NTFY = process.env.NTFY_TOPIC || "";
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getJSON(url){
  const r = await fetch(url, {signal:AbortSignal.timeout(20000), headers:{"User-Agent":"turnspotter-bot"}});
  if(!r.ok) throw new Error(`HTTP ${r.status} ${url}`); return r.json();
}
async function alert(title, msg, tags){
  if(!NTFY) return;
  try{ await fetch(`https://ntfy.sh/${NTFY}`, {method:"POST", body:msg, headers:{Title:title, Tags:tags || "coin"}, signal:AbortSignal.timeout(15000)}); }
  catch(e){ console.log("alert failed:", e.message); }
}
const impact = (usd, liq) => liq > 0 ? usd / (liq / 2 + usd) : 1;   // price impact of a swap this size in a pool this deep

const now = Date.now();
const L = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8"))
  : {start:CFG.start, balance:CFG.start, startedAt:now, positions:[], closed:[], equity:[], reports:{}, scan:[], alerted:{}};
L.config = CFG; L.rules = MEME_RULES;
const before = L.positions.map(p => p.mint).join() + "|" + L.closed.length;

// 1) discover coins (Solana only), always including the ones we hold
let mints = [];
for(const u of ["https://api.dexscreener.com/token-boosts/top/v1", "https://api.dexscreener.com/token-boosts/latest/v1", "https://api.dexscreener.com/token-profiles/latest/v1"]){
  try{ for(const t of await getJSON(u)) if(t.chainId === "solana" && t.tokenAddress && !mints.includes(t.tokenAddress)) mints.push(t.tokenAddress); }
  catch(e){ console.log("discover failed:", e.message); }
}
for(const p of L.positions) if(!mints.includes(p.mint)) mints.unshift(p.mint);
mints = mints.slice(0, 90);

// 2) market data, 30 coins per request
const pairOf = {};
for(let i = 0; i < mints.length; i += 30){
  const batch = mints.slice(i, i + 30);
  try{ const ps = await getJSON(`https://api.dexscreener.com/tokens/v1/solana/${batch.join(",")}`);
    for(const m of batch) pairOf[m] = memePickPair(ps.filter(p => p.baseToken && p.baseToken.address === m)); }
  catch(e){ console.log("pairs failed:", e.message); }
}

// 3) rug reports: refresh held coins every run; check the most-traded new candidates (a few per run, politely)
const stale = m => !L.reports[m] || now - L.reports[m].t > CFG.reportTtlMin * 60000;
const want = [...L.positions.map(p => p.mint),
  ...mints.filter(m => pairOf[m] && pairOf[m].liquidity.usd >= MEME_RULES.minLiqUsd && stale(m))
    .sort((a, b) => (pairOf[b].volume.h24 || 0) - (pairOf[a].volume.h24 || 0))];
let fetched = 0;
for(const m of [...new Set(want)]){
  if(fetched >= CFG.reportsPerRun && !L.positions.some(p => p.mint === m)) break;
  try{ L.reports[m] = {t:now, r:memeTrim(await getJSON(`https://api.rugcheck.xyz/v1/tokens/${m}/report`))}; fetched++; }
  catch(e){ console.log("rugcheck failed", m.slice(0, 6), e.message); }
  await sleep(1200);
}
for(const m of Object.keys(L.reports)) if(now - L.reports[m].t > 24 * 36e5 && !L.positions.some(p => p.mint === m)) delete L.reports[m];

// 4) score every coin we have market data for
const scored = [];
for(const m of mints){ const pair = pairOf[m]; if(!pair) continue;
  const rep = L.reports[m] ? L.reports[m].r : null, res = memeChecks(pair, rep, now);
  scored.push({mint:m, sym:pair.baseToken.symbol, name:pair.baseToken.name, url:pair.url, price:+pair.priceUsd,
    liq:Math.round(pair.liquidity.usd), vol24:Math.round(pair.volume.h24 || 0), mcap:Math.round(pair.marketCap || pair.fdv || 0),
    chg:{h1:pair.priceChange.h1 || 0, h6:pair.priceChange.h6 || 0, h24:pair.priceChange.h24 || 0},
    h1:pair.txns.h1 || {buys:0, sells:0}, ageH:+((now - pair.pairCreatedAt) / 36e5).toFixed(1), checked:!!rep,
    passed:res.passed, failed:res.failed, warnings:res.warnings, fails:res.checks.filter(c => !c.pass).map(c => c.label)}); }
L.scan = scored.sort((a, b) => (b.checked - a.checked) || (b.passed - a.passed) || (a.failed - b.failed) || b.vol24 - a.vol24).slice(0, 30);

// 5) manage open positions
const sellValue = (p, pair) => { const v = p.qty * +pair.priceUsd; return v * (1 - impact(v, pair.liquidity.usd)) * (1 - CFG.feePct / 100); };
for(const p of [...L.positions]){
  const pair = pairOf[p.mint], rep = L.reports[p.mint] ? L.reports[p.mint].r : null;
  let reason = null, proceeds = 0;
  if(!pair){ p.missing = (p.missing || 0) + 1; if(p.missing >= 6) reason = "rug: coin vanished from the market"; }
  else {
    p.missing = 0; proceeds = sellValue(p, pair); const ret = proceeds / p.stake - 1, chk = memeChecks(pair, rep, now);
    p.last = {price:+pair.priceUsd, value:+proceeds.toFixed(2), ret:+ret.toFixed(4), liq:Math.round(pair.liquidity.usd), t:now};
    if(pair.liquidity.usd < p.entryLiq * (1 - CFG.rugLiqDrop)) reason = "rug: pool drained";
    else if(rep && rep.rugged) reason = "rug: RugCheck flagged it";
    else if(!chk.passed && chk.checks.some(c => !c.pass && ["mint", "freeze", "lp", "risks"].includes(c.id))) reason = "safety check failed";
    else if(ret >= CFG.tp) reason = "take profit";
    else if(ret <= CFG.sl) reason = "stop loss";
    else if(now - p.openedAt >= CFG.maxHoldH * 36e5) reason = "24 h time limit";
  }
  if(reason) await sell(p, reason, pair, proceeds);
}
async function sell(p, reason, pair, proceeds){
  const pnl = proceeds - p.stake;
  L.balance = +(L.balance + proceeds).toFixed(4);
  L.positions.splice(L.positions.indexOf(p), 1);
  L.closed.push({...p, closedAt:now, exitPrice:pair ? +pair.priceUsd : 0, proceeds:+proceeds.toFixed(4), pnl:+pnl.toFixed(4), reason});
  console.log("SOLD", p.sym, reason, pnl.toFixed(2));
  await alert(`${pnl >= 0 ? "✅" : "🔻"} Sold ${p.sym}: ${pnl >= 0 ? "+" : "-"}$${Math.abs(pnl).toFixed(2)}`,
    `${reason} · paper trade · balance $${L.balance.toFixed(2)}`, pnl >= 0 ? "white_check_mark" : "small_red_triangle_down");
}
if(L.closed.length > 500) L.closed.splice(0, L.closed.length - 500);

// 5b) the shift (README round 35): a new shift starts at midnight UTC. Up the daily goal -> sell everything,
//     PROFIT LOCKED, off duty for the day. Down the daily limit -> PROFIT BRAKE: sell everything, off duty.
const eqNow = () => L.balance + L.positions.reduce((s, p) => s + (p.last ? p.last.value : p.stake), 0);
const today = new Date(now).toISOString().slice(0, 10);
if(!L.day || L.day.date !== today) L.day = {date:today, startEq:+eqNow().toFixed(2), status:"on"};
if(L.day.status === "on" && L.positions.every(p => p.last)){
  const r = eqNow() / L.day.startEq - 1;
  const why = r >= SET.dailyGoalPct / 100 ? "daily goal: profit locked" : r <= -SET.dailyLossPct / 100 ? "profit brake: daily loss limit" : null;
  if(why){
    L.day.status = why.startsWith("daily goal") ? "locked" : "brake";
    for(const p of [...L.positions]){ const pair = pairOf[p.mint]; await sell(p, why, pair, pair ? sellValue(p, pair) : 0); }
    L.day.endedAt = now; L.day.result = +(eqNow() - L.day.startEq).toFixed(2);
    await alert(L.day.status === "locked" ? `🔒 PROFIT LOCKED +$${L.day.result.toFixed(2)}` : `🛑 Profit brake hit: $${L.day.result.toFixed(2)}`,
      `Meme bot is off duty until midnight UTC · paper balance $${L.balance.toFixed(2)}`, L.day.status === "locked" ? "lock" : "octagonal_sign");
  }
}
const canTrade = SET.on && L.day.status === "on";

// 6) open new positions: every critical check passes, no warnings, and real upward momentum
const recent = m => L.closed.some(c => c.mint === m && now - c.closedAt < CFG.cooldownH * 36e5);
const picks = L.scan.filter(c => c.checked && c.passed && !c.warnings && c.chg.h1 >= CFG.momentum.h1 && c.chg.h6 >= CFG.momentum.h6
  && c.chg.h1 <= CFG.maxPump.h1 && c.chg.h6 <= CFG.maxPump.h6
  && c.h1.buys > c.h1.sells && !L.positions.some(p => p.mint === c.mint) && !recent(c.mint));
for(const c of picks){
  if(!canTrade || L.positions.length >= CFG.maxOpen) break;
  const stake = +Math.max(CFG.minStake, L.balance * CFG.stakePct).toFixed(2); if(L.balance < stake) break;
  const pair = pairOf[c.mint], afterFee = stake * (1 - CFG.feePct / 100), eff = +pair.priceUsd * (1 + impact(afterFee, pair.liquidity.usd));
  L.balance = +(L.balance - stake).toFixed(4);
  L.positions.push({mint:c.mint, sym:c.sym, url:c.url, stake, qty:afterFee / eff, entryPrice:+pair.priceUsd, effEntry:eff,
    entryLiq:pair.liquidity.usd, openedAt:now, why:`1h +${c.chg.h1}% · 6h +${c.chg.h6}% · ${c.h1.buys} buys vs ${c.h1.sells} sells`});
  console.log("BOUGHT", c.sym, stake);
  await alert(`🟢 Bought ${c.sym} (paper)`, `$${stake.toFixed(2)} · passed every rug check · ${memeUsdLocal(c.liq)} liquidity · 1h +${c.chg.h1}%`, "green_circle");
}
function memeUsdLocal(v){ return v >= 1e6 ? "$" + (v / 1e6).toFixed(1) + "M" : "$" + Math.round(v / 1e3) + "K"; }

// 7) equity = cash + what the open positions would sell for right now
const openVal = L.positions.reduce((s, p) => s + (p.last ? p.last.value : p.stake), 0);
L.equity.push({t:now, v:+(L.balance + openVal).toFixed(2)});
if(L.equity.length > 3000) L.equity.splice(0, L.equity.length - 3000);
L.day.pnl = +(eqNow() - L.day.startEq).toFixed(2);
L.shift = !SET.on ? "off" : L.day.status;   // on / locked / brake / off
L.settings = SET;
L.lastRun = now;
fs.writeFileSync(FILE, JSON.stringify(L));
if(L.positions.map(p => p.mint).join() + "|" + L.closed.length !== before) console.log("TRADES_CHANGED");
console.log(`meme: $${L.balance.toFixed(2)} cash + $${openVal.toFixed(2)} in ${L.positions.length} positions | scanned ${scored.length}, `
  + `${fetched} new rug reports, ${L.scan.filter(c => c.passed).length} pass every check, ${picks.length} buy signals`);
