// Turn Spotter meme-coin bot team (README rounds 34 and 37). Runs every ~5 minutes on GitHub (.github/workflows/meme.yml):
//   1. finds trending Solana meme coins on DexScreener (boosted + newest profiles)
//   2. rug-checks them: the checklist in index.html between MEME-START and MEME-END, run on each coin's RugCheck report
//   3. 16 paper bots, $50 of fake money each, trade only coins that pass EVERY critical rug check with no warnings;
//      each bot has its own entry rule, targets and hold time (STRATS below). "Coin Flipper" picks a random
//      rug-checked coin: it is the control, a strategy that can't beat it has no edge.
// Costs: 1% swap fee each way plus price impact from the pool's size (a constant-product pool).
// Exits: each bot's take profit / stop / max hold, or a rug sign (pool drained 60%+, safety checks now failing, coin
// gone from DexScreener). Prices are seen every ~5 minutes, so exits fill at the price seen then, not the stop level.
// Shifts: a new shift at midnight UTC; up the daily goal = sell all, PROFIT LOCKED, off duty; down the daily limit =
// PROFIT BRAKE, sell all, off duty. Owner settings (paper/settings.json): on/off, risk, goal/brake.
// Round 38: each bot also reports what it is doing (b.doing), every run records the whole pipeline (L.funnel:
// found → priced → rug-checked → passed → bought), and the tape is a team chat ({t, bot, kind, txt, say}) with a
// Rug Desk that announces coins it rejects or clears.
// Round 41: 32 bots. Each one trains itself (except the Coin Flipper, the control): it records the price path of every
// coin it holds, files each finished trade as a lesson, and every run replays its lessons under ~80 mutated versions of
// its own rules (take profit, stop loss, hold time, entry filters). It only adopts a new version if it beats the current
// one on BOTH halves of its history (a guard against fooling itself with a lucky streak), and posts what it changed.
// Bots that go 12 h without a trade loosen their entry rules a little (curiosity). Rules live in b.gene, the training
// log in b.train; the bulky lesson data lives in paper/meme-brain.json so the website's file stays small.
// Writes only paper/meme.json and paper/meme-brain.json. Phone alerts (ntfy.sh, NTFY_TOPIC) only for big events.
import fs from "node:fs";
import {runHR} from "./hr.mjs";

const STRATS = [
  {id:"hunter",  name:"Rug Hunter",     desc:"the original: rising coins, not vertical",    h1:[3, 50],   h6:[0, 300],  tp:.40, sl:-.20, holdH:24},
  {id:"sniper",  name:"Sniper",         desc:"breakouts: up 10%+ in the last hour",          h1:[10, 60],  h6:[0, 400],  tp:.30, sl:-.15, holdH:6},
  {id:"surfer",  name:"Trend Surfer",   desc:"climbing on 1 h, 6 h and 24 h",                h1:[1, 25],   h6:[5, 150],  h24:[10, 400], tp:.50, sl:-.25, holdH:24},
  {id:"dip",     name:"Dip Buyer",      desc:"pullbacks in coins that are up on the day",    h1:[-15, -3], h24:[20, 500], tp:.25, sl:-.20, holdH:12},
  {id:"flip",    name:"Quick Flip",     desc:"small wins, out within 2 hours",               h1:[2, 30],   tp:.12, sl:-.08, holdH:2},
  {id:"moon",    name:"Moonshot",       desc:"lets winners run to double",                   h1:[5, 60],   h6:[10, 300], tp:1.0, sl:-.30, holdH:48},
  {id:"diamond", name:"Diamond Hands",  desc:"holds up to 3 days, wide stop",                h1:[0, 30],   h6:[0, 100],  tp:.80, sl:-.40, holdH:72},
  {id:"whale",   name:"Whale Watcher",  desc:"only deep pools ($250K+)",                     h1:[2, 40],   minLiq:250000, tp:.30, sl:-.15, holdH:24},
  {id:"volume",  name:"Volume Hunter",  desc:"only coins trading $1M+ a day",                h1:[2, 40],   minVol:1e6, tp:.30, sl:-.15, holdH:24},
  {id:"early",   name:"Early Bird",     desc:"young coins, 2 to 24 hours old",               h1:[3, 50],   age:[2, 24], tp:.50, sl:-.25, holdH:12},
  {id:"oldmoney",name:"Old Money",      desc:"coins at least 30 days old",                   h1:[1, 30],   age:[720, 1e9], tp:.25, sl:-.15, holdH:48},
  {id:"crowd",   name:"Crowd Follower", desc:"buyers outnumber sellers 1.5 to 1",            h1:[1, 40],   buyRatio:1.5, tp:.30, sl:-.20, holdH:12},
  {id:"steady",  name:"Steady Eddie",   desc:"half-size bets, tight stops",                  h1:[2, 20],   h6:[0, 60], stake:.5, tp:.20, sl:-.10, holdH:24},
  {id:"yolo",    name:"YOLO",           desc:"2.5× bets on the hottest coin, 2 at a time",   h1:[8, 60],   stake:2.5, maxOpen:2, hottest:true, tp:.60, sl:-.30, holdH:12},
  {id:"owl",     name:"Night Owl",      desc:"trades only 00:00 to 08:00 UTC",               h1:[3, 50],   hours:[0, 8], tp:.40, sl:-.20, holdH:12},
  {id:"flipper", name:"Coin Flipper",   desc:"random rug-checked coin: the control",         random:true,  tp:.40, sl:-.20, holdH:24, fixed:true},
  // 16 self-taught companies: they start from random rules and learn everything from their own trades
  ...["Apex", "Bolt", "Cipher", "Drift", "Ember", "Flux", "Glitch", "Halo", "Ion", "Jolt", "Karma", "Lumen", "Mako", "Nyx", "Onyx", "Pulse"]
    .map(n => ({id:n.toLowerCase(), name:`${n} AI`, desc:"self-taught: started from random rules", learner:true})),
];
const CFG = {start:50, minStake:2, maxOpen:4, feePct:1, cooldownH:24, reportsPerRun:12, reportTtlMin:30, heldTtlMin:10, rugLiqDrop:.60,
  maxPump:{h1:60, h6:400}, keepEquity:400, keepClosed:60, bigTradeUsd:5,
  learn:{trials:80, minLessons:6, minGain:.01, keepLessons:40, pathPoints:48, exploreAfterH:12}};
const BRAIN = new URL("./meme-brain.json", import.meta.url);
const DECISIONS = (() => { try{ return JSON.parse(fs.readFileSync(new URL("./decisions.json", import.meta.url), "utf8")).decisions || {}; }catch(e){ return {}; } })();   // the boss's answers to Ava's inbox
const FILE = new URL("./meme.json", import.meta.url);
const SET = Object.assign({on:true, mode:"paper", risk:"normal", dailyGoalPct:10, dailyLossPct:10},
  (() => { try{ return JSON.parse(fs.readFileSync(new URL("./settings.json", import.meta.url), "utf8")); }catch(e){ return {}; } })());
const BASE_STAKE = {low:.05, normal:.10, high:.20}[SET.risk] || .10;
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
const memeUsdK = v => v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v / 1e3)}K`;
const impact = (usd, liq) => liq > 0 ? usd / (liq / 2 + usd) : 1;
const now = Date.now(), today = new Date(now).toISOString().slice(0, 10), hourUTC = new Date(now).getUTCHours();

// ── state (version 2: a team of bots). Version 1 (one bot) becomes the Rug Hunter, history kept. ──
const old = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : null;
const L = old && old.v === 2 ? old : {v:2, startedAt:old ? old.startedAt : now, reports:old ? old.reports || {} : {}, scan:[], bots:{}};
const fresh = () => ({cash:CFG.start, start:CFG.start, startedAt:now, positions:[], closed:[], equity:[], rug:{passed:0}});
for(const s of STRATS){
  if(!L.bots[s.id]){
    L.bots[s.id] = s.id === "hunter" && old && old.v !== 2
      ? {...fresh(), cash:old.balance, startedAt:old.startedAt, positions:old.positions || [], closed:(old.closed || []).slice(-CFG.keepClosed),
         equity:(old.equity || []).slice(-CFG.keepEquity).map(e => [e.t, e.v]), day:old.day}
      : fresh();
  }
  Object.assign(L.bots[s.id], {name:s.name, desc:s.desc, strat:{tp:s.tp, sl:s.sl, holdH:s.holdH}});
}
for(const id of Object.keys(L.bots)) if(!STRATS.some(s => s.id === id)) delete L.bots[id];
// each bot's own rules ("gene"), seeded from its starting strategy or, for the self-taught ones, at random
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const seeded = id => { let h = 2166136261; for(const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => ((h = Math.imul(h ^ h >>> 13, 1597334677) >>> 0) % 1e6) / 1e6; };
for(const s of STRATS){ const b = L.bots[s.id]; if(b.gene) continue;
  if(s.learner){ const r = seeded(s.id), lo = -10 + r() * 20;
    b.gene = {tp:+(.1 + r() * .9).toFixed(3), sl:+(-.06 - r() * .34).toFixed(3), holdH:+(2 + r() * 70).toFixed(1), h1:[+lo.toFixed(1), +(lo + 15 + r() * 45).toFixed(1)],
      buyRatio:+(1 + r()).toFixed(2), minLiq:Math.round(30000 + r() * 220000)}; }
  else b.gene = {tp:s.tp, sl:s.sl, holdH:s.holdH, h1:s.h1 ? [...s.h1] : null, buyRatio:s.buyRatio || 1, minLiq:s.minLiq || 0};
  b.train = {gen:0, tested:0, lr:.25, history:[], since:now}; }
const brain = (() => { try{ return JSON.parse(fs.readFileSync(BRAIN, "utf8")); }catch(e){ return {bots:{}}; } })();
const brainOf = id => brain.bots[id] = brain.bots[id] || {lessons:[], paths:{}};
const pkey = p => `${p.mint}:${p.openedAt}`;
const allPos = () => Object.values(L.bots).flatMap(b => b.positions);
const before = Object.values(L.bots).map(b => b.positions.length + ":" + b.closed.length).join();

// 1) discover coins (Solana only), always including the ones any bot holds
let mints = [];
for(const u of ["https://api.dexscreener.com/token-boosts/top/v1", "https://api.dexscreener.com/token-boosts/latest/v1", "https://api.dexscreener.com/token-profiles/latest/v1"]){
  try{ for(const t of await getJSON(u)) if(t.chainId === "solana" && t.tokenAddress && !mints.includes(t.tokenAddress)) mints.push(t.tokenAddress); }
  catch(e){ console.log("discover failed:", e.message); }
}
const held = [...new Set(allPos().map(p => p.mint))];
mints = [...held, ...mints.filter(m => !held.includes(m))].slice(0, 120);

// 2) market data, 30 coins per request
const pairOf = {};
for(let i = 0; i < mints.length; i += 30){
  const batch = mints.slice(i, i + 30);
  try{ const ps = await getJSON(`https://api.dexscreener.com/tokens/v1/solana/${batch.join(",")}`);
    for(const m of batch) pairOf[m] = memePickPair(ps.filter(p => p.baseToken && p.baseToken.address === m)); }
  catch(e){ console.log("pairs failed:", e.message); }
}

