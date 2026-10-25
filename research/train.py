"""Train the Experience brain and write its weights into index.html.

For each prediction distance (1, 4 and 16 fifteen-minute candles = 15 min, 1 hour, 4 hours):
  1. honest check: train on everything before the last 16 months, test on those 16 months
  2. ship: retrain on all data and write the weights between /*MODEL-START*/ and /*MODEL-END*/
Run from the research folder after fetch_data.py. The weekly GitHub job does both.
"""
import json, os, re
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from experiments4 import build

FEATS = ["ret1", "ret3", "ret12", "ret48", "rsi", "trend", "range_pos", "vol_z", "vol_regime", "volmom"]
HTML = os.path.join(os.path.dirname(__file__), "..", "index.html")

models, report = {}, {}
for h in (1, 4, 16):
    data = build("15m", h, ())
    test_start = data.index.max() - pd.Timedelta(days=480)
    tr = data[data.index < test_start].dropna(subset=["y_now"])
    te = data[data.index >= test_start]
    m = LogisticRegression(C=0.1, max_iter=500).fit(tr[FEATS], tr["y_now"])
    p = m.predict_proba(te[FEATS])[:, 1]
    rep = {}
    for cf in (0.55, 0.56, 0.58):
        sel = np.abs(p - .5) >= cf - .5
        acc = {}
        for col in ("y_now", "y_del"):
            y = te[col].to_numpy(); ok = sel & ~np.isnan(y)
            acc[col] = round(float(((p[ok] > .5) == (y[ok] == 1)).mean()), 4)
        rep[str(cf)] = {"share": round(float(sel.mean()), 3), "now": acc["y_now"], "delayed": acc["y_del"]}
    report[h] = rep
    print(f"h={h:>2} tested on {te.index.min():%Y-%m-%d}..{te.index.max():%Y-%m-%d}:", rep, flush=True)
    full = data.dropna(subset=["y_now"])
    mf = LogisticRegression(C=0.1, max_iter=500).fit(full[FEATS], full["y_now"])
    models[h] = {"w": [round(float(x), 5) for x in mf.coef_[0]], "b": round(float(mf.intercept_[0]), 5)}

stamp = pd.Timestamp.now(tz="UTC").strftime("%Y-%m-%d")
block = ("/*MODEL-START*/\n// Experience brain weights: logistic regression trained on all five coins' 15-minute candles since 2023.\n"
         f"// Written by research/train.py on {stamp}. Out-of-sample check (last 16 months): {json.dumps(report)}\n"
         f"const EXPERIENCE = {json.dumps({'trained': stamp, 'feats': FEATS, 'models': models})};\n/*MODEL-END*/")
html = open(HTML).read()
if "/*MODEL-START*/" in html:
    html = re.sub(r"/\*MODEL-START\*/.*?/\*MODEL-END\*/", lambda _: block, html, flags=re.S)
else:
    html = html.replace("/*LOGIC-START*/", "/*LOGIC-START*/\n" + block, 1)
open(HTML, "w").write(html)
print("wrote weights to index.html")
