/**
 * Sepolia EURC transfer helper. Lazy-imports `viem` so the rest of the
 * app (tests, simulator mode) does not need the dependency loaded.
 *
 * Mirrors the hackaton/revolut onchain module: it signs an ERC-20
 * `transfer(to, amount)` on Circle's official EURC Sepolia contract and
 * waits for one confirmation before returning the explorer URL.
 *
 * Docs: https://developers.circle.com/stablecoins/eurc-on-test-networks
 */

export const EURC_SEPOLIA =
  "0x08210F9170F89Ab7658F0B5E3fF39b0E03C594D4" as const;
export const EURC_DECIMALS = 6;

const ERC20_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

export interface OnchainConfig {
  sourcePrivateKey: `0x${string}`;
  rpcUrl: string;
}

export interface TransferInput {
  to: `0x${string}`;
  amountEurc: number;
}

export interface TransferResult {
  hash: `0x${string}`;
  explorerUrl: string;
}

export async function transferEurcOnSepolia(
  cfg: OnchainConfig,
  input: TransferInput,
): Promise<TransferResult> {
  const viem = (await import("viem")) as typeof import("viem");
  const viemAccounts = (await import(
    "viem/accounts"
  )) as typeof import("viem/accounts");
  const viemChains = (await import(
    "viem/chains"
  )) as typeof import("viem/chains");

  const account = viemAccounts.privateKeyToAccount(cfg.sourcePrivateKey);
  const client = viem
    .createWalletClient({
      account,
      chain: viemChains.sepolia,
      transport: viem.http(cfg.rpcUrl),
    })
    .extend(viem.publicActions);

  const amount = viem.parseUnits(String(input.amountEurc), EURC_DECIMALS);

  const [ethBal, eurcBalRaw] = await Promise.all([
    client.getBalance({ address: account.address }),
    client.readContract({
      address: EURC_SEPOLIA,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [account.address],
    }) as Promise<bigint>,
  ]);

  if (ethBal === 0n) {
    throw new Error(
      `Source wallet ${account.address} has 0 Sepolia ETH. Fund it at https://www.alchemy.com/faucets/ethereum-sepolia`,
    );
  }
  if (eurcBalRaw < amount) {
    throw new Error(
      `Source wallet ${account.address} has ${viem.formatUnits(eurcBalRaw, EURC_DECIMALS)} EURC but needs ${input.amountEurc}. Fund at https://faucet.circle.com/ (Ethereum Sepolia, EURC).`,
    );
  }

  const hash = (await client.writeContract({
    address: EURC_SEPOLIA,
    abi: ERC20_ABI,
    functionName: "transfer",
    args: [input.to, amount],
  })) as `0x${string}`;

  await client.waitForTransactionReceipt({ hash, confirmations: 1 });

  return {
    hash,
    explorerUrl: `https://sepolia.etherscan.io/tx/${hash}`,
  };
}