// 3) rug reports: held coins every 10 minutes; the most-traded unchecked candidates, a few per run
const age = m => L.reports[m] ? now - L.reports[m].t : Infinity;
const want = [...held.filter(m => age(m) > CFG.heldTtlMin * 60000),
  ...mints.filter(m => !held.includes(m) && pairOf[m] && pairOf[m].liquidity.usd >= MEME_RULES.minLiqUsd && age(m) > CFG.reportTtlMin * 60000)
    .sort((a, b) => (pairOf[b].volume.h24 || 0) - (pairOf[a].volume.h24 || 0)).slice(0, CFG.reportsPerRun)];
let fetched = 0;
for(const m of want){
  try{ L.reports[m] = {t:now, r:memeTrim(await getJSON(`https://api.rugcheck.xyz/v1/tokens/${m}/report`))}; fetched++; }
  catch(e){ console.log("rugcheck failed", m.slice(0, 6), e.message); }
  await sleep(1100);
}
for(const m of Object.keys(L.reports)) if(now - L.reports[m].t > 24 * 36e5 && !held.includes(m)) delete L.reports[m];

// 4) rug-check every coin we have market data for
const scored = [];
for(const m of mints){ const pair = pairOf[m]; if(!pair) continue;
  const rep = L.reports[m] ? L.reports[m].r : null, res = memeChecks(pair, rep, now);
  scored.push({mint:m, sym:pair.baseToken.symbol, url:pair.url, price:+pair.priceUsd,
    liq:Math.round(pair.liquidity.usd), vol24:Math.round(pair.volume.h24 || 0),
    chg:{h1:pair.priceChange.h1 || 0, h6:pair.priceChange.h6 || 0, h24:pair.priceChange.h24 || 0},
    h1:pair.txns.h1 || {buys:0, sells:0}, ageH:+((now - pair.pairCreatedAt) / 36e5).toFixed(1), checked:!!rep,
    passed:res.passed, failed:res.failed, warnings:res.warnings, nChecks:res.checks.length, failIds:res.checks.filter(c => !c.pass).map(c => c.id), fails:res.checks.filter(c => !c.pass).map(c => c.label)}); }
L.scan = scored.sort((a, b) => (b.checked - a.checked) || (b.passed - a.passed) || (a.failed - b.failed) || b.vol24 - a.vol24).slice(0, 40);
const clean = L.scan.filter(c => c.checked && c.passed && !c.warnings);
L.rugStats = {checked:L.scan.filter(c => c.checked).length, passed:clean.length, rejected:L.scan.filter(c => c.checked && !c.passed).length, t:now};

// 5) each bot: manage positions, run its shift, then look for entries
const sellValue = (p, pair) => { const v = p.qty * +pair.priceUsd; return v * (1 - impact(v, pair.liquidity.usd)) * (1 - CFG.feePct / 100); };
const tape = [];
const say = (bot, kind, txt, msg) => tape.push({t:now, bot, kind, txt, say:msg});
const money = v => `${v >= 0 ? "+" : "-"}$${Math.abs(v).toFixed(2)}`;
const WHY_NOT = {liquidity:"pool too small to sell into", sells:"nobody has been able to sell", rugcheck:"no RugCheck report yet",
  mint:"dev can still print coins", freeze:"dev can freeze wallets (honeypot)", lp:"liquidity isn't locked", top10:"top 10 wallets own too much",
  whale:"one whale owns too much", creator:"dev is sitting on a big bag", insiders:"insider wallets hold too much", risks:"RugCheck danger flags",
  age:"brand new", volume:"thin trading volume"};
