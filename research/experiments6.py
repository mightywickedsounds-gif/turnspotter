"""Round 20: which objections should the Critic bot raise? Tested on unseen 2025-07..2026-10 data.

For every confident Experience-brain call (1 hour ahead on 15-minute candles), check how often it was
right (entry one candle late, the strict test) when each objection is present vs absent.
"""
import numpy as np
from sklearn.linear_model import LogisticRegression
from experiments4 import build, SPLIT
FEATS = ["ret1", "ret3", "ret12", "ret48", "rsi", "trend", "range_pos", "vol_z", "vol_regime", "volmom"]

data = build("15m", 4, ("taker",))
tr = data[data.index < SPLIT].dropna(subset=["y_now"])
m = LogisticRegression(C=0.1, max_iter=500).fit(tr[FEATS], tr["y_now"])
te = data[data.index >= SPLIT].copy()
te["p"] = m.predict_proba(te[FEATS])[:, 1]
calls = te[(te.p - .5).abs() >= .05].copy()
calls["dir"] = np.sign(calls.p - .5)
calls["right"] = (calls.dir > 0) == (calls.y_del == 1)
calls = calls.dropna(subset=["y_del"])
objections = {
    "weak lean (AI under 56%)": (calls.p - .5).abs() < .06,
    "chasing (last candle moved >1σ the same way)": calls.ret1 * calls.dir > 1,
    "chasing (last 3 candles moved >1.5σ the same way)": calls.ret3 * calls.dir > 1.5,
    "betting against a >1σ move (fading)": calls.ret1 * calls.dir < -1,
    "flow against (taker flow opposite, >1σ)": calls.imb1 * calls.dir < -1,
    "flow with (taker flow same way, >1σ)": calls.imb1 * calls.dir > 1,
    "stretched (RSI far the same way)": calls.rsi * calls.dir > 1,
    "high-volatility regime": calls.vol_regime > .5,
}
base = calls.right.mean()
print(f"All confident calls: {len(calls)} · right {base:.1%}")
for name, mask in objections.items():
    a, b = calls[mask], calls[~mask]
    print(f"  {name:<52} present: {a.right.mean():.1%} ({len(a):>5})   absent: {b.right.mean():.1%} ({len(b):>5})")

# combined Critic: veto chasing; half size for each of (wild market, weak lean); two halves = veto
chase = calls.ret1 * calls.dir > 1
halves = ((calls.vol_regime > .5).astype(int) + ((calls.p - .5).abs() < .06).astype(int))
veto = chase | (halves >= 2)
half = ~veto & (halves == 1)
full = ~veto & (halves == 0)
print("\nCombined Critic:")
for name, mask in [("approved, full size", full), ("approved, half size", half), ("vetoed", veto)]:
    print(f"  {name:<22} {mask.mean():5.1%} of calls · right {calls[mask].right.mean():.1%}")
w = full * 1.0 + half * .5
print(f"  money-weighted hit rate with the Critic: {(calls.right * w).sum() / w.sum():.1%}  (without: {base:.1%})")
