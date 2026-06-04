# railway-betting-bot

Node.js + Express dashboard for a Polymarket paper-trading bot.

## Local run

```cmd
npm install
node index.js
```

Open:

```text
http://localhost:3000
```

## Test environment variables in Windows CMD

```cmd
set MARKET_ID=test-market-123
set TEST_RSI=57
set BUY_AMOUNT=5
node index.js
```

## Safety

This project is currently DRY RUN only. It does not place real trades.