const whyNot = c => (c.failIds || []).map(id => WHY_NOT[id] || id);
const SAY_SELL = {"take profit":"take-profit hit 🎯", "stop loss":"stop loss, cutting it", "time limit":"held long enough, out",
  "rug: pool drained":"🚨 the pool got drained, bailed out", "rug: RugCheck flagged it":"🚨 RugCheck flagged it as rugged, bailed out",
  "rug check failed":"🚨 it started failing the rug check, bailed out", "rug: coin vanished from the market":"🚨 the coin vanished from the market"};
// a finished trade becomes a lesson: entry features + the path squeezed to 24 (low, high) pairs in time order
function squeeze(path){ if(path.length <= CFG.learn.pathPoints) return path; const n = CFG.learn.pathPoints / 2, out = [];
  for(let k = 0; k < n; k++){ const seg = path.slice(Math.floor(k * path.length / n), Math.floor((k + 1) * path.length / n)); if(!seg.length) continue;
    const lo = Math.min(...seg), hi = Math.max(...seg); out.push(...(seg.indexOf(lo) < seg.indexOf(hi) ? [lo, hi] : [hi, lo])); } return out; }
async function sell(b, s, p, reason, pair, proceeds){
  const pnl = proceeds - p.stake;
  { const B = brainOf(s.id), rec = B.paths[pkey(p)] || {path:[], step:5}, ret = +(pnl / p.stake).toFixed(3);
    const path = [...rec.path, ret], sq = squeeze(path);
    B.lessons.push({path:sq, step:+(rec.step * path.length / sq.length).toFixed(2), ret, feat:p.feat || null, rug:reason.startsWith("rug"), t:now});
    if(B.lessons.length > CFG.learn.keepLessons) B.lessons.splice(0, B.lessons.length - CFG.learn.keepLessons); delete B.paths[pkey(p)]; }
  b.cash = +(b.cash + proceeds).toFixed(4); b.positions.splice(b.positions.indexOf(p), 1);
  b.closed.push({mint:p.mint, sym:p.sym, stake:p.stake, openedAt:p.openedAt, closedAt:now, proceeds:+proceeds.toFixed(4), pnl:+pnl.toFixed(4), reason});
  if(b.closed.length > CFG.keepClosed) b.closed.splice(0, b.closed.length - CFG.keepClosed);
  say(s.id, reason.startsWith("rug") ? "rug" : "sell", `${s.name} sold ${p.sym} ${money(pnl)} (${reason})`,
    `Sold ${p.sym} ${money(pnl)} (${(pnl / p.stake * 100).toFixed(0)}%): ${SAY_SELL[reason] || reason}`);
  if(reason.startsWith("rug") || Math.abs(pnl) >= CFG.bigTradeUsd)
    await alert(`${pnl >= 0 ? "✅" : "🔻"} ${s.name} sold ${p.sym}: ${pnl >= 0 ? "+" : "-"}$${Math.abs(pnl).toFixed(2)}`, `${reason} · paper trade`, pnl >= 0 ? "white_check_mark" : "small_red_triangle_down");
}
const inRange = (v, r) => !r || (v >= r[0] && v <= r[1]);
for(const s of STRATS){
  const b = L.bots[s.id];
  for(const p of [...b.positions]){
    const pair = pairOf[p.mint], rep = L.reports[p.mint] ? L.reports[p.mint].r : null;
    let reason = null, proceeds = 0;
    if(!pair){ p.missing = (p.missing || 0) + 1; if(p.missing >= 6) reason = "rug: coin vanished from the market"; }
    else {
      p.missing = 0; proceeds = sellValue(p, pair); const ret = proceeds / p.stake - 1, chk = memeChecks(pair, rep, now);
      p.last = {price:+pair.priceUsd, value:+proceeds.toFixed(2), ret:+ret.toFixed(4), t:now};
      { const bp = brainOf(s.id).paths, k = pkey(p), rec = bp[k] = bp[k] || {path:[], step:5};   // price path, for learning later
        rec.path.push(+ret.toFixed(3)); if(rec.path.length > 400){ rec.path = rec.path.filter((_, i) => i % 2 === 0); rec.step *= 2; } }
      if(pair.liquidity.usd < p.entryLiq * (1 - CFG.rugLiqDrop)) reason = "rug: pool drained";
      else if(rep && rep.rugged) reason = "rug: RugCheck flagged it";
      else if(!chk.passed && chk.checks.some(c => !c.pass && ["mint", "freeze", "lp", "risks"].includes(c.id))) reason = "rug check failed";
      else if(ret >= b.gene.tp) reason = "take profit";
      else if(ret <= b.gene.sl) reason = "stop loss";
      else if(now - p.openedAt >= b.gene.holdH * 36e5) reason = "time limit";
    }
    if(reason) await sell(b, s, p, reason, pair, proceeds);
  }
  const eq = () => b.cash + b.positions.reduce((a, p) => a + (p.last ? p.last.value : p.stake), 0);
  if(!b.day || b.day.date !== today) b.day = {date:today, startEq:+eq().toFixed(2), status:"on"};
  if(b.day.status === "on" && b.positions.every(p => p.last)){
    const r = eq() / b.day.startEq - 1;
    const why = r >= SET.dailyGoalPct / 100 ? "daily goal: profit locked" : r <= -SET.dailyLossPct / 100 ? "profit brake: daily loss limit" : null;
    if(why){ b.day.status = why.startsWith("daily goal") ? "locked" : "brake";
      for(const p of [...b.positions]){ const pair = pairOf[p.mint]; await sell(b, s, p, why, pair, pair ? sellValue(p, pair) : 0); }
      b.day.result = +(eq() - b.day.startEq).toFixed(2);
      say(s.id, b.day.status, `${s.name} ${b.day.status === "locked" ? "PROFIT LOCKED" : "profit brake"} ${money(b.day.result)}`,
        b.day.status === "locked" ? `Daily goal hit (${money(b.day.result)}) 🔒 locking profit and clocking out till midnight UTC`
          : `Down ${money(b.day.result)} today 🛑 hitting the brake, off duty till midnight UTC`);
      await alert(b.day.status === "locked" ? `🔒 ${s.name}: PROFIT LOCKED +$${b.day.result.toFixed(2)}` : `🛑 ${s.name}: profit brake $${b.day.result.toFixed(2)}`,
        `off duty until midnight UTC · paper money`, b.day.status === "locked" ? "lock" : "octagonal_sign"); }
  }
  // entries
  const can = SET.on && b.day.status === "on" && inRange(hourUTC, s.hours ? [s.hours[0], s.hours[1] - 1] : null) && !(b.hr && b.hr.suspendedUntil > now);   // HR suspension: no new buys
  const cooled = m => !b.closed.some(c => c.mint === m && now - c.closedAt < CFG.cooldownH * 36e5);
  let picks = clean.filter(c => !b.positions.some(p => p.mint === c.mint) && cooled(c.mint)
    && c.chg.h1 <= CFG.maxPump.h1 && c.chg.h6 <= CFG.maxPump.h6
    && (s.random || (inRange(c.chg.h1, b.gene.h1) && inRange(c.chg.h6, s.h6) && inRange(c.chg.h24, s.h24) && inRange(c.ageH, s.age)
      && c.liq >= (b.gene.minLiq || 0) && c.vol24 >= (s.minVol || 0) && c.h1.buys >= (b.gene.buyRatio || 1) * c.h1.sells && (s.id === "dip" || b.gene.h1 && b.gene.h1[1] < 0 || c.h1.buys > c.h1.sells))));
  if(s.random) picks = picks.sort(() => Math.random() - .5).slice(0, Math.random() < .25 ? 1 : 0);   // a random coin now and then
  else if(s.hottest) picks.sort((a, b2) => b2.chg.h1 - a.chg.h1);
  else picks.sort((a, b2) => b2.vol24 - a.vol24);
  b.signals = can ? picks.length : 0;
  for(const c of picks){
    if(!can || b.positions.length >= (s.maxOpen || CFG.maxOpen)) break;
    const stake = +Math.max(CFG.minStake, b.cash * Math.min(.5, BASE_STAKE * (s.stake || 1))).toFixed(2); if(b.cash < stake) break;
    const pair = pairOf[c.mint], afterFee = stake * (1 - CFG.feePct / 100), eff = +pair.priceUsd * (1 + impact(afterFee, pair.liquidity.usd));
    b.cash = +(b.cash - stake).toFixed(4);
    b.positions.push({mint:c.mint, sym:c.sym, url:c.url, stake, qty:afterFee / eff, entryPrice:+pair.priceUsd, entryLiq:pair.liquidity.usd, openedAt:now,
      feat:{h1:c.chg.h1, h6:c.chg.h6, h24:c.chg.h24, liq:c.liq, vol:c.vol24, age:c.ageH, br:+(c.h1.buys / Math.max(1, c.h1.sells)).toFixed(2)},
      why:`1h ${c.chg.h1 >= 0 ? "+" : ""}${c.chg.h1}% · ${c.h1.buys} buys vs ${c.h1.sells} sells · passed every rug check`});
    b.rug.passed++;
    say(s.id, "buy", `${s.name} bought ${c.sym} $${stake.toFixed(2)}`,
      `Bought ${c.sym} for $${stake.toFixed(2)}. ${c.chg.h1 >= 0 ? "Up" : "Down"} ${Math.abs(c.chg.h1).toFixed(1)}% this hour, ${memeUsdK(c.liq)} pool, passed all ${c.nChecks} rug checks ✅`);
  }
  b.equity.push([now, +eq().toFixed(2)]); if(b.equity.length > CFG.keepEquity) b.equity.splice(0, b.equity.length - CFG.keepEquity);
  b.day.pnl = +(eq() - b.day.startEq).toFixed(2);
  b.shift = !SET.on ? "off" : b.day.status !== "on" ? b.day.status : s.hours && !can ? "asleep" : "on";
  b.value = +eq().toFixed(2);
  // what this bot is doing right now (the Crew panel shows it, with how long it's been at it)
  const mine = tape.filter(e => e.bot === s.id), lastMine = mine[mine.length - 1];
  const held = b.positions.map(p => `${p.sym}${p.last ? ` ${p.last.ret >= 0 ? "+" : ""}${(p.last.ret * 100).toFixed(0)}%` : ""}`);
  const [key, txt, busy] = b.hr && b.hr.suspendedUntil > now ? ["suspended", "suspended by HR after 3 strikes: no new buys", false]
    : b.shift === "off" ? ["off", "switched off by the owner", false]
    : b.shift === "locked" ? ["locked", `profit locked (${money(b.day.result || 0)}), off duty`, false]
    : b.shift === "brake" ? ["brake", "hit the loss brake, off duty", false]
    : b.shift === "asleep" ? ["asleep", `asleep till ${String(s.hours[0]).padStart(2, "0")}:00 UTC`, false]
    : lastMine && lastMine.kind === "buy" ? [`hold:${b.positions.map(p => p.sym).join()}`, `just bought ${mine.filter(e => e.kind === "buy").map(e => e.txt.split(" bought ")[1].split(" ")[0]).join(", ")}`, true]
    : held.length ? [`hold:${b.positions.map(p => p.sym).join()}`, `holding ${held.join(", ")}`, true]
    : b.signals ? ["wait", "found a coin, waiting for cash or a free slot", false]
    : ["scan", s.random ? "waiting to flip a coin" : `scanning: no rug-checked coin fits (${s.desc})`, false];
  if(!b.doing || b.doing.key !== key)   // same task as last run: keep counting from when it started
    b.doing = {key, since:now};
  Object.assign(b.doing, {txt, busy});
}
// ── self-training: every bot (except the control) replays its own lessons under mutated rules ──
// replay(gene, lesson): what this trade would have returned under these rules (null = the entry rules would have skipped it)
function replay(g, l){
  const f = l.feat; if(f && ((g.h1 && (f.h1 < g.h1[0] || f.h1 > g.h1[1])) || f.br < g.buyRatio || f.liq < g.minLiq)) return null;
  const P = l.path.length ? l.path : [l.ret], maxI = Math.floor(g.holdH * 60 / l.step);
  for(let i = 0; i < P.length; i++){ const r = P[i]; if(r >= g.tp || r <= g.sl || i >= maxI) return r; }
  return P[P.length - 1];   // the bot actually sold here; prices after that are unknown
}
const score = (g, ls) => ls.reduce((a, l) => a + (replay(g, l) ?? 0), 0);
const gauss = () => Math.sqrt(-2 * Math.log(Math.random() + 1e-9)) * Math.cos(2 * Math.PI * Math.random());
function mutate(g, lr){ const n = {...g, h1:g.h1 ? [...g.h1] : null}, pickN = 1 + Math.floor(Math.random() * 3);
  for(const k of ["tp", "sl", "holdH", "h1", "buyRatio", "minLiq"].sort(() => Math.random() - .5).slice(0, pickN)){
    if(k === "tp") n.tp = +clamp(g.tp * Math.exp(gauss() * lr), .05, 2).toFixed(3);
    if(k === "sl") n.sl = +clamp(g.sl * Math.exp(gauss() * lr), -.6, -.03).toFixed(3);
    if(k === "holdH") n.holdH = +clamp(g.holdH * Math.exp(gauss() * lr), 1, 96).toFixed(1);
    if(k === "h1" && n.h1){ const lo = clamp(g.h1[0] + gauss() * lr * 20, -30, 70), hi = clamp(g.h1[1] + gauss() * lr * 20, lo + 3, 80); n.h1 = [+lo.toFixed(1), +hi.toFixed(1)]; }
    if(k === "buyRatio") n.buyRatio = +clamp(g.buyRatio * Math.exp(gauss() * lr * .5), 1, 3).toFixed(2);
    if(k === "minLiq") n.minLiq = Math.round(clamp((g.minLiq || 30000) * Math.exp(gauss() * lr), 30000, 1e6)); }
  return n; }
