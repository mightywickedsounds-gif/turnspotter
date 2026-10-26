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
- **Paper trading:** `paper/trader.mjs` runs every 5 minutes on GitHub with $50 of fake money.
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

### Round 15: the fight bar
- The bot's open trade has a tug-of-war bar above it: the marker slides toward "bullshit" (red) as
  the trade nears its bust and toward "larp" (green) as it nears take profit, updating several times a
  second.
- Fix: at 100% stake the bot used to stake every dollar, leaving nothing for the fee, so the fee was
  skipped. It now keeps just enough back to pay it. The bankroll peak now counts the run in progress.

### Round 16: mark price for busts
- Busts, take-profits and stop-losses for the bot and the practice account now trigger on a mark price
  (the median of the last 5 seconds of trades on the price feed) instead of on every single trade print.
  One stray trade on a thin exchange like Binance US can no longer liquidate a position; a move that
  holds for a few seconds still does. At ×1000 a bust is only 0.1% away, so busts within a minute or
  two are still normal.

### Round 17: fewer options on screen
- Bot settings: four style cards (Careful, Balanced, Degen, Trench ×1000) plus Multiplier and Stake.
  Everything else (direction, take profit, stop loss, hold, wait, confidence, fee, goal, time limit,
  follow) is under "More options". The odds are one line: bust distance, win rate, break-even and
  chance to hit the goal, plus the fee.
- Practice ticket: UP/DOWN, stake, multiplier, a one-line risk summary and Place; trade length and
  auto-follow are under "More options". "What if?" moves strictness and time window under "More options".
- The Market page's folded sections are now called "Prediction settings" and "How the AI works".

### Round 18: automatic profit protection
- **Grab profit that's close enough:** if a trade sits within 15% of its take-profit for 2 seconds, the
  bot closes it instead of waiting for the last few cents. If a trade gets 60% of the way to the target
  and slips back to 30%, it locks in what's left.
- **Stop going all-in when ahead:** once a run is up 10%, any stake above 55% is cut to 55% while the
  run stays in profit; back at the starting balance, the normal stake returns.
- No new settings. The odds line and the 100-run replay follow the same rules.

- Fix: when nothing meets the confidence bar, the bot re-checks on the user's "wait between trades"
  setting instead of a fixed 15 seconds, and the countdown says "No good setup yet".

### Round 19: banks profits sooner
- The bot now banks a profit that has stayed at 40% or more of the take-profit target for 3 seconds,
  closes instantly at 85% of the target, and closes a winner that gives back half of its best profit.
  These checks use the latest live price, so a fast drop can't skip past them (busts still use the
  smoothed mark price). The odds line and the 100-run replay assume profits are banked at 40% of the
  target.

### Round 20: the table (a Critic bot checks every trade)
- Every trade the bot wants now goes past a second bot, the Critic, before it opens. The two talk it
  out on screen in chat bubbles, and the table stamps a verdict: Approved, Half size or Vetoed.
- The Critic only raises objections that held up on 16 months of data the model never trained on
  (2025-07 to 2026-10, entry one candle late; `research/experiments6.py`):
  - chasing a candle that just jumped more than 1σ the same way: those calls were right 48.4% of the
    time, so it vetoes;
  - a wild, high-volatility market: right 51.6%, so it halves the stake;
  - an AI lean under 56%: right 52.9%, so it halves the stake;
  - two half-size objections together veto, and a stale price feed always vetoes.
- Honest result: small. Money-weighted accuracy goes from 53.4% to 53.7%. It mostly helps by
  skipping or shrinking the worst setups, not by finding new winners. The 100-run replay uses the
  same rules.

### Round 21: less on screen
- Coin strip: no 24-hour % numbers, just the sparkline and the call.
- Price moves: 4 windows (5m, 15m, 1h, 24h) instead of 6, one short line for the multiplier view.
- Today's calls: last 4 instead of 8. Bot coin tiles: no price line.
- Shorter text for the bot's stats, goal, bankroll, odds line and open trade, and for the practice
  cash line. The bot's thinking log moved into a fold under the table.

### Round 22: the Boss joins the table (3D)
- The table is now a 3D scene (three.js, loaded only when the AI bot page opens): the Trader, the Critic
  and a bigger gold Boss sit around a glowing table. Whoever talks lights up and the others turn to look;
  an arc of light shows who is answering whom; a hologram in the middle shows the pitch, the Boss's
  simulated trades and the verdict; the Boss bangs a gavel and the table rim flashes the result.
- The Boss runs the numbers on every trade: it plays the trade out 300 times as a random walk with the
  coin's normal volatility (nudged by the AI's lean) and says the chance to bank, the chance to bust and
  what we'd expect to make after the fee. It also reads the last 10 trades against what the math expected.
  This is shown, not used to decide: at Trench-style settings the expected value is about minus the fee.
