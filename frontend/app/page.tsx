"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ethers } from "ethers";
import {
  isMetaMaskAvailable,
  requestAccounts,
  getBrowserProvider,
  getMetaMaskSigner,
  getChainId,
  switchNetwork,
  shortenAddress,
  onAccountsChanged,
  onChainChanged,
  removeAccountsListener,
  removeChainListener,
} from "./lib/wallet";
import {
  SUPPORTED_NETWORKS,
  getExplorerTxUrl,
  getNetworkName,
  isSupportedNetwork,
  getSwitchNetworkParams,
  DEFAULT_EXPECTED_CHAIN_ID,
} from "./lib/network";
import {
  CONTRACT_ABI,
  loadContractAddress,
  getReadContract,
  getWriteContract,
  checkUniversityRole,
} from "./lib/contract";
import {
  generateQRCodeDataUrl,
  downloadQRCode,
  getVerificationUrl,
} from "./lib/qrcode";

// ─── Types ───────────────────────────────────────────────────────────

interface DegreeResult {
  studentWallet: string;
  studentName: string;
  degreeName: string;
  issueDate: bigint;
  isValid: boolean;
  certId?: string;
}

interface Transaction {
  type: string;
  certificateId: string;
  studentName?: string;
  degreeName?: string;
  timestamp: number;
  txHash: string;
  chainId?: number;
}

type TxState =
  | "IDLE"
  | "AWAITING_SIGNATURE"
  | "PENDING"
  | "CONFIRMED"
  | "FAILED"
  | "REJECTED";

// ─── SVG Icons ───────────────────────────────────────────────────────

const VaultIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
    <circle cx="12" cy="12" r="3" />
    <path d="M12 9v1" /><path d="M12 14v1" /><path d="M9 12h1" /><path d="M14 12h1" />
  </svg>
);

const ShieldIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
  </svg>
);

const BanIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="m4.9 4.9 14.2 14.2" />
  </svg>
);

const FileTextIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

const LinkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const WalletIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4z" />
  </svg>
);

const ActivityIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const AlertIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const UploadIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const MetaMaskIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4M4 7l8 4M4 7v10l8 4m0-10v10" />
  </svg>
);

const QrCodeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="5" height="5" x="3" y="3" rx="1" />
    <rect width="5" height="5" x="16" y="3" rx="1" />
    <rect width="5" height="5" x="3" y="16" rx="1" />
    <path d="M21 16h-3a2 2 0 0 0-2 2v3" />
    <path d="M21 21v.01" />
    <path d="M12 7v3a2 2 0 0 1-2 2H7" />
    <path d="M3 12h.01" />
    <path d="M12 3h.01" />
    <path d="M12 16v.01" />
    <path d="M16 12h1" />
    <path d="M21 12v.01" />
    <path d="M12 21v-1" />
  </svg>
);

const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

// ─── Transaction Status Component ────────────────────────────────────

