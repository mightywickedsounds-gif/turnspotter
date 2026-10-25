"""Tests candidate upgrades to the Turn Spotter model, the way the website runs it.

Each test window is 3,000 candles: the model learns from scratch (or from pre-trained
weights), and only calls in the last 1,000 candles are scored. Only 2013-2017 is
scored, because 2012 was an unusually inefficient market.
"""
import numpy as np
import pandas as pd
from backtest import features

CONF = 0.58


def load():
    d = pd.read_csv("btc_1h_2011_2017.csv")
    d["Timestamp"] = pd.to_datetime(d.Timestamp, unit="s")
    return d.set_index("Timestamp").rename(columns={"Volume_BTC": "Volume"})[["Open", "High", "Low", "Close", "Volume"]]


def feats(df, extra=()):
    f = features(df)
    hr = df.index.hour + df.index.minute / 60
    if "hour" in extra:
        f["hsin"], f["hcos"] = np.sin(2 * np.pi * hr / 24), np.cos(2 * np.pi * hr / 24)
        f["weekend"] = (df.index.dayofweek >= 5).astype(float) * 2 - 1
    if "volmom" in extra:
        f["volmom"] = (f.ret3 * f.vol_z.clip(lower=0)).clip(-3, 3)
    if "htf" in extra:
        lr = np.log(df.Close).diff(); sd = lr.rolling(50).std()
        f["ret168"] = (np.log(df.Close / df.Close.shift(168)) / (sd * np.sqrt(168))).clip(-3, 3)
    return f


def online(X, y, h, lr, w0=None, l2=1e-4):
    n, k = X.shape
    w = np.zeros(k) if w0 is None else w0.copy()
    p = np.full(n, np.nan)
    ok = ~np.isnan(X).any(1)
    for t in range(n):
        j = t - h
        if j >= 0 and ok[j]:
            q = 1 / (1 + np.exp(-X[j] @ w)); w += lr * ((y[j] - q) * X[j] - l2 * w)
        if ok[t] and t >= 150:
            p[t] = 1 / (1 + np.exp(-X[t] @ w))
    return p, w


def evaluate(df, h, extra=(), lrs=(0.02,), warm=False, gate=0):
    F = feats(df, extra)
    X = np.hstack([F.to_numpy(), np.ones((len(F), 1))])
    c = df.Close.to_numpy()
    y = np.r_[(c[h:] > c[:-h]).astype(float), np.full(h, np.nan)]
    years = df.index.year.to_numpy()
    hits = []
    for a in range(0, len(df) - 3000, 1000):
        sl = slice(a, a + 3000)
        w0 = None
        if warm and a >= 3000:  # weights learned on everything before this window
            _, w0 = online(X[:a], y[:a], h, 0.005)
        ps = [online(X[sl], y[sl], h, lr, w0)[0] for lr in lrs]
        p = np.nanmean(ps, 0) if len(ps) > 1 else ps[0]
        yy, yr = y[sl], years[sl]
        calls = []  # (candle, right?) for every confident call, scored or not
        for t in range(150, 3000 - h):
            if np.isnan(p[t]) or abs(p[t] - .5) < CONF - .5 or c[a + t + h] == c[a + t]:
                continue
            win = (p[t] > .5) == (yy[t] == 1)
            paused = False
            if gate:
                # self-check: only outcomes already known at candle t (call made at least h candles ago)
                known = [w for (j, w) in calls[-(gate + h):] if j + h <= t][-gate:]
                paused = len(known) >= 50 and np.mean(known) < 0.52
            calls.append((t, win))
            if not paused and t >= 2000 and yr[t] >= 2013:
                hits.append(win)
    return np.mean(hits), len(hits)


if __name__ == "__main__":
    df = load()
    tests = [
        ("Current model", {}),
        ("+ time of day / weekend", {"extra": ("hour",)}),
        ("+ momentum x volume", {"extra": ("volmom",)}),
        ("+ 1-week trend", {"extra": ("htf",)}),
        ("Ensemble of 3 learning speeds", {"lrs": (0.005, 0.02, 0.08)}),
        ("Pre-trained on older history", {"warm": True}),
        ("Self-check gate (last 100 calls)", {"gate": 100}),
    ]
    for h in (1, 4):
        print(f"\n=== Predicting {h} candle(s) ahead (1h candles), confident calls only")
        for name, kw in tests:
            acc, n = evaluate(df, h, **kw)
            print(f"  {name:<34} {acc:6.2%}  ({n} calls)")


def threshold_table(df):
    import experiments as ex
    print("\n=== Combined (momentum x volume + self-check gate) vs confidence threshold")
    for h in (1, 4):
        for conf in (0.55, 0.58, 0.62, 0.66):
            ex.CONF = conf
            a0, n0 = evaluate(df, h)
            a1, n1 = evaluate(df, h, extra=("volmom",), gate=100)
            print(f"  ahead={h} conf={conf:.2f}  current {a0:6.2%} ({n0:>5})   upgraded {a1:6.2%} ({n1:>5})")
