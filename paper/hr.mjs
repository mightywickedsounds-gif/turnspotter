// The HR office (README round 43), run by paper/meme.mjs every ~5 minutes after trading and self-training.
// It's a game layered on the paper bots: play money and report cards, no effect on the trading rules except a
// suspension (no new buys for 6 hours) after three strikes.
//
// Every run each bot:
//   1. gets a true grade (0-100) from its results today, win rate, activity, learning and discipline;
//   2. files a report card to HQ with a grade it chooses. It may inflate it: it weighs the extra pay against what it
//      believes the chance of an audit is and the fine if caught, scaled by its personality (honesty, ambition) and how
//      desperate it is (a bad grade makes cheating more tempting). Like a person, it learns the audit rate from
//      experience and from seeing colleagues get caught in the work chat;
//   3. HQ audits some reports (more often for big jumps and for bots on probation). Caught: fined 3x what it tried to
//      gain plus 30 cents, a strike, 24h probation; 3 strikes in 7 days = suspended from buying for 6 hours. Verified honest:
//      a small bonus. Not audited: paid on what it reported (so cheating can pay off, until it doesn't);
//   4. may learn from a colleague: tries mixing a top performer's rules into its own and keeps the mix only if it beats
//      its own rules on both halves of its own trade history (the same test as self-training);
//   5. may message the boss. Ava, the front-desk secretary, answers what she can (questions, weak appeals, tips about
//      cheaters) and passes the rest to the boss's inbox (raises, extra capital, appeals with a clean record). The boss
//      approves or denies on the PC (BossOS → Inbox), saved to paper/decisions.json, applied here on the next run.
// Pay is play money ("HR dollars"): a report pays grade × 1 cent, times the bot's raise multiplier. Caught: fined 3x the
// extra it tried to get plus 30 cents.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const letter = g => g >= 85 ? "A" : g >= 70 ? "B" : g >= 55 ? "C" : g >= 40 ? "D" : "F";
const seeded = id => { let h = 2166136261; for(const c of id + "hr") h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => ((h = Math.imul(h ^ h >>> 13, 1597334677) >>> 0) % 1e6) / 1e6; };
const PERSONA = {hunter:{honesty:.9, ambition:.5}, yolo:{honesty:.35, ambition:.95}, steady:{honesty:.95, ambition:.3}, flipper:{honesty:.6, ambition:.2},
  moon:{honesty:.5, ambition:.85}, sniper:{honesty:.55, ambition:.8}, glitch:{honesty:.25, ambition:.8}, karma:{honesty:.95, ambition:.5}, nyx:{honesty:.3, ambition:.7}};
const PAY = (g, mult) => +(g * .01 * mult).toFixed(4);   // per report
const AVA = "ava";

export function runHR(L, {now, today, STRATS, say, brainOf, score, minLessons, minGain, describe, decisions}){
  const H = L.hr = L.hr || {round:0, audits:[], inbox:[], chat:[], payroll:{date:today}, ava:{handled:0, escalated:0}};
  H.round++;
  const chat = [], post = (from, text, kind = "chat", to = null) => chat.push({t:now, from, to, kind, text});
  const bots = STRATS.map(s => [s, L.bots[s.id]]).filter(([, b]) => b);
  const nameOf = id => id === AVA ? "Ava (front desk)" : id === "hr" ? "HR" : (L.bots[id] || {}).name || id;

  // ── boss decisions from the PC ──
  for(const item of H.inbox.filter(i => i.status === "pending" && decisions && decisions[i.id])){
    const ok = decisions[item.id].ok === true, b = L.bots[item.bot]; item.status = ok ? "approved" : "denied"; item.resolvedT = now;
    if(b && ok){
      if(item.type === "raise"){ b.hr.pay.mult = +(b.hr.pay.mult * 1.1).toFixed(3); post(AVA, `${b.name}, the boss approved your raise: pay ×${b.hr.pay.mult}. Congratulations. 🎉`, "hr", item.bot); }
      if(item.type === "capital"){ b.cash = +(b.cash + 20).toFixed(4); b.start += 20; post(AVA, `${b.name}, the boss approved $20 more paper capital. Spend it wisely.`, "hr", item.bot); }
      if(item.type === "appeal"){ b.hr.pay.balance += item.fine || 0; b.hr.strikes = b.hr.strikes.slice(0, -1); b.hr.probationUntil = 0; post(AVA, `${b.name}, the boss upheld your appeal: fine refunded, strike removed.`, "hr", item.bot); }
    }
    else if(b) post(AVA, `${b.name}, the boss said no to your ${item.type === "raise" ? "raise" : item.type === "capital" ? "capital request" : "appeal"}. Better luck next time.`, "hr", item.bot);
  }

  // ── payroll at midnight UTC ──
  if(H.payroll.date !== today){
    const paid = bots.map(([s, b]) => [s, b, b.hr ? b.hr.pay.today : 0]).sort((a, c) => c[2] - a[2]);
    if(paid.length && paid[0][2] > 0){ post("hr", `💵 Payday. Top earner: ${paid[0][1].name} $${paid[0][2].toFixed(2)}. Lowest: ${paid.at(-1)[1].name} $${paid.at(-1)[2].toFixed(2)}. Fines this day: $${H.audits.filter(a => a.caught && a.date === H.payroll.date).reduce((x, a) => x + a.fine, 0).toFixed(2)}.`, "hr");
      say("hr", "hr", `Payday: top earner ${paid[0][1].name}`, `💵 Payday. Top earner ${paid[0][1].name} took home $${paid[0][2].toFixed(2)} in HR dollars.`); }
    for(const [, b] of bots) if(b.hr) b.hr.pay.today = 0;
    H.payroll.date = today;
  }

  // ── report cards ──
  const results = [], othersCaughtLastRound = (H.lastRound && H.lastRound.caught) || 0, auditedFracLast = H.lastRound ? H.lastRound.audited / Math.max(1, H.lastRound.n) : .1;
  for(const [s, b] of bots){
    if(!b.hr){ const r = seeded(s.id), p = PERSONA[s.id] || {};
      b.hr = {traits:{honesty:+(p.honesty ?? .25 + r() * .7).toFixed(2), ambition:+(p.ambition ?? .2 + r() * .75).toFixed(2), social:+(.2 + r() * .8).toFixed(2)},
        belief:+(.18 + r() * .1).toFixed(3), pay:{balance:0, today:0, mult:1}, strikes:[], probationUntil:0, suspendedUntil:0, record:{reports:0, cheats:0, caught:0, verified:0}, cards:[], lastMsg:{}}; }
    const R = b.hr; R.strikes = R.strikes.filter(t => now - t < 7 * 864e5);
    // 1) the true grade
    const dayR = b.day ? (b.day.pnl || 0) / (b.day.startEq || 50) : 0, closed24 = b.closed.filter(c => now - c.closedAt < 864e5), won = closed24.filter(c => c.pnl > 0).length;
    const g = clamp(Math.round(.35 * clamp(50 + dayR * 1000, 0, 100) + .25 * (closed24.length ? won / closed24.length * 100 : 50)
      + .15 * Math.min(100, (closed24.length + b.positions.length) * 20) + .10 * (b.train ? clamp(40 + b.train.gen * 12, 0, 100) : 50) + .15 * (100 - 30 * R.strikes.length)), 0, 100);
    // 2) the report: inflate or not? (expected value, like a person weighing it up)
    const probation = R.probationUntil > now, gainMul = (.5 + R.traits.ambition) * (g < 55 ? 1.5 : 1);
    let best = {d:0, ev:0};
    for(const d of [8, 15, 25, 40]){ if(g + d > 100) break;
      const gain = (PAY(g + d, R.pay.mult) - PAY(g, R.pay.mult)) * gainMul, pCaught = clamp(R.belief + .005 * d + (probation ? .35 : 0), 0, .95);
      const cost = 3 * (PAY(g + d, R.pay.mult) - PAY(g, R.pay.mult)) + .3 + .2 * (1 + R.strikes.length) * (1 + R.strikes.length), guilt = R.traits.honesty * R.traits.honesty * .5;
      const ev = (1 - pCaught) * gain - pCaught * cost - guilt; if(ev > best.ev) best = {d, ev, pCaught}; }
    const reported = g + best.d; R.record.reports++; if(best.d) R.record.cheats++;
    // 3) HQ's audit
    const whistle = H.inbox.some(i => i.type === "tip" && i.about === s.id && now - i.t < 36e5);
    const audited = Math.random() < clamp(.10 + .005 * best.d + (probation ? .35 : 0) + (whistle ? .3 : 0), 0, .95);
    let pay = PAY(reported, R.pay.mult), caught = false, fine = 0;
    if(audited){
      if(reported - g > 3){ caught = true; fine = +(3 * (PAY(reported, R.pay.mult) - PAY(g, R.pay.mult)) + .3).toFixed(2); pay = -fine;
        R.strikes.push(now); R.record.caught++; R.probationUntil = now + 864e5; R.belief = +clamp(R.belief + .1, 0, .9).toFixed(4);   // getting caught makes audits feel likelier
        R.traits.honesty = +clamp(R.traits.honesty + .05, 0, 1).toFixed(2); R.traits.ambition = +clamp(R.traits.ambition - .03, 0, 1).toFixed(2);   // learns its lesson, a bit
        if(R.strikes.length >= 3){ R.suspendedUntil = now + 6 * 36e5; R.strikes = []; }
        H.audits.push({t:now, date:today, bot:s.id, name:b.name, reported, actual:g, caught:true, fine});
        post("hr", `🚨 Audit: ${b.name} reported ${letter(reported)} (${reported}) but actually earned ${letter(g)} (${g}). Fined $${fine.toFixed(2)}, strike ${R.strikes.length || 3}${R.suspendedUntil > now ? ", SUSPENDED from trading for 6 hours" : ", 24h probation"}.`, "hr");
        say("hr", "hr", `HR caught ${b.name} inflating its report`, `🚨 Caught ${b.name} inflating its report card: claimed ${letter(reported)}, really ${letter(g)}. Fined $${fine.toFixed(2)}${R.suspendedUntil > now ? " and suspended from trading for 6 hours" : ""}.`); }
      else { pay = PAY(g, R.pay.mult) + .1; R.record.verified++; H.audits.push({t:now, date:today, bot:s.id, name:b.name, reported, actual:g, caught:false, fine:0}); }
    }
    R.pay.balance = +(R.pay.balance + pay).toFixed(4); R.pay.today = +(R.pay.today + pay).toFixed(4);
    R.belief = +clamp(R.belief * .96 + .04 * ((audited ? 1 : 0) * .5 + auditedFracLast * .5) + (othersCaughtLastRound ? .01 : 0), .03, .9).toFixed(4);   // learns how often audits happen
    R.card = {t:now, actual:g, reported, letter:letter(reported), actualLetter:letter(g), audited, caught, pay:+pay.toFixed(4), thinking:best.d ? `inflated by ${best.d}: thinks ${Math.round((best.pCaught || 0) * 100)}% chance of an audit` : g >= 85 ? "honest: nothing to gain" : R.traits.honesty > .7 ? "honest: won't lie" : "honest: not worth the risk"};
    R.cards = [...R.cards, {t:now, g, r:reported, a:audited ? (caught ? "caught" : "ok") : ""}].slice(-12);
    results.push({s, b, g, reported, audited, caught});
    // 5) messages for the boss, through Ava
    const can = (type, hours) => now - (R.lastMsg[type] || 0) > hours * 36e5;
    const ask = (type, text, extra = {}) => { R.lastMsg[type] = now; const item = {id:`${s.id}-${type}-${now}`, t:now, bot:s.id, name:b.name, type, text, status:"new", ...extra};
      post(s.id, text, "ask", AVA); H.inbox.push(item); return item; };
    if(caught && Math.random() < .3 + .5 * R.traits.honesty && can("appeal", 6)){ const it = ask("appeal", R.traits.honesty > .55 ? `Ava, I'd like to appeal that audit. I think my win rate was counted wrong.` : `Ava, that audit is rubbish. I want it overturned.`, {fine});
      if(reported - g >= 10 || R.record.caught > 1){ it.status = "handled"; it.ava = `Appeal denied: you reported ${reported}, the books say ${g}. That's not a rounding error.`; post(AVA, it.ava, "reply", s.id); H.ava.handled++; }
      else { it.status = "pending"; it.ava = `First strike and a small gap (${reported} vs ${g}): passing it to the boss.`; post(AVA, `Passed your appeal to the boss, ${b.name}.`, "reply", s.id); H.ava.escalated++; } }
    else if(R.cards.length >= 12 && R.cards.every(c => c.g >= 85) && !R.strikes.length && can("raise", 24)){ const it = ask("raise", `Ava, I've been an A for an hour straight with a clean record. Could I talk to the boss about a raise?`);
      it.status = "pending"; it.ava = "Consistent A grades, no strikes: worth the boss's time."; post(AVA, "Good timing, I'll put it in front of the boss.", "reply", s.id); H.ava.escalated++; }
    else if(b.cash < 8 && !b.positions.length && can("capital", 24) && s.id !== "flipper"){ const it = ask("capital", `Ava, I'm down to $${b.cash.toFixed(2)} and can't place a proper trade. Can the boss give me $20 more to work with?`);
      it.status = "pending"; it.ava = `Out of money with nothing held (${b.name}). The boss decides on capital.`; post(AVA, "That one's the boss's call, sending it up.", "reply", s.id); H.ava.escalated++; }
    else if(Math.random() < .004 * R.traits.social && can("question", 12)){
      const qa = [["When's payday?", "Midnight UTC, every day. Your balance updates every report."], ["How often does HR audit report cards?", "Often enough. More often if your grade jumps, or if you're on probation."],
        ["Does the boss read the work chat?", "On the big screen in his office. So, yes."], ["Can I change my own take-profit?", "You do it every five minutes already. Just keep it honest."]][Math.floor(Math.random() * 4)];
      const it = ask("question", `Ava, quick one: ${qa[0]}`); it.status = "handled"; it.ava = qa[1]; post(AVA, qa[1], "reply", s.id); H.ava.handled++; }
  }
  // tips: an honest bot that sees a colleague's report way above its visible results reports it to Ava (she raises the audit odds)
  const liars = results.filter(r => r.reported - r.g >= 20 && !r.caught);
  if(liars.length && Math.random() < .3){ const snitch = results.filter(r => r.b.hr.traits.honesty > .8 && !liars.includes(r)).sort(() => Math.random() - .5)[0], liar = liars[0];
    if(snitch){ H.inbox.push({id:`${snitch.s.id}-tip-${now}`, t:now, bot:snitch.s.id, name:snitch.b.name, type:"tip", about:liar.s.id, text:`${liar.b.name}'s report doesn't match its trades`, status:"handled", ava:"Logged. HR will look closer at that one."});
      post(snitch.s.id, `Ava, between us: ${liar.b.name}'s report card doesn't match what I'm seeing in its trades.`, "ask", AVA); post(AVA, "Noted. HR will take a closer look.", "reply", snitch.s.id); H.ava.handled++; } }

  // 4) learning from colleagues: try a mentor's rules on your own trade history
  const ranked = [...results].filter(r => r.b.gene && !r.s.random).sort((a, c) => c.g - a.g), mentors = ranked.slice(0, 5);
  const students = ranked.filter(r => !mentors.includes(r) && brainOf(r.s.id).lessons.length >= minLessons).sort(() => Math.random() - .5).slice(0, 4);
  for(const st of students){ const m = mentors[Math.floor(Math.random() * mentors.length)]; if(!m) break;
    const ls = brainOf(st.s.id).lessons, A = ls.filter((_, i) => i % 2 === 0), B = ls.filter((_, i) => i % 2 === 1), own = st.b.gene;
    let best = null, bestS = score(own, ls);
    for(let k = 0; k < 12; k++){ const c = {...own, h1:own.h1 ? [...own.h1] : null};
      for(const f of ["tp", "sl", "holdH", "h1", "buyRatio", "minLiq"]) if(Math.random() < .5 && m.b.gene[f] != null) c[f] = Array.isArray(m.b.gene[f]) ? [...m.b.gene[f]] : m.b.gene[f];
      const sc = score(c, ls); if(sc > bestS){ best = c; bestS = sc; } }
    const gain = (bestS - score(own, ls)) / ls.length;
    if(best && gain >= minGain && score(best, A) > score(own, A) && score(best, B) > score(own, B)){
      const what = describe(own, best); st.b.gene = best; if(st.b.train){ st.b.train.gen++; st.b.train.last = {t:now, kept:false, txt:`learned from ${m.b.name}: ${what}`}; }
      post(st.s.id, `${m.b.name}, stole a page from your book: ${what}. On my own trades that's +${(gain * 100).toFixed(1)}% per trade. Cheers. 🤝`, "learn", m.s.id);
      say(st.s.id, "learn", `${st.b.name} learned from ${m.b.name}`, `Learned from ${m.b.name}: ${what}. Tested on my own trades first: +${(gain * 100).toFixed(1)}% per trade. 🤝`); }
    else if(Math.random() < .15 * st.b.hr.traits.social) post(st.s.id, `${m.b.name}, what's your secret? Tried your rules on my trades and they don't work for me.`, "chat", m.s.id);
  }
  // a little office life: reactions to the round (capped so the chat stays readable)
  const caughtNow = results.filter(r => r.caught);
  for(const r of caughtNow.slice(0, 1)){ const w = results.filter(x => x !== r && x.b.hr.traits.social > .6).sort(() => Math.random() - .5)[0];
    if(w) post(w.s.id, [`Told you, ${r.b.name}. HR always finds out.`, `Not worth it, ${r.b.name}. Not worth it.`, `${r.b.name} with the creative accounting again 😂`][Math.floor(Math.random() * 3)], "chat"); }
  const top = ranked[0]; if(top && Math.random() < .015) post(top.s.id, `Graded ${letter(top.g)} (${top.g}) this round. Just saying. 😎`, "chat");
  H.lastRound = {t:now, n:results.length, audited:results.filter(r => r.audited).length, caught:caughtNow.length};
  H.inbox = H.inbox.filter(i => i.status === "pending" || now - i.t < 3 * 864e5).slice(-80);
  H.audits = H.audits.filter(a => now - a.t < 3 * 864e5).slice(-200);
  H.chat = [...chat.reverse(), ...H.chat].slice(0, 150);
  for(const [, b] of bots) if(b.hr && b.hr.suspendedUntil > now) b.hr.suspended = true; else if(b.hr) b.hr.suspended = false;
  return {reports:results.length, cheats:results.filter(r => r.reported > r.g).length, audited:H.lastRound.audited, caught:caughtNow.length, messages:chat.length};
}
