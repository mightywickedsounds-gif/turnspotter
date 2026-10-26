"""Round 24: do the Experience brain's calls make money, not just win more than half the time?

Trained once on 2023-01..2025-06, tested on 2025-07..2026-10 (never seen). For every candle where the
model leans at least `conf`, take the call one candle late (the strict entry) and hold H candles.
Reports the average move in the called direction in basis points (1 bp = 0.01%), before costs, by
confidence and horizon. A real trade costs roughly 5-15 bp round trip (spread + exchange fee), so an
idea needs an average move well above that to survive.
"""
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from experiments3 import load, base_feats, COINS
from experiments4 import SPLIT

FEATS = ["ret1", "ret3", "ret12", "ret48", "rsi", "trend", "range_pos", "vol_z", "vol_regime", "volmom"]


def build(iv, h):
    frames = []
    for sym in COINS:
        d = load(sym, iv)
        F = base_feats(d)[FEATS].copy()
        c = d.Close
        F["y"] = (c.shift(-h) > c).astype(float).where(c.shift(-h) != c)
        F["r_del"] = c.shift(-h - 1) / c.shift(-1) - 1        # entry one candle late, hold h candles
        F["coin"] = sym[:-4]
        frames.append(F.dropna(subset=FEATS))
    return pd.concat(frames)


for iv, hs in (("15m", (4, 16)), ("1h", (4, 12, 24))):
    for h in hs:
        data = build(iv, h)
        tr, te = data[data.index < SPLIT].dropna(subset=["y"]), data[data.index >= SPLIT].dropna(subset=["r_del"]).copy()
        m = LogisticRegression(C=0.1, max_iter=500).fit(tr[FEATS], tr["y"])
        te["p"] = m.predict_proba(te[FEATS])[:, 1]
        te["sig"] = np.sign(te.p - .5) * te.r_del * 1e4
        hold = f"{h * (15 if iv == '15m' else 60) / 60:g}h"
        print(f"\n== {iv} candles, hold {hold} (test {te.index.min():%Y-%m}..{te.index.max():%Y-%m}) ==")
        for conf in (.52, .55, .58, .60, .65):
            sel = te[(te.p - .5).abs() >= conf - .5]
            if len(sel) < 200:
                continue
            right = (sel.sig > 0).mean()
            by = sel.groupby("coin").sig.mean()
            print(f"  lean >= {conf:.0%}: {len(sel):6d} calls ({len(sel) / len(te):4.0%}), right {right:.1%}, "
                  f"avg move {sel.sig.mean():+6.1f} bp  | " + " ".join(f"{k} {v:+.1f}" for k, v in by.items()))
