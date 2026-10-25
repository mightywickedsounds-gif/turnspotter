# Turn Spotter

Live crypto direction-prediction website for use alongside Trench.io, hosted on GitHub Pages from `main` (root): https://mightywickedsounds-gif.github.io/turnspotter/

- `index.html`: the whole website, a single self-contained page (no build step). Pulls candles in the browser from Binance, then Binance US, then Coinbase. Model code lives between `/*LOGIC-START*/` and `/*LOGIC-END*/`: the Trend brain (`learn`, online logistic regression), the Memory brain (`memory`, nearest neighbours), and `selfCheck` (pauses calls under 52%). A call needs both brains to agree.
- `tradingview/TrenchAI_Direction.pine`: TradingView Pine v6 version of the Trend brain.
- `research/`: walk-forward backtests on `btc_1h_2011_2017.csv` (cleaned hourly BTC data). `experiments*.py` holds the tests behind each upgrade.

The owner isn't a programmer: explain changes in plain English. Backtest any change to the signal logic on the research data before shipping, and report the results honestly, including when an idea fails. Log each round in README.md.