function TransactionStatusCard({
  txState,
  txHash,
  txBlockNumber,
  chainId,
  onDismiss,
}: {
  txState: TxState;
  txHash: string;
  txBlockNumber: number | null;
  chainId: number | null;
  onDismiss: () => void;
}) {
  if (txState === "IDLE") return null;

  const explorerUrl = chainId && txHash ? getExplorerTxUrl(chainId, txHash) : "";

  const stateConfig: Record<TxState, { label: string; color: string; icon: string }> = {
    IDLE: { label: "", color: "", icon: "" },
    AWAITING_SIGNATURE: { label: "Confirm transaction in MetaMask", color: "#f59e0b", icon: "⏳" },
    PENDING: { label: "Transaction submitted — awaiting confirmation…", color: "#3b82f6", icon: "⏳" },
    CONFIRMED: { label: "Transaction confirmed!", color: "#22c55e", icon: "✓" },
    FAILED: { label: "Transaction failed / reverted", color: "#ef4444", icon: "✗" },
    REJECTED: { label: "Transaction rejected by user", color: "#f97316", icon: "✗" },
  };

  const cfg = stateConfig[txState];

  return (
    <div className="tx-status-card animate-slide-in" style={{ borderColor: `${cfg.color}44` }}>
      <div className="tx-status-header">
        <div className="tx-status-title">
          <span className="tx-status-icon" style={{ color: cfg.color }}>
            {txState === "PENDING" || txState === "AWAITING_SIGNATURE" ? (
              <span className="spinner" style={{ borderTopColor: cfg.color }} />
            ) : (
              cfg.icon
            )}
          </span>
          <span style={{ color: cfg.color, fontWeight: 600 }}>{cfg.label}</span>
        </div>
        {(txState === "CONFIRMED" || txState === "FAILED" || txState === "REJECTED") && (
          <button className="alert-close" onClick={onDismiss}>×</button>
        )}
      </div>

      {txHash && (
        <div className="tx-status-body">
          <div className="tx-status-row">
            <span className="tx-status-label">Transaction Hash</span>
            <span className="tx-status-hash" title={txHash}>
              {shortenAddress(txHash)}
            </span>
          </div>
          {txBlockNumber && (
            <div className="tx-status-row">
              <span className="tx-status-label">Block</span>
              <span className="tx-status-value">#{txBlockNumber}</span>
            </div>
          )}
          {explorerUrl && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="tx-explorer-link"
            >
              View on {chainId === 137 ? "PolygonScan" : chainId === 80002 ? "PolygonScan (Amoy)" : "Explorer"} ↗
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

export default function Home() {
  // Contract state
  const [contractAddress, setContractAddress] = useState("");

  // Wallet state
  const [walletConnected, setWalletConnected] = useState(false);
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState<number | null>(null);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(true);
  const [hasUniversityRole, setHasUniversityRole] = useState(false);
  const [isCheckingRole, setIsCheckingRole] = useState(false);

  // Transaction lifecycle
  const [txState, setTxState] = useState<TxState>("IDLE");
  const [lastTxHash, setLastTxHash] = useState("");
  const [lastTxBlockNumber, setLastTxBlockNumber] = useState<number | null>(null);

  // Form state
  const [studentWallet, setStudentWallet] = useState("");
  const [student, setStudent] = useState("");
  const [degree, setDegree] = useState("");
  const [certId, setCertId] = useState("");
  const [verifyCertId, setVerifyCertId] = useState("");
  const [revokeCertId, setRevokeCertId] = useState("");
  const [result, setResult] = useState<DegreeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalDegrees, setTotalDegrees] = useState(0);
  const [activeTab, setActiveTab] = useState<"issue" | "batch" | "verify" | "revoke" | "mydegrees">("issue");
  const [csvData, setCsvData] = useState<{ studentWallet: string; studentName: string; degreeName: string; certId: string }[]>([]);
  const [csvFileName, setCsvFileName] = useState("");
  const [myDegrees, setMyDegrees] = useState<DegreeResult[]>([]);
  const [loadingMyDegrees, setLoadingMyDegrees] = useState(false);
  const [issuedCertQr, setIssuedCertQr] = useState<{
    certId: string;
    qrUrl: string;
    verifyUrl: string;
    student: string;
    degree: string;
  } | null>(null);
  const [verifyCertQr, setVerifyCertQr] = useState("");
  const [copiedQrLink, setCopiedQrLink] = useState(false);
  const [copiedVerifyLink, setCopiedVerifyLink] = useState(false);

  // Refs for event listener cleanup
  const accountsListenerRef = useRef<((accounts: string[]) => void) | null>(null);
  const chainListenerRef = useRef<((chainIdHex: string) => void) | null>(null);

  // ─── Initialization ──────────────────────────────────────────────

  useEffect(() => {
    loadContractAddress().then(setContractAddress);
    loadTransactions();
  }, []);

  useEffect(() => {
    if (contractAddress) {
      fetchTotalDegrees();
    }
  }, [contractAddress]);

  // ─── MetaMask Event Listeners ────────────────────────────────────

  useEffect(() => {
    if (!isMetaMaskAvailable()) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        // User disconnected
        setWalletConnected(false);
        setAccount("");
        setHasUniversityRole(false);
        setActiveTab("verify");
      } else {
        setAccount(accounts[0]);
        setWalletConnected(true);
      }
    };

    const handleChainChanged = (chainIdHex: string) => {
      const newChainId = parseInt(chainIdHex as string, 16);
      setChainId(newChainId);
      setIsCorrectNetwork(isSupportedNetwork(newChainId));
    };

    accountsListenerRef.current = handleAccountsChanged;
    chainListenerRef.current = handleChainChanged;

    onAccountsChanged(handleAccountsChanged);
    onChainChanged(handleChainChanged);

    return () => {
      if (accountsListenerRef.current) removeAccountsListener(accountsListenerRef.current);
      if (chainListenerRef.current) removeChainListener(chainListenerRef.current);
    };
  }, []);

  // ─── Role checking when account/contract changes ─────────────────

  useEffect(() => {
    if (!account || !contractAddress) {
      setHasUniversityRole(false);
      return;
    }

    const checkRole = async () => {
      setIsCheckingRole(true);
      try {
        const provider = getReadProvider();
        const contract = getReadContract(contractAddress, provider);
        const hasRole = await checkUniversityRole(contract, account);
        setHasUniversityRole(hasRole);
      } catch (err) {
        console.error("Role check failed:", err);
        setHasUniversityRole(false);
      } finally {
        setIsCheckingRole(false);
      }
    };

    checkRole();
  }, [account, contractAddress, chainId]);

  useEffect(() => {
    if (!hasUniversityRole && (activeTab === "issue" || activeTab === "batch" || activeTab === "revoke")) {
      setActiveTab("verify");
    }
  }, [hasUniversityRole, activeTab]);

  // ─── Provider helpers ────────────────────────────────────────────

  const getReadProvider = useCallback((): ethers.Provider => {
    if (isMetaMaskAvailable() && walletConnected) {
      return getBrowserProvider();
    }
    // Fallback to localhost RPC for read operations when wallet not connected
    return new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  }, [walletConnected]);

  const getSignerContract = async (): Promise<ethers.Contract> => {
    if (!walletConnected) throw new Error("Wallet not connected");
    if (!isCorrectNetwork) throw new Error("Wrong network. Please switch to a supported network.");
    const signer = await getMetaMaskSigner();
    return getWriteContract(contractAddress, signer);
  };

  // ─── Data fetching ───────────────────────────────────────────────

  const fetchTotalDegrees = async () => {
    try {
      const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
      const contract = getReadContract(contractAddress, provider);
      const total = await contract.getTotalDegrees();
      setTotalDegrees(Number(total));
    } catch {
      // Try via MetaMask provider if localhost fails
      try {
        if (isMetaMaskAvailable() && walletConnected) {
          const provider = getBrowserProvider();
          const contract = getReadContract(contractAddress, provider);
          const total = await contract.getTotalDegrees();
          setTotalDegrees(Number(total));
        } else {
          setTotalDegrees(0);
        }
      } catch {
        setTotalDegrees(0);
      }
    }
  };

  const loadMyDegrees = async () => {
    if (!account || !contractAddress) return;
    setLoadingMyDegrees(true);
    try {
      const provider = getReadProvider();
      const contract = getReadContract(contractAddress, provider);
      const total = await contract.getTotalDegrees();
      const degrees: DegreeResult[] = [];
      for (let i = 0; i < Number(total); i++) {
        const data = await contract.getDegreeByIndex(i);
        if (data[0].toLowerCase() === account.toLowerCase()) {
          degrees.push({
            studentWallet: data[0],
            studentName: data[1],
            degreeName: data[2],
            issueDate: data[3],
            isValid: data[4],
            certId: data[5],
          });
        }
      }
      setMyDegrees(degrees);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMyDegrees(false);
    }
  };

  useEffect(() => {
    if (activeTab === "mydegrees") {
      loadMyDegrees();
    }
  }, [activeTab, account, contractAddress]);

  // ─── Transaction history ─────────────────────────────────────────

  const loadTransactions = () => {
    const saved = localStorage.getItem("degreeTransactions");
    if (saved) setTransactions(JSON.parse(saved));
  };

  const addTransaction = (tx: Transaction) => {
    setTransactions((prev) => {
      const updated = [tx, ...prev];
      localStorage.setItem("degreeTransactions", JSON.stringify(updated));
      return updated;
    });
  };

  // ─── Wallet connection ───────────────────────────────────────────

  const connectWallet = async () => {
    setError("");
    try {
      if (!isMetaMaskAvailable()) {
        setError("MetaMask is not installed. Please install MetaMask browser extension to continue.");
        return;
      }
      const accounts = await requestAccounts();
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        setWalletConnected(true);
        const currentChainId = await getChainId();
        setChainId(currentChainId);
        setIsCorrectNetwork(isSupportedNetwork(currentChainId));
      }
    } catch (err: unknown) {
      const e = err as { code?: number; message?: string };
      if (e.code === 4001) {
        setError("Connection rejected. Please approve the MetaMask connection request.");
      } else {
        setError(e.message || "Failed to connect wallet");
      }
    }
  };

  const disconnectWallet = () => {
    setWalletConnected(false);
    setAccount("");
    setChainId(null);
    setHasUniversityRole(false);
    setActiveTab("verify");
  };

  const handleSwitchNetwork = async (targetChainId: number) => {
    const params = getSwitchNetworkParams(targetChainId);
    if (!params) return;
    try {
      await switchNetwork(params);
    } catch (err: unknown) {
      const e = err as { code?: number; message?: string };
      if (e.code === 4001) {
        setError("Network switch rejected by user.");
      } else {
        setError(e.message || "Failed to switch network");
      }
    }
  };

  // ─── Issue Degree ────────────────────────────────────────────────

  const issue = async () => {
    setError(""); setSuccess(""); setTxState("IDLE"); setLastTxHash(""); setLastTxBlockNumber(null);

    if (!walletConnected) { setError("Please connect your wallet first"); return; }
    if (!isCorrectNetwork) { setError("Please switch to a supported network"); return; }
    if (!hasUniversityRole) { setError("Your wallet does not have the University role"); return; }
    if (!studentWallet.trim() || !student.trim() || !degree.trim() || !certId.trim()) {
      setError("Please fill in all fields"); return;
    }

    try {
      setLoading(true);
      setTxState("AWAITING_SIGNATURE");

      const contract = await getSignerContract();
      const currentCertId = certId;
      const currentStudent = student;
      const currentDegree = degree;
      const hash = ethers.keccak256(ethers.toUtf8Bytes(currentCertId));
      const tx = await contract.issueDegree(studentWallet, currentStudent, currentDegree, hash);

      setTxState("PENDING");
      setLastTxHash(tx.hash);

      const receipt = await tx.wait();
      setTxState("CONFIRMED");
      setLastTxBlockNumber(receipt.blockNumber);

      addTransaction({
        type: "Issued",
        certificateId: currentCertId,
        studentName: currentStudent,
        degreeName: currentDegree,
        timestamp: Date.now(),
        txHash: tx.hash,
        chainId: chainId || undefined,
      });

      // Generate QR Code for immediate verification
      try {
        const qrUrl = await generateQRCodeDataUrl(currentCertId, { width: 220 });
        const verifyUrl = getVerificationUrl(currentCertId);
        setIssuedCertQr({
          certId: currentCertId,
          qrUrl,
          verifyUrl,
          student: currentStudent,
          degree: currentDegree,
        });
      } catch (qrErr) {
        console.warn("Failed to generate QR code:", qrErr);
      }

      setSuccess(`Degree issued successfully for ${currentStudent}!`);
      setStudentWallet(""); setStudent(""); setDegree(""); setCertId("");
      fetchTotalDegrees();
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (e.code === "ACTION_REJECTED" || (e.message && e.message.includes("user rejected"))) {
        setTxState("REJECTED");
        setError("Transaction was rejected");
      } else {
        setTxState("FAILED");
        const msg = e.message || "Failed to issue degree";
        if (msg.includes("Degree already issued")) setError("This certificate ID has already been used");
        else setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── Batch Issue ─────────────────────────────────────────────────

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n");
      const parsedData = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const parts = line.split(",");
        if (parts.length >= 4) {
          if (i === 0 && parts[0].toLowerCase().includes("wallet")) continue;
          parsedData.push({
            studentWallet: parts[0].trim(),
            studentName: parts[1].trim(),
            degreeName: parts[2].trim(),
            certId: parts[3].trim(),
          });
        }
      }
      setCsvData(parsedData);
    };
    reader.readAsText(file);
  };

  const issueBatch = async () => {
    setError(""); setSuccess(""); setTxState("IDLE"); setLastTxHash(""); setLastTxBlockNumber(null);

    if (!walletConnected) { setError("Please connect your wallet first"); return; }
    if (!isCorrectNetwork) { setError("Please switch to a supported network"); return; }
    if (!hasUniversityRole) { setError("Your wallet does not have the University role"); return; }
    if (csvData.length === 0) { setError("Please upload a valid CSV file with data first"); return; }
    if (csvData.length > 100) { setError("Maximum 100 degrees per batch"); return; }

    try {
      setLoading(true);
      setTxState("AWAITING_SIGNATURE");

      const contract = await getSignerContract();
      const studentWallets = csvData.map((d) => d.studentWallet);
      const studentNames = csvData.map((d) => d.studentName);
      const degreeNames = csvData.map((d) => d.degreeName);
      const hashes = csvData.map((d) => ethers.keccak256(ethers.toUtf8Bytes(d.certId)));

      const tx = await contract.issueBatchDegrees(studentWallets, studentNames, degreeNames, hashes);

      setTxState("PENDING");
      setLastTxHash(tx.hash);

      const receipt = await tx.wait();
      setTxState("CONFIRMED");
      setLastTxBlockNumber(receipt.blockNumber);

      const timestamp = Date.now();
      csvData.forEach((d) => {
        addTransaction({
          type: "Issued",
          certificateId: d.certId,
          studentName: d.studentName,
          degreeName: d.degreeName,
          timestamp,
          txHash: tx.hash,
          chainId: chainId || undefined,
        });
      });
      setSuccess(`Batch issued successfully: ${csvData.length} degrees!`);
      setCsvData([]); setCsvFileName("");
      fetchTotalDegrees();
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (e.code === "ACTION_REJECTED" || (e.message && e.message.includes("user rejected"))) {
        setTxState("REJECTED");
        setError("Transaction was rejected");
      } else {
        setTxState("FAILED");
        const msg = e.message || "Failed to issue batch degrees";
        if (msg.includes("Degree already issued")) setError("One or more certificate IDs have already been used");
        else setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── Verify Degree (read-only, no wallet needed) ─────────────────

  const verify = async () => {
    setError(""); setSuccess(""); setResult(null);
    if (!verifyCertId.trim()) { setError("Please enter a certificate ID"); return; }
    try {
      setLoading(true);
      // Always use read-only provider for verification
      let provider: ethers.Provider;
      try {
        provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
        // Test connection
        await provider.getBlockNumber();
      } catch {
        // If localhost fails, try MetaMask provider
        if (isMetaMaskAvailable()) {
          provider = getBrowserProvider();
        } else {
          throw new Error("No blockchain provider available. Start a local node or connect MetaMask.");
        }
      }
      const contract = getReadContract(contractAddress, provider);
      const hash = ethers.keccak256(ethers.toUtf8Bytes(verifyCertId));
      const data = await contract.verifyDegree(hash);
      setResult({ studentWallet: data[0], studentName: data[1], degreeName: data[2], issueDate: data[3], isValid: data[4], certId: verifyCertId });

      // Generate QR Code for verified credential
      try {
        const qrUrl = await generateQRCodeDataUrl(verifyCertId, { width: 180 });
        setVerifyCertQr(qrUrl);
      } catch (qrErr) {
        console.warn("Failed to generate QR code:", qrErr);
      }

      setSuccess("Degree verified successfully!");
    } catch (err: unknown) {
      const e = err as Error;
      if (e.message.includes("Degree not found")) setError("Certificate not found. Please check the ID.");
      else setError(e.message || "Failed to verify degree");
    } finally {
      setLoading(false);
    }
  };

  // ─── Revoke Degree ───────────────────────────────────────────────

  const revoke = async () => {
    setError(""); setSuccess(""); setTxState("IDLE"); setLastTxHash(""); setLastTxBlockNumber(null);

    if (!walletConnected) { setError("Please connect your wallet first"); return; }
    if (!isCorrectNetwork) { setError("Please switch to a supported network"); return; }
    if (!hasUniversityRole) { setError("Your wallet does not have the University role"); return; }
    if (!revokeCertId.trim()) { setError("Please enter a certificate ID"); return; }
    if (typeof window !== "undefined" && window.confirm && !(window as any).__autoConfirm) {
      if (!window.confirm("Are you sure you want to revoke this degree? This action cannot be undone.")) return;
    }

    try {
      setLoading(true);
      setTxState("AWAITING_SIGNATURE");

      const contract = await getSignerContract();
      const hash = ethers.keccak256(ethers.toUtf8Bytes(revokeCertId));

      // Fetch degree info for transaction log
      let sName: string | undefined;
      let dName: string | undefined;
      try {
        const verifyData = await contract.verifyDegree(hash);
        sName = verifyData[1];
        dName = verifyData[2];
      } catch { /* degree may not exist — revoke will fail with proper error */ }

      const tx = await contract.revokeDegree(hash);

      setTxState("PENDING");
      setLastTxHash(tx.hash);

      const receipt = await tx.wait();
      setTxState("CONFIRMED");
      setLastTxBlockNumber(receipt.blockNumber);

      addTransaction({
        type: "Revoked",
        certificateId: revokeCertId,
        studentName: sName,
        degreeName: dName,
        timestamp: Date.now(),
        txHash: tx.hash,
        chainId: chainId || undefined,
      });
      setSuccess("Degree revoked successfully!");
      setRevokeCertId(""); setResult(null);
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (e.code === "ACTION_REJECTED" || (e.message && e.message.includes("user rejected"))) {
        setTxState("REJECTED");
        setError("Transaction was rejected");
      } else {
        setTxState("FAILED");
        const msg = e.message || "Failed to revoke degree";
        if (msg.includes("Degree not found")) setError("Certificate not found");
        else if (msg.includes("Degree already revoked")) setError("This degree has already been revoked");
        else setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── Helpers ─────────────────────────────────────────────────────

  const resetTxState = () => {
    setTxState("IDLE");
    setLastTxHash("");
    setLastTxBlockNumber(null);
  };

  const getExplorerUrlForTx = (txHash: string, txChainId?: number) => {
    const cid = txChainId || chainId;
    if (!cid) return "";
    return getExplorerTxUrl(cid, txHash);
  };

  const canIssueOrRevoke = hasUniversityRole;

  // ─── Render ──────────────────────────────────────────────────────

  return (
    <main className="app-container">
      {/* Animated background */}
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />
      <div className="bg-orb bg-orb-3" />

      <div className="content-wrapper">
        {/* Header */}
        <header className="header">
          <div className="header-left">
            <div className="logo">
              <div className="logo-icon"><VaultIcon /></div>
              <div>
                <h1 className="app-title">DegreeVault</h1>
              </div>
            </div>
          </div>
          <div className="header-right">
            {walletConnected ? (
              /* MetaMask connected state */
              <div className="wallet-card">
                <div className="wallet-top">
                  <span className="status-dot" />
                  <select
                    className="account-select-dropdown"
                    value={account.toLowerCase()}
                    onChange={(e) => {
                      const newAcc = e.target.value;
                      setAccount(newAcc);
                      if (typeof window !== "undefined" && (window as any).__degreeVault?.setAccount) {
                        (window as any).__degreeVault.setAccount(newAcc);
                      }
                    }}
                    title="Switch Presentation Account"
                  >
                    <option value="0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266">
                      University Admin (Admin + Issuer)
                    </option>
                    <option value="0x70997970c51812dc3a010c7d01b50e0d17dc79c8">
                      Verifier (Read-only)
                    </option>
                    <option value="0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc">
                      Alex Morgan (Student SBT)
                    </option>
                  </select>
                  <button className="disconnect-btn" onClick={disconnectWallet} title="Disconnect">×</button>
                </div>
                <div className="wallet-info">
                  <div className="wallet-badges">
                    {/* Role badge */}
                    {isCheckingRole ? (
                      <span className="role-badge role-checking"><span className="spinner-sm" /> Checking…</span>
                    ) : hasUniversityRole ? (
                      <span className="role-badge role-university"><ShieldIcon /> University</span>
                    ) : (
                      <span className="role-badge role-verifier"><SearchIcon /> Verifier</span>
                    )}
                    {/* Network badge */}
                    {isCorrectNetwork ? (
                      <span className="network-badge">{chainId ? getNetworkName(chainId) : "Connected"}</span>
                    ) : (
                      <span className="network-badge network-wrong">⚠ Wrong Network</span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Not connected: Connect Wallet button */
              <button className="connect-wallet-btn" onClick={connectWallet}>
                <MetaMaskIcon /> Connect Wallet
              </button>
            )}
            <a
              href="/verify"
              target="_blank"
              rel="noopener noreferrer"
              className="portal-header-btn"
              title="Open Employer QR Verification Portal"
            >
              <QrCodeIcon /> Employer Portal
            </a>
          </div>
        </header>

        {/* Wrong Network Banner */}
        {walletConnected && !isCorrectNetwork && (
          <div className="network-warning animate-slide-in">
            <AlertIcon />
            <span>
              You are connected to <strong>{chainId ? getNetworkName(chainId) : "an unknown network"}</strong>.
              Please switch to a supported network.
            </span>
            <div className="network-switch-btns">
              <button className="btn-switch-network" onClick={() => handleSwitchNetwork(DEFAULT_EXPECTED_CHAIN_ID)}>
                Switch to Localhost
              </button>
              <button className="btn-switch-network" onClick={() => handleSwitchNetwork(80002)}>
                Switch to Amoy
              </button>
            </div>
          </div>
        )}

        {/* Stats Bar */}
        <div className="stats-bar">
          <div className="stat-item">
            <div className="stat-icon stat-icon-purple"><FileTextIcon /></div>
            <div>
              <p className="stat-value">{totalDegrees}</p>
              <p className="stat-label">Total Degrees</p>
            </div>
          </div>
          <div className="stat-item">
            <div className="stat-icon stat-icon-green"><CheckCircleIcon /></div>
            <div>
              <p className="stat-value">{transactions.filter((t) => t.type === "Issued").length}</p>
              <p className="stat-label">Issued</p>
            </div>
          </div>
          <div className="stat-item">
            <div className="stat-icon stat-icon-red"><BanIcon /></div>
            <div>
              <p className="stat-value">{transactions.filter((t) => t.type === "Revoked").length}</p>
              <p className="stat-label">Revoked</p>
            </div>
          </div>
          <div className="stat-item">
            <div className="stat-icon stat-icon-cyan"><ActivityIcon /></div>
            <div>
              <p className="stat-value status-active">{walletConnected ? (isCorrectNetwork ? "Active" : "Wrong") : "Offline"}</p>
              <p className="stat-label">Network</p>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="alert alert-error animate-slide-in">
            <BanIcon /> <span>{error}</span>
            <button className="alert-close" onClick={() => setError("")}>×</button>
          </div>
        )}
        {success && (
          <div className="alert alert-success animate-slide-in">
            <CheckCircleIcon /> <span>{success}</span>
            <button className="alert-close" onClick={() => setSuccess("")}>×</button>
          </div>
        )}

        {/* Transaction Status */}
        <TransactionStatusCard
          txState={txState}
          txHash={lastTxHash}
          txBlockNumber={lastTxBlockNumber}
          chainId={chainId}
          onDismiss={resetTxState}
        />

        {/* Main Content */}
        <div className="main-grid">
          {/* Left Panel — Actions */}
          <div className="actions-panel">
            {/* Tabs */}
            <div className="tab-bar">
              {canIssueOrRevoke && (
                <>
                  <button className={`tab-btn ${activeTab === "issue" ? "tab-active tab-issue" : ""}`} onClick={() => setActiveTab("issue")}>
                    <ShieldIcon /> Issue
                  </button>
                  <button className={`tab-btn ${activeTab === "batch" ? "tab-active tab-batch" : ""}`} onClick={() => setActiveTab("batch")}>
                    <UploadIcon /> Batch Issue
                  </button>
                </>
              )}
              <button className={`tab-btn ${activeTab === "verify" ? "tab-active tab-verify" : ""}`} onClick={() => setActiveTab("verify")}>
                <SearchIcon /> Verify
              </button>
              {canIssueOrRevoke && (
                <button className={`tab-btn ${activeTab === "revoke" ? "tab-active tab-revoke" : ""}`} onClick={() => setActiveTab("revoke")}>
                  <BanIcon /> Revoke
                </button>
              )}
              <button className={`tab-btn ${activeTab === "mydegrees" ? "tab-active tab-verify" : ""}`} onClick={() => setActiveTab("mydegrees")}>
                <WalletIcon /> My Degrees
              </button>
            </div>

            {/* Unauthorized Banner */}
            {walletConnected && !canIssueOrRevoke && !isCheckingRole && (
              <div className="unauthorized-banner">
                <AlertIcon />
                <div>
                  <strong>Verifier Mode</strong>
                  <p>Your wallet does not have the University role. You can verify degrees but cannot issue or revoke them.</p>
                </div>
              </div>
            )}

            {/* Issue Tab */}
            {activeTab === "issue" && (
              <div className="tab-content animate-fade-in">
                <h2 className="section-title">Issue New Degree</h2>
                <p className="section-desc">Issue a tamper-proof academic credential on the Polygon blockchain.</p>
                <div className="form-group">
                  <label className="form-label">Student Wallet Address</label>
                  <input type="text" placeholder="e.g., 0x123..." className="form-input" value={studentWallet} onChange={(e) => setStudentWallet(e.target.value)} disabled={loading} />
                </div>
                <div className="form-group">
                  <label className="form-label">Student Name</label>
                  <input type="text" placeholder="e.g., John Doe" className="form-input" value={student} onChange={(e) => setStudent(e.target.value)} disabled={loading} />
                </div>
                <div className="form-group">
                  <label className="form-label">Degree Name</label>
                  <input type="text" placeholder="e.g., B.Sc. Computer Science" className="form-input" value={degree} onChange={(e) => setDegree(e.target.value)} disabled={loading} />
                </div>
                <div className="form-group">
                  <label className="form-label">Certificate ID</label>
                  <input type="text" placeholder="e.g., CERT-2024-001" className="form-input" value={certId} onChange={(e) => setCertId(e.target.value)} disabled={loading} />
                </div>
                <button onClick={issue} disabled={loading} className="btn btn-purple">
                  {loading ? <><span className="spinner" /> Processing...</> : <><ShieldIcon /> Issue Degree</>}
                </button>

                {/* Newly Issued Degree QR Code Card */}
                {issuedCertQr && (
                  <div className="issued-qr-card animate-slide-in">
                    <div className="issued-qr-header">
                      <div className="qr-badge"><QrCodeIcon /> Certificate QR Code Generated</div>
                      <button className="alert-close" onClick={() => setIssuedCertQr(null)}>×</button>
                    </div>
                    <div className="issued-qr-content">
                      <div className="issued-qr-image-wrapper">
                        <img src={issuedCertQr.qrUrl} alt={`QR for ${issuedCertQr.certId}`} className="issued-qr-image" />
                        <span className="qr-caption">Scan to Verify</span>
                      </div>
                      <div className="issued-qr-details">
                        <p className="issued-qr-title">{issuedCertQr.degree}</p>
                        <p className="issued-qr-subtitle">Issued to <strong>{issuedCertQr.student}</strong></p>
                        <p className="issued-qr-id">ID: <code>{issuedCertQr.certId}</code></p>
                        <div className="issued-qr-actions">
                          <button
                            className="btn-qr-action"
                            onClick={() => downloadQRCode(issuedCertQr.qrUrl, issuedCertQr.certId)}
                          >
                            <DownloadIcon /> Download QR Code
                          </button>
                          <button
                            className="btn-qr-action"
                            onClick={() => {
                              navigator.clipboard.writeText(issuedCertQr.verifyUrl);
                              setCopiedQrLink(true);
                              setTimeout(() => setCopiedQrLink(false), 2500);
                            }}
                          >
                            <CopyIcon /> {copiedQrLink ? "Copied!" : "Copy Verification URL"}
                          </button>
                          <a
                            href={issuedCertQr.verifyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-qr-action btn-qr-action-accent"
                          >
                            <ExternalLinkIcon /> Open Verification Portal ↗
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Batch Issue Tab */}
            {activeTab === "batch" && (
              <div className="tab-content animate-fade-in">
                <h2 className="section-title">Batch Issue Degrees</h2>
                <p className="section-desc">Upload a CSV file to issue multiple academic credentials simultaneously and save gas.</p>
                <div className="form-group">
                  <label className="form-label">Upload CSV File</label>
                  <div className="file-upload-box">
                    <input type="file" accept=".csv" onChange={handleFileUpload} disabled={loading} className="file-input-hidden" id="csv-upload" />
                    <label htmlFor="csv-upload" className="file-upload-label">
                      <UploadIcon />
                      {csvFileName ? csvFileName : "Click to select a CSV file"}
                    </label>
                  </div>
                  <p style={{ fontSize: "12px", color: "#64748b", marginTop: "8px" }}>Format: Student Wallet, Student Name, Degree Name, Certificate ID</p>
                </div>
                {csvData.length > 0 && (
                  <div className="preview-table-container">
                    <p style={{ fontSize: "13px", fontWeight: "600", marginBottom: "8px", color: "#a78bfa" }}>Previewing {csvData.length} records:</p>
                    <div className="preview-table-wrapper">
                      <table className="preview-table">
                        <thead>
                          <tr>
                            <th>Wallet</th><th>Student</th><th>Degree</th><th>Cert ID</th>
                          </tr>
                        </thead>
                        <tbody>
                          {csvData.slice(0, 5).map((row, i) => (
                            <tr key={i}>
                              <td>{shortenAddress(row.studentWallet)}</td>
                              <td>{row.studentName}</td>
                              <td>{row.degreeName}</td>
                              <td>{row.certId}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {csvData.length > 5 && <p className="preview-more">+ {csvData.length - 5} more rows not shown</p>}
                    </div>
                  </div>
                )}
                <button onClick={issueBatch} disabled={loading || csvData.length === 0} className="btn btn-purple" style={{ marginTop: "20px" }}>
                  {loading ? <><span className="spinner" /> Processing Batch...</> : <><ShieldIcon /> Issue {csvData.length > 0 ? csvData.length : "Batch"} Degrees</>}
                </button>
              </div>
            )}

            {/* Verify Tab */}
            {activeTab === "verify" && (
              <div className="tab-content animate-fade-in">
                {/* Employer Portal Callout */}
                <div className="employer-portal-banner">
                  <div className="portal-banner-left">
                    <div className="portal-icon"><QrCodeIcon /></div>
                    <div>
                      <span className="portal-title">Employer QR Verification Portal</span>
                      <p className="portal-desc">Instant zero-wallet verification by scanning certificate QR codes</p>
                    </div>
                  </div>
                  <a href="/verify" target="_blank" rel="noopener noreferrer" className="btn-portal-link">
                    Open Portal ↗
                  </a>
                </div>

                <h2 className="section-title">Verify Degree</h2>
                <p className="section-desc">Instantly verify the authenticity of any academic credential. No wallet connection required.</p>
                <div className="form-group">
                  <label className="form-label">Certificate ID</label>
                  <input type="text" placeholder="Enter certificate ID to verify" className="form-input" value={verifyCertId} onChange={(e) => setVerifyCertId(e.target.value)} disabled={loading} />
                </div>
                <button onClick={verify} disabled={loading} className="btn btn-cyan">
                  {loading ? <><span className="spinner" /> Verifying...</> : <><SearchIcon /> Verify Degree</>}
                </button>

                {result && (
                  <div className={`result-card ${result.isValid ? "result-valid" : "result-revoked"}`}>
                    <div className="result-header">
                      <span className={`result-badge ${result.isValid ? "badge-valid" : "badge-revoked"}`}>
                        {result.isValid ? "✓ Valid" : "✗ Revoked"}
                      </span>
                      <a
                        href={`/verify?cert=${encodeURIComponent(verifyCertId)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="result-external-link"
                        title="View in Dedicated Employer Portal"
                      >
                        <ExternalLinkIcon /> Employer View
                      </a>
                    </div>
                    <div className="result-body">
                      <div className="result-row">
                        <span className="result-label">Certificate ID</span>
                        <span className="result-value"><code>{verifyCertId}</code></span>
                      </div>
                      <div className="result-row">
                        <span className="result-label">Wallet</span>
                        <span className="result-value">{result.studentWallet}</span>
                      </div>
                      <div className="result-row">
                        <span className="result-label">Student</span>
                        <span className="result-value">{result.studentName}</span>
                      </div>
                      <div className="result-row">
                        <span className="result-label">Degree</span>
                        <span className="result-value">{result.degreeName}</span>
                      </div>
                      <div className="result-row">
                        <span className="result-label">Issue Date</span>
                        <span className="result-value">
                          {new Date(Number(result.issueDate) * 1000).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                        </span>
                      </div>
                    </div>

                    {/* QR Code Section on Verification Result */}
                    {verifyCertQr && (
                      <div className="verify-qr-footer">
                        <div className="verify-qr-box">
                          <img src={verifyCertQr} alt="Certificate QR Code" className="verify-qr-img" />
                          <span className="verify-qr-hint">Scan with Phone</span>
                        </div>
                        <div className="verify-qr-details">
                          <p className="verify-qr-title">Instant QR Verification</p>
                          <p className="verify-qr-subtitle">Scan to verify directly on any smartphone or share link with employers</p>
                          <div className="verify-qr-btns">
                            <button
                              className="btn-qr-sm"
                              onClick={() => downloadQRCode(verifyCertQr, verifyCertId)}
                            >
                              <DownloadIcon /> Download QR
                            </button>
                            <button
                              className="btn-qr-sm"
                              onClick={() => {
                                const url = getVerificationUrl(verifyCertId);
                                navigator.clipboard.writeText(url);
                                setCopiedVerifyLink(true);
                                setTimeout(() => setCopiedVerifyLink(false), 2500);
                              }}
                            >
                              <CopyIcon /> {copiedVerifyLink ? "Copied!" : "Copy Link"}
                            </button>
                            <a
                              href={`/verify?cert=${encodeURIComponent(verifyCertId)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-qr-sm"
                            >
                              <ExternalLinkIcon /> Open Dedicated
                            </a>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Revoke Tab */}
            {activeTab === "revoke" && (
              <div className="tab-content animate-fade-in">
                <h2 className="section-title">Revoke Degree</h2>
                <p className="section-desc">Permanently revoke an academic credential. This cannot be undone.</p>
                <div className="form-group">
                  <label className="form-label">Certificate ID</label>
                  <input type="text" placeholder="Enter certificate ID to revoke" className="form-input" value={revokeCertId} onChange={(e) => setRevokeCertId(e.target.value)} disabled={loading} />
                </div>
                <button onClick={revoke} disabled={loading} className="btn btn-red">
                  {loading ? <><span className="spinner" /> Processing...</> : <><BanIcon /> Revoke Degree</>}
                </button>
                <div className="warning-box">
                  <AlertIcon />
                  <span>Revocation is recorded permanently on the blockchain and cannot be reversed.</span>
                </div>
              </div>
            )}

            {/* My Degrees Tab */}
            {activeTab === "mydegrees" && (
              <div className="tab-content animate-fade-in">
                <h2 className="section-title">My Degrees (SBTs)</h2>
                <p className="section-desc">View the Soulbound Tokens permanently issued to your wallet.</p>
                {!walletConnected ? (
                  <div className="empty-state">
                    <div className="empty-icon"><WalletIcon /></div>
                    <p className="empty-title">Wallet not connected</p>
                    <p className="empty-desc">Connect your wallet to view your degrees.</p>
                  </div>
                ) : loadingMyDegrees ? (
                  <div style={{ textAlign: "center", padding: "40px", color: "#a78bfa" }}>
                    <span className="spinner" /> Loading your degrees...
                  </div>
                ) : myDegrees.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon"><SearchIcon /></div>
                    <p className="empty-title">No degrees found</p>
                    <p className="empty-desc">Your wallet doesn&apos;t have any Soulbound Tokens yet.</p>
                  </div>
                ) : (
                  <div className="degrees-grid" style={{ display: "grid", gap: "16px" }}>
                    {myDegrees.map((deg, idx) => (
                      <div key={idx} className={`result-card ${deg.isValid ? "result-valid" : "result-revoked"}`}>
                        <div className="result-header">
                          <span className={`result-badge ${deg.isValid ? "badge-valid" : "badge-revoked"}`}>
                            {deg.isValid ? "✓ Valid SBT" : "✗ Revoked"}
                          </span>
                        </div>
                        <div className="result-body">
                          <div className="result-row">
                            <span className="result-label">Student</span>
                            <span className="result-value">{deg.studentName}</span>
                          </div>
                          <div className="result-row">
                            <span className="result-label">Degree</span>
                            <span className="result-value">{deg.degreeName}</span>
                          </div>
                          <div className="result-row">
                            <span className="result-label">Issue Date</span>
                            <span className="result-value">
                              {new Date(Number(deg.issueDate) * 1000).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Panel — Transactions */}
          <div className="transactions-panel">
            <div className="transactions-header">
              <h2 className="section-title">Recent Activity</h2>
              <span className="tx-count">{transactions.length}</span>
            </div>
            <div className="transactions-list">
              {transactions.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon"><ActivityIcon /></div>
                  <p className="empty-title">No activity yet</p>
                  <p className="empty-desc">Issue your first degree to see transaction history</p>
                </div>
              ) : (
                transactions.map((tx, idx) => {
                  const explorerUrl = getExplorerUrlForTx(tx.txHash, tx.chainId);
                  return (
                    <div key={idx} className="tx-item">
                      <div className="tx-left">
                        <span className={`tx-badge ${tx.type === "Issued" ? "tx-badge-issued" : "tx-badge-revoked"}`}>
                          {tx.type === "Issued" ? <ShieldIcon /> : <BanIcon />}
                        </span>
                        <div>
                          <p className="tx-cert">{tx.certificateId}</p>
                          {tx.studentName && <p className="tx-student">{tx.studentName}{tx.degreeName ? ` • ${tx.degreeName}` : ""}</p>}
                          <p className="tx-time">{new Date(tx.timestamp).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="tx-right-actions">
                        <a
                          href={`/verify?cert=${encodeURIComponent(tx.certificateId)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="tx-qr-link"
                          title="Open QR Verification Portal"
                        >
                          <QrCodeIcon />
                        </a>
                        {explorerUrl ? (
                          <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="tx-link" title="View on Explorer">
                            <LinkIcon />
                          </a>
                        ) : (
                          <span className="tx-hash-mini" title={tx.txHash}>{shortenAddress(tx.txHash)}</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="footer">
          <div className="footer-badges">
            <span className="footer-badge"><ShieldIcon /> Secured by Polygon</span>
            <span className="footer-divider">·</span>
            <span className="footer-badge">Immutable Records</span>
            <span className="footer-divider">·</span>
            <span className="footer-badge">Transparent & Verifiable</span>
          </div>
        </footer>
      </div>

      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        .app-container {
          min-height: 100vh;
          background: #0a0a1a;
          color: #e2e8f0;
          font-family: 'Inter', -apple-system, sans-serif;
          position: relative;
          overflow: hidden;
        }

        /* Animated background orbs */
        .bg-orb {
          position: fixed;
          border-radius: 50%;
          filter: blur(120px);
          opacity: 0.15;
          pointer-events: none;
          animation: float 20s ease-in-out infinite;
        }
        .bg-orb-1 { width: 600px; height: 600px; background: #7c3aed; top: -200px; left: -200px; }
        .bg-orb-2 { width: 500px; height: 500px; background: #06b6d4; bottom: -150px; right: -150px; animation-delay: -7s; }
        .bg-orb-3 { width: 400px; height: 400px; background: #8b5cf6; top: 50%; left: 50%; transform: translate(-50%, -50%); animation-delay: -14s; }

        @keyframes float {
          0%, 100% { transform: translate(0, 0); }
          33% { transform: translate(30px, -30px); }
          66% { transform: translate(-20px, 20px); }
        }

        .content-wrapper {
          position: relative;
          z-index: 1;
          max-width: 1200px;
          margin: 0 auto;
          padding: 24px;
        }

        /* Header */
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 16px;
        }
        .logo {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .logo-icon {
          width: 52px;
          height: 52px;
          background: linear-gradient(135deg, #7c3aed, #a78bfa);
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 0 0 30px rgba(124, 58, 237, 0.3);
        }
        .app-title {
          font-size: 26px;
          font-weight: 800;
          background: linear-gradient(135deg, #c4b5fd, #818cf8, #67e8f9);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          line-height: 1.2;
        }

        /* Connect Wallet Button */
        .connect-wallet-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 24px;
          background: linear-gradient(135deg, #7c3aed, #6d28d9);
          border: none;
          border-radius: 14px;
          color: white;
          font-size: 15px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 20px rgba(124, 58, 237, 0.3);
        }
        .connect-wallet-btn:hover {
          box-shadow: 0 4px 30px rgba(124, 58, 237, 0.5);
          transform: translateY(-1px);
        }

        /* Wallet Card */
        .wallet-card {
          background: rgba(30, 27, 75, 0.5);
          border: 1px solid rgba(124, 58, 237, 0.2);
          border-radius: 14px;
          padding: 12px 16px;
          backdrop-filter: blur(12px);
          min-width: 240px;
        }
        .wallet-top {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #a78bfa;
        }
        .wallet-address-text {
          font-family: 'JetBrains Mono', monospace;
          font-size: 14px;
          font-weight: 600;
          color: #e2e8f0;
        }
        .disconnect-btn {
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #f87171;
          width: 24px;
          height: 24px;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-left: auto;
          transition: all 0.2s;
        }
        .disconnect-btn:hover {
          background: rgba(239, 68, 68, 0.3);
        }
        .account-select {
          background: transparent;
          border: none;
          color: #e2e8f0;
          font-size: 13px;
          font-weight: 500;
          font-family: inherit;
          cursor: pointer;
          outline: none;
        }
        .account-select option {
          background: #1e1b4b;
          color: #e2e8f0;
        }
        .account-select-dropdown {
          background: rgba(15, 23, 42, 0.7);
          border: 1px solid rgba(124, 58, 237, 0.35);
          color: #e2e8f0;
          font-size: 13px;
          font-weight: 600;
          font-family: inherit;
          padding: 4px 8px;
          border-radius: 8px;
          cursor: pointer;
          outline: none;
          max-width: 250px;
        }
        .account-select-dropdown:hover {
          border-color: rgba(167, 139, 250, 0.6);
        }
        .account-select-dropdown option {
          background: #1e1b4b;
          color: #e2e8f0;
        }
        .wallet-info {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 8px;
          gap: 10px;
        }
        .wallet-badges {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .wallet-address {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .status-dot {
          width: 8px;
          height: 8px;
          background: #22c55e;
          border-radius: 50%;
          box-shadow: 0 0 8px #22c55e;
          animation: pulse-dot 2s ease-in-out infinite;
          flex-shrink: 0;
        }
        @keyframes pulse-dot {
          0%, 100% { box-shadow: 0 0 8px #22c55e; }
          50% { box-shadow: 0 0 16px #22c55e; }
        }
        .address-text {
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          color: #94a3b8;
        }

        /* Role Badge */
        .role-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          font-weight: 600;
          padding: 3px 10px;
          border-radius: 20px;
          letter-spacing: 0.3px;
        }
        .role-university {
          background: rgba(124, 58, 237, 0.15);
          border: 1px solid rgba(124, 58, 237, 0.3);
          color: #a78bfa;
        }
        .role-verifier {
          background: rgba(6, 182, 212, 0.15);
          border: 1px solid rgba(6, 182, 212, 0.3);
          color: #22d3ee;
        }
        .role-checking {
          background: rgba(100, 116, 139, 0.15);
          border: 1px solid rgba(100, 116, 139, 0.3);
          color: #94a3b8;
        }
        .spinner-sm {
          width: 10px;
          height: 10px;
          border: 1.5px solid rgba(255,255,255,0.3);
          border-top-color: currentColor;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
          display: inline-block;
        }

        /* Network Badge */
        .network-badge {
          background: linear-gradient(135deg, #7c3aed33, #8b5cf633);
          border: 1px solid #7c3aed44;
          color: #a78bfa;
          font-size: 11px;
          font-weight: 600;
          padding: 3px 10px;
          border-radius: 20px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .network-wrong {
          background: rgba(239, 68, 68, 0.15) !important;
          border-color: rgba(239, 68, 68, 0.3) !important;
          color: #f87171 !important;
        }

        /* Network Warning */
        .network-warning {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 18px;
          border-radius: 12px;
          margin-bottom: 16px;
          background: rgba(234, 179, 8, 0.08);
          border: 1px solid rgba(234, 179, 8, 0.2);
          color: #fbbf24;
          font-size: 14px;
          flex-wrap: wrap;
        }
        .network-switch-btns {
          display: flex;
          gap: 8px;
          margin-left: auto;
        }
        .btn-switch-network {
          background: rgba(234, 179, 8, 0.15);
          border: 1px solid rgba(234, 179, 8, 0.3);
          color: #fbbf24;
          padding: 6px 14px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-switch-network:hover {
          background: rgba(234, 179, 8, 0.25);
        }

        /* Unauthorized Banner */
        .unauthorized-banner {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 16px 20px;
          margin: 16px 20px 0;
          background: rgba(6, 182, 212, 0.06);
          border: 1px solid rgba(6, 182, 212, 0.15);
          border-radius: 12px;
          color: #22d3ee;
          font-size: 13px;
          line-height: 1.5;
        }
        .unauthorized-banner strong {
          display: block;
          margin-bottom: 4px;
        }
        .unauthorized-banner p {
          color: #64748b;
          margin: 0;
        }

        /* Transaction Status Card */
        .tx-status-card {
          background: rgba(30, 27, 75, 0.4);
          border: 1px solid rgba(124, 58, 237, 0.15);
          border-radius: 14px;
          padding: 16px 20px;
          margin-bottom: 16px;
          backdrop-filter: blur(8px);
        }
        .tx-status-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .tx-status-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 14px;
        }
        .tx-status-icon {
          font-size: 18px;
          display: flex;
          align-items: center;
        }
        .tx-status-body {
          margin-top: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .tx-status-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .tx-status-label {
          font-size: 12px;
          color: #64748b;
          font-weight: 500;
        }
        .tx-status-hash {
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px;
          color: #a78bfa;
          font-weight: 500;
        }
        .tx-status-value {
          font-size: 13px;
          color: #e2e8f0;
          font-weight: 600;
        }
        .tx-explorer-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 4px;
          padding: 8px 14px;
          background: rgba(124, 58, 237, 0.1);
          border: 1px solid rgba(124, 58, 237, 0.2);
          border-radius: 8px;
          color: #a78bfa;
          font-size: 13px;
          font-weight: 500;
          text-decoration: none;
          transition: all 0.2s;
          width: fit-content;
        }
        .tx-explorer-link:hover {
          background: rgba(124, 58, 237, 0.2);
          color: #c4b5fd;
        }

        .tx-hash-mini {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          color: #475569;
          flex-shrink: 0;
        }

        /* Stats Bar */
        .stats-bar {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 24px;
        }
        .stat-item {
          background: rgba(30, 27, 75, 0.3);
          border: 1px solid rgba(124, 58, 237, 0.12);
          border-radius: 14px;
          padding: 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          backdrop-filter: blur(8px);
          transition: all 0.3s ease;
        }
        .stat-item:hover {
          border-color: rgba(124, 58, 237, 0.3);
          transform: translateY(-2px);
        }
        .stat-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .stat-icon-purple { background: rgba(124, 58, 237, 0.15); color: #a78bfa; }
        .stat-icon-green { background: rgba(34, 197, 94, 0.15); color: #4ade80; }
        .stat-icon-red { background: rgba(239, 68, 68, 0.15); color: #f87171; }
        .stat-icon-cyan { background: rgba(6, 182, 212, 0.15); color: #22d3ee; }
        .stat-value {
          font-size: 20px;
          font-weight: 700;
          color: #f1f5f9;
          line-height: 1;
        }
        .stat-label {
          font-size: 12px;
          color: #64748b;
          font-weight: 500;
          margin-top: 2px;
        }
        .status-active { color: #4ade80 !important; font-size: 14px !important; }

        /* Alerts */
        .alert {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          border-radius: 12px;
          margin-bottom: 16px;
          font-size: 14px;
          font-weight: 500;
        }
        .alert-error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.25);
          color: #fca5a5;
        }
        .alert-success {
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.25);
          color: #86efac;
        }
        .alert-close {
          margin-left: auto;
          background: none;
          border: none;
          color: inherit;
          font-size: 20px;
          cursor: pointer;
          opacity: 0.6;
          transition: opacity 0.2s;
        }
        .alert-close:hover { opacity: 1; }

        /* Main Grid */
        .main-grid {
          display: grid;
          grid-template-columns: 1fr 380px;
          gap: 20px;
        }

        /* Actions Panel */
        .actions-panel {
          background: rgba(30, 27, 75, 0.25);
          border: 1px solid rgba(124, 58, 237, 0.12);
          border-radius: 20px;
          backdrop-filter: blur(12px);
          overflow: hidden;
        }
        .tab-bar {
          display: flex;
          border-bottom: 1px solid rgba(124, 58, 237, 0.15);
        }
        .tab-btn {
          flex: 1;
          padding: 16px;
          background: none;
          border: none;
          color: #64748b;
          font-size: 14px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s ease;
          border-bottom: 2px solid transparent;
        }
        .tab-btn:hover { color: #94a3b8; background: rgba(255,255,255,0.02); }
        .tab-active { color: #e2e8f0 !important; }
        .tab-issue { border-bottom-color: #8b5cf6; }
        .tab-batch { border-bottom-color: #10b981; }
        .tab-verify { border-bottom-color: #06b6d4; }
        .tab-revoke { border-bottom-color: #ef4444; }

        .file-upload-box {
          border: 2px dashed rgba(124, 58, 237, 0.4);
          border-radius: 12px;
          padding: 24px;
          text-align: center;
          transition: all 0.2s;
        }
        .file-upload-box:hover {
          border-color: rgba(124, 58, 237, 0.8);
          background: rgba(124, 58, 237, 0.05);
        }
        .file-input-hidden { display: none; }
        .file-upload-label {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          color: #a78bfa;
          font-weight: 500;
          cursor: pointer;
        }
        .preview-table-container { margin-top: 20px; }
        .preview-table-wrapper {
          background: rgba(15, 14, 36, 0.6);
          border: 1px solid rgba(124, 58, 237, 0.15);
          border-radius: 8px;
          overflow: hidden;
        }
        .preview-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .preview-table th, .preview-table td {
          padding: 10px 12px;
          text-align: left;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .preview-table th {
          background: rgba(0,0,0,0.2);
          color: #94a3b8;
          font-weight: 600;
        }
        .preview-table tr:last-child td { border-bottom: none; }
        .preview-more {
          padding: 10px;
          text-align: center;
          font-size: 12px;
          color: #64748b;
          border-top: 1px solid rgba(255,255,255,0.05);
        }

        .tab-content { padding: 28px; }
        .section-title {
          font-size: 20px;
          font-weight: 700;
          color: #f1f5f9;
          margin-bottom: 6px;
        }
        .section-desc {
          font-size: 14px;
          color: #64748b;
          margin-bottom: 24px;
        }

        /* Form */
        .form-group { margin-bottom: 18px; }
        .form-label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: #94a3b8;
          margin-bottom: 6px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .form-input {
          width: 100%;
          padding: 13px 16px;
          background: rgba(15, 14, 36, 0.6);
          border: 1px solid rgba(124, 58, 237, 0.15);
          border-radius: 12px;
          color: #e2e8f0;
          font-size: 14px;
          font-family: inherit;
          outline: none;
          transition: all 0.2s ease;
          box-sizing: border-box;
        }
        .form-input::placeholder { color: #475569; }
        .form-input:focus {
          border-color: #7c3aed;
          box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.1);
        }

        /* Buttons */
        .btn {
          width: 100%;
          padding: 14px;
          border: none;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: white;
          transition: all 0.3s ease;
          margin-top: 8px;
        }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }
        .btn-purple {
          background: linear-gradient(135deg, #7c3aed, #6d28d9);
          box-shadow: 0 4px 20px rgba(124, 58, 237, 0.3);
        }
        .btn-purple:hover:not(:disabled) { box-shadow: 0 4px 30px rgba(124, 58, 237, 0.5); transform: translateY(-1px); }
        .btn-cyan {
          background: linear-gradient(135deg, #0891b2, #0e7490);
          box-shadow: 0 4px 20px rgba(6, 182, 212, 0.3);
        }
        .btn-cyan:hover:not(:disabled) { box-shadow: 0 4px 30px rgba(6, 182, 212, 0.5); transform: translateY(-1px); }
        .btn-red {
          background: linear-gradient(135deg, #dc2626, #b91c1c);
          box-shadow: 0 4px 20px rgba(239, 68, 68, 0.3);
        }
        .btn-red:hover:not(:disabled) { box-shadow: 0 4px 30px rgba(239, 68, 68, 0.5); transform: translateY(-1px); }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Warning Box */
        .warning-box {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-top: 18px;
          padding: 12px 16px;
          background: rgba(234, 179, 8, 0.06);
          border: 1px solid rgba(234, 179, 8, 0.15);
          border-radius: 10px;
          color: #fbbf24;
          font-size: 13px;
          line-height: 1.5;
        }

        /* Result Card */
        .result-card {
          margin-top: 20px;
          border-radius: 14px;
          padding: 20px;
          backdrop-filter: blur(8px);
        }
        .result-valid {
          background: rgba(34, 197, 94, 0.06);
          border: 1px solid rgba(34, 197, 94, 0.2);
        }
        .result-revoked {
          background: rgba(239, 68, 68, 0.06);
          border: 1px solid rgba(239, 68, 68, 0.2);
        }
        .result-header { margin-bottom: 16px; }
        .result-badge {
          display: inline-block;
          padding: 4px 14px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 700;
        }
        .badge-valid { background: rgba(34, 197, 94, 0.15); color: #4ade80; }
        .badge-revoked { background: rgba(239, 68, 68, 0.15); color: #f87171; }
        .result-body { display: flex; flex-direction: column; gap: 10px; }
        .result-row { display: flex; justify-content: space-between; align-items: center; }
        .result-label { font-size: 13px; color: #64748b; font-weight: 500; }
        .result-value { font-size: 14px; color: #f1f5f9; font-weight: 600; }

        /* Transactions Panel */
        .transactions-panel {
          background: rgba(30, 27, 75, 0.25);
          border: 1px solid rgba(124, 58, 237, 0.12);
          border-radius: 20px;
          backdrop-filter: blur(12px);
          padding: 24px;
          display: flex;
          flex-direction: column;
          max-height: 620px;
        }
        .transactions-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        .tx-count {
          background: rgba(124, 58, 237, 0.15);
          color: #a78bfa;
          font-size: 12px;
          font-weight: 700;
          padding: 3px 10px;
          border-radius: 20px;
        }
        .transactions-list {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .transactions-list::-webkit-scrollbar { width: 4px; }
        .transactions-list::-webkit-scrollbar-track { background: transparent; }
        .transactions-list::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 16px;
          text-align: center;
        }
        .empty-icon {
          width: 56px;
          height: 56px;
          border-radius: 16px;
          background: rgba(124, 58, 237, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #7c3aed;
          margin-bottom: 16px;
        }
        .empty-title { font-size: 15px; font-weight: 600; color: #94a3b8; margin-bottom: 4px; }
        .empty-desc { font-size: 13px; color: #475569; }

        .tx-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px;
          border-radius: 12px;
          background: rgba(15, 14, 36, 0.4);
          border: 1px solid rgba(124, 58, 237, 0.08);
          transition: all 0.2s ease;
        }
        .tx-item:hover {
          background: rgba(15, 14, 36, 0.6);
          border-color: rgba(124, 58, 237, 0.2);
        }
        .tx-left {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }
        .tx-badge {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .tx-badge-issued { background: rgba(124, 58, 237, 0.15); color: #a78bfa; }
        .tx-badge-revoked { background: rgba(239, 68, 68, 0.15); color: #f87171; }
        .tx-cert {
          font-size: 13px;
          font-weight: 600;
          color: #e2e8f0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .tx-student { font-size: 12px; color: #64748b; }
        .tx-time { font-size: 11px; color: #475569; margin-top: 2px; }
        .tx-link {
          color: #64748b;
          transition: color 0.2s;
          flex-shrink: 0;
          padding: 6px;
        }
        .tx-link:hover { color: #a78bfa; }

        /* Footer */
        .footer {
          text-align: center;
          padding: 32px 0 16px;
        }
        .footer-badges {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 24px;
          background: rgba(30, 27, 75, 0.3);
          border: 1px solid rgba(124, 58, 237, 0.1);
          border-radius: 100px;
          backdrop-filter: blur(8px);
        }
        .footer-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #94a3b8;
          font-weight: 500;
        }
        .footer-divider { color: #334155; }

        /* Animations */
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out;
        }
        .animate-slide-in {
          animation: slideIn 0.3s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Employer Portal Header Button */
        .portal-header-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: rgba(56, 189, 248, 0.1);
          border: 1px solid rgba(56, 189, 248, 0.3);
          border-radius: 12px;
          color: #38bdf8;
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.2s ease;
        }
        .portal-header-btn:hover {
          background: rgba(56, 189, 248, 0.2);
          border-color: #38bdf8;
          transform: translateY(-1px);
        }

        /* Employer Portal Banner in Verify Tab */
        .employer-portal-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: linear-gradient(135deg, rgba(30, 27, 75, 0.7), rgba(15, 23, 42, 0.7));
          border: 1px solid rgba(56, 189, 248, 0.3);
          border-radius: 14px;
          padding: 16px 20px;
          margin-bottom: 24px;
          gap: 16px;
        }
        .portal-banner-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .portal-icon {
          width: 42px;
          height: 42px;
          border-radius: 10px;
          background: rgba(56, 189, 248, 0.15);
          color: #38bdf8;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .portal-title {
          font-size: 14px;
          font-weight: 700;
          color: #f1f5f9;
          display: block;
        }
        .portal-desc {
          font-size: 12px;
          color: #94a3b8;
          margin-top: 2px;
        }
        .btn-portal-link {
          display: inline-flex;
          align-items: center;
          padding: 8px 16px;
          background: linear-gradient(135deg, #0284c7, #0ea5e9);
          border-radius: 10px;
          color: white;
          font-size: 12px;
          font-weight: 600;
          text-decoration: none;
          white-space: nowrap;
          transition: all 0.2s ease;
        }
        .btn-portal-link:hover {
          opacity: 0.92;
          transform: translateY(-1px);
        }

        /* Issued QR Code Card */
        .issued-qr-card {
          margin-top: 24px;
          background: rgba(30, 27, 75, 0.6);
          border: 1px solid rgba(167, 139, 250, 0.35);
          border-radius: 16px;
          padding: 20px;
          box-shadow: 0 8px 32px rgba(124, 58, 237, 0.15);
        }
        .issued-qr-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .qr-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 700;
          color: #a78bfa;
          background: rgba(124, 58, 237, 0.2);
          padding: 6px 12px;
          border-radius: 8px;
        }
        .issued-qr-content {
          display: flex;
          gap: 20px;
          align-items: center;
          flex-wrap: wrap;
        }
        .issued-qr-image-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          background: white;
          padding: 12px;
          border-radius: 14px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
        }
        .issued-qr-image {
          width: 140px;
          height: 140px;
          display: block;
        }
        .qr-caption {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #1e1b4b;
          margin-top: 6px;
        }
        .issued-qr-details {
          flex: 1;
          min-width: 240px;
        }
        .issued-qr-title {
          font-size: 16px;
          font-weight: 700;
          color: #f1f5f9;
        }
        .issued-qr-subtitle {
          font-size: 13px;
          color: #94a3b8;
          margin-top: 4px;
        }
        .issued-qr-id {
          font-size: 12px;
          color: #a78bfa;
          margin-top: 8px;
        }
        .issued-qr-id code {
          background: rgba(15, 23, 42, 0.6);
          padding: 2px 6px;
          border-radius: 4px;
        }
        .issued-qr-actions {
          display: flex;
          gap: 8px;
          margin-top: 14px;
          flex-wrap: wrap;
        }
        .btn-qr-action {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 10px;
          color: #e2e8f0;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          text-decoration: none;
        }
        .btn-qr-action:hover {
          background: rgba(255, 255, 255, 0.12);
          border-color: rgba(255, 255, 255, 0.25);
        }
        .btn-qr-action-accent {
          background: rgba(124, 58, 237, 0.25);
          border-color: rgba(124, 58, 237, 0.4);
          color: #c4b5fd;
        }
        .btn-qr-action-accent:hover {
          background: rgba(124, 58, 237, 0.4);
          border-color: #a78bfa;
        }

        /* Verify Result QR Section */
        .result-external-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #38bdf8;
          text-decoration: none;
          font-weight: 600;
        }
        .result-external-link:hover {
          text-decoration: underline;
        }
        .verify-qr-footer {
          display: flex;
          gap: 16px;
          align-items: center;
          margin-top: 18px;
          padding-top: 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          flex-wrap: wrap;
        }
        .verify-qr-box {
          background: white;
          padding: 8px;
          border-radius: 10px;
          display: flex;
          flex-direction: column;
          align-items: center;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }
        .verify-qr-img {
          width: 100px;
          height: 100px;
          display: block;
        }
        .verify-qr-hint {
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          color: #1e1b4b;
          margin-top: 4px;
        }
        .verify-qr-details {
          flex: 1;
          min-width: 200px;
        }
        .verify-qr-title {
          font-size: 13px;
          font-weight: 700;
          color: #f1f5f9;
        }
        .verify-qr-subtitle {
          font-size: 11px;
          color: #94a3b8;
          margin-top: 2px;
        }
        .verify-qr-btns {
          display: flex;
          gap: 8px;
          margin-top: 10px;
          flex-wrap: wrap;
        }
        .btn-qr-sm {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 6px 10px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          color: #cbd5e1;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          text-decoration: none;
        }
        .btn-qr-sm:hover {
          background: rgba(255, 255, 255, 0.14);
          color: white;
        }
        .tx-right-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .tx-qr-link {
          color: #a78bfa;
          opacity: 0.75;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4px;
          border-radius: 6px;
          transition: all 0.2s;
        }
        .tx-qr-link:hover {
          opacity: 1;
          background: rgba(124, 58, 237, 0.15);
          color: #c4b5fd;
        }

        /* Responsive */
        @media (max-width: 900px) {
          .main-grid { grid-template-columns: 1fr; }
          .stats-bar { grid-template-columns: repeat(2, 1fr); }
          .header { flex-direction: column; align-items: flex-start; }
          .network-warning { flex-direction: column; }
          .network-switch-btns { margin-left: 0; }
        }
        @media (max-width: 500px) {
          .stats-bar { grid-template-columns: 1fr; }
          .content-wrapper { padding: 16px; }
        }
      `}</style>
    </main>
  );
}