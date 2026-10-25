"""Round 4b: a model trained once on years of real data vs. the site's learn-as-you-go model.

Train: 2023-01-01 .. 2025-06-30 (all five coins pooled). Test: 2025-07-01 onward (never seen).
Target: is price higher H candles later? Scored two ways:
  now     - entry at the signal candle's close (what the site does)
  delayed - entry one candle later, which removes any bid/ask-bounce illusion
"""
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import HistGradientBoostingClassifier
from experiments3 import load, base_feats, extra_feats, COINS

SPLIT = pd.Timestamp("2025-07-01")


def build(iv, h, extras):
    btc = load("BTCUSDT", iv)
    frames = []
    for sym in COINS:
        d = load(sym, iv)
        F = base_feats(d)
        ex = tuple(e for e in extras if not (e == "btc" and sym == "BTCUSDT"))
        if extras:
            F = pd.concat([F, extra_feats(d, ex, btc)], axis=1)
            if "btc" in extras and sym == "BTCUSDT":
                for col in ("btc1", "btc3", "btc_gap"):
                    F[col] = 0.0
        c = d.Close
        F["y_now"] = (c.shift(-h) > c).astype(float).where(c.shift(-h) != c)
        F["y_del"] = (c.shift(-h - 1) > c.shift(-1)).astype(float).where(c.shift(-h - 1) != c.shift(-1))
        F["coin"] = sym[:-4]
        frames.append(F.dropna(subset=[k for k in F.columns if k not in ("y_now", "y_del", "coin")]))
    return pd.concat(frames)


def evaluate(model, data, feats, conf_levels=(0.52, 0.54, 0.56, 0.58)):
    tr, te = data[data.index < SPLIT], data[data.index >= SPLIT]
    trn = tr.dropna(subset=["y_now"])
    model.fit(trn[feats], trn["y_now"])
    p = model.predict_proba(te[feats])[:, 1]
    out = []
    for cf in conf_levels:
        sel = np.abs(p - .5) >= cf - .5
        row = [cf, sel.mean()]
        for col in ("y_now", "y_del"):
            y = te[col].to_numpy(); ok = sel & ~np.isnan(y)
            row.append(((p[ok] > .5) == (y[ok] == 1)).mean())
        out.append(row)
    return out, te.assign(p=p)


if __name__ == "__main__":
    for iv, h in (("15m", 4), ("15m", 1), ("1h", 1)):
        print(f"\n===== {iv} candles, {h} ahead | trained 2023-01..2025-06, tested 2025-07..2026-10 =====")
        for name, extras, mdl in [
            ("Logistic, price features", (), "lr"),
            ("Logistic + taker + BTC", ("taker", "flow", "btc"), "lr"),
            ("Boosted trees, price features", (), "gb"),
            ("Boosted trees + taker + BTC", ("taker", "flow", "btc"), "gb"),
        ]:
            data = build(iv, h, extras)
            feats = [k for k in data.columns if k not in ("y_now", "y_del", "coin")]
            model = LogisticRegression(C=0.1, max_iter=500) if mdl == "lr" else \
                HistGradientBoostingClassifier(max_depth=4, learning_rate=0.05, max_iter=300, min_samples_leaf=500, l2_regularization=1.0)
            res, _ = evaluate(model, data, feats)
            print(f"  {name:<30} " + " | ".join(f"conf {cf:.2f}: {share:4.0%} of candles, {a:.1%} now / {b:.1%} delayed" for cf, share, a, b in res), flush=True)
