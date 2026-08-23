const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n🚀 Starting DegreeVerification Contract Deployment...\n");

  const [deployer] = await hre.ethers.getSigners();
  const balance = await deployer.getBalance();

  console.log("📋 Deployment Details:");
  console.log("   Deployer Address:", deployer.address);
  console.log("   Account Balance:", hre.ethers.utils.formatEther(balance), "MATIC");
  console.log("   Network:", hre.network.name);
  console.log("\n⏳ Deploying contract...\n");

  const DegreeVerification = await hre.ethers.getContractFactory("DegreeVerification");
  const contract = await DegreeVerification.deploy(deployer.address);

  await contract.deployed();

  console.log("✅ Contract successfully deployed!");
  console.log("\n📝 Contract Information:");
  console.log("   Contract Address:", contract.address);
  console.log("   Transaction Hash:", contract.deployTransaction.hash);
  console.log("   Block Number:", contract.deployTransaction.blockNumber);

  console.log("\n👥 Role Assignments:");
  console.log("   Admin Role:", deployer.address);
  console.log("   University Role:", deployer.address);

  // Auto-save contract address for the frontend
  const contractInfo = {
    address: contract.address,
    network: hre.network.name,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };

  const frontendPublicDir = path.join(__dirname, "..", "frontend", "public");
  if (!fs.existsSync(frontendPublicDir)) {
    fs.mkdirSync(frontendPublicDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(frontendPublicDir, "contract.json"),
    JSON.stringify(contractInfo, null, 2)
  );

  console.log("\n📁 Contract address auto-saved to frontend/public/contract.json");

  console.log("\n🎉 Deployment Complete!\n");

  // Verify roles
  const DEFAULT_ADMIN_ROLE = await contract.DEFAULT_ADMIN_ROLE();
  const UNIVERSITY_ROLE = await contract.UNIVERSITY_ROLE();

  const hasAdminRole = await contract.hasRole(DEFAULT_ADMIN_ROLE, deployer.address);
  const hasUniversityRole = await contract.hasRole(UNIVERSITY_ROLE, deployer.address);

  console.log("✓ Admin role granted:", hasAdminRole);
  console.log("✓ University role granted:", hasUniversityRole);
  console.log("");
}

main().catch((error) => {
  console.error("\n❌ Deployment failed:");
  console.error(error);
  process.exitCode = 1;
});