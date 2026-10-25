"""Download recent real candles (with taker-buy volume) for research.

Runs on GitHub's servers (see .github/workflows/fetch-data.yml), which can reach the exchange.
Uses the Binance US API in parallel. Writes research/data/<SYMBOL>_<interval>.csv.gz
"""
import csv, gzip, json, os, time, urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

COINS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "DOGEUSDT"]
INTERVALS = {"15m": 900, "1h": 3600}
START = int(datetime(2023, 1, 1, tzinfo=timezone.utc).timestamp())
OUT = os.path.join(os.path.dirname(__file__), "data")
API = "https://api.binance.us/api/v3/klines?symbol={sym}&interval={iv}&startTime={st}&limit=1000"


def chunk(args):
    sym, iv, st = args
    for attempt in range(4):
        try:
            with urllib.request.urlopen(API.format(sym=sym, iv=iv, st=st * 1000), timeout=20) as r:
                return json.load(r)
        except Exception as e:
            time.sleep(2 * (attempt + 1))
    print("  gave up on", sym, iv, st)
    return []


os.makedirs(OUT, exist_ok=True)
now = int(time.time())
for sym in COINS:
    for iv, sec in INTERVALS.items():
        starts = list(range(START, now, 1000 * sec))
        with ThreadPoolExecutor(4) as ex:
            parts = list(ex.map(chunk, [(sym, iv, s) for s in starts]))
        seen, out = set(), []
        for part in parts:
            for k in part:
                t = int(k[0]) // 1000
                if t in seen:
                    continue
                seen.add(t)
                out.append([t, k[1], k[2], k[3], k[4], k[5], k[9]])
        out.sort()
        with gzip.open(os.path.join(OUT, f"{sym}_{iv}.csv.gz"), "wt", newline="") as g:
            w = csv.writer(g)
            w.writerow(["Timestamp", "Open", "High", "Low", "Close", "Volume", "TakerBuyVolume"])
            w.writerows(out)
        print(sym, iv, len(out), "candles", flush=True)
