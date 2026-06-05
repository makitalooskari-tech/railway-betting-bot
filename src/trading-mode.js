import { DRY_RUN } from "./config.js";

export function getTradingMode() {
  return {
    dryRun: DRY_RUN,
    mode: DRY_RUN ? "DRY_RUN" : "LIVE",
    canPlaceRealOrders: !DRY_RUN,
    warning: DRY_RUN
      ? "DRY RUN is enabled. No real orders will be placed."
      : "LIVE MODE is enabled. Real orders may be placed.",
  };
}

export function assertLiveTradingAllowed() {
  if (DRY_RUN) {
    throw new Error("Live trading is blocked because DRY_RUN is enabled.");
  }
}