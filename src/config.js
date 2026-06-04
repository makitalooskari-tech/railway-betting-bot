


export const MAX_BUY_PRICE = Number(process.env.MAX_BUY_PRICE || "0.55");
export const MAX_BUY_AMOUNT = Number(process.env.MAX_BUY_AMOUNT || "5");

export const PORT = process.env.PORT || 3000;

export const MARKET_ID = process.env.MARKET_ID;
export const BUY_AMOUNT = Number(process.env.BUY_AMOUNT || "5");
export const DRY_RUN = process.env.DRY_RUN !== "false";

// Test value. Later this will be replaced with real RSI data.
export const TEST_RSI = Number(process.env.TEST_RSI || "55");
