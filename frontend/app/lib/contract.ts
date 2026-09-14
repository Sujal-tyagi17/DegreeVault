/**
 * Contract ABI, address loading, and role-checking utilities.
 */

import { ethers } from "ethers";

/**
 * ABI for DegreeVerification contract.
 * Includes all existing functions + AccessControl hasRole/role constants.
 */
export const CONTRACT_ABI = [
  // Existing functions
  "function issueDegree(address,string,string,bytes32)",
  "function issueBatchDegrees(address[],string[],string[],bytes32[])",
  "function verifyDegree(bytes32) view returns (address,string,string,uint256,bool)",
  "function getDegreeByIndex(uint256) view returns (address,string,string,uint256,bool,bytes32)",
  "function revokeDegree(bytes32)",
  "function getTotalDegrees() view returns (uint256)",
  // AccessControl — needed for role checking
  "function hasRole(bytes32,address) view returns (bool)",
  "function UNIVERSITY_ROLE() view returns (bytes32)",
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
  // Events
  "event DegreeIssued(bytes32 indexed certificateHash, string studentName, address indexed studentWallet)",
  "event BatchDegreesIssued(uint256 count)",
  "event DegreeRevoked(bytes32 indexed certificateHash)",
];

export const FALLBACK_CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

/**
 * Load contract address from /contract.json (auto-saved by deploy script).
 * Falls back to FALLBACK_CONTRACT_ADDRESS if unavailable.
 */
export async function loadContractAddress(): Promise<string> {
  try {
    const res = await fetch("/contract.json");
    const data = await res.json();
    if (data.address) {
      console.log("📄 Contract address loaded:", data.address);
      return data.address;
    }
  } catch {
    console.log("📄 Using fallback contract address");
  }
  return FALLBACK_CONTRACT_ADDRESS;
}

/**
 * Get a read-only contract instance (no signer needed — for verify, getTotalDegrees, etc.)
 */
export function getReadContract(
  address: string,
  provider: ethers.Provider
): ethers.Contract {
  return new ethers.Contract(address, CONTRACT_ABI, provider);
}

/**
 * Get a writable contract instance (needs signer — for issue, revoke, etc.)
 */
export function getWriteContract(
  address: string,
  signer: ethers.Signer
): ethers.Contract {
  return new ethers.Contract(address, CONTRACT_ABI, signer);
}

/**
 * Check if an address has the UNIVERSITY_ROLE on the contract.
 */
export async function checkUniversityRole(
  contract: ethers.Contract,
  address: string
): Promise<boolean> {
  try {
    const universityRole: string = await contract.UNIVERSITY_ROLE();
    return await contract.hasRole(universityRole, address);
  } catch (err) {
    console.error("Failed to check university role:", err);
    return false;
  }
}

/**
 * Check if an address has the DEFAULT_ADMIN_ROLE on the contract.
 */
export async function checkAdminRole(
  contract: ethers.Contract,
  address: string
): Promise<boolean> {
  try {
    const adminRole: string = await contract.DEFAULT_ADMIN_ROLE();
    return await contract.hasRole(adminRole, address);
  } catch (err) {
    console.error("Failed to check admin role:", err);
    return false;
  }
}