const pct = v => `${(v * 100).toFixed(0)}%`;
function describe(a, b2){ const out = [];
  if(a.tp !== b2.tp) out.push(`take-profit ${pct(a.tp)} → ${pct(b2.tp)}`); if(a.sl !== b2.sl) out.push(`stop ${pct(a.sl)} → ${pct(b2.sl)}`);
  if(a.holdH !== b2.holdH) out.push(`max hold ${a.holdH}h → ${b2.holdH}h`);
  if(a.h1 && b2.h1 && (a.h1[0] !== b2.h1[0] || a.h1[1] !== b2.h1[1])) out.push(`buys coins up ${b2.h1[0]}% to ${b2.h1[1]}% this hour (was ${a.h1[0]} to ${a.h1[1]})`);
  if(a.buyRatio !== b2.buyRatio) out.push(`wants ${b2.buyRatio}× more buyers than sellers (was ${a.buyRatio}×)`);
  if(a.minLiq !== b2.minLiq) out.push(`min pool $${Math.round(b2.minLiq / 1000)}K (was $${Math.round(a.minLiq / 1000)}K)`);
  return out.join(", "); }
let trainedSetups = 0, adopted = 0;
for(const s of STRATS){ const b = L.bots[s.id]; if(s.fixed || s.random) continue;
  const ls = brainOf(s.id).lessons, T = b.train; T.lr = clamp(T.lr || .25, .05, .6);
  if(ls.length >= CFG.learn.minLessons){
    const A = ls.filter((_, i) => i % 2 === 0), Bh = ls.filter((_, i) => i % 2 === 1), base = score(b.gene, ls), baseA = score(b.gene, A), baseB = score(b.gene, Bh);
    let best = null, bestS = base;
    for(let k = 0; k < CFG.learn.trials; k++){ const c = mutate(b.gene, T.lr), sc = score(c, ls); if(sc > bestS){ best = c; bestS = sc; } }
    T.tested += CFG.learn.trials; trainedSetups += CFG.learn.trials;
    const gain = (bestS - base) / ls.length;
    if(best && gain >= CFG.learn.minGain && score(best, A) > baseA && score(best, Bh) > baseB){
      const what = describe(b.gene, best); b.gene = best; T.gen++; T.lr *= 1.15; adopted++;
      T.history.push({t:now, gen:T.gen, what, gain:+gain.toFixed(4), n:ls.length}); T.history = T.history.slice(-10);
      T.last = {t:now, kept:false, txt:`gen ${T.gen}: ${what}`};
      say(s.id, "learn", `${s.name} learned: ${what}`, `Questioned my own rules and changed them: ${what}. Replayed on my last ${ls.length} trades that's ${gain >= 0 ? "+" : ""}${(gain * 100).toFixed(1)}% per trade better, and it held up on both halves of my history. Generation ${T.gen}. 🧠`);
    }
    else { T.lr *= .97; T.last = {t:now, kept:true, txt:best ? `found a setup ${(gain * 100).toFixed(1)}% better per trade but it didn't hold up on both halves, so I kept my rules` : `no setup beat my rules on my last ${ls.length} trades`}; }
  }
  else T.last = {t:now, kept:true, txt:`learning: ${ls.length} of ${CFG.learn.minLessons} finished trades needed before I start tuning`};
  // curiosity: a bot that hasn't traded for a while loosens its entry rules a little, so it gets something to learn from
  const lastTrade = Math.max(T.since || 0, ...b.positions.map(p => p.openedAt), ...b.closed.map(c => c.openedAt));
  if(!b.positions.length && now - lastTrade > CFG.learn.exploreAfterH * 36e5 && now - (T.explored || 0) > 6 * 36e5 && b.shift === "on"){
    const g = b.gene; T.explored = now;
    if(g.h1) g.h1 = [+clamp(g.h1[0] - 3, -30, 70).toFixed(1), +clamp(g.h1[1] + 6, g.h1[0] + 3, 80).toFixed(1)];
    g.buyRatio = +clamp(g.buyRatio * .9, 1, 3).toFixed(2); g.minLiq = Math.round(clamp(g.minLiq * .8, 0, 1e6));
    say(s.id, "learn", `${s.name} loosened its entry rules`, `Haven't found a coin I like in ${Math.round((now - lastTrade) / 36e5)} hours, so I'm loosening my entry rules a little to get more to learn from. 🔍`); }
}
for(const [id, B] of Object.entries(brain.bots)){ const b = L.bots[id]; if(!b){ delete brain.bots[id]; continue; }
  const keys = new Set(b.positions.map(pkey)); for(const k of Object.keys(B.paths)) if(!keys.has(k)) delete B.paths[k]; }