- What the Boss decides: it keeps the Critic's tested objections, and once a run has been up 20% it never
  lets one trade risk more than half of the best profit so far. When there's no room left, it ends the run
  and keeps the money ("profit locked in").
- Replayed on 44 days of real 1-minute prices for all five coins (1,500 random one-hour runs each, same
  start times for every version, $50 start, 1% fee; `research/data/*_1m.csv.gz`):

  | Style | Version | Average finish | Typical (median) | Runs ending up | Went broke |
  |---|---|---|---|---|---|
  | Trench ×1000 | no table | $21.02 | $0.00 | 18.9% | 65.9% |
  | Trench ×1000 | Critic only (round 20) | $27.22 | $14.31 | 24.7% | 35.0% |
  | Trench ×1000 | Critic + Boss | $36.92 | $54.09 | 50.9% | 24.0% |
  | ×1000, take profit 20% | Critic only | $13.72 | $5.37 | 6.1% | 39.9% |
  | ×1000, take profit 20% | Critic + Boss | $16.06 | $6.72 | 11.8% | 37.6% |
  | Degen | Critic only | $44.45 | $47.31 | 44.0% | 4.7% |
  | Degen | Critic + Boss | $45.59 | $50.48 | 50.9% | 4.3% |
  | Careful | all versions | $49.90 | $50.00 | 40.5% | 0% |

  Keeping 30% or 70% of the best profit instead of half scored about the same; starting the protection
  at +50% instead of +20% was clearly worse. The 10× goal was almost never reached in an hour by any
  version.
- Honest result: the Boss is the biggest improvement the bot has had, because it stops the "double up,
  then bust it all" pattern. Every style still loses money on average in this replay, and the replay
  won about 42% of ×1000 trades where the random-walk math says about 71%: one-minute candles on
  Binance US have deep wicks, so the replay is harsher than live trading on the smoothed mark price.

- Fix: a stray closing tag from round 22 pushed the bot's Settings, Reality check and History panels
  outside the bot card, so those tabs showed nothing. Removed it; all four tabs tested on a phone-sized screen.

### Round 23: the paper bot checks every 5 minutes
- GitHub's 15-minute timer actually fired every 40–90 minutes, so the 24/7 paper bot missed calls that
  came and went between its turns. Each GitHub run now stays awake for about 50 minutes and checks every
  5 minutes; the next run queues behind it, so there's almost always one awake.
- It saves the ledger right away when a trade opens or closes, otherwise at most every 15 minutes.
- Same calls, same 10% stakes, same multiplier and bust rules: nothing about how it trades changed, only
  how often it looks, so no new backtest was needed. Entries now come closer to when a call is made,
  which is nearer to how the calls were tested (entry one candle late).
