import { addLog } from "./logger.js";

function maskValue(value) {
  if (!value) return null;

  if (value.length <= 8) {
    return "***";
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function testPolymarketAuthConfig() {
  const privateKey = process.env.POLY_PRIVATE_KEY;
  const funderAddress = process.env.POLY_FUNDER_ADDRESS;
  const signatureType = process.env.POLY_SIGNATURE_TYPE;
  const dryRun = process.env.POLY_DRY_RUN;

  const missingVariables = [];

  if (!privateKey) missingVariables.push("POLY_PRIVATE_KEY");
  if (!funderAddress) missingVariables.push("POLY_FUNDER_ADDRESS");
  if (!signatureType) missingVariables.push("POLY_SIGNATURE_TYPE");
  if (!dryRun) missingVariables.push("POLY_DRY_RUN");

  const result = {
    ok: missingVariables.length === 0,
    message:
      missingVariables.length === 0
        ? "Polymarket auth config looks OK"
        : "Polymarket auth config is missing variables",
    missingVariables,
    config: {
      POLY_PRIVATE_KEY: privateKey ? maskValue(privateKey) : null,
      POLY_FUNDER_ADDRESS: funderAddress ? maskValue(funderAddress) : null,
      POLY_SIGNATURE_TYPE: signatureType || null,
      POLY_DRY_RUN: dryRun || null,
    },
  };

  if (result.ok) {
    addLog("Polymarket auth config test OK");
  } else {
    addLog(
      `Polymarket auth config test failed. Missing: ${missingVariables.join(", ")}`
    );
  }

  return result;
}