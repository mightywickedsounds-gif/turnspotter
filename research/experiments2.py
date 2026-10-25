"""Round 2: does an 'analog' (nearest-neighbour) model or more history beat the current model?

Same rules as experiments.py: walk-forward, fresh model per window, scored on 2013-2017,
the last 1,000 candles of each window only, self-check pause on, momentum x volume on.
"""
import numpy as np
from experiments import load, feats, online

CONF = 0.58


def knn_probs(X, y, h, idx, k=60, pool=None):
    """For each candle t in idx: find the k most similar past candles whose outcome is known."""
    out = np.full(len(X), np.nan)
    ok = ~np.isnan(X).any(1) & ~np.isnan(y)
    for t in idx:
        lo = 0 if pool is None else max(0, t - pool)
        cand = np.where(ok[lo:t - h + 1])[0] + lo if t - h + 1 > lo else np.array([], int)
        if len(cand) < 200 or np.isnan(X[t]).any():
            continue
        d = ((X[cand] - X[t]) ** 2).sum(1)
        nn = cand[np.argpartition(d, k)[:k]]
        out[t] = (y[nn].sum() + 1) / (k + 2)
    return out


def score(p, c, y, h, years, a, lo, hi, gate=100):
    hits, calls = [], []
    for t in range(150, hi - h):
        if np.isnan(p[t]) or abs(p[t] - .5) < CONF - .5 or c[a + t + h] == c[a + t]:
            continue
        win = (p[t] > .5) == (y[t] == 1)
        known = [w for (j, w) in calls[-(gate + h):] if j + h <= t][-gate:]
        paused = len(known) >= 50 and np.mean(known) < 0.52
        calls.append((t, win))
        if not paused and t >= lo and years[t] >= 2013:
            hits.append(win)
    return hits


def run(df, h, window=3000, mode="logit"):
    F = feats(df, ("volmom",))
    X = np.hstack([F.to_numpy(), np.ones((len(F), 1))])
    c = df.Close.to_numpy()
    y = np.r_[(c[h:] > c[:-h]).astype(float), np.full(h, np.nan)]
    yrs = df.index.year.to_numpy()
    hits = []
    for a in range(max(0, window - 3000), len(df) - window, 1000):
        sl = slice(a, a + window)
        Xs, ys, cs = X[sl], y[sl].copy(), c
        # outcomes only count as known once they happened inside the window
        lo = window - 1000
        pl, _ = online(Xs, ys, h, 0.02)
        if mode == "logit":
            p = pl
        else:
            ym = ys.copy(); ym[-h:] = np.nan
            pk = knn_probs(Xs[:, :-1], ym, h, range(lo - 400, window - h))
            if mode == "knn":
                p = pk
            elif mode == "blend":
                p = np.where(np.isnan(pk), pl, (pl + pk) / 2)
            elif mode == "agree":
                same = np.sign(pl - .5) == np.sign(pk - .5)
                p = np.where(same & (np.abs(pk - .5) >= .05), pl, np.nan)
        hits += score(p, cs, ys, h, yrs[sl], a, lo, window)
    return np.mean(hits), len(hits)


if __name__ == "__main__":
    df = load()
    for h in (1, 4):
        print(f"\n=== {h} candle(s) ahead, 1h candles, confident calls (>= {CONF:.0%})")
        for name, kw in [("Current model (3,000 candles)", {}),
                         ("Current model, 6,000 candles", {"window": 6000}),
                         ("Analog model alone", {"mode": "knn"}),
                         ("Blend: current + analog", {"mode": "blend"}),
                         ("Both must agree", {"mode": "agree"})]:
            acc, n = run(df, h, **kw)
            print(f"  {name:<32} {acc:6.2%}  ({n} calls)", flush=True)
