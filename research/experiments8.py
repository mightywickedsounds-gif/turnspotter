"""Round 24b: slow trend-following on daily candles, where costs are small next to the moves.

Each day at 00:00 UTC, for each of the five coins: hold it if its trend is up, otherwise hold cash
(long-only, spot, no leverage). The money is split equally across the five coins.
Rules tested (few on purpose, to avoid fitting noise):
  momN  - up if the price is above its level N days ago
  maN   - up if the price is above its N-day average
Costs: 0.15% per buy or sell (spread + a typical spot taker fee). Trades happen at the next day's open
price after the signal (strict entry). Compared with simply buying and holding all five coins.
Reported for the whole period and each year separately.
"""
import numpy as np
import pandas as pd
from experiments3 import load, COINS

COST = .0015


def daily(sym):
    d = load(sym, "1h")
    return d.resample("1D").agg({"Open": "first", "Close": "last"}).dropna()


px = {sym[:-4]: daily(sym) for sym in COINS}
idx = sorted(set.intersection(*(set(v.index) for v in px.values())))
O = pd.DataFrame({k: v.Open for k, v in px.items()}).loc[idx]
C = pd.DataFrame({k: v.Close for k, v in px.items()}).loc[idx]
ret = O.shift(-1) / O - 1            # open-to-open: a position decided at day t's close is held t+1 open -> t+2 open


def backtest(pos):
    pos = pos.shift(1).fillna(0)        # signal at close of day t, trade at open of t+1
    turn = pos.diff().abs().fillna(pos.abs())
    daily_r = (pos * ret - turn * COST).mean(axis=1).dropna()   # equal split across coins
    return daily_r


def stats(r):
    eq = (1 + r).cumprod()
    dd = (1 - eq / eq.cummax()).max()
    yrs = len(r) / 365
    cagr = eq.iloc[-1] ** (1 / yrs) - 1
    sharpe = r.mean() / r.std() * np.sqrt(365) if r.std() else 0
    return f"x{eq.iloc[-1]:5.2f}  yearly {cagr:+6.0%}  worst drop {dd:4.0%}  sharpe {sharpe:4.2f}"


rules = {"buy and hold": pd.DataFrame(1.0, index=C.index, columns=C.columns)}
for n in (20, 50, 100):
    rules[f"price above {n}-day average"] = (C > C.rolling(n).mean()).astype(float).where(C.rolling(n).mean().notna(), 0)
for n in (14, 30, 90):
    rules[f"price above {n} days ago"] = (C > C.shift(n)).astype(float).where(C.shift(n).notna(), 0)

print(f"Daily candles {C.index.min():%Y-%m-%d} .. {C.index.max():%Y-%m-%d}, five coins split equally, 0.15% per trade\n")
for name, pos in rules.items():
    r = backtest(pos)
    by_year = " | ".join(f"{y}: {(1 + g).prod() - 1:+5.0%}" for y, g in r.groupby(r.index.year))
    print(f"{name:<28} {stats(r)}   {by_year}")
