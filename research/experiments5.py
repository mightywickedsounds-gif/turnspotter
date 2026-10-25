"""Round 4c: tune the trained-once ('Experience') model on unseen 2025-07..2026-10 data.

Compares: Experience alone, Experience + Trend brain agreeing, Experience + self-check pause,
at several strictness levels. Entry 'now' and 'delayed' (one candle late) as before.
"""
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from experiments import online
from experiments4 import build, SPLIT

FEATS = ["ret1", "ret3", "ret12", "ret48", "rsi", "trend", "range_pos", "vol_z", "vol_regime", "volmom"]


def pause_mask(p, y, h, conf, gate=100):
    """True where the self-check would pause (last 100 resolved confident calls under 52%)."""
    paused = np.zeros(len(p), bool); calls = []
    for t in range(len(p)):
        known = [w for (j, w) in calls[-(gate + h):] if j + h <= t][-gate:]
        paused[t] = len(known) >= 50 and np.mean(known) < .52
        if abs(p[t] - .5) >= conf - .5 and not np.isnan(y[t]):
            calls.append((t, (p[t] > .5) == (y[t] == 1)))
    return paused


if __name__ == "__main__":
    h = 4
    data = build("15m", h, ())
    tr = data[data.index < SPLIT].dropna(subset=["y_now"])
    m = LogisticRegression(C=0.1, max_iter=500).fit(tr[FEATS], tr["y_now"])
    print("weights:", dict(zip(FEATS, np.round(m.coef_[0], 3))), "bias", round(m.intercept_[0], 3))
    rows = {k: [] for k in ("alone", "agree", "pause")}
    for coin, g in data[data.index >= SPLIT].groupby("coin"):
        p = m.predict_proba(g[FEATS])[:, 1]
        X = np.hstack([g[FEATS].to_numpy(), np.ones((len(g), 1))])
        yn = g.y_now.to_numpy()
        po, _ = online(X, yn, h, 0.02)
        for cf in (0.54, 0.55, 0.56, 0.57, 0.58):
            sel = np.abs(p - .5) >= cf - .5
            agree = sel & (np.sign(po - .5) == np.sign(p - .5))
            pm = sel & ~pause_mask(p, yn, h, cf)
            for k, s in (("alone", sel), ("agree", agree), ("pause", pm)):
                for col in ("y_now", "y_del"):
                    y = g[col].to_numpy(); ok = s & ~np.isnan(y)
                    rows[k].append((cf, coin, col, ok.sum(), ((p[ok] > .5) == (y[ok] == 1)).sum(), len(g)))
    for k, r in rows.items():
        df = pd.DataFrame(r, columns=["cf", "coin", "col", "n", "w", "N"])
        print(f"\n-- {k}")
        for cf, gg in df.groupby("cf"):
            now, dl = gg[gg.col == "y_now"], gg[gg.col == "y_del"]
            per = " ".join(f"{c}:{(x.w.sum()/x.n.sum()):.1%}" for c, x in dl.groupby("coin"))
            print(f"  conf {cf:.2f}: {now.n.sum()/now.N.sum():5.1%} of candles | now {now.w.sum()/now.n.sum():.1%} | delayed {dl.w.sum()/dl.n.sum():.1%}  ({per})")
