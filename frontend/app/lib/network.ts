/**
 * Network configuration for DegreeVault.
 * Derived from hardhat.config.js network settings.
 */

export interface NetworkConfig {
  chainId: number;
  chainIdHex: string;
  name: string;
  rpcUrl: string;
  explorerUrl: string; // base URL without trailing slash
  currency: { name: string; symbol: string; decimals: number };
}

export const SUPPORTED_NETWORKS: Record<number, NetworkConfig> = {
  // Hardhat Localhost
  31337: {
    chainId: 31337,
    chainIdHex: "0x7a69",
    name: "Localhost (Hardhat)",
    rpcUrl: "http://127.0.0.1:8545",
    explorerUrl: "", // no explorer for local
    currency: { name: "Ether", symbol: "ETH", decimals: 18 },
  },
  // Polygon Amoy Testnet
  80002: {
    chainId: 80002,
    chainIdHex: "0x13882",
    name: "Polygon Amoy Testnet",
    rpcUrl: "https://rpc-amoy.polygon.technology",
    explorerUrl: "https://amoy.polygonscan.com",
    currency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
  },
  // Polygon Mainnet
  137: {
    chainId: 137,
    chainIdHex: "0x89",
    name: "Polygon Mainnet",
    rpcUrl: "https://polygon-rpc.com",
    explorerUrl: "https://polygonscan.com",
    currency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
  },
};

/**
 * Returns the block explorer transaction URL for a given chain and tx hash.
 * Returns empty string for local networks without an explorer.
 */
export function getExplorerTxUrl(chainId: number, txHash: string): string {
  const network = SUPPORTED_NETWORKS[chainId];
  if (!network || !network.explorerUrl) return "";
  return `${network.explorerUrl}/tx/${txHash}`;
}

/**
 * Returns a human-readable network name for a chain ID.
 */
export function getNetworkName(chainId: number): string {
  const network = SUPPORTED_NETWORKS[chainId];
  return network ? network.name : `Unknown Network (${chainId})`;
}

/**
 * Returns whether a chain ID is in the supported network list.
 */
export function isSupportedNetwork(chainId: number): boolean {
  return chainId in SUPPORTED_NETWORKS;
}

/**
 * Returns the parameters for wallet_addEthereumChain / wallet_switchEthereumChain.
 */
export function getSwitchNetworkParams(chainId: number) {
  const network = SUPPORTED_NETWORKS[chainId];
  if (!network) return null;
  return {
    chainId: network.chainIdHex,
    chainName: network.name,
    rpcUrls: [network.rpcUrl],
    nativeCurrency: network.currency,
    blockExplorerUrls: network.explorerUrl ? [network.explorerUrl] : undefined,
  };
}

/** Default expected network: Hardhat Localhost for dev, Polygon Amoy for prod */
export const DEFAULT_EXPECTED_CHAIN_ID = 31337;
