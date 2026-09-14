"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ethers } from "ethers";
import { isMetaMaskAvailable, getBrowserProvider } from "../lib/wallet";
import { CONTRACT_ABI, loadContractAddress, getReadContract } from "../lib/contract";
import { generateQRCodeDataUrl, downloadQRCode, getVerificationUrl } from "../lib/qrcode";

// ─── Types ───────────────────────────────────────────────────────────

interface DegreeResult {
  studentWallet: string;
  studentName: string;
  degreeName: string;
  issueDate: bigint;
  isValid: boolean;
}

// ─── SVG Icons ───────────────────────────────────────────────────────

const VaultIcon = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
    <circle cx="12" cy="12" r="3" />
    <path d="M12 9v1" /><path d="M12 14v1" /><path d="M9 12h1" /><path d="M14 12h1" />
  </svg>
);

const ShieldCheckIcon = () => (
  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

const ShieldXIcon = () => (
  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="M9.5 9.5l5 5" /><path d="M14.5 9.5l-5 5" />
  </svg>
);

const SearchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

// ─── Verify Page Content (uses useSearchParams) ──────────────────────

function VerifyPageContent() {
  const searchParams = useSearchParams();
  const certParam = searchParams.get("cert");

  const [contractAddress, setContractAddress] = useState("");
  const [certId, setCertId] = useState(certParam || "");
  const [result, setResult] = useState<DegreeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [autoVerified, setAutoVerified] = useState(false);

  // Load contract address
  useEffect(() => {
    loadContractAddress().then(setContractAddress);
  }, []);

  // Get a read-only provider
  const getProvider = useCallback((): ethers.Provider => {
    // Try localhost first (for dev), then MetaMask
    try {
      return new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    } catch {
      if (isMetaMaskAvailable()) {
        return getBrowserProvider();
      }
      throw new Error("No blockchain provider available.");
    }
  }, []);

  // Verify function
  const verify = useCallback(async (id: string) => {
    if (!id.trim() || !contractAddress) return;
    setError("");
    setResult(null);
    setQrDataUrl("");
    setLoading(true);

    try {
      let provider: ethers.Provider;
      try {
        provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
        await (provider as ethers.JsonRpcProvider).getBlockNumber();
      } catch {
        if (isMetaMaskAvailable()) {
          provider = getBrowserProvider();
        } else {
          throw new Error("No blockchain provider available. Please ensure a local node is running or MetaMask is installed.");
        }
      }

      const contract = getReadContract(contractAddress, provider);
      const hash = ethers.keccak256(ethers.toUtf8Bytes(id));
      const data = await contract.verifyDegree(hash);

      const degreeResult: DegreeResult = {
        studentWallet: data[0],
        studentName: data[1],
        degreeName: data[2],
        issueDate: data[3],
        isValid: data[4],
      };
      setResult(degreeResult);

      // Generate QR code for this verified certificate
      const qr = await generateQRCodeDataUrl(id, { width: 200 });
      setQrDataUrl(qr);
    } catch (err: unknown) {
      const e = err as Error;
      if (e.message.includes("Degree not found")) {
        setError("Certificate not found. Please verify the certificate ID is correct.");
      } else {
        setError(e.message || "Verification failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }, [contractAddress]);

  // Auto-verify if cert parameter is present in URL
  useEffect(() => {
    if (certParam && contractAddress && !autoVerified) {
      setCertId(certParam);
      verify(certParam);
      setAutoVerified(true);
    }
  }, [certParam, contractAddress, autoVerified, verify]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    verify(certId);
  };

  const copyLink = () => {
    const url = getVerificationUrl(certId);
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="verify-page">
      {/* Animated background */}
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />

      <div className="verify-wrapper">
        {/* Header */}
        <header className="verify-header">
          <a href="/" className="verify-logo">
            <div className="verify-logo-icon"><VaultIcon /></div>
            <div>
              <h1 className="verify-title">DegreeVault</h1>
              <p className="verify-subtitle">Blockchain Credential Verification</p>
            </div>
          </a>
        </header>

        {/* Main Verification Card */}
        <div className="verify-card">
          <div className="verify-card-header">
            <SearchIcon />
            <h2>Verify Academic Credential</h2>
          </div>
          <p className="verify-card-desc">
            Enter a certificate ID or scan a QR code to instantly verify the authenticity of an academic credential on the blockchain.
          </p>

          <form onSubmit={handleSubmit} className="verify-form">
            <div className="verify-input-group">
              <input
                type="text"
                placeholder="Enter Certificate ID (e.g., CERT-2024-001)"
                className="verify-input"
                value={certId}
                onChange={(e) => setCertId(e.target.value)}
                disabled={loading}
              />
              <button type="submit" disabled={loading || !certId.trim()} className="verify-submit-btn">
                {loading ? <span className="spinner" /> : <SearchIcon />}
              </button>
            </div>
          </form>

          {/* Error */}
          {error && (
            <div className="verify-alert verify-alert-error animate-fade-in">
              <div className="verify-alert-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><path d="m4.9 4.9 14.2 14.2" />
                </svg>
              </div>
              <div>
                <strong>Not Found</strong>
                <p>{error}</p>
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className={`verify-result ${result.isValid ? "verify-result-valid" : "verify-result-revoked"} animate-fade-in`}>
              {/* Status Hero */}
              <div className="verify-result-hero">
                <div className={`verify-result-shield ${result.isValid ? "shield-valid" : "shield-revoked"}`}>
                  {result.isValid ? <ShieldCheckIcon /> : <ShieldXIcon />}
                </div>
                <div className="verify-result-status">
                  <span className={`verify-result-badge ${result.isValid ? "badge-valid" : "badge-revoked"}`}>
                    {result.isValid ? "✓ VERIFIED — VALID" : "✗ VERIFIED — REVOKED"}
                  </span>
                  <p className="verify-result-note">
                    {result.isValid
                      ? "This credential has been cryptographically verified on the blockchain."
                      : "This credential was previously valid but has been revoked by the issuing institution."}
                  </p>
                </div>
              </div>

              {/* Credential Details */}
              <div className="verify-details">
                <h3 className="verify-details-title">Credential Details</h3>
                <div className="verify-detail-grid">
                  <div className="verify-detail-item">
                    <span className="verify-detail-label">Student Name</span>
                    <span className="verify-detail-value">{result.studentName}</span>
                  </div>
                  <div className="verify-detail-item">
                    <span className="verify-detail-label">Degree</span>
                    <span className="verify-detail-value">{result.degreeName}</span>
                  </div>
                  <div className="verify-detail-item">
                    <span className="verify-detail-label">Issue Date</span>
                    <span className="verify-detail-value">
                      {new Date(Number(result.issueDate) * 1000).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="verify-detail-item">
                    <span className="verify-detail-label">Student Wallet</span>
                    <span className="verify-detail-value verify-detail-mono">
                      {result.studentWallet}
                    </span>
                  </div>
                </div>
              </div>

              {/* QR Code Section */}
              {qrDataUrl && (
                <div className="verify-qr-section">
                  <h3 className="verify-details-title">Verification QR Code</h3>
                  <p className="verify-qr-desc">Share this QR code to allow anyone to verify this credential.</p>
                  <div className="verify-qr-container">
                    <div className="verify-qr-image-wrapper">
                      <img src={qrDataUrl} alt={`QR Code for certificate ${certId}`} className="verify-qr-image" />
                      <span className="verify-qr-label">Scan to Verify</span>
                    </div>
                    <div className="verify-qr-actions">
                      <button className="verify-qr-btn" onClick={() => downloadQRCode(qrDataUrl, certId)}>
                        <DownloadIcon /> Download QR Code
                      </button>
                      <button className="verify-qr-btn verify-qr-btn-secondary" onClick={copyLink}>
                        <CopyIcon /> {copied ? "Copied!" : "Copy Verification Link"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="verify-footer">
          <p>Powered by <strong>DegreeVault</strong> — Immutable, Transparent, Verifiable</p>
          <p className="verify-footer-sub">Credentials secured on the Polygon blockchain</p>
        </footer>
      </div>

      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        .verify-page {
          min-height: 100vh;
          background: #0a0a1a;
          color: #e2e8f0;
          font-family: 'Inter', -apple-system, sans-serif;
          position: relative;
          overflow-x: hidden;
        }

        .bg-orb {
          position: fixed;
          border-radius: 50%;
          filter: blur(140px);
          opacity: 0.12;
          pointer-events: none;
        }
        .bg-orb-1 { width: 600px; height: 600px; background: #7c3aed; top: -200px; right: -100px; }
        .bg-orb-2 { width: 500px; height: 500px; background: #06b6d4; bottom: -200px; left: -100px; }

        .verify-wrapper {
          position: relative;
          z-index: 1;
          max-width: 680px;
          margin: 0 auto;
          padding: 32px 20px;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        /* Header */
        .verify-header {
          text-align: center;
          margin-bottom: 40px;
        }
        .verify-logo {
          display: inline-flex;
          align-items: center;
          gap: 14px;
          text-decoration: none;
          color: inherit;
        }
        .verify-logo-icon {
          width: 56px;
          height: 56px;
          background: linear-gradient(135deg, #7c3aed, #a78bfa);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 0 0 40px rgba(124, 58, 237, 0.3);
        }
        .verify-title {
          font-size: 28px;
          font-weight: 800;
          background: linear-gradient(135deg, #c4b5fd, #818cf8, #67e8f9);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          line-height: 1.2;
          text-align: left;
        }
        .verify-subtitle {
          font-size: 13px;
          color: #94a3b8;
          font-weight: 500;
          text-align: left;
        }

        /* Card */
        .verify-card {
          background: rgba(30, 27, 75, 0.3);
          border: 1px solid rgba(124, 58, 237, 0.15);
          border-radius: 24px;
          padding: 36px;
          backdrop-filter: blur(16px);
        }
        .verify-card-header {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #a78bfa;
          margin-bottom: 8px;
        }
        .verify-card-header h2 {
          font-size: 22px;
          font-weight: 700;
          color: #f1f5f9;
        }
        .verify-card-desc {
          font-size: 14px;
          color: #64748b;
          margin-bottom: 28px;
          line-height: 1.6;
        }

        /* Form */
        .verify-form { margin-bottom: 0; }
        .verify-input-group {
          display: flex;
          gap: 0;
          border-radius: 14px;
          overflow: hidden;
          border: 1px solid rgba(124, 58, 237, 0.2);
          background: rgba(15, 14, 36, 0.6);
          transition: border-color 0.2s;
        }
        .verify-input-group:focus-within {
          border-color: #7c3aed;
          box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.1);
        }
        .verify-input {
          flex: 1;
          padding: 16px 20px;
          background: transparent;
          border: none;
          color: #e2e8f0;
          font-size: 15px;
          font-family: inherit;
          outline: none;
        }
        .verify-input::placeholder { color: #475569; }
        .verify-submit-btn {
          padding: 16px 24px;
          background: linear-gradient(135deg, #7c3aed, #6d28d9);
          border: none;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .verify-submit-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #8b5cf6, #7c3aed);
        }
        .verify-submit-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Alerts */
        .verify-alert {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 18px 20px;
          border-radius: 14px;
          margin-top: 24px;
        }
        .verify-alert-error {
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.2);
          color: #fca5a5;
        }
        .verify-alert-icon { flex-shrink: 0; margin-top: 2px; }
        .verify-alert strong { display: block; font-size: 15px; margin-bottom: 4px; }
        .verify-alert p { font-size: 13px; color: #94a3b8; margin: 0; }

        /* Result */
        .verify-result {
          margin-top: 28px;
          border-radius: 20px;
          overflow: hidden;
        }
        .verify-result-valid {
          border: 1px solid rgba(34, 197, 94, 0.2);
        }
        .verify-result-revoked {
          border: 1px solid rgba(239, 68, 68, 0.2);
        }

        .verify-result-hero {
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 28px 24px;
        }
        .verify-result-valid .verify-result-hero {
          background: rgba(34, 197, 94, 0.06);
        }
        .verify-result-revoked .verify-result-hero {
          background: rgba(239, 68, 68, 0.06);
        }

        .verify-result-shield {
          flex-shrink: 0;
        }
        .shield-valid { color: #4ade80; }
        .shield-revoked { color: #f87171; }

        .verify-result-status { flex: 1; }
        .verify-result-badge {
          display: inline-block;
          padding: 6px 16px;
          border-radius: 24px;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.5px;
        }
        .badge-valid {
          background: rgba(34, 197, 94, 0.15);
          color: #4ade80;
        }
        .badge-revoked {
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
        }
        .verify-result-note {
          font-size: 13px;
          color: #94a3b8;
          margin-top: 8px;
          line-height: 1.5;
        }

        /* Details */
        .verify-details {
          padding: 24px;
          border-top: 1px solid rgba(124, 58, 237, 0.1);
        }
        .verify-details-title {
          font-size: 14px;
          font-weight: 600;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 16px;
        }
        .verify-detail-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .verify-detail-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .verify-detail-item:last-child {
          grid-column: 1 / -1;
        }
        .verify-detail-label {
          font-size: 12px;
          color: #64748b;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .verify-detail-value {
          font-size: 15px;
          color: #f1f5f9;
          font-weight: 600;
        }
        .verify-detail-mono {
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          word-break: break-all;
        }

        /* QR Section */
        .verify-qr-section {
          padding: 24px;
          border-top: 1px solid rgba(124, 58, 237, 0.1);
        }
        .verify-qr-desc {
          font-size: 13px;
          color: #64748b;
          margin-bottom: 20px;
        }
        .verify-qr-container {
          display: flex;
          align-items: flex-start;
          gap: 24px;
          flex-wrap: wrap;
        }
        .verify-qr-image-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }
        .verify-qr-image {
          width: 160px;
          height: 160px;
          border-radius: 12px;
          border: 3px solid rgba(124, 58, 237, 0.2);
          background: white;
          padding: 4px;
        }
        .verify-qr-label {
          font-size: 11px;
          color: #64748b;
          font-weight: 500;
        }
        .verify-qr-actions {
          display: flex;
          flex-direction: column;
          gap: 10px;
          flex: 1;
          min-width: 200px;
        }
        .verify-qr-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 11px 18px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.2s;
          background: linear-gradient(135deg, #7c3aed, #6d28d9);
          border: none;
          color: white;
          box-shadow: 0 2px 10px rgba(124, 58, 237, 0.2);
        }
        .verify-qr-btn:hover {
          box-shadow: 0 4px 20px rgba(124, 58, 237, 0.4);
          transform: translateY(-1px);
        }
        .verify-qr-btn-secondary {
          background: rgba(124, 58, 237, 0.1);
          border: 1px solid rgba(124, 58, 237, 0.2);
          box-shadow: none;
          color: #a78bfa;
        }
        .verify-qr-btn-secondary:hover {
          background: rgba(124, 58, 237, 0.2);
          box-shadow: none;
        }

        /* Footer */
        .verify-footer {
          text-align: center;
          margin-top: auto;
          padding-top: 48px;
          padding-bottom: 24px;
        }
        .verify-footer p {
          font-size: 13px;
          color: #64748b;
        }
        .verify-footer strong {
          color: #a78bfa;
        }
        .verify-footer-sub {
          font-size: 12px !important;
          color: #475569 !important;
          margin-top: 4px;
        }

        /* Spinner */
        .spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Animations */
        .animate-fade-in {
          animation: fadeIn 0.4s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Responsive */
        @media (max-width: 600px) {
          .verify-card { padding: 24px 20px; }
          .verify-result-hero { flex-direction: column; text-align: center; }
          .verify-detail-grid { grid-template-columns: 1fr; }
          .verify-qr-container { flex-direction: column; align-items: center; }
          .verify-qr-actions { min-width: unset; width: 100%; }
        }
      `}</style>
    </main>
  );
}

// ─── Page wrapper with Suspense for useSearchParams ──────────────────

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: "100vh",
        background: "#0a0a1a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#a78bfa",
        fontFamily: "Inter, sans-serif",
        fontSize: "16px",
      }}>
        Loading verification...
      </div>
    }>
      <VerifyPageContent />
    </Suspense>
  );
}
