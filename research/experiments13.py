"""Round 33: does jumping in EARLIER on a move pay more than waiting for a 2x move?

On 45 days of 1-minute candles: trigger when the last 1, 2 or 3 minutes moved more than k times a normal move
(k = 0.5 ... 3), enter at the next minute's open, and measure the move in the trigger's direction over the next
1 and 3 minutes (basis points; 1 bp = 0.01%). Also: how often each trigger fires per day.
An earlier trigger catches more of the move only if what comes AFTER it still leans the right way.
"""
import numpy as np
import pandas as pd

for sym in ("BTC", "ETH", "SOL"):
    d = pd.read_csv(f"data/{sym}USDT_1m.csv.gz")
    o, c = d.Open.to_numpy(), d.Close.to_numpy()
    days = len(c) / 1440
    r1 = np.concatenate([[np.nan], np.log(c[1:] / c[:-1])])
    sd = pd.Series(r1).rolling(240).std().to_numpy()
    fwd = {h: np.concatenate([np.log(c[h:] / o[1:len(c) - h + 1]), [np.nan] * h]) for h in (1, 3)}   # next h minutes from the next open
    print(f"\n{sym}  (avg move in the trigger's direction, next 1 min / next 3 min, and triggers per day)")
    for look in (1, 3):
        past = pd.Series(r1).rolling(look).sum().to_numpy()
        z = past / (sd * np.sqrt(look))
        cells = []
        for k in (.5, 1, 1.5, 2, 3):
            sig = np.where(z > k, 1, np.where(z < -k, -1, 0))
            ok = (sig != 0) & ~np.isnan(fwd[3])
            a1, a3 = ((sig[ok] * fwd[1][ok] * 1e4).mean(), (sig[ok] * fwd[3][ok] * 1e4).mean())
            cells.append(f">{k}x: {a1:+.2f}/{a3:+.2f} bp, {ok.sum() / days:5.0f}/day")
        print(f"  last {look} min  " + " | ".join(cells))