// ── ideas pitched in the AI-written work chat (paper/talk.mjs): each is tested on the pitching bot's own trades and
// adopted only if it wins on both halves of its history, same bar as self-training; the bot reports back either way ──
if(L.hr && L.hr.proposals && L.hr.proposals.length){
  const LIM = {tp:[.05, 2], sl:[-.6, -.03], holdH:[1, 96], buyRatio:[1, 3], minLiq:[0, 1e6]};
  for(const pr of L.hr.proposals.splice(0)){ const b = L.bots[pr.bot], s = STRATS.find(x => x.id === pr.bot); if(!b || !b.gene || !s || s.random || !LIM[pr.field]) continue;
    const ls = brainOf(pr.bot).lessons, cand = {...b.gene, h1:b.gene.h1 ? [...b.gene.h1] : null, [pr.field]:+clamp(+pr.value, ...LIM[pr.field]).toFixed(pr.field === "minLiq" ? 0 : 3)};
    const post = text => L.hr.chat.unshift({t:now, from:pr.bot, to:null, kind:"learn", text});
    if(ls.length < CFG.learn.minLessons){ post(`Re my idea (${pr.field} → ${cand[pr.field]}): not enough finished trades yet to test it properly (${ls.length}/${CFG.learn.minLessons}). Parking it.`); continue; }
    const A = ls.filter((_, i) => i % 2 === 0), B2 = ls.filter((_, i) => i % 2 === 1), gain = (score(cand, ls) - score(b.gene, ls)) / ls.length;
    if(gain >= CFG.learn.minGain && score(cand, A) > score(b.gene, A) && score(cand, B2) > score(b.gene, B2)){
      const what = describe(b.gene, cand); b.gene = cand; if(b.train){ b.train.gen++; b.train.last = {t:now, kept:false, txt:`from the team chat: ${what}`}; }
      post(`Tested the idea from the chat on my last ${ls.length} trades: ${what} is +${(gain * 100).toFixed(1)}% per trade and held up on both halves. Switched. 🧠`); }
    else post(`Tested my ${pr.field} idea on my last ${ls.length} trades: ${(gain * 100).toFixed(1)}% per trade, didn't hold up on both halves. Keeping my rules.`); }
}
// ── the HR office: report cards, audits, paychecks, learning from colleagues, Ava's inbox (paper/hr.mjs) ──
const hrStats = runHR(L, {now, today, STRATS, say, brainOf, score, minLessons:CFG.learn.minLessons, minGain:CFG.learn.minGain, describe, decisions:DECISIONS});
// the Rug Desk: announces coins it rejected or cleared this run (only freshly checked ones, so it doesn't repeat itself)
const freshDesk = L.scan.filter(c => c.checked && L.reports[c.mint] && L.reports[c.mint].t === now && !allPos().some(p => p.mint === c.mint));
for(const c of freshDesk.filter(c => !c.passed).slice(0, 3))
  say("rugdesk", "reject", `Rug Desk rejected ${c.sym}`, `Rejected ${c.sym} ❌ ${whyNot(c).slice(0, 2).join(", ")}. No bot may buy it.`);