- Follow-up: the 50-minute jobs left gaps of up to ~50 minutes when GitHub was slow to start the next
  one, so each job now stays awake for about 5h40m (GitHub's limit is 6 hours).
- Fix (round 26): a job froze for hours on one exchange request that never answered. Every request now gives
  up after 20 seconds and each bot run is capped at a few minutes, so a stuck request can't freeze the loop.

### Round 24: realistic paper trading, and a second bot built for real money
- **Does the AI-calls paper bot really make money?** `research/paper_backtest.mjs` replays its exact rules on
  the 30 days the Experience brain never trained on (from 2026-09-26), with 1-minute bust checks:

  | Version | $50 became | Trades | Won | Busts |
  |---|---|---|---|---|
  | as it ran (no spread, x50 cap) | $18.64 | 1,181 | 53.6% | 21 |
  | with the real spread | $0.73 | 463 | 46.0% | 10 |
  | with the spread, x20 cap | $1.97 | 1,125 | 40.9% | 0 |
  | with the spread, x10 cap | $9.86 | 1,181 | 35.7% | 0 |

  Even before costs the average call moved the price −0.8 bp (a basis point is 0.01%) its way.
  `research/experiments7.py` checks 15 unseen months (2025-07..2026-10): calls are right 52–53% of the time
  but the average move their way is only +0.5 to +2 bp at a 1-hour hold, while a real trade costs about
  5–15 bp. Longer holds (4h, 12h, 24h) are no better. **Conclusion: the short-term calls can't make money
  after costs.** The paper bot's +45% in its first day (23 trades) was luck.
- **Paper bot, version 2:** buys at the live ask and sells at the bid, checks for a bust on every 1-minute
  candle, and only acts on calls from closed candles. Version 1 is archived in `paper/ledger-v1.json`
  ($72.58 after 23 trades); version 2 started fresh at $50.
- **What can work: slow trend-following** (`research/experiments8.py`, daily candles 2023-07..2026-10, five
  coins split equally, 0.15% per buy or sell, trades at the next day's open):

  | Rule | Growth | Per year | Worst drop | 2025 | 2026 |
  |---|---|---|---|---|---|
  | buy and hold | x2.38 | +30% | 66% | −24% | −22% |
  | above 20-day average | x2.58 | +33% | 50% | −26% | −2% |
  | above 50-day average | x3.67 | +49% | 40% | +1% | +1% |
  | above 100-day average | x2.81 | +37% | 42% | −1% | −1% |
  | above its price 14 days ago | x3.01 | +40% | 48% | −19% | −0% |
  | above its price 30 days ago | x2.71 | +35% | 45% | −3% | −20% |
  | above its price 90 days ago | x2.22 | +27% | 46% | −21% | −15% |

  Six of the seven trend rules beat holding, which suggests a real effect rather than one lucky setting. The
  gain mostly comes from sitting out crashes. It's only ~3 years of data and still fell 40% at its worst.
- **New: the Trend bot** (`paper/trend.mjs`, ledger `paper/trend.json`): $50 of fake money, plain buying,
  no leverage. Once a day after 00:00 UTC it holds each coin above its 50-day average (a fifth of the money
  each) and keeps the rest in cash, paying the live spread plus a 0.1% fee. It runs in the same GitHub
  loop, and both bots show on the 24/7 bots tab.

### Round 25: the site, ordered by importance
- Four tabs: **Market** (the call, chart, live buys & sells, waiting orders), **AI bot**, **24/7 bots** (new tab:
  the Trend bot first, then the AI calls bot) and **Practice** (Trade, What if?). Order flow is no longer a
  separate tab; its two cards sit under the chart.
- On the Market card the big UP/DOWN call now comes first, above the price-move boxes and the multiplier slider.
- Removed the old "Stretch checklist" from How the AI works, shortened the 24/7 bot notes, and added the
  honest bottom line to How the AI works: the calls' edge is smaller than trading costs, so treat them as a lean.
- Nothing was deleted that a feature needs: settings, history, replay, practice and alerts all still work.

### Round 26: calmer pages
- Market: the call with one short line under it, the four move boxes, the chart and the last 4 calls.
  Live buys & sells, Waiting orders, Settings (now including the multiplier slider) and How the AI works
  are folded away at the bottom.
- Explanations cut to a few words or removed throughout (bot odds line, replay notes, 24/7 bot notes,
  practice ticket, footer). The honest points stay: break-even win rate on the bot, "the edge is smaller than
  the costs" on the 24/7 page and in How the AI works.
- AI bot on phones: the five coin tiles are one compact row; the empty "No trade open" box is hidden; the coin
  strip at the top is hidden on the AI bot and 24/7 bots pages, where it isn't used.

### Round 27: the Instagram reel's breakout strategy (research only)
- The reel: mark a tight range on TradingView, wait for price to break out, then take a Trench x1000 trade
  in that direction with a large stake (~$9,000) and cash out within 30-60 seconds at +20-33% of the stake.
  It shows only the winners (+$2,978 on BTC in 26 s, +$1,640 on gold in 57 s).
- `research/experiments9.py` tests it on 45 days of 1-minute candles for all five coins: a range is the last
  30 minutes' high/low when it's under 0.3% wide; enter at the next minute's open; win if price moves the
  take-profit distance before the 0.1% bust, within 5 minutes. Compared with the same trades in a random
  direction and with fading the break.
- Result, before any Trench fee (% of the stake per trade):

  | Take profit | Coin | Breakout | Random direction | Fade |
  |---|---|---|---|---|
  | +20% | BTC | −10.0% | −10.3% | −9.3% |
  | +20% | ETH | −10.5% | −9.9% | −11.9% |
  | +20% | SOL | −12.6% | −15.4% | −17.7% |
  | +20% | XRP | −5.5% | −13.7% | −20.4% |
  | +20% | DOGE | −8.7% | −11.8% | −15.7% |
  | +33% | BTC | −7.4% | −6.9% | −6.3% |
  | +33% | XRP | −1.5% | −8.9% | −18.4% |

  Trading the breakout direction is a little better than random on SOL, XRP and DOGE (a small, real
  follow-through after a break) but no better on BTC or ETH, and every version loses money before fees.
  At x1000 you must win 75-83% of the time just to break even; these trades won 28-50%.
- Not added to the site.

## Files

- `index.html`: the live web page (the website itself)
- `tradingview/TrenchAI_Direction.pine`: the indicator (paste into TradingView)
- `research/backtest.py`: walk-forward test of the model (`python3 backtest.py`)
- `research/experiments*.py`: tests of candidate upgrades; `research/train.py`: trains the Experience brain
- `research/data/`: 2023–2026 candles for all five coins, plus the last 45 days of 1-minute candles (refreshed weekly)
- `paper/`: the two paper bots (`trader.mjs` follows the AI calls, `trend.mjs` follows 50-day trends) and their ledgers
- `research/btc_1h_2011_2017.csv`: the hourly BTC data used for testing
