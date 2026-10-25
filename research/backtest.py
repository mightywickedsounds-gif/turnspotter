"""Walk-forward test of the online logistic-regression model used by the Pine indicator.

The model only ever sees the past: at bar t it predicts the direction of close[t+h]
vs close[t], and it is trained on bar t-h once that label is known. This mirrors
exactly what the TradingView script does bar by bar.
"""
import sys
import numpy as np
import pandas as pd

LR, L2, CLIP = 0.02, 1e-4, 3.0


def rma(x, n):
    return x.ewm(alpha=1 / n, adjust=False).mean()


def features(df):
    c, h, l, v = df.Close, df.High, df.Low, df.Volume
    lr = np.log(c).diff()
    sd = lr.rolling(50).std()
    delta = c.diff()
    rsi = 100 - 100 / (1 + rma(delta.clip(lower=0), 14) / rma(-delta.clip(upper=0), 14))
    ema_f, ema_s = c.ewm(span=12, adjust=False).mean(), c.ewm(span=48, adjust=False).mean()
    hi24, lo24 = h.rolling(24).max(), l.rolling(24).min()
    lv = np.log(v + 1)
    f = pd.DataFrame({
        "ret1": lr / sd,
        "ret3": np.log(c / c.shift(3)) / (sd * np.sqrt(3)),
        "ret12": np.log(c / c.shift(12)) / (sd * np.sqrt(12)),
        "ret48": np.log(c / c.shift(48)) / (sd * np.sqrt(48)),
        "rsi": (rsi - 50) / 25,
        "trend": np.log(ema_f / ema_s) / (sd * 4),
        "range_pos": 2 * (c - lo24) / (hi24 - lo24).replace(0, np.nan) - 1,
        "vol_z": (lv - lv.rolling(50).mean()) / lv.rolling(50).std(),
        "vol_regime": lr.rolling(20).std() / lr.rolling(100).std() - 1,
    })
    return f.clip(-CLIP, CLIP)


def run(df, h):
    X = features(df).to_numpy()
    X = np.hstack([X, np.ones((len(X), 1))])
    y = (df.Close.shift(-h) > df.Close).to_numpy(float)
    w = np.zeros(X.shape[1])
    prob = np.full(len(X), np.nan)
    for t in range(len(X)):
        j = t - h  # bar whose outcome is now known
        if j >= 0 and not np.isnan(X[j]).any():
            p = 1 / (1 + np.exp(-X[j] @ w))
            w += LR * ((y[j] - p) * X[j] - L2 * w)
        if not np.isnan(X[t]).any():
            prob[t] = 1 / (1 + np.exp(-X[t] @ w))
    return prob, y, w


def report(df, h, warmup=2000):
    prob, y, w = run(df, h)
    m = ~np.isnan(prob)
    m[: warmup] = False
    m[-h:] = False
    p, yy = prob[m], y[m]
    pred = p > 0.5
    rows = [("all bars", m.sum(), (pred == yy).mean())]
    for thr in (0.55, 0.60, 0.65):
        s = np.abs(p - 0.5) >= thr - 0.5
        if s.sum():
            rows.append((f"confidence >= {thr:.0%}", s.sum(), (pred[s] == yy[s]).mean()))
    base = max(yy.mean(), 1 - yy.mean())
    print(f"\n=== Horizon {h} bar(s)  | 'always guess majority' baseline: {base:.2%}")
    for name, n, acc in rows:
        print(f"  {name:<20} n={n:>6}  accuracy={acc:.2%}")
    return w


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "btc_1h_2011_2017.csv"
    raw = pd.read_csv(path)
    raw["Timestamp"] = pd.to_datetime(raw.Timestamp, unit="s")
    raw = raw.set_index("Timestamp").rename(columns={"Volume_BTC": "Volume"})
    raw = raw[raw.Close > 0].dropna(subset=["Close"])
    print(f"Data: {raw.index[0]} -> {raw.index[-1]}, {len(raw)} hourly bars")
    for tf, rule in (("1h", None), ("4h", "4h"), ("1d", "1D")):
        df = raw if rule is None else raw.resample(rule).agg(
            {"Open": "first", "High": "max", "Low": "min", "Close": "last", "Volume": "sum"}).dropna()
        print(f"\n######## Timeframe {tf} ({len(df)} bars)")
        for h in (1, 4) if tf != "1d" else (1,):
            w = report(df, h, warmup=2000 if tf != "1d" else 300)
        names = list(features(df).columns) + ["bias"]
        print("  final weights:", ", ".join(f"{n}={v:+.3f}" for n, v in zip(names, w)))
