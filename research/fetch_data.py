"""Download recent real candles (with taker-buy volume) from Binance's public data archive.

Runs on GitHub's servers (see .github/workflows/fetch-data.yml), which can reach the exchange.
Writes research/data/<SYMBOL>_<interval>.csv.gz
"""
import csv, gzip, io, os, sys, urllib.request, zipfile
from datetime import date

COINS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "DOGEUSDT"]
INTERVALS = ["15m", "1h"]
START = date(2023, 1, 1)
OUT = os.path.join(os.path.dirname(__file__), "data")
BASE = "https://data.binance.vision/data/spot/{freq}/klines/{sym}/{iv}/{sym}-{iv}-{tag}.zip"


def months():
    y, m = START.year, START.month
    today = date.today()
    while (y, m) < (today.year, today.month):
        yield f"{y}-{m:02d}"
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)


def days_this_month():
    today = date.today()
    for d in range(1, today.day):
        yield f"{today.year}-{today.month:02d}-{d:02d}"


def get(url):
    try:
        with urllib.request.urlopen(url, timeout=60) as r:
            z = zipfile.ZipFile(io.BytesIO(r.read()))
            return z.read(z.namelist()[0]).decode().splitlines()
    except Exception as e:
        print("  miss", url.rsplit("/", 1)[-1], e)
        return []


os.makedirs(OUT, exist_ok=True)
for sym in COINS:
    for iv in INTERVALS:
        rows = []
        for tag in months():
            rows += get(BASE.format(freq="monthly", sym=sym, iv=iv, tag=tag))
        for tag in days_this_month():
            rows += get(BASE.format(freq="daily", sym=sym, iv=iv, tag=tag))
        seen, out = set(), []
        for line in rows:
            f = line.split(",")
            if not f[0].isdigit():
                continue
            t = int(f[0])
            t = t // 1000 if t > 10**14 else t  # archive switched to microseconds in 2025
            if t in seen:
                continue
            seen.add(t)
            out.append([t // 1000, f[1], f[2], f[3], f[4], f[5], f[9]])
        out.sort()
        path = os.path.join(OUT, f"{sym}_{iv}.csv.gz")
        with gzip.open(path, "wt", newline="") as g:
            w = csv.writer(g)
            w.writerow(["Timestamp", "Open", "High", "Low", "Close", "Volume", "TakerBuyVolume"])
            w.writerows(out)
        print(sym, iv, len(out), "candles")
        sys.stdout.flush()
