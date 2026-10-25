"""Round 4: test ideas from the research on REAL recent data (2023 onward, all five coins).

Data comes from research/data/*.csv.gz (downloaded by research/fetch_data.py on GitHub).
Same walk-forward rules as before: fresh models per 2,000-candle window (what the site loads),
only the last 700 candles of each window scored, self-check pause on, both brains must agree.
"""
import sys
import numpy as np
import pandas as pd
from experiments import online
from experiments2 import knn_probs, score

COINS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "DOGEUSDT"]


def load(sym, iv="15m"):
    d = pd.read_csv(f"data/{sym}_{iv}.csv.gz")
    d["Timestamp"] = pd.to_datetime(d.Timestamp, unit="s")
    return d.set_index("Timestamp")


def base_feats(df):
    c, h, l, v = df.Close, df.High, df.Low, df.Volume
    lr = np.log(c).diff(); sd = lr.rolling(50).std()
    delta = c.diff()
    rma = lambda x: x.ewm(alpha=1/14, adjust=False).mean()
    rsi = 100 - 100 / (1 + rma(delta.clip(lower=0)) / rma(-delta.clip(upper=0)))
    ef, es = c.ewm(span=12, adjust=False).mean(), c.ewm(span=48, adjust=False).mean()
    hi, lo = h.rolling(24).max(), l.rolling(24).min()
    lv = np.log(v + 1); vz = (lv - lv.rolling(50).mean()) / lv.rolling(50).std()
    f = pd.DataFrame({
        "ret1": lr / sd, "ret3": np.log(c / c.shift(3)) / (sd * np.sqrt(3)),
        "ret12": np.log(c / c.shift(12)) / (sd * np.sqrt(12)), "ret48": np.log(c / c.shift(48)) / (sd * np.sqrt(48)),
        "rsi": (rsi - 50) / 25, "trend": np.log(ef / es) / (sd * 4),
        "range_pos": 2 * (c - lo) / (hi - lo).replace(0, np.nan) - 1, "vol_z": vz,
        "vol_regime": lr.rolling(20).std() / lr.rolling(100).std() - 1,
    }).clip(-3, 3)
    f["volmom"] = (f.ret3 * f.vol_z.clip(lower=0)).clip(-3, 3)
    return f


def extra_feats(df, which, btc=None):
    f = pd.DataFrame(index=df.index)
    lr = np.log(df.Close).diff(); sd = lr.rolling(50).std()
    imb = (2 * df.TakerBuyVolume / df.Volume.replace(0, np.nan) - 1).fillna(0)
    if "taker" in which:
        f["imb1"] = (imb - imb.rolling(50).mean()) / imb.rolling(50).std()
        f["imb4"] = imb.rolling(4).mean() / imb.rolling(50).std()
    if "flow" in which:   # was the last move pushed by aggressive traders? (research: these moves tend to reverse)
        f["flowmove"] = (lr / sd) * imb.abs() * np.sign(imb * lr)
    if "btc" in which and btc is not None:
        b = btc.reindex(df.index)
        blr = np.log(b.Close).diff(); bsd = blr.rolling(50).std()
        f["btc1"] = blr / bsd
        f["btc3"] = np.log(b.Close / b.Close.shift(3)) / (bsd * np.sqrt(3))
        f["btc_gap"] = f["btc1"] - (lr / sd)   # BTC moved but this coin hasn't caught up yet
    if "time" in which:
        hr = df.index.hour + df.index.minute / 60
        f["hsin"], f["hcos"] = np.sin(2 * np.pi * hr / 24), np.cos(2 * np.pi * hr / 24)
        f["q0"] = (df.index.minute == 0).astype(float) * 2 - 1
    return f.clip(-3, 3)


def run(df, h, extras=(), btc=None, conf=0.58, window=2000, scored=700, both=True, step=700):
    F = base_feats(df)
    if extras:
        F = pd.concat([F, extra_feats(df, extras, btc)], axis=1)
    X = np.hstack([F.to_numpy(), np.ones((len(F), 1))])
    c = df.Close.to_numpy()
    y = np.r_[(c[h:] > c[:-h]).astype(float), np.full(h, np.nan)]
    yrs = np.full(len(df), 2099)
    import experiments2 as e2
    e2.CONF = conf
    hits, n_cands = [], 0
    for a in range(0, len(df) - window, step):
        sl = slice(a, a + window); lo = window - scored
        Xs, ys = X[sl], y[sl].copy()
        pl, _ = online(Xs, ys, h, 0.02)
        if both:
            ym = ys.copy(); ym[-h:] = np.nan
            pk = knn_probs(Xs[:, :-1], ym, h, range(lo - 400, window - h))
            same = np.sign(pl - .5) == np.sign(pk - .5)
            p = np.where(same & (np.abs(pk - .5) >= .05), pl, np.nan)
        else:
            p = pl
        hits += score(p, c, ys, h, yrs[sl], a, lo, window)
        n_cands += scored
    return (np.mean(hits) if hits else np.nan), len(hits), len(hits) / max(1, n_cands)


if __name__ == "__main__":
    iv = sys.argv[1] if len(sys.argv) > 1 else "15m"
    btc = load("BTCUSDT", iv)
    tests = [("Current site model", {}),
             ("+ taker flow", {"extras": ("taker",)}),
             ("+ flow-driven moves", {"extras": ("flow",)}),
             ("+ BTC leads", {"extras": ("btc",)}),
             ("+ time of day", {"extras": ("time",)}),
             ("+ taker + flow + BTC", {"extras": ("taker", "flow", "btc")})]
    for h in (1, 4):
        print(f"\n=== {iv} candles, predicting {h} ahead (accuracy | calls | share of candles with a call)")
        for name, kw in tests:
            row = []
            for sym in COINS:
                df = load(sym, iv)
                if "btc" in kw.get("extras", ()) and sym == "BTCUSDT":
                    kw2 = dict(kw, extras=tuple(e for e in kw["extras"] if e != "btc"))
                else:
                    kw2 = kw
                acc, n, share = run(df, h, btc=btc, **kw2)
                row.append((sym[:-4], acc, n, share))
            tot = sum(r[2] for r in row); acc = sum(r[1] * r[2] for r in row if r[2]) / max(1, tot)
            print(f"  {name:<24} ALL {acc:6.2%} ({tot:>5}, {np.mean([r[3] for r in row]):.0%})  " +
                  "  ".join(f"{s} {a:5.1%}" for s, a, n, sh in row), flush=True)
