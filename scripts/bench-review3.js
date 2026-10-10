// Review-3 benchmark for DegreeVault (Hardhat localhost, chain 31337).
// Usage:  terminal 1: npx hardhat node
//         terminal 2: npx hardhat run scripts/bench-review3.js --network localhost
// Writes sample_batch_degrees.csv (repo root) and bench-output/results.json.
// Needs the 20 default Hardhat accounts, so it is meant for the local node.
// Mirrors the frontend: certificate hash = keccak256(utf8(certId)); QR = qrcode lib, ECC "H",
// URL = http://localhost:3000/verify?cert=<id>; verify via a fresh JSON-RPC provider (as /verify does).
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");
const jsQR = require("jsqr");
const { PNG } = require("pngjs");

const { ethers } = hre;
const H = (id) => ethers.utils.keccak256(ethers.utils.toUtf8Bytes(id));
const now = () => Number(process.hrtime.bigint()) / 1e6;
const stats = (a) => {
  const s = [...a].sort((x, y) => x - y);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  const mean = a.reduce((x, y) => x + y, 0) / a.length;
  return { n: a.length, mean: +mean.toFixed(2), median: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2), min: +s[0].toFixed(2), max: +s[s.length - 1].toFixed(2) };
};
async function rejects(p) { try { const tx = await p; await tx.wait(); return { rejected: false }; } catch (e) { return { rejected: true, reason: (e.errorName || e.reason || e.message || "").toString().slice(0, 120) }; } }

// Same parsing logic as frontend/app/page.tsx handleFileUpload
function parseCsv(text) {
  const out = []; const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim(); if (!line) continue;
    const parts = line.split(",");
    if (parts.length >= 4) {
      if (i === 0 && parts[0].toLowerCase().includes("wallet")) continue;
      out.push({ studentWallet: parts[0].trim(), studentName: parts[1].trim(), degreeName: parts[2].trim(), certId: parts[3].trim() });
    }
  }
  return out;
}

async function qrRoundTrip(certId, occlusion = 0) {
  const url = `http://localhost:3000/verify?cert=${encodeURIComponent(certId)}`;
  const buf = await QRCode.toBuffer(url, { width: 300, margin: 2, color: { dark: "#1e1b4b", light: "#ffffff" }, errorCorrectionLevel: "H" });
  const png = PNG.sync.read(buf);
  if (occlusion > 0) { // paint a centred white square covering `occlusion` fraction of the code area
    const side = Math.round(Math.sqrt(occlusion) * png.width * 0.85);
    const x0 = Math.round((png.width - side) / 2), y0 = Math.round((png.height - side) / 2);
    for (let y = y0; y < y0 + side; y++) for (let x = x0; x < x0 + side; x++) { const i = (y * png.width + x) * 4; png.data[i] = png.data[i + 1] = png.data[i + 2] = 255; }
  }
  const code = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  if (!code) return null;
  return new URL(code.data).searchParams.get("cert");
}

async function main() {
  const net = await ethers.provider.getNetwork();
  const signers = await ethers.getSigners();
  const [admin] = signers;
  const R = { network: hre.network.name, chainId: net.chainId, runAt: new Date().toISOString(), node: process.version, ethers: ethers.version };

  // ---------- Deploy ----------
  const F = await ethers.getContractFactory("DegreeVerification");
  const c = await F.deploy(admin.address); const dr = await c.deployTransaction.wait();
  R.deployGas = dr.gasUsed.toNumber();

  const students = signers.slice(10, 20).map((s) => s.address);
  let idc = 0; const nextId = (p = "BENCH") => `${p}-2024-${String(++idc).padStart(5, "0")}`;

  // ---------- Single issuance (n=30) ----------
  const single = { gas: [], latencyMs: [] }; const issuedIds = [];
  for (let i = 0; i < 30; i++) {
    const id = nextId("SGL");
    const t0 = now();
    const tx = await c.issueDegree(students[i % students.length], `Student ${i}`, "B.Tech. Computer Science", H(id));
    const rc = await tx.wait();
    single.latencyMs.push(now() - t0); single.gas.push(rc.gasUsed.toNumber()); issuedIds.push(id);
  }
  R.singleIssue = { gas: stats(single.gas), latencyMs: stats(single.latencyMs) };

  // ---------- Batch issuance ----------
  const CAP = 16777216;
  const sizes = [1, 5, 10, 25, 50, 75, 100]; R.batch = [];
  for (const n of sizes) {
    const runs = { gas: [], latencyMs: [] }; let err = null; let est = null;
    for (let r = 0; r < 3; r++) {
      const ids = Array.from({ length: n }, () => nextId(`B${n}`));
      const args = [ids.map((_, k) => students[k % students.length]), ids.map((_, k) => `Batch Student ${k}`), ids.map(() => "M.Sc. Data Science"), ids.map(H)];
      try {
        est = (await c.estimateGas.issueBatchDegrees(...args)).toNumber();
        const t0 = now(); const rc = await (await c.issueBatchDegrees(...args)).wait();
        runs.latencyMs.push(now() - t0); runs.gas.push(rc.gasUsed.toNumber());
      } catch (e) { err = (e.reason || e.message).slice(0, 160); break; }
    }
    if (runs.gas.length) { const g = stats(runs.gas); R.batch.push({ size: n, reps: runs.gas.length, gasTotal: g.mean, gasPerCredential: +(g.mean / n).toFixed(0), pctOfCap: +(100 * g.mean / CAP).toFixed(1), latencyMs: stats(runs.latencyMs) }); }
    else R.batch.push({ size: n, failed: true, estimate: est, error: err });
  }
  const over = await rejects(c.issueBatchDegrees(Array(101).fill(students[0]), Array(101).fill("x"), Array(101).fill("y"), Array.from({ length: 101 }, () => H(nextId("OVR"))), { gasLimit: 16_000_000 }));
  R.batchOver100Rejected = over;

  // ---------- CSV pipeline (generated sample_batch_degrees.csv in the frontend format) ----------
  const degrees = ["B.Sc. Blockchain Architecture", "M.Sc. Cybersecurity", "B.Sc. Data Science", "B.Tech. ECE", "M.Tech. AI & ML"];
  const rows = ["studentWallet,studentName,degreeName,certificateId"];
  for (let i = 0; i < 100; i++) rows.push(`${students[i % students.length]},Sample Student ${i + 1},${degrees[i % 5]},CSV-2024-${String(i + 1).padStart(3, "0")}`);
  const csvPath = path.join(__dirname, "..", "sample_batch_degrees.csv");
  fs.mkdirSync(path.dirname(csvPath), { recursive: true }); fs.writeFileSync(csvPath, rows.join("\n"));
  const t0 = now(); const parsed = parseCsv(fs.readFileSync(csvPath, "utf8")); const parseMs = now() - t0;
  const t1 = now(); let csvGas = 0, csvTxs = 0, csvFullBatchError = null;
  try { const rc = await (await c.issueBatchDegrees(parsed.map((d) => d.studentWallet), parsed.map((d) => d.studentName), parsed.map((d) => d.degreeName), parsed.map((d) => H(d.certId)))).wait(); csvGas = rc.gasUsed.toNumber(); csvTxs = 1; }
  catch (e) {
    csvFullBatchError = (e.reason || e.message).slice(0, 160);
    for (let k = 0; k < parsed.length; k += 50) { const ch = parsed.slice(k, k + 50); const rc = await (await c.issueBatchDegrees(ch.map((d) => d.studentWallet), ch.map((d) => d.studentName), ch.map((d) => d.degreeName), ch.map((d) => H(d.certId)))).wait(); csvGas += rc.gasUsed.toNumber(); csvTxs++; }
  }
  let csvVerified = 0; for (const d of parsed) { const v = await c.verifyDegree(H(d.certId)); if (v[4] && v[1] === d.studentName) csvVerified++; }
  R.csv = { rows: parsed.length, parseMs: +parseMs.toFixed(2), issueMs: +(now() - t1).toFixed(1), gas: csvGas, txCount: csvTxs, fullBatchError: csvFullBatchError, verifiedAfterIssue: csvVerified };

  // ---------- Verification latency (fresh JSON-RPC provider, as /verify page) ----------
  const rpc = new ethers.providers.JsonRpcProvider(hre.network.config.url || "http://127.0.0.1:8545");
  const ro = c.connect(rpc);
  const vLat = []; let vOk = 0;
  for (let i = 0; i < 200; i++) { const id = issuedIds[i % issuedIds.length]; const t = now(); const v = await ro.verifyDegree(H(id)); vLat.push(now() - t); if (v[4]) vOk++; }
  const nfLat = []; let nfOk = 0;
  for (let i = 0; i < 50; i++) { const t = now(); try { await ro.verifyDegree(H(`NOPE-${i}`)); } catch (e) { if ((e.reason || e.message).includes("Degree not found")) nfOk++; } nfLat.push(now() - t); }
  R.verify = { validLookups: { latencyMs: stats(vLat), correct: vOk, total: 200 }, notFoundLookups: { latencyMs: stats(nfLat), correct: nfOk, total: 50 }, estimateGasView: (await ro.estimateGas.verifyDegree(H(issuedIds[0]))).toNumber() };

  // ---------- Revocation (n=20) ----------
  const revGas = [], revLat = []; let revThenRevoked = 0; let doubleRevokeRejected = 0; let recordRetained = 0;
  for (let i = 0; i < 20; i++) {
    const id = issuedIds[i]; const t = now();
    const rc = await (await c.revokeDegree(H(id))).wait(); revLat.push(now() - t); revGas.push(rc.gasUsed.toNumber());
    const v = await ro.verifyDegree(H(id)); if (v[4] === false) revThenRevoked++; if (v[1] === `Student ${i}` && v[3].gt(0)) recordRetained++;
    if ((await rejects(c.revokeDegree(H(id)))).rejected) doubleRevokeRejected++;
  }
  R.revoke = { n: 20, gas: stats(revGas), latencyMs: stats(revLat), verifyShowsRevoked: revThenRevoked, recordRetained, doubleRevokeRejected };

  // ---------- Unauthorized access (10 non-university wallets x 4 ops) ----------
  const attackers = signers.slice(1, 11); const ops = { issueDegree: 0, issueBatchDegrees: 0, revokeDegree: 0, grantRole: 0 }; const reasons = new Set();
  const role = await c.UNIVERSITY_ROLE();
  for (const a of attackers) {
    const ca = c.connect(a);
    for (const [k, p] of [
      ["issueDegree", () => ca.issueDegree(a.address, "Fake", "Fake Degree", H(nextId("FAKE")), { gasLimit: 500000 })],
      ["issueBatchDegrees", () => ca.issueBatchDegrees([a.address], ["Fake"], ["Fake"], [H(nextId("FAKEB"))], { gasLimit: 500000 })],
      ["revokeDegree", () => ca.revokeDegree(H(issuedIds[25]), { gasLimit: 500000 })],
      ["grantRole", () => ca.grantRole(role, a.address, { gasLimit: 500000 })],
    ]) { const r = await rejects(p()); if (r.rejected) { ops[k]++; reasons.add(r.reason.slice(0, 80)); } }
  }
  R.rbac = { attackers: attackers.length, attemptsPerOp: attackers.length, rejected: ops, totalAttempts: attackers.length * 4, totalRejected: Object.values(ops).reduce((x, y) => x + y, 0), stillValid: (await c.verifyDegree(H(issuedIds[25])))[4], sampleReasons: [...reasons].slice(0, 3) };

  // ---------- Soulbound transfer attempts ----------
  let sbtRejected = 0; const holder = signers[10];
  const bal = (await c.balanceOf(holder.address)).toNumber();
  for (let t = 0; t < 10; t++) {
    let tokenId = null; for (let id = t; id < 400 && tokenId === null; id++) { try { if ((await c.ownerOf(id)) === holder.address) tokenId = id; } catch {} }
    if ((await rejects(c.connect(holder).transferFrom(holder.address, signers[11].address, tokenId, { gasLimit: 500000 }))).rejected) sbtRejected++;
  }
  R.soulbound = { attempts: 10, rejected: sbtRejected, holderBalance: bal };

  // ---------- QR end-to-end ----------
  const revokedIds = issuedIds.slice(0, 10), validIds = issuedIds.slice(20, 30), csvIds = parsed.slice(0, 20).map((d) => d.certId), missing = Array.from({ length: 10 }, (_, i) => `MISSING-2024-${i}`);
  const cases = [...validIds.map((id) => [id, "VALID"]), ...csvIds.map((id) => [id, "VALID"]), ...revokedIds.map((id) => [id, "REVOKED"]), ...missing.map((id) => [id, "NOT FOUND"])];
  let decoded = 0, correct = 0; const qrLat = []; const byState = { VALID: [0, 0], REVOKED: [0, 0], "NOT FOUND": [0, 0] };
  for (const [id, expect] of cases) {
    const t = now(); const got = await qrRoundTrip(id); let state = "DECODE FAIL";
    if (got !== null) { decoded++; try { const v = await ro.verifyDegree(H(got)); state = v[4] ? "VALID" : "REVOKED"; } catch (e) { state = (e.reason || e.message).includes("Degree not found") ? "NOT FOUND" : "ERROR"; } }
    qrLat.push(now() - t); byState[expect][1]++; if (state === expect) { correct++; byState[expect][0]++; }
  }
  R.qr = { cases: cases.length, decoded, correctStatus: correct, byState, roundTripMs: stats(qrLat) };
  const occ = {}; for (const f of [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3]) { let ok = 0; for (const id of validIds) if ((await qrRoundTrip(id, f)) === id) ok++; occ[f] = `${ok}/${validIds.length}`; }
  R.qrOcclusion = occ;

  R.totalDegreesOnChain = (await c.getTotalDegrees()).toNumber();
  fs.mkdirSync(path.join(__dirname, "..", "bench-output"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, "..", "bench-output", "results.json"), JSON.stringify(R, null, 2));
  console.log(JSON.stringify(R, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
