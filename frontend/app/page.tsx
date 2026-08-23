"use client";

import { useState, useEffect } from "react";
import { ethers } from "ethers";

const FALLBACK_CONTRACT_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
const abi = [
  "function issueDegree(address,string,string,bytes32)",
  "function issueBatchDegrees(address[],string[],string[],bytes32[])",
  "function verifyDegree(bytes32) view returns (address,string,string,uint256,bool)",
  "function getDegreeByIndex(uint256) view returns (address,string,string,uint256,bool,bytes32)",
  "function revokeDegree(bytes32)",
  "function getTotalDegrees() view returns (uint256)",
  "event DegreeIssued(bytes32 indexed certificateHash, string studentName, address indexed studentWallet)",
  "event BatchDegreesIssued(uint256 count)",
  "event DegreeRevoked(bytes32 indexed certificateHash)"
];

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
}

const HARDHAT_ACCOUNTS = [
  { index: 0, name: "University Admin", role: "Admin + Issuer" },
  { index: 1, name: "University Staff", role: "Issuer" },
  { index: 2, name: "Verifier", role: "Read-only" },
  { index: 3, name: "Guest", role: "Read-only" },
];

// SVG Icons
const VaultIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
    <circle cx="12" cy="12" r="3" />
    <path d="M12 9v1" />
    <path d="M12 14v1" />
    <path d="M9 12h1" />
    <path d="M14 12h1" />
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

