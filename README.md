# Trench AI Direction

A self-learning indicator that studies a coin's price history candle by candle and gives you its
best guess for **which way price goes next** (UP / DOWN / NO TRADE), plus a live scorecard of how
often it has actually been right. It's built for use alongside Trench.io's up/down trades.

## How Trench.io works (what the research found)

- You pick an asset (crypto, stocks, commodities), call **up or down**, and choose a **payout
  multiplier** (advertised up to 1000x).
- A higher multiplier means a bigger payout but a price that busts you much closer to your entry. On
  high multipliers a small move against you loses the whole stake.
- Reviews are split. Some people say deposits and withdrawals are easy. Others report lost funds.
  Trustpilot flags it as associated with high-risk investments. Most "how it works" guides online are
  affiliate pages.

Trench.io doesn't let you load custom indicators, so this runs on **TradingView** (free) on the same
coin, next to Trench.

## One-time setup (about 2 minutes)

I can't log into your accounts, so this one part needs you:

1. Go to tradingview.com (a free account works) and open a chart, for example `BTCUSDT`.
2. At the bottom, open **Pine Editor**, delete what's there, and paste in all of
   `tradingview/TrenchAI_Direction.pine`.
3. Click **Save**, then **Add to chart**.
4. Optional: right-click the indicator → **Add alert** → pick "Trench AI: UP signal" / "DOWN signal" to
   get phone notifications.

## Reading it

| You see | Meaning |
|---|---|
| **▲ UP** green arrow | The model gives UP at least the confidence level you set (default 58%) |
| **▼ DOWN** red arrow | The model gives DOWN at least that confidence level |
| **— NO TRADE** | Too close to a coin flip, so skip it |
| Hit rate (signals only) | How often its past signals on *this* chart were right. **If it's near 50%, it has no edge here. Don't use it.** |

Settings: **"Predict this many candles ahead"** sets the horizon. On a 1-hour chart with 4, it
predicts the price 4 hours from now. Match the horizon to how long your Trench trade stays open.

## How the "AI" works

It's online logistic regression, a small machine-learning model that updates itself on every candle.
It looks at 9 signals: recent moves at 4 lookbacks, RSI, trend (EMA spread), position in the 24-candle
range, volume surprise, and volatility regime. When a candle's outcome becomes known, it adjusts its
weights a little. So it learns from all the history TradingView loads, and it keeps adapting as the
market changes. It never sees future data, and it doesn't repaint.

## Honest test results

`research/backtest.py` runs the exact same model over **46,000 hourly Bitcoin candles (2011–2017)**,
always predicting only from the past:

| Setup | Hit rate | "Always guess up" baseline |
|---|---|---|
| 1-hour candles, every call (2013–2017, by year) | 53.6–56% | ~51% |
| 1-hour candles, confident calls only (≥58%) | 56–60% each year | ~52% |
| 4-hour candles, every call | ~54% | ~53% |
| Daily candles, confident calls only | ~60% (small sample) | ~55% |

The dataset had about 5,700 corrupted placeholder rows. They've been removed, and the numbers above
come from the cleaned data.

**What this means:** the model finds a real but **small** edge, and it was weakest in the most recent
year (2017). Today's market is more efficient than any of this data. Expect calls in the mid-50s, not
a money printer. Also:

- On Trench, the bust price and fees mean **you need to be right much more than 50% of the time to
  profit**, more so at higher multipliers. A 53% hit rate at a high multiplier can still lose money.
- Use the indicator's own live scorecard on your chosen coin and timeframe as the judge. If it's not
  clearly above 50% over hundreds of calls, it isn't working there.
- Nothing can reliably predict crypto. Only stake what you're fine losing. This is not financial advice.

## Live web page: Turn Spotter (`index.html`)

Open the website: https://mightywickedsounds-gif.github.io/turnspotter/ (bookmark it or add it to your home screen). No install and no account.
When it loads, it pulls the last 1–3 days of candles from Binance (falling back to Binance US, then
Coinbase), so it has seen the whole day. It trains the same learning model on that data and then
updates every 10 seconds.

- **Big verdict at the top:** UP / DOWN / no edge, plus "really low" or "really high" when price is
  stretched for the day.
- **Pick your settings:** coin (BTC, ETH, SOL, XRP, DOGE), candle size, and how far ahead to predict.
  Match "how far ahead" to how long your Trench trade stays open.
- **Chart:** the last 24 hours, with fair price (VWAP), the day's high and low, and every call it made.
- **Scorecard:** how often its calls were actually right, with each call marked right or wrong.
- **Turn on alerts:** a sound plus a browser notification when a new call fires. Keep the tab open.

What testing found: "price is really low and starting to bounce" sounds like a great signal, but on
six years of Bitcoin data it was **no better than a coin flip** (DOWN calls into a rising market
were right only about 35% of the time). So the page shows "really low/high" as context, and only the
learning model triggers calls. A call marked "from a low" means both agreed.

## Files

- `index.html`: the live web page (the website itself)
- `tradingview/TrenchAI_Direction.pine`: the indicator (paste into TradingView)
- `research/backtest.py`: walk-forward test of the model (`python3 backtest.py`)
- `research/btc_1h_2011_2017.csv`: the hourly BTC data used for testing
