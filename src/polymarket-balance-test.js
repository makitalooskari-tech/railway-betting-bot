import { createPolymarketClient } from "./polymarket-client-test.js";
import { addLog } from "./logger.js";

export async function testPolymarketBalance() {
  const { client, account, funderAddress, signatureTypeRaw } =
    await createPolymarketClient();

  const balanceAllowance = await client.getBalanceAllowance({
    asset_type: "COLLATERAL",
  });

  addLog(
    `Polymarket balance test OK. Balance: ${balanceAllowance.balance}, allowance: ${balanceAllowance.allowance}`
  );

  return {
    ok: true,
    message: "Polymarket balance test OK",
    account: {
      signerAddress: `${account.address.slice(0, 6)}...${account.address.slice(-4)}`,
      funderAddress: `${funderAddress.slice(0, 6)}...${funderAddress.slice(-4)}`,
      signatureType: signatureTypeRaw,
    },
    balanceAllowance,
  };
}