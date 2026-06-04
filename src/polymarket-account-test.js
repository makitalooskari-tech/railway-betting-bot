import { createPolymarketClient } from "./polymarket-client-test.js";
import { addLog } from "./logger.js";

export async function testPolymarketAccount() {
  const { client, account, funderAddress, signatureTypeRaw } =
    await createPolymarketClient();

  const openOrders = await client.getOpenOrders();

  addLog(`Polymarket account test OK. Open orders: ${openOrders.length}`);

  return {
    ok: true,
    message: "Polymarket account test OK",
    account: {
      signerAddress: `${account.address.slice(0, 6)}...${account.address.slice(-4)}`,
      funderAddress: `${funderAddress.slice(0, 6)}...${funderAddress.slice(-4)}`,
      signatureType: signatureTypeRaw,
    },
    openOrdersCount: openOrders.length,
    openOrders,
  };
}