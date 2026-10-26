"""Round 27: the Instagram reel's strategy. Mark a tight range, wait for price to break out of it, then take a
Trench x1000 trade in the breakout direction and cash out within a minute or so at about +20-33% of the stake.

Tested on the last 45 days of 1-minute candles for all five coins (research/data/*_1m.csv.gz):
  range    = the high and low of the previous 30 minutes, only when that range is tight (< 0.3% of price)
  breakout = a 1-minute candle closes above the range high (UP) or below the range low (DOWN)
  entry    = the next minute's open (you can't click faster than the candle that showed you the break)
  win      = price moves TP in your direction before it moves 0.1% against you (the x1000 bust), within 5 minutes
When one minute touches both lines we can't tell which came first, so it's scored with the same odds a random
walk would give (closer line more likely first). Compared with taking the same trades in random directions
and with fading the breakout, so we can see if the breakout itself adds anything.
"""
import numpy as np
import pandas as pd

COINS = ["BTC", "ETH", "SOL", "XRP", "DOGE"]
BUST, LOOK, MAXW, HOLD = .001, 30, .003, 5
rng = np.random.default_rng(1)


def trades(sym, tp):
    d = pd.read_csv(f"data/{sym}USDT_1m.csv.gz")
    o, h, l, c = (d[k].to_numpy() for k in ("Open", "High", "Low", "Close"))
    hi = pd.Series(h).rolling(LOOK).max().shift(1).to_numpy()
    lo = pd.Series(l).rolling(LOOK).min().shift(1).to_numpy()
    tight = (hi - lo) / c < MAXW
    out, i, n = [], LOOK, len(c)
    while i < n - HOLD - 2:
        dr = 1 if tight[i] and c[i] > hi[i] else -1 if tight[i] and c[i] < lo[i] else 0
        if not dr:
            i += 1
            continue
        res = {}
        for name, d_ in (("breakout", dr), ("fade", -dr), ("random", rng.choice([-1, 1]))):
            e = o[i + 1]
            up, dn = e * (1 + d_ * tp), e * (1 - d_ * BUST)
            r = 0
            for j in range(i + 1, i + 1 + HOLD):
                win = h[j] >= up if d_ > 0 else l[j] <= up
                bust = l[j] <= dn if d_ > 0 else h[j] >= dn
                if win and bust:
                    r = 1 if rng.random() < BUST / (BUST + tp) else -1
                elif win:
                    r = 1
                elif bust:
                    r = -1
                if r:
                    break
            # result in stakes, before fees: a win pays tp x 1000, a bust loses the stake,
            # and if neither line was hit in 5 minutes it closes at that price
            res[name] = tp * 1000 if r == 1 else -1 if r == -1 else max(-1, d_ * (c[i + HOLD] / e - 1) * 1000)
            res[name + "_won"] = r == 1
        out.append(res)
        i += HOLD + 1           # one trade at a time
    return pd.DataFrame(out)


for tp in (.0002, .00033):
    print(f"\n== take profit at +{tp * 100:.3f}% move = +{tp * 1000 * 100:.0f}% of the stake at x1000; bust at -0.100% ==")
    print(f"   break-even win rate before any fee: {BUST / (BUST + tp):.1%}")
    for sym in COINS:
        t = trades(sym, tp)
        cells = []
        for k in ("breakout", "fade", "random"):
            cells.append(f"{k} {t[k + '_won'].mean():5.1%} won, {t[k].mean() * 100:+5.1f}% of stake/trade")
        print(f"  {sym:<4} {len(t):5d} breakouts | " + " | ".join(cells))
