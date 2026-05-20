const marketId = process.env.MARKET_ID;
const buyAmount = process.env.BUY_AMOUNT || "5";
const side = process.env.SIDE || "YES";
const dryRun = process.env.DRY_RUN !== "false";

console.log("Betting bot started successfully");

console.log("Settings:");
console.log("MARKET_ID:", marketId || "not set");
console.log("BUY_AMOUNT:", buyAmount);
console.log("SIDE:", side);
console.log("DRY_RUN:", dryRun);

if (!marketId) {
  console.log("No MARKET_ID set. Nothing to do.");
  process.exit(0);
}

if (dryRun) {
  console.log(`DRY RUN: Would buy ${buyAmount} USDC of ${side} from market ${marketId}`);
} else {
  console.log("LIVE MODE would run here, but real buying is not implemented yet.");
}