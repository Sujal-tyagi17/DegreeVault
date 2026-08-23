const hre = require("hardhat");

async function main() {
  console.log("\n📊 Recent Blockchain Transactions\n");
  
  const provider = hre.ethers.provider;
  const latestBlock = await provider.getBlockNumber();
  
  console.log(`Latest Block: ${latestBlock}\n`);
  
  // Get last 10 blocks
  const blocksToShow = Math.min(10, latestBlock);
  
  for (let i = latestBlock; i > latestBlock - blocksToShow && i >= 0; i--) {
    const block = await provider.getBlock(i);
    
    if (block && block.transactions.length > 0) {
      console.log(`\n🔷 Block #${i}`);
      console.log(`   Timestamp: ${new Date(block.timestamp * 1000).toLocaleString()}`);
      console.log(`   Transactions: ${block.transactions.length}`);
      
      for (const txHash of block.transactions) {
        const tx = await provider.getTransaction(txHash);
        const receipt = await provider.getTransactionReceipt(txHash);
        
        if (tx && receipt) {
          console.log(`\n   📤 Transaction: ${txHash.slice(0, 10)}...`);
          console.log(`      From: ${tx.from}`);
          console.log(`      To: ${tx.to}`);
          console.log(`      Gas Used: ${receipt.gasUsed.toString()}`);
          console.log(`      Status: ${receipt.status === 1 ? '✅ Success' : '❌ Failed'}`);
        }
      }
    }
  }
  
  console.log("\n" + "=".repeat(60) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
