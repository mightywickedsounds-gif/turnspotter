"""Which Bitcoin price does Trench use? Runs on GitHub's servers (.github/workflows/price-probe.yml).

1) Downloads trench.io's web page and its JavaScript files and lists every price-feed address they mention
   (Pyth, Binance, Bybit, Coinbase, Chainlink, Hyperliquid, websockets, its own APIs...).
2) Reads Bitcoin's price from many feeds at the same moment, 10 times, 3 seconds apart.
Writes research/price_probe.json.
"""
import json, re, time, urllib.request
from concurrent.futures import ThreadPoolExecutor

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"}


def get(url, data=None, timeout=15):
    req = urllib.request.Request(url, data=data, headers={**UA, **({"Content-Type": "application/json"} if data else {})})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "replace")


# 1) what Trench's own code connects to
scan = {"pages": {}, "scripts": [], "hosts": [], "hits": []}
PATTERNS = r"(pyth|hermes|benchmarks|chainlink|binance|bybit|okx|coinbase|kraken|bitstamp|hyperliquid|coingecko|cryptocompare|tradingview|polygon\.io|finnhub|twelvedata|wss://[^\"'\s]+|https://api[^\"'\s]*|price[a-z_]*feed[^\"'\s]*)"
for page in ("https://trench.io", "https://trench.io/trade/BTC", "https://www.trench.io"):
    try:
        html = get(page)
        scan["pages"][page] = len(html)
        for src in re.findall(r'src="([^"]+\.js[^"]*)"', html):
            scan["scripts"].append(src if src.startswith("http") else "https://trench.io" + (src if src.startswith("/") else "/" + src))
        scan["hits"] += re.findall(PATTERNS, html, re.I)
    except Exception as e:
        scan["pages"][page] = f"error: {e}"
scan["scripts"] = sorted(set(scan["scripts"]))[:60]
for js in scan["scripts"]:
    try:
        code = get(js, timeout=20)
        for m in re.finditer(PATTERNS, code, re.I):
            scan["hits"].append(code[max(0, m.start() - 60): m.end() + 60].replace("\n", " "))
    except Exception as e:
        scan["hits"].append(f"{js}: error {e}")
scan["hits"] = sorted(set(scan["hits"]))[:400]
scan["hosts"] = sorted(set(re.findall(r"(?:https?|wss)://([a-z0-9.-]+)", " ".join(scan["hits"]), re.I)))

# 2) Bitcoin from many feeds at the same moment
PYTH_BTC = "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"
def pyth():
    d = json.loads(get(f"https://hermes.pyth.network/v2/updates/price/latest?ids[]={PYTH_BTC}"))["parsed"][0]["price"]
    return int(d["price"]) * 10 ** d["expo"]
FEEDS = {
    "Coinbase BTC-USD": lambda: float(json.loads(get("https://api.exchange.coinbase.com/products/BTC-USD/ticker"))["price"]),
    "Binance US BTCUSDT": lambda: float(json.loads(get("https://api.binance.us/api/v3/ticker/price?symbol=BTCUSDT"))["price"]),
    "Binance US BTCUSD": lambda: float(json.loads(get("https://api.binance.us/api/v3/ticker/price?symbol=BTCUSD"))["price"]),
    "Binance BTCUSDT": lambda: float(json.loads(get("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT"))["price"]),
    "Binance perp BTCUSDT": lambda: float(json.loads(get("https://fapi.binance.com/fapi/v1/ticker/price?symbol=BTCUSDT"))["price"]),
    "Bybit perp BTCUSDT": lambda: float(json.loads(get("https://api.bybit.com/v5/market/tickers?category=linear&symbol=BTCUSDT"))["result"]["list"][0]["lastPrice"]),
    "OKX BTC-USDT": lambda: float(json.loads(get("https://www.okx.com/api/v5/market/ticker?instId=BTC-USDT"))["data"][0]["last"]),
    "OKX perp BTC-USDT-SWAP": lambda: float(json.loads(get("https://www.okx.com/api/v5/market/ticker?instId=BTC-USDT-SWAP"))["data"][0]["last"]),
    "Kraken XBTUSD": lambda: float(list(json.loads(get("https://api.kraken.com/0/public/Ticker?pair=XBTUSD"))["result"].values())[0]["c"][0]),
    "Bitstamp BTCUSD": lambda: float(json.loads(get("https://www.bitstamp.net/api/v2/ticker/btcusd/"))["last"]),
    "Gemini BTCUSD": lambda: float(json.loads(get("https://api.gemini.com/v1/pubticker/btcusd"))["last"]),
    "Hyperliquid BTC": lambda: float(json.loads(get("https://api.hyperliquid.xyz/info", data=b'{"type":"allMids"}'))["BTC"]),
    "Pyth BTC/USD": pyth,
}
def one(item):
    name, fn = item
    try: return name, round(fn(), 2)
    except Exception as e: return name, f"error: {str(e)[:80]}"
samples = []
for k in range(10):
    t = time.time()
    with ThreadPoolExecutor(len(FEEDS)) as ex:
        samples.append({"t": round(t, 1), **dict(ex.map(one, FEEDS.items()))})
    time.sleep(3)

json.dump({"trench_scan": scan, "samples": samples}, open("research/price_probe.json", "w"), indent=1)
print(json.dumps(scan["hosts"], indent=1)); print(json.dumps(samples[-1], indent=1))
