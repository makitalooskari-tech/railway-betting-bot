import { ClobClient, SignatureTypeV2 } from "@polymarket/clob-client-v2";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { addLog } from "./logger.js";

const HOST = "https://clob.polymarket.com";
const CHAIN_ID = 137;
const POLYGON_RPC_URL =
  process.env.POLYGON_RPC_URL || "https://polygon-rpc.com";

function normalizePrivateKey(privateKey) {
  if (!privateKey) {
    throw new Error("POLY_PRIVATE_KEY is missing");
  }

  if (privateKey.startsWith("0x")) {
    return privateKey;
  }

  return `0x${privateKey}`;
}

function maskValue(value) {
  if (!value) return null;

  if (value.length <= 8) {
    return "***";
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function getSignatureType(signatureTypeRaw) {
  if (signatureTypeRaw === "3") {
    return SignatureTypeV2.POLY_1271;
  }

  return Number(signatureTypeRaw);
}

export async function createPolymarketClient() {
  const privateKey = normalizePrivateKey(process.env.POLY_PRIVATE_KEY);
  const funderAddress = process.env.POLY_FUNDER_ADDRESS;
  const signatureTypeRaw = process.env.POLY_SIGNATURE_TYPE || "3";

  if (!funderAddress) {
    throw new Error("POLY_FUNDER_ADDRESS is missing");
  }

  const account = privateKeyToAccount(privateKey);

  const signer = createWalletClient({
    account,
    transport: http(POLYGON_RPC_URL),
  });

  const tempClient = new ClobClient({
    host: HOST,
    chain: CHAIN_ID,
    signer,
  });

  const apiCreds = await tempClient.createOrDeriveApiKey();

  const signatureType = getSignatureType(signatureTypeRaw);

  const client = new ClobClient({
    host: HOST,
    chain: CHAIN_ID,
    signer,
    creds: apiCreds,
    signatureType,
    funderAddress,
  });

  return {
    client,
    account,
    funderAddress,
    signatureTypeRaw,
    apiCreds,
  };
}

export async function testPolymarketClientAuth() {
  const { client, account, funderAddress, signatureTypeRaw, apiCreds } =
    await createPolymarketClient();

  addLog("Polymarket client auth test OK");

  return {
    ok: true,
    message: "Polymarket client auth test OK",
    host: HOST,
    chainId: CHAIN_ID,
    signerAddress: maskValue(account.address),
    funderAddress: maskValue(funderAddress),
    signatureType: signatureTypeRaw,
    apiCreds: {
      apiKey: apiCreds.apiKey ? maskValue(apiCreds.apiKey) : null,
      secret: apiCreds.secret ? "***" : null,
      passphrase: apiCreds.passphrase ? "***" : null,
    },
    clientReady: Boolean(client),
  };
}