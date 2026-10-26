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

## Improvement log

### Round 1: what was tested (`research/experiments.py`)

Each idea was tested the way the website runs, with a fresh model on about 3,000 candles, scored on
2013–2017 hourly Bitcoin data. "Confident calls" means calls at 58% or more.

| Idea | Result | Kept? |
|---|---|---|
| Time-of-day and weekend effects | No gain (studies disagree on whether these exist) | No |
| Momentum that counts more on high volume | Small gain (supported by research on Bitcoin intraday momentum) | **Yes** |
| 1-week trend | Slightly worse | No |
| Blend of 3 learning speeds | Slightly worse | No |
| Pre-training on older history | Within noise | No |
| **Self-check pause** (stop calling while the last 100 calls are under 52% right) | Best single gain, mostly at longer horizons | **Yes** |

Combined upgrade vs. the old model, at each strictness level:

| Ahead | Strictness | Old | New |
|---|---|---|---|
| 1 candle | Normal (58%) | 57.96% | 58.47% |
| 1 candle | Very strict (66%) | 60.34% | 61.70% |
| 4 candles | Normal (58%) | 55.96% | 56.33% |
| 4 candles | Very strict (66%) | 56.81% | 58.63% |

Calls made while price was "stretched" (bouncing off a low or rolling off a high) did worse than
ordinary calls in testing, so the site now warns you about them.

### Round 1: new on the website
- **Strictness setting:** Normal, Strict or Very strict. Stricter means fewer calls with a higher hit rate.
- **Self-check pause:** the model stops calling when it's on a cold streak, and tells you why.
- **Typical move:** the normal size of a price swing over your prediction window. Keep your Trench
  bust price well beyond it.
- **Countdown:** time until the latest call is checked.
- **Watchlist:** a strip of all five coins showing which ones have a call right now. Tap one to switch.
- **App icon:** add the site to your phone's home screen and it opens like an app.

### Round 2: the Memory brain (`research/experiments2.py`)

Tested the same way, on 2013–2017 hourly Bitcoin data, confident calls only:

| Setup | 1 candle ahead | 4 candles ahead |
|---|---|---|
| Round 1 model | 58.5% | 56.3% |
| Round 1 model with twice the history | 58.2% | 55.8% |
| Memory brain alone (60 most similar past moments) | 57.6% | 56.9% |
| Blend of both | 59.8% | 58.4% |
| **Both must agree (shipped)** | **60.8%** | **58.9%** |

The website's own code, backtested the same way: 60.3% (1 ahead) and 59.6% (4 ahead), against a
52–53% "always guess up" baseline. Bounce and roll-over setups were right only 33–40% of the time,
the fourth test in a row where they failed, so the site now skips them.

### Round 2: new on the website
- **Two brains:** the Trend brain plus the Memory brain. A call needs both to agree.
- **Full redesign:** dark trading-cockpit look, a live dial with a needle, a glowing chart, mood
  lighting that shifts with the call, price flashes, a range bar for today's low-to-high, and a
  scorecard ring.
- The TradingView indicator still runs only the Trend brain. The Memory brain is too heavy for
  TradingView's script limits.

### Round 3: simpler screen
- The main screen now answers one question: **UP, DOWN or WAIT**, with one plain sentence and a
  countdown to when the call gets checked.
- The coin strip at the top is the coin picker.
- Settings (how far ahead, how picky, candle size) and Details (the dial, both brains, the checklist,
  the full scorecard) are folded away until you open them.
- The main line quotes the real track record ("calls like this were right 62% of the time") instead
  of the model's raw confidence, which runs hotter than reality.

### Round 4: real recent data changed everything (`research/experiments3-5.py`, `research/train.py`)

GitHub's servers downloaded 15-minute and 1-hour candles for all five coins from January 2023 to
October 2026, including buyer/seller ("taker") flow. Findings:

- **Short moves now tend to reverse.** On every coin, in every year from 2023 to 2026, the next hour
  went the opposite way to the last 15 minutes to 4 hours about 52% of the time. In 2013–2017 moves
  tended to continue. The live learner bets on moves continuing, which is why it stopped working.
- **The old site model on 2025–26 data:** 54.6% right at the moment of the call, but only **51.2%**
  with a 15-minute entry delay. That's a coin flip, and the self-check correctly paused it, which is
  why everything said WAIT.
- **Taker flow** looked huge on DOGE/XRP 15-minute data but disappeared at 1 hour and with a delay.
  It's most likely an artifact of Binance US being a thin market, so it's not used.
- **Bitcoin leading the other coins:** no usable effect at these timeframes.
- **Boosted trees** were no better than a simple model.

**Shipped: the Experience brain.** A simple model trained once on all five coins since 2023,
retrained every Monday by GitHub. On 16 months it never saw (July 2025 to October 2026), using the
site's own code:

| How far ahead | Strictness | Calls per 100 candles | Right at the call | Right with 15-min late entry |
|---|---|---|---|---|
| 1 hour | Normal (55%) | 7.6 | 55.6% | 52.6% |
| 1 hour | Very picky (58%) | 2.7 | 56.2% | 53.3% |
| 4 hours | Picky (56%) | 2.3 | 54.9% | 54.7% |
| 15 minutes | Normal | 8.2 | 54.1% | 49.6% (removed) |

The self-check pause and the Memory brain were dropped, because both hurt with this model.

### Round 4: other changes
- **Live motion:** price refreshes every 3 seconds, the chart glides, the glow breathes. The page
  also has load, call-change and chart draw-in animations (off for people who ask for reduced motion).
- **Paper trading:** `paper/trader.mjs` runs every 15 minutes on GitHub with $50 of fake money.
  It follows the site's calls, Trench-style (assumed rules in the file), and shows the P&L on the site.

### Round 5: things to do, not just watch
- **Live buys & sells:** the site connects straight to the exchange's live trade stream (Binance,
  Binance US or Coinbase). It shows a buyers-vs-sellers tug-of-war for the last minute and 5 minutes,
  a second-by-second buying/selling chart with floating bubbles for bigger trades, and a scrolling
  trade tape with whale trades highlighted. Live trades also drive the main chart's price.
- **Practice trading** (saved in your browser) has three tabs:
  - **Trade:** a Trench-style ticket with UP/DOWN, stake, multiplier and 1h/4h. It shows the bust
    price and how risky it is compared to a normal move. Open trades show live P&L, time left and
    distance to bust, and you can close early. **Auto-follow** takes every new call on any coin, with
    your own stake and bust-distance settings. Reset to any starting amount.
  - **What if?:** replays ~20 days of real calls with your settings (start money, stake %, multiplier,
    strictness, horizon, coins) and draws the money curve next to a no-multiplier version.
  - **24/7 bot:** the GitHub paper trader.
- The shipped Experience brain is now trained on everything **except the last 30 days**, so the
  "What if?" replay and the scorecard run on days the brain has never seen.

### Round 6: Trench-style percentages and a richer page
- **Why the old % looked stuck:** it was the 24-hour change, refreshed every 10 seconds. Over a whole
  day that barely moves. Trench shows your trade's P&L, which is roughly the price move since you
  entered × your multiplier.
- **Live change strip:** 1 min, 5 min, 15 min, 1 hour, 4 hours and 24 hours, updating 4 times a
  second from live trades, each with its own mini chart. Tap one to show it next to the price.
- **Trench lens:** a multiplier slider (×1–×100) that shows each move the way Trench would, e.g.
  "▼0.22% → ×50 −11.1%", including "busted" when the move passes the bust distance.
- **Interactive chart:** 6h / 12h / 24h / 3d ranges; hover for the price, time and what an UP bet
  from that point would show now; click and drag to measure any move, raw and at your multiplier.
- **Waiting orders:** a live order-book depth chart (buyers below the price, sellers above, within
  ±0.5/1/2%), with the biggest "walls" marked, hover readouts and a buyer/seller balance bar.
- **Visuals:** a drifting particle constellation tinted by the current call, section icons, and live
  mini charts plus 24h % on every coin in the top strip.

### Round 7: the live AI bot
- **AI bot · live run** (top of the page): press Start and the bot trades fake money on screen,
  aiming for a goal ($50 → $500 by default) within 60 minutes. It narrates every decision: which coin,
  which way and why (the AI's lean on every coin, plus live buying/selling and the order book for the
  coin on screen). It can switch the screen to the coin it's trading.
- **Styles:** Trench max ×1000 (default: all-in, a 0.1% move doubles or busts each trade, no fees
  because Trench doesn't publish its ×1000 fee), All-in degen, Aggressive and Careful.
- Goal bar, countdown, money curve, live trade card (bust ↔ take-profit bar), confetti on the goal
  and a shake on a bust. For any fair gamble, the chance of 10× before $0 is about 1 in 10.
- The practice ticket and the Trench lens now go up to ×1000.

### Round 8: a bot you can set up, a more realistic fill, and a history
- **Coin tiles** inside the bot card: each coin shows a big ▲ / ▼ / – for the AI's current lean, its
  %, price, mini chart and whether there's a call. Tap to let the bot trade it or not.
- **Settings:** direction (follow the AI / always UP / always DOWN), multiplier (auto or ×1–×1000),
  stake %, take profit, stop loss, max hold, wait between trades, minimum AI confidence, fee, start,
  goal and time limit, plus presets (Trench ×1000 gamble, Degen, Steady). A risk line shows the bust
  distance and what the fee costs, and blocks trades where the fee would eat the whole stake.
- **More realistic trading:** orders fill 1 second after the decision, at the ask when buying and the
  bid when selling (from the live order book), with a fee on the position size. Bust, stop and take
  profit are checked on every live trade.
- **History:** every bot trade and run is saved on the device: all-time P&L, win rate, busts, best
  and worst trade, fees paid, a cumulative P&L line, and run and trade tables.

### Round 9: reality check, a bankroll that carries over, and a fairer take-profit
- **Run 100 times:** replays the bot's exact settings 100 times from random moments in the last ~2
  days of real 1-minute prices, starting from the current bankroll. It shows how many runs hit the
  goal, went broke or ran out of time, the median/average/best/worst finish, 50 money paths and a
  finish histogram. With the ×1000 preset, a test gave 7 goals and 93 broke out of 100.
- **Bankroll:** money now carries over between runs ("Keep going with $X"). Each run's goal is a
  multiple of the bankroll (2×, 5×, 10×, 100× or none). "Reset bankroll" starts fresh.
- **Fix:** take profit and stop loss now close at their trigger price. Before, a gap in the live
  price could push a win far past the target (e.g. +133% with a +50% target) while losses were capped
  at the stake, which made the live bot look better than it is.

### Round 10: why the bot "wins everything"
- The bot's risk line now shows the odds for the chosen settings: how far the take-profit and the
  bust are, the expected win rate, the break-even win rate, the average result per trade and the
  chance of reaching the goal. With ×1000 and a +50% take-profit, the bot wins about 53% of trades
  but needs 67% to break even, because a loss costs 2× a win.
- The replay now settles same-minute take-profit/bust ties with distance-based odds instead of a
  fair coin.
- Bot history has a "live vs expected" check: each live trade stores its predicted win chance, so
  real live wins can be compared with the math over 30+ trades.

### Round 11: fixed the bug behind the impossible bot runs
- **Bug:** for US visitors the prices came from Binance US (Binance.com's API blocks the US), but
  the live trade stream could connect to Binance.com's global feed, which trades about 0.1% apart.
  The bot then bought on one exchange's price and cashed out on the other's. At ×1000 a 0.1% gap is
  a full win or bust, so runs like $50 → $13 million (18 wins in a row, roughly a 1-in-10-million
  event at the real odds) came from the price mix-up, not the market.
- **Fix:** live trades only move prices (and only check the bot's bust / take-profit) when they come
  from the same exchange as the price feed. Otherwise they're shown as buying/selling activity only,
  labelled "prices still come from …". The bot also refuses to fill an order on a price older than
  5 seconds. Bot results from before this fix are not trustworthy: reset the bankroll and clear the
  history.

### Round 12: fees you set yourself
- The bot's fee is now any number you type, as a % of the stake (default 1% = $0.50 on a $50 trade)
  or a % of the position. Copy it from a real Trench ticket. Presets no longer change the fee.
- The same fee applies to the practice ticket, the "What if?" replay and the 100-run check. The 24/7
  GitHub bot now pays 1% of the stake instead of 0.1% of the position.

### Round 13: a cleaner site, and trades that start at $0.00
- **Four pages instead of one long scroll:** Market (the call, the % changes, the chart), AI bot,
  Practice and Order flow (live buys/sells and the order book), switched from a sticky tab bar. The
  coin strip stays on every page.
- **Bot tabs:** Run (balance, coin tiles, current trade, bankroll, start button, the bot's thinking),
  Settings, Reality check and History, instead of one giant card.
- Less clutter: the Trench lens is one line, shorter notes, a dimmer particle background, no sheen.
- **Trades start at $0.00:** like real platforms, trades are valued at the market (mark) price and the
  fee comes out of the balance once when the trade opens. History shows each trade's result after its
  fee. With ×1000 and a +100% take-profit, each trade is now a 50/50 coin flip minus the fee.

### Round 14: candlestick background that reacts to your trades
- The background is now a fast, glowing candlestick stream in three depth layers with light streaks.
- It follows your open trades (the bot's and the practice account's): the deeper in the green, the
  more green candles and the more the stream climbs and speeds up; the deeper in the red, the more red
  candles sliding down. With no trade open it leans gently with the coin's last 15 minutes. Cards are
  a bit more see-through so it shows. It goes still for people who ask for reduced motion.

## Files

- `index.html`: the live web page (the website itself)
- `tradingview/TrenchAI_Direction.pine`: the indicator (paste into TradingView)
- `research/backtest.py`: walk-forward test of the model (`python3 backtest.py`)
- `research/experiments*.py`: tests of candidate upgrades; `research/train.py`: trains the Experience brain
- `research/data/`: 2023–2026 candles for all five coins (refreshed weekly)
- `paper/`: the paper trader and its ledger
- `research/btc_1h_2011_2017.csv`: the hourly BTC data used for testing