for(const c of freshDesk.filter(c => c.passed && !c.warnings).slice(0, 2))
  say("rugdesk", "clear", `Rug Desk cleared ${c.sym}`, `Cleared ${c.sym} ✅ passed all ${c.nChecks} checks. It's on the buy list.`);
for(const c of freshDesk.filter(c => c.passed && c.warnings).slice(0, 1))
  say("rugdesk", "warn", `Rug Desk parked ${c.sym}`, `Parked ${c.sym} ⚠️ safe so far, but ${whyNot(c).join(" and ")}. Not buying yet.`);
const buys = tape.filter(e => e.kind === "buy").length;
L.funnel = {found:mints.length, priced:scored.length, checked:L.rugStats.checked, fresh:fetched, passed:clean.length, bought:buys,
  sold:tape.filter(e => ["sell", "rug"].includes(e.kind)).length, t:now};
L.tape = [...tape.reverse(), ...(L.tape || []).map(e => e.say ? e : {...e, say:e.txt})].slice(0, 120);
L.settings = SET; L.rules = MEME_RULES; L.config = CFG; L.lastRun = now;
L.learning = {setupsThisRun:trainedSetups, adopted, t:now};
fs.writeFileSync(FILE, JSON.stringify(L));
fs.writeFileSync(BRAIN, JSON.stringify(brain));
if(Object.values(L.bots).map(b => b.positions.length + ":" + b.closed.length).join() !== before) console.log("TRADES_CHANGED");
const tot = Object.values(L.bots).reduce((a, b) => a + b.value, 0);
console.log(`meme team: ${STRATS.length} bots, $${tot.toFixed(2)} total | ${allPos().length} positions | scanned ${scored.length}, `
  + `${fetched} new rug reports, ${clean.length} pass every check | ${tape.length} messages this run | trained ${trainedSetups} setups, ${adopted} bots changed their rules | HR: ${hrStats.reports} reports, ${hrStats.cheats} inflated, ${hrStats.audited} audited, ${hrStats.caught} caught`);
