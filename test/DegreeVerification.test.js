const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DegreeVerification", function () {
  let degreeVerification;
  let admin, university, otherUser;
  let certificateHash;

  beforeEach(async function () {
    [admin, university, otherUser] = await ethers.getSigners();
    
    const DegreeVerification = await ethers.getContractFactory("DegreeVerification");
    degreeVerification = await DegreeVerification.deploy(admin.address);
    // Wait for deployment to complete
    await degreeVerification.deployed();

    // Grant university role
    const UNIVERSITY_ROLE = await degreeVerification.UNIVERSITY_ROLE();
    await degreeVerification.connect(admin).grantRole(UNIVERSITY_ROLE, university.address);

    // Generate a certificate hash
    certificateHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("CERT-2024-001"));
  });

  describe("Deployment", function () {
    it("Should set the right admin", async function () {
      const DEFAULT_ADMIN_ROLE = await degreeVerification.DEFAULT_ADMIN_ROLE();
      expect(await degreeVerification.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
    });

    it("Should grant university role to admin", async function () {
      const UNIVERSITY_ROLE = await degreeVerification.UNIVERSITY_ROLE();
      expect(await degreeVerification.hasRole(UNIVERSITY_ROLE, admin.address)).to.be.true;
    });
  });

  describe("Issue Degree", function () {
    it("Should issue a degree successfully", async function () {
      await expect(
        degreeVerification.connect(university).issueDegree(
          otherUser.address,
          "John Doe",
          "Bachelor of Science",
          certificateHash
        )
      ).to.emit(degreeVerification, "DegreeIssued")
        .withArgs(certificateHash, "John Doe", otherUser.address);

      const degree = await degreeVerification.verifyDegree(certificateHash);
      expect(degree[0]).to.equal(otherUser.address);
      expect(degree[1]).to.equal("John Doe");
      expect(degree[2]).to.equal("Bachelor of Science");
      expect(degree[4]).to.be.true; // isValid
    });

    it("Should fail if not called by university", async function () {
      await expect(
        degreeVerification.connect(otherUser).issueDegree(
          otherUser.address,
          "John Doe",
          "Bachelor of Science",
          certificateHash
        )
      ).to.be.reverted;
    });

    it("Should fail with empty student name", async function () {
      await expect(
        degreeVerification.connect(university).issueDegree(
          otherUser.address,
          "",
          "Bachelor of Science",
          certificateHash
        )
      ).to.be.revertedWith("Student name required");
    });

    it("Should fail with empty degree name", async function () {
      await expect(
        degreeVerification.connect(university).issueDegree(
          otherUser.address,
          "John Doe",
          "",
          certificateHash
        )
      ).to.be.revertedWith("Degree name required");
    });

    it("Should fail with zero certificate hash", async function () {
      await expect(
        degreeVerification.connect(university).issueDegree(
          otherUser.address,
          "John Doe",
          "Bachelor of Science",
          ethers.constants.HashZero
        )
      ).to.be.revertedWith("Invalid certificate hash");
    });

    it("Should fail with invalid wallet", async function () {
      await expect(
        degreeVerification.connect(university).issueDegree(
          ethers.constants.AddressZero,
          "John Doe",
          "Bachelor of Science",
          certificateHash
        )
      ).to.be.revertedWith("Invalid student wallet");
    });

    it("Should fail if degree already issued", async function () {
      await degreeVerification.connect(university).issueDegree(
        otherUser.address,
        "John Doe",
        "Bachelor of Science",
        certificateHash
      );

      await expect(
        degreeVerification.connect(university).issueDegree(
          otherUser.address,
          "Jane Doe",
          "Master of Arts",
          certificateHash
        )
      ).to.be.revertedWith("Degree already issued");
    });

    it("Should issue multiple degrees with different hashes", async function () {
      const hash1 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("CERT-2024-001"));
      const hash2 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("CERT-2024-002"));

      await degreeVerification.connect(university).issueDegree(
        otherUser.address,
        "John Doe",
        "Bachelor of Science",
        hash1
      );

      await degreeVerification.connect(university).issueDegree(
        otherUser.address,
        "Jane Doe",
        "Master of Arts",
        hash2
      );

      const degree1 = await degreeVerification.verifyDegree(hash1);
      const degree2 = await degreeVerification.verifyDegree(hash2);

      expect(degree1[1]).to.equal("John Doe");
      expect(degree2[1]).to.equal("Jane Doe");
    });
  });

  describe("Verify Degree", function () {
    beforeEach(async function () {
      await degreeVerification.connect(university).issueDegree(
        otherUser.address,
        "John Doe",
        "Bachelor of Science",
        certificateHash
      );
    });

    it("Should verify an issued degree", async function () {
      const degree = await degreeVerification.verifyDegree(certificateHash);
      
      expect(degree[0]).to.equal(otherUser.address);
      expect(degree[1]).to.equal("John Doe");
      expect(degree[2]).to.equal("Bachelor of Science");
      expect(degree[3]).to.be.gt(0); // issueDate should be set
      expect(degree[4]).to.be.true; // isValid
    });

    it("Should fail for non-existent degree", async function () {
      const fakeHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("FAKE-CERT"));
      
      await expect(
        degreeVerification.verifyDegree(fakeHash)
      ).to.be.revertedWith("Degree not found");
    });

    it("Should be callable by anyone", async function () {
      const degree = await degreeVerification.connect(otherUser).verifyDegree(certificateHash);
      expect(degree[1]).to.equal("John Doe");
    });

    it("Should show correct timestamp", async function () {
      const degree = await degreeVerification.verifyDegree(certificateHash);
      const timestamp = degree[3];
      
      const latestBlock = await ethers.provider.getBlock("latest");
      expect(timestamp).to.be.lte(latestBlock.timestamp);
    });
  });

  describe("Revoke Degree", function () {
    beforeEach(async function () {
      await degreeVerification.connect(university).issueDegree(
        otherUser.address,
        "John Doe",
        "Bachelor of Science",
        certificateHash
      );
    });

    it("Should revoke a degree successfully", async function () {
      await expect(
        degreeVerification.connect(university).revokeDegree(certificateHash)
      ).to.emit(degreeVerification, "DegreeRevoked")
        .withArgs(certificateHash);

      const degree = await degreeVerification.verifyDegree(certificateHash);
      expect(degree[4]).to.be.false; // isValid should be false
    });

    it("Should fail if not called by university", async function () {
      await expect(
        degreeVerification.connect(otherUser).revokeDegree(certificateHash)
      ).to.be.reverted;
    });

    it("Should fail for non-existent degree", async function () {
      const fakeHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("FAKE-CERT"));
      
      await expect(
        degreeVerification.connect(university).revokeDegree(fakeHash)
      ).to.be.revertedWith("Degree not found");
    });

    it("Should fail if degree already revoked", async function () {
      await degreeVerification.connect(university).revokeDegree(certificateHash);
      
      await expect(
        degreeVerification.connect(university).revokeDegree(certificateHash)
      ).to.be.revertedWith("Degree already revoked");
    });
  });

  describe("Soulbound Tokens (Non-Transferable)", function () {
    beforeEach(async function () {
      await degreeVerification.connect(university).issueDegree(
        otherUser.address,
        "John Doe",
        "Bachelor of Science",
        certificateHash
      );
    });

    it("Should prevent transferring degrees", async function () {
      // Connect as the student who owns the degree
      await expect(
        degreeVerification.connect(otherUser).transferFrom(otherUser.address, admin.address, 0)
      ).to.be.revertedWith("DegreeVault: Degrees are Soulbound (Non-Transferable)");
    });
  });

  describe("Access Control", function () {
    it("Should allow admin to grant university role", async function () {
      const UNIVERSITY_ROLE = await degreeVerification.UNIVERSITY_ROLE();
      
      await degreeVerification.connect(admin).grantRole(UNIVERSITY_ROLE, otherUser.address);
      
      expect(await degreeVerification.hasRole(UNIVERSITY_ROLE, otherUser.address)).to.be.true;
    });

    it("Should allow new university to issue degrees", async function () {
      const UNIVERSITY_ROLE = await degreeVerification.UNIVERSITY_ROLE();
      await degreeVerification.connect(admin).grantRole(UNIVERSITY_ROLE, otherUser.address);
      
      const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("NEW-CERT"));
      await degreeVerification.connect(otherUser).issueDegree(
        otherUser.address,
        "Alice Smith",
        "PhD",
        hash
      );

      const degree = await degreeVerification.verifyDegree(hash);
      expect(degree[1]).to.equal("Alice Smith");
    });

    it("Should allow admin to revoke university role", async function () {
      const UNIVERSITY_ROLE = await degreeVerification.UNIVERSITY_ROLE();
      
      await degreeVerification.connect(admin).revokeRole(UNIVERSITY_ROLE, university.address);
      
      expect(await degreeVerification.hasRole(UNIVERSITY_ROLE, university.address)).to.be.false;
    });

    it("Should prevent revoked university from issuing degrees", async function () {
      const UNIVERSITY_ROLE = await degreeVerification.UNIVERSITY_ROLE();
      await degreeVerification.connect(admin).revokeRole(UNIVERSITY_ROLE, university.address);
      
      const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("NEW-CERT"));
      await expect(
        degreeVerification.connect(university).issueDegree(
          otherUser.address,
          "Alice Smith",
          "PhD",
          hash
        )
      ).to.be.reverted;
    });
  });

  describe("Batch Operations", function () {
    it("Should issue multiple degrees in one transaction", async function () {
      const wallets = [otherUser.address, otherUser.address, otherUser.address];
      const names = ["Alice", "Bob", "Charlie"];
      const degrees = ["BSc", "MSc", "PhD"];
      const hashes = [
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes("CERT-001")),
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes("CERT-002")),
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes("CERT-003"))
      ];

      await expect(
        degreeVerification.connect(university).issueBatchDegrees(wallets, names, degrees, hashes)
      ).to.emit(degreeVerification, "BatchDegreesIssued")
        .withArgs(3);

      // Verify all degrees were issued
      for (let i = 0; i < hashes.length; i++) {
        const degree = await degreeVerification.verifyDegree(hashes[i]);
        expect(degree[0]).to.equal(otherUser.address);
        expect(degree[1]).to.equal(names[i]);
        expect(degree[2]).to.equal(degrees[i]);
        expect(degree[4]).to.be.true;
      }
    });

    it("Should fail if arrays have different lengths", async function () {
      const wallets = [otherUser.address, otherUser.address];
      const names = ["Alice", "Bob"];
      const degrees = ["BSc"];
      const hashes = [ethers.utils.keccak256(ethers.utils.toUtf8Bytes("CERT-001"))];

      await expect(
        degreeVerification.connect(university).issueBatchDegrees(wallets, names, degrees, hashes)
      ).to.be.revertedWith("Array lengths must match");
    });

    it("Should fail with empty arrays", async function () {
      await expect(
        degreeVerification.connect(university).issueBatchDegrees([], [], [], [])
      ).to.be.revertedWith("Empty arrays not allowed");
    });

    it("Should fail if batch exceeds maximum size", async function () {
      const wallets = new Array(101).fill(otherUser.address);
      const names = new Array(101).fill("Student");
      const degrees = new Array(101).fill("Degree");
      const hashes = Array.from({length: 101}, (_, i) => 
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`CERT-${i}`))
      );

      await expect(
        degreeVerification.connect(university).issueBatchDegrees(wallets, names, degrees, hashes)
      ).to.be.revertedWith("Maximum 100 degrees per batch");
    });

    it("Should fail if any certificate already exists", async function () {
      const hash1 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("CERT-001"));
      
      // Issue one degree first
      await degreeVerification.connect(university).issueDegree(otherUser.address, "Alice", "BSc", hash1);

      // Try to batch issue including the same hash
      const wallets = [otherUser.address, otherUser.address];
      const names = ["Alice", "Bob"];
      const degrees = ["BSc", "MSc"];
      const hashes = [hash1, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("CERT-002"))];

      await expect(
        degreeVerification.connect(university).issueBatchDegrees(wallets, names, degrees, hashes)
      ).to.be.revertedWith("Degree already issued");
    });
  });

  describe("Query Functions", function () {
    beforeEach(async function () {
      const hash1 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("CERT-001"));
      const hash2 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("CERT-002"));
      
      await degreeVerification.connect(university).issueDegree(otherUser.address, "Alice", "BSc", hash1);
      await degreeVerification.connect(university).issueDegree(otherUser.address, "Bob", "MSc", hash2);
    });

    it("Should return correct total degree count", async function () {
      const total = await degreeVerification.getTotalDegrees();
      expect(total).to.equal(2);
    });

    it("Should get degree by index", async function () {
      const degree = await degreeVerification.getDegreeByIndex(0);
      
      expect(degree[1]).to.equal("Alice");
      expect(degree[2]).to.equal("BSc");
      expect(degree[4]).to.be.true;
    });

    it("Should fail with index out of bounds", async function () {
      await expect(
        degreeVerification.getDegreeByIndex(100)
      ).to.be.revertedWith("Index out of bounds");
    });

    it("Should track all degrees including batch issued", async function () {
      const wallets = [otherUser.address, otherUser.address];
      const names = ["Charlie", "David"];
      const degrees = ["PhD", "MBA"];
      const hashes = [
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes("CERT-003")),
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes("CERT-004"))
      ];

      await degreeVerification.connect(university).issueBatchDegrees(wallets, names, degrees, hashes);

      const total = await degreeVerification.getTotalDegrees();
      expect(total).to.equal(4);

      const degree = await degreeVerification.getDegreeByIndex(2);
      expect(degree[1]).to.equal("Charlie");
    });
  });
});