export default function Home() {
  const [contractAddress, setContractAddress] = useState(FALLBACK_CONTRACT_ADDRESS);
  const [studentWallet, setStudentWallet] = useState("");
  const [student, setStudent] = useState("");
  const [degree, setDegree] = useState("");
  const [certId, setCertId] = useState("");
  const [verifyCertId, setVerifyCertId] = useState("");
  const [revokeCertId, setRevokeCertId] = useState("");
  const [result, setResult] = useState<DegreeResult | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<number>(0);
  const [account, setAccount] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalDegrees, setTotalDegrees] = useState(0);
  const [activeTab, setActiveTab] = useState<"issue" | "batch" | "verify" | "revoke" | "mydegrees">("issue");
  const [csvData, setCsvData] = useState<{studentWallet: string, studentName: string, degreeName: string, certId: string}[]>([]);
  const [csvFileName, setCsvFileName] = useState("");
  const [myDegrees, setMyDegrees] = useState<DegreeResult[]>([]);
  const [loadingMyDegrees, setLoadingMyDegrees] = useState(false);

  useEffect(() => {
    fetch("/contract.json")
      .then((res) => res.json())
      .then((data) => {
        if (data.address) {
          setContractAddress(data.address);
          console.log("📄 Contract address loaded:", data.address);
        }
      })
      .catch(() => {
        console.log("📄 Using fallback contract address");
      });

    loadTransactions();
    connectAccount(0);
  }, []);

  useEffect(() => {
    if (contractAddress) {
      fetchTotalDegrees();
    }
  }, [contractAddress]);

  const fetchTotalDegrees = async () => {
    try {
      const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
      const contract = new ethers.Contract(contractAddress, abi, provider);
      const total = await contract.getTotalDegrees();
      setTotalDegrees(Number(total));
    } catch {
      setTotalDegrees(0);
    }
  };

  const loadMyDegrees = async () => {
    if (!account || !contractAddress) return;
    setLoadingMyDegrees(true);
    try {
      const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
      const contract = new ethers.Contract(contractAddress, abi, provider);
      const total = await contract.getTotalDegrees();
      const degrees = [];
      for (let i = 0; i < Number(total); i++) {
        const data = await contract.getDegreeByIndex(i);
        if (data[0].toLowerCase() === account.toLowerCase()) {
           degrees.push({
             studentWallet: data[0],
             studentName: data[1],
             degreeName: data[2],
             issueDate: data[3],
             isValid: data[4],
             certId: data[5]
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

  const loadTransactions = () => {
    const saved = localStorage.getItem("degreeTransactions");
    if (saved) setTransactions(JSON.parse(saved));
  };

  const addTransaction = (tx: Transaction) => {
    const updated = [tx, ...transactions];
    setTransactions(updated);
    localStorage.setItem("degreeTransactions", JSON.stringify(updated));
  };

  const connectAccount = async (accountIndex: number) => {
    try {
      const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
      const signer = await provider.getSigner(accountIndex);
      const address = await signer.getAddress();
      setAccount(address);
      setSelectedAccount(accountIndex);
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || "Failed to connect");
    }
  };

  useEffect(() => {
    if (selectedAccount >= 2 && (activeTab === "issue" || activeTab === "batch" || activeTab === "revoke")) {
      setActiveTab("mydegrees");
    }
  }, [selectedAccount, activeTab]);

  const getContract = async () => {
    const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    const signer = await provider.getSigner(selectedAccount);
    return new ethers.Contract(contractAddress, abi, signer);
  };

  const issue = async () => {
    setError(""); setSuccess("");
    if (!studentWallet.trim() || !student.trim() || !degree.trim() || !certId.trim()) {
      setError("Please fill in all fields");
      return;
    }
    try {
      setLoading(true);
      const contract = await getContract();
      const hash = ethers.keccak256(ethers.toUtf8Bytes(certId));
      const tx = await contract.issueDegree(studentWallet, student, degree, hash);
      await tx.wait();
      addTransaction({ type: "Issued", certificateId: certId, studentName: student, degreeName: degree, timestamp: Date.now(), txHash: tx.hash });
      setSuccess(`Degree issued successfully for ${student}!`);
      setStudentWallet(""); setStudent(""); setDegree(""); setCertId("");
      fetchTotalDegrees();
    } catch (err: unknown) {
      const error = err as Error;
      if (error.message.includes("Degree already issued")) setError("This certificate ID has already been used");
      else if (error.message.includes("user rejected")) setError("Transaction was rejected");
      else setError(error.message || "Failed to issue degree");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      const parsedData = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const parts = line.split(',');
        if (parts.length >= 4) {
          if (i === 0 && parts[0].toLowerCase().includes("wallet")) continue;
          parsedData.push({
            studentWallet: parts[0].trim(),
            studentName: parts[1].trim(),
            degreeName: parts[2].trim(),
            certId: parts[3].trim()
          });
        }
      }
      setCsvData(parsedData);
    };
    reader.readAsText(file);
  };

  const issueBatch = async () => {
    setError(""); setSuccess("");
    if (csvData.length === 0) {
      setError("Please upload a valid CSV file with data first");
      return;
    }
    if (csvData.length > 100) {
       setError("Maximum 100 degrees per batch");
       return;
    }
    try {
      setLoading(true);
      const contract = await getContract();
      
      const studentWallets = csvData.map(d => d.studentWallet);
      const studentNames = csvData.map(d => d.studentName);
      const degreeNames = csvData.map(d => d.degreeName);
      const hashes = csvData.map(d => ethers.keccak256(ethers.toUtf8Bytes(d.certId)));
      
      const tx = await contract.issueBatchDegrees(studentWallets, studentNames, degreeNames, hashes);
      await tx.wait();
      
      const newTxs: Transaction[] = [];
      const timestamp = Date.now();
      csvData.forEach((d) => {
        newTxs.push({
          type: "Issued",
          certificateId: d.certId,
          studentName: d.studentName,
          degreeName: d.degreeName,
          timestamp: timestamp,
          txHash: tx.hash
        });
      });
      
      const updated = [...newTxs, ...transactions];
      setTransactions(updated);
      localStorage.setItem("degreeTransactions", JSON.stringify(updated));
      
      setSuccess(`Batch issued successfully: ${csvData.length} degrees!`);
      setCsvData([]);
      setCsvFileName("");
      fetchTotalDegrees();
    } catch (err: unknown) {
      const error = err as Error;
      if (error.message.includes("Degree already issued")) setError("One or more certificate IDs have already been used");
      else if (error.message.includes("user rejected")) setError("Transaction was rejected");
      else setError(error.message || "Failed to issue batch degrees");
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    setError(""); setSuccess(""); setResult(null);
    if (!verifyCertId.trim()) { setError("Please enter a certificate ID"); return; }
    try {
      setLoading(true);
      const contract = await getContract();
      const hash = ethers.keccak256(ethers.toUtf8Bytes(verifyCertId));
      const data = await contract.verifyDegree(hash);
      setResult({ studentWallet: data[0], studentName: data[1], degreeName: data[2], issueDate: data[3], isValid: data[4] });
      setSuccess("Degree verified successfully!");
    } catch (err: unknown) {
      const error = err as Error;
      if (error.message.includes("Degree not found")) setError("Certificate not found. Please check the ID.");
      else setError(error.message || "Failed to verify degree");
    } finally {
      setLoading(false);
    }
  };

  const revoke = async () => {
    setError(""); setSuccess("");
    if (!revokeCertId.trim()) { setError("Please enter a certificate ID"); return; }
    if (!window.confirm("Are you sure you want to revoke this degree? This action cannot be undone.")) return;
    try {
      setLoading(true);
      const contract = await getContract();
      const hash = ethers.keccak256(ethers.toUtf8Bytes(revokeCertId));
      
      let sName = undefined;
      let dName = undefined;
      try {
        const verifyData = await contract.verifyDegree(hash);
        sName = verifyData[1];
        dName = verifyData[2];
      } catch(e) {}
      
      const tx = await contract.revokeDegree(hash);
      await tx.wait();
      addTransaction({ type: "Revoked", certificateId: revokeCertId, studentName: sName, degreeName: dName, timestamp: Date.now(), txHash: tx.hash });
      setSuccess("Degree revoked successfully!");
      setRevokeCertId(""); setResult(null);
    } catch (err: unknown) {
      const error = err as Error;
      if (error.message.includes("Degree not found")) setError("Certificate not found");
      else if (error.message.includes("Degree already revoked")) setError("This degree has already been revoked");
      else setError(error.message || "Failed to revoke degree");
    } finally {
      setLoading(false);
    }
  };

  const shortenAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

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
              <div className="logo-icon">
                <VaultIcon />
              </div>
              <div>
                <h1 className="app-title">DegreeVault</h1>
              </div>
            </div>
          </div>
          <div className="header-right">
            <div className="wallet-card">
              <div className="wallet-top">
                <WalletIcon />
                <select
                  value={selectedAccount}
                  onChange={(e) => connectAccount(parseInt(e.target.value))}
                  className="account-select"
                >
                  {HARDHAT_ACCOUNTS.map((acc) => (
                    <option key={acc.index} value={acc.index}>
                      {acc.name} ({acc.role})
                    </option>
                  ))}
                </select>
              </div>
              {account && (
                <div className="wallet-info">
                  <div className="wallet-address">
                    <span className="status-dot" />
                    <span className="address-text" style={{ fontSize: '10px' }} title={account}>{account}</span>
                  </div>
                  <span className="network-badge">Polygon</span>
                </div>
              )}
            </div>
          </div>
        </header>

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
              <p className="stat-value">{transactions.filter(t => t.type === "Issued").length}</p>
              <p className="stat-label">Issued</p>
            </div>
          </div>
          <div className="stat-item">
            <div className="stat-icon stat-icon-red"><BanIcon /></div>
            <div>
              <p className="stat-value">{transactions.filter(t => t.type === "Revoked").length}</p>
              <p className="stat-label">Revoked</p>
            </div>
          </div>
          <div className="stat-item">
            <div className="stat-icon stat-icon-cyan"><ActivityIcon /></div>
            <div>
              <p className="stat-value status-active">Active</p>
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

        {/* Main Content */}
        <div className="main-grid">
          {/* Left Panel — Actions */}
          <div className="actions-panel">
            {/* Tabs */}
            <div className="tab-bar">
              {selectedAccount < 2 && (
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
              {selectedAccount < 2 && (
                <button className={`tab-btn ${activeTab === "revoke" ? "tab-active tab-revoke" : ""}`} onClick={() => setActiveTab("revoke")}>
                  <BanIcon /> Revoke
                </button>
              )}
              <button className={`tab-btn ${activeTab === "mydegrees" ? "tab-active tab-verify" : ""}`} onClick={() => setActiveTab("mydegrees")}>
                <WalletIcon /> My Degrees
              </button>
            </div>

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
                  <p style={{fontSize: "12px", color: "#64748b", marginTop: "8px"}}>Format: Student Wallet, Student Name, Degree Name, Certificate ID</p>
                </div>
                
                {csvData.length > 0 && (
                  <div className="preview-table-container">
                    <p style={{fontSize: "13px", fontWeight: "600", marginBottom: "8px", color: "#a78bfa"}}>Previewing {csvData.length} records:</p>
                    <div className="preview-table-wrapper">
                      <table className="preview-table">
                        <thead>
                          <tr>
                            <th>Wallet</th>
                            <th>Student</th>
                            <th>Degree</th>
                            <th>Cert ID</th>
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

                <button onClick={issueBatch} disabled={loading || csvData.length === 0} className="btn btn-purple" style={{marginTop: "20px"}}>
                  {loading ? <><span className="spinner" /> Processing Batch...</> : <><ShieldIcon /> Issue {csvData.length > 0 ? csvData.length : "Batch"} Degrees</>}
                </button>
              </div>
            )}

            {/* Verify Tab */}
            {activeTab === "verify" && (
              <div className="tab-content animate-fade-in">
                <h2 className="section-title">Verify Degree</h2>
                <p className="section-desc">Instantly verify the authenticity of any academic credential.</p>
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
                    </div>
                    <div className="result-body">
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
                {loadingMyDegrees ? (
                  <div style={{textAlign: "center", padding: "40px", color: "#a78bfa"}}>
                     <span className="spinner" /> Loading your degrees...
                  </div>
                ) : myDegrees.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon"><SearchIcon /></div>
                    <p className="empty-title">No degrees found</p>
                    <p className="empty-desc">Your wallet doesn't have any Soulbound Tokens yet.</p>
                  </div>
                ) : (
                  <div className="degrees-grid" style={{display: "grid", gap: "16px"}}>
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
                transactions.map((tx, idx) => (
                  <div key={idx} className="tx-item">
                    <div className="tx-left">
                      <span className={`tx-badge ${tx.type === "Issued" ? "tx-badge-issued" : "tx-badge-revoked"}`}>
                        {tx.type === "Issued" ? <ShieldIcon /> : <BanIcon />}
                      </span>
                      <div>
                        <p className="tx-cert">{tx.certificateId}</p>
                        {tx.studentName && <p className="tx-student">{tx.studentName}{tx.degreeName ? ` • ${tx.degreeName}` : ''}</p>}
                        <p className="tx-time">{new Date(tx.timestamp).toLocaleString()}</p>
                      </div>
                    </div>
                    <a href={`https://polygonscan.com/tx/${tx.txHash}`} target="_blank" rel="noopener noreferrer" className="tx-link">
                      <LinkIcon />
                    </a>
                  </div>
                ))
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
        .app-subtitle {
          font-size: 13px;
          color: #94a3b8;
          font-weight: 500;
        }

        /* Wallet */
        .wallet-card {
          background: rgba(30, 27, 75, 0.5);
          border: 1px solid rgba(124, 58, 237, 0.2);
          border-radius: 14px;
          padding: 12px 16px;
          backdrop-filter: blur(12px);
        }
        .wallet-top {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #a78bfa;
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
        .wallet-info {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 8px;
          gap: 10px;
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

        /* Responsive */
        @media (max-width: 900px) {
          .main-grid { grid-template-columns: 1fr; }
          .stats-bar { grid-template-columns: repeat(2, 1fr); }
          .header { flex-direction: column; align-items: flex-start; }
        }
        @media (max-width: 500px) {
          .stats-bar { grid-template-columns: 1fr; }
          .content-wrapper { padding: 16px; }
        }
      `}</style>
    </main>
  );
}