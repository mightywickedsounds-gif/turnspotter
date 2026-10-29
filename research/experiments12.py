"""Round 31: how would the Scalper bot do if it were really trading on Trench?

1-minute candles can't replay x1000 trades (the tiny wiggles inside a minute decide them), so this simulates
the price second by second:
  - each coin's real volatility: the typical 1-minute move over the last 45 days, spread evenly over 60 s
  - the real follow-through after a strong 3-minute move, measured in experiments10.py (the next minute kept
    going by +0.31 bp on BTC ... +0.64 bp on XRP on average), as a steady push in the trade's direction;
    also run with no push and with double the push
  - the bot's exact exit rules at x1000: bust at -0.1%, take profit at +30% of the stake, close instantly at
    85% of it, bank a profit held at 40%+ of it for 3 s, close a winner that gives back half its best,
    and close after 60 s
  - Trench's costs: the 1% fee on the stake, plus an entry price worse than the chart by a "spread"
    (0, 0.5 or 1 bp; Trench doesn't publish it, and its price ran about $100 = 1.2 bp away from Coinbase)
  - 25% of the balance per trade, $50 start, one trade at a time
"""
import numpy as np
import pandas as pd

rng = np.random.default_rng(7)
COINS = {"BTC": .31, "ETH": .20, "SOL": .51, "XRP": .64, "DOGE": .53}   # follow-through in bp per minute (3-min move > 2x)
MULT, TP, HOLD_AT, NEAR, GIVEBACK, BUST = 1000, .30, .40, .85, .5, .001
STEPS = 240                                                                   # quarter-second steps over 60 s


def sigma_1m(sym):
    d = pd.read_csv(f"data/{sym}USDT_1m.csv.gz")
    r = np.diff(np.log(d.Close.to_numpy()))
    return np.std(r[r != 0])          # ignore minutes with no trades at all (thin Binance US hours)


def trades(n, sd1m, drift_bp, spread_bp):
    """P&L of n trades as a fraction of the stake, after the fee."""
    sd = sd1m / np.sqrt(STEPS)
    mu = drift_bp * 1e-4 / STEPS
    x = np.cumsum(rng.normal(mu, sd, (n, STEPS)), axis=1) - spread_bp * 1e-4   # price move from entry, trade's direction
    pnl = np.clip(MULT * x, -1, None)
    out = np.empty(n)
    for i in range(n):
        p, held, best, res = pnl[i], 0, 0.0, None
        for k in range(STEPS):
            v = p[k]
            if x[i, k] <= -BUST: res = -1.0; break
            if v >= TP: res = TP; break
            if v >= NEAR * TP: res = v; break
            held = held + 1 if v >= HOLD_AT * TP else 0
            if held >= 12: res = v; break              # 3 s at 40%+ of the target
            best = max(best, v)
            if best >= HOLD_AT * TP and v <= best * GIVEBACK: res = v; break
        out[i] = (p[-1] if res is None else res) - .01
    return out


print(f"x{MULT}, take profit +{TP:.0%}, 1% fee, 60 s max. Per-trade result as % of the stake (20,000 simulated trades each)\n")
rows = []
for sym, push in COINS.items():
    sd = sigma_1m(sym)
    for spread in (0, .5, 1):
        for name, drift in (("no edge", 0), ("measured edge", push), ("2x edge", 2 * push)):
            t = trades(20000, sd, drift, spread)
            rows.append((sym, spread, name, t.mean(), (t > 0).mean(), (t <= -.99).mean()))
    print(f"{sym}: normal 1-minute move {sd * 100:.3f}%  (bust is {BUST / sd:.1f}x that)")
df = pd.DataFrame(rows, columns=["coin", "spread_bp", "edge", "avg", "won", "busted"])
print()
for (sym, spread), g in df.groupby(["coin", "spread_bp"], sort=False):
    print(f"  {sym:<4} spread {spread:.1f} bp | " + " | ".join(f"{r.edge}: {r.avg * 100:+6.1f}% (won {r.won:.0%}, bust {r.busted:.0%})" for r in g.itertuples()))

# what that means for $50 at 25% a trade
print("\n$50, 25% of the balance per trade, BTC, measured edge: balance after N trades (1,000 runs each)")
sd = sigma_1m("BTC")
for spread in (0, .5, 1):
    pool = trades(40000, sd, COINS["BTC"], spread)
    cells = []
    for n in (20, 100, 300):
        bal = np.full(1000, 50.0)
        for k in range(n):
            bal *= 1 + .25 * rng.choice(pool, 1000)
        cells.append(f"{n} trades: median ${np.median(bal):6.2f}, ended up {np.mean(bal > 50):.0%}, under $5 {np.mean(bal < 5):.0%}")
    print(f"  spread {spread:.1f} bp | " + " | ".join(cells))
