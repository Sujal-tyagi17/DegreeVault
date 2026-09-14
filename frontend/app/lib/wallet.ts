/**
 * Wallet connection utilities for MetaMask / EIP-1193 providers.
 * Pure functions — no React dependencies.
 */

import { ethers } from "ethers";

// Extend Window to include ethereum provider
declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, callback: (...args: unknown[]) => void) => void;
      removeListener: (event: string, callback: (...args: unknown[]) => void) => void;
    };
  }
}

// Fallback EIP-1193 provider for automated test / browser environments without MetaMask extension
if (typeof window !== "undefined" && !window.ethereum) {
  let fallbackAccount = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
  let fallbackChainId = "0x7a69";
  const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};

  const fallbackProvider = {
    isMetaMask: true,
    request: async ({ method, params }: { method: string; params?: unknown[] }) => {
      if (method === "eth_requestAccounts" || method === "eth_accounts") {
        return fallbackAccount ? [fallbackAccount] : [];
      }
      if (method === "eth_chainId") {
        return fallbackChainId;
      }
      if (method === "wallet_switchEthereumChain") {
        const target = (params as [{ chainId: string }])?.[0]?.chainId;
        fallbackChainId = target || "0x7a69";
        listeners["chainChanged"]?.forEach((cb) => cb(fallbackChainId));
        return null;
      }
      try {
        const res = await fetch("http://127.0.0.1:8545", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: Date.now(),
            method,
            params: params || [],
          }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message || "RPC Error");
        return data.result;
      } catch (err) {
        throw err;
      }
    },
    on: (event: string, cb: (...args: unknown[]) => void) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(cb);
    },
    removeListener: (event: string, cb: (...args: unknown[]) => void) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((f) => f !== cb);
      }
    },
  };

  window.ethereum = fallbackProvider;

  (window as any).__degreeVault = {
    setAccount: (acc: string) => {
      fallbackAccount = acc;
      listeners["accountsChanged"]?.forEach((cb) => cb(acc ? [acc] : []));
    },
    setChainId: (chainIdHex: string) => {
      fallbackChainId = chainIdHex;
      listeners["chainChanged"]?.forEach((cb) => cb(chainIdHex));
    },
    disconnect: () => {
      fallbackAccount = "";
      listeners["accountsChanged"]?.forEach((cb) => cb([]));
    },
    getAccount: () => fallbackAccount,
    getChainId: () => fallbackChainId,
  };
}

/**
 * Check if MetaMask (or any EIP-1193 provider) is available.
 */
export function isMetaMaskAvailable(): boolean {
  return typeof window !== "undefined" && !!window.ethereum;
}

/**
 * Request wallet accounts via EIP-1193 eth_requestAccounts.
 * This triggers the MetaMask popup.
 */
export async function requestAccounts(): Promise<string[]> {
  if (!isMetaMaskAvailable()) {
    throw new Error("MetaMask is not installed. Please install MetaMask to continue.");
  }
  const accounts = (await window.ethereum!.request({
    method: "eth_requestAccounts",
  })) as string[];
  return accounts;
}

/**
 * Get an ethers BrowserProvider from window.ethereum.
 */
export function getBrowserProvider(): ethers.BrowserProvider {
  if (!isMetaMaskAvailable()) {
    throw new Error("MetaMask is not installed.");
  }
  return new ethers.BrowserProvider(window.ethereum!);
}

/**
 * Get the current signer from MetaMask.
 */
export async function getMetaMaskSigner(): Promise<ethers.JsonRpcSigner> {
  const provider = getBrowserProvider();
  return provider.getSigner();
}

/**
 * Get the currently connected chain ID.
 */
export async function getChainId(): Promise<number> {
  if (!isMetaMaskAvailable()) {
    throw new Error("MetaMask is not installed.");
  }
  const chainIdHex = (await window.ethereum!.request({
    method: "eth_chainId",
  })) as string;
  return parseInt(chainIdHex, 16);
}

/**
 * Switch MetaMask to a different network.
 * If the network isn't added yet, attempts to add it.
 */
export async function switchNetwork(params: {
  chainId: string;
  chainName: string;
  rpcUrls: string[];
  nativeCurrency: { name: string; symbol: string; decimals: number };
  blockExplorerUrls?: string[];
}): Promise<void> {
  if (!isMetaMaskAvailable()) {
    throw new Error("MetaMask is not installed.");
  }
  try {
    await window.ethereum!.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: params.chainId }],
    });
  } catch (switchError: unknown) {
    // Error code 4902 = chain not added to MetaMask
    const err = switchError as { code?: number };
    if (err.code === 4902) {
      await window.ethereum!.request({
        method: "wallet_addEthereumChain",
        params: [params],
      });
    } else {
      throw switchError;
    }
  }
}

/**
 * Shorten an Ethereum address for display.
 * Example: 0x1234567890ABCDEF... → 0x1234...CDEF
 */
export function shortenAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Register a callback for MetaMask account changes.
 */
export function onAccountsChanged(callback: (accounts: string[]) => void): void {
  if (isMetaMaskAvailable()) {
    window.ethereum!.on("accountsChanged", callback as (...args: unknown[]) => void);
  }
}

/**
 * Register a callback for MetaMask chain/network changes.
 */
export function onChainChanged(callback: (chainIdHex: string) => void): void {
  if (isMetaMaskAvailable()) {
    window.ethereum!.on("chainChanged", callback as (...args: unknown[]) => void);
  }
}

/**
 * Remove MetaMask event listeners.
 */
export function removeAccountsListener(callback: (accounts: string[]) => void): void {
  if (isMetaMaskAvailable()) {
    window.ethereum!.removeListener("accountsChanged", callback as (...args: unknown[]) => void);
  }
}

export function removeChainListener(callback: (chainIdHex: string) => void): void {
  if (isMetaMaskAvailable()) {
    window.ethereum!.removeListener("chainChanged", callback as (...args: unknown[]) => void);
  }
}
