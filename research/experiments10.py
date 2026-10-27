"""Round 28: "wait for it to start heading up, jump in, cash out within a minute."

On 45 days of 1-minute candles for all five coins: when the last 1, 2 or 3 minutes moved strongly one way
(bigger than k times the typical 1-minute move), what happened over the NEXT minute, entering at the next
minute's open (you can't click before the move you just watched)?
Reports how often the next minute continued the same way and the average move in basis points (0.01%).
A strategy that cashes out quickly at +X or -X (same size win and loss, cutting losers early) needs the next
move to continue clearly more than 50% of the time, plus enough to pay the spread.
"""
import numpy as np
import pandas as pd

COINS = ["BTC", "ETH", "SOL", "XRP", "DOGE"]

print("next minute after a strong move (entry at the next minute's open, hold 1 minute)\n")
for sym in COINS:
    d = pd.read_csv(f"data/{sym}USDT_1m.csv.gz")
    o, c = d.Open.to_numpy(), d.Close.to_numpy()
    r1 = np.log(c[1:] / c[:-1]); r1 = np.concatenate([[np.nan], r1])
    sd = pd.Series(r1).rolling(240).std().to_numpy()                 # typical 1-minute move over the last 4 hours
    nxt = np.concatenate([np.log(c[1:] / o[1:]), [np.nan]])           # next minute: its open -> its close
    rows = []
    for look in (1, 2, 3):
        past = pd.Series(r1).rolling(look).sum().to_numpy()
        for k in (1, 2, 3):
            z = past / (sd * np.sqrt(look))
            sig = np.where(z > k, 1, np.where(z < -k, -1, 0))
            ok = (sig != 0) & ~np.isnan(nxt)
            m = sig[ok] * nxt[ok] * 1e4
            if ok.sum() < 100:
                continue
            rows.append(f"last {look}m >{k}σ: {ok.sum():5d} times, continued {(m > 0).mean():5.1%}, avg {m.mean():+5.2f} bp")
    print(f"{sym}: " + "\n      ".join(rows))


# --- the same signal as an actual Trench-style trade: enter at the next minute's open, cash out at its close,
# --- bust if that minute's low/high reaches 1/multiplier against you, 1% of the stake as a fee.
print("\nTrench-style 1-minute trades after the last 3 minutes moved >2σ (one trade at a time), % of stake per trade")
print("(momentum = trade the move's direction, random = a coin flip, same moments)")
rng = np.random.default_rng(3)
for mult in (100, 500, 1000):
    cells = []
    for sym in COINS:
        d = pd.read_csv(f"data/{sym}USDT_1m.csv.gz")
        o, h, l, c = (d[k].to_numpy() for k in ("Open", "High", "Low", "Close"))
        r1 = np.concatenate([[np.nan], np.log(c[1:] / c[:-1])])
        sd = pd.Series(r1).rolling(240).std().to_numpy()
        z = pd.Series(r1).rolling(3).sum().to_numpy() / (sd * np.sqrt(3))
        res = {"momentum": [], "random": []}
        i = 300
        while i < len(c) - 2:
            if abs(z[i]) > 2:
                j = i + 1
                for name, dr in (("momentum", np.sign(z[i])), ("random", rng.choice([-1, 1]))):
                    worst = l[j] / o[j] - 1 if dr > 0 else 1 - h[j] / o[j]
                    pnl = -1 if worst <= -1 / mult else max(-1, mult * dr * (c[j] / o[j] - 1))
                    res[name].append(pnl - .01)
                i += 2
            else:
                i += 1
        m, r = np.mean(res["momentum"]), np.mean(res["random"])
        won = np.mean(np.array(res["momentum"]) > 0)
        cells.append(f"{sym} {m * 100:+5.1f}% (won {won:4.0%}) vs random {r * 100:+5.1f}%")
    print(f"  x{mult:<5} " + " | ".join(cells))
