"""Round 30: "wait for a long row of one colour, then bet the opposite."

After N candles in a row closed the same colour (green = close above open), what did the next candle do?
Bet the opposite colour, entering at the next candle's open (you see the streak once its last candle closes).
Reports how often the next candle really flipped, and the average move in the bet's direction in basis points
(1 bp = 0.01%). Flat candles (open == close) are counted as neither colour and break a streak.
1-minute candles: last 45 days. 15-minute candles: 2023 onward. All five coins.
"""
import numpy as np
import pandas as pd

COINS = ["BTC", "ETH", "SOL", "XRP", "DOGE"]

for iv in ("1m", "15m"):
    print(f"\n== {iv} candles: bet AGAINST a streak, hold one candle ==")
    for sym in COINS:
        d = pd.read_csv(f"data/{sym}USDT_{iv}.csv.gz")
        o, c = d.Open.to_numpy(), d.Close.to_numpy()
        col = np.sign(c - o)                                   # +1 green, -1 red, 0 flat
        run = np.zeros(len(col), int)
        for i in range(len(col)):
            run[i] = run[i - 1] + 1 if i and col[i] != 0 and col[i] == col[i - 1] else (1 if col[i] != 0 else 0)
        nxt = np.concatenate([(c[1:] - o[1:]) / o[1:], [np.nan]])   # the next candle, open to close
        cells = []
        for n in (3, 5, 7, 9):
            ok = (run == n) & ~np.isnan(nxt)                      # exactly n in a row (counted once per streak length)
            if ok.sum() < 30:
                continue
            bet = -col[ok] * nxt[ok] * 1e4
            flipped = (np.sign(nxt[ok]) == -col[ok]).mean()
            cells.append(f"{n} in a row: {ok.sum():6d} times, flipped {flipped:5.1%}, avg {bet.mean():+5.2f} bp")
        print(f"  {sym:<4} " + " | ".join(cells))
