// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract DegreeVerification is ERC721, AccessControl {

    bytes32 public constant UNIVERSITY_ROLE = keccak256("UNIVERSITY_ROLE");

    struct Degree {
        address studentWallet;
        string studentName;
        string degreeName;
        uint256 issueDate;
        bool isValid;
        bytes32 certificateHash;
    }

    mapping(bytes32 => Degree) private degrees;
    bytes32[] private certificateHashes;
    uint256 private _nextTokenId;

    event DegreeIssued(bytes32 indexed certificateHash, string studentName, address indexed studentWallet);
    event DegreeRevoked(bytes32 indexed certificateHash);
    event BatchDegreesIssued(uint256 count);

    constructor(address universityAdmin) ERC721("DegreeVault", "DGR") {
        _grantRole(DEFAULT_ADMIN_ROLE, universityAdmin);
        _grantRole(UNIVERSITY_ROLE, universityAdmin);
    }

    function issueDegree(
        address studentWallet,
        string memory studentName,
        string memory degreeName,
        bytes32 certificateHash
    ) external onlyRole(UNIVERSITY_ROLE) {

        require(certificateHash != bytes32(0), "Invalid certificate hash");
        require(studentWallet != address(0), "Invalid student wallet");
        require(bytes(studentName).length > 0, "Student name required");
        require(bytes(degreeName).length > 0, "Degree name required");
        require(degrees[certificateHash].issueDate == 0, "Degree already issued");

        degrees[certificateHash] = Degree({
            studentWallet: studentWallet,
            studentName: studentName,
            degreeName: degreeName,
            issueDate: block.timestamp,
            isValid: true,
            certificateHash: certificateHash
        });

        certificateHashes.push(certificateHash);

        uint256 tokenId = _nextTokenId++;
        _safeMint(studentWallet, tokenId);

        emit DegreeIssued(certificateHash, studentName, studentWallet);
    }

    function issueBatchDegrees(
        address[] memory studentWallets,
        string[] memory studentNames,
        string[] memory degreeNames,
        bytes32[] memory certificateHashArray
    ) external onlyRole(UNIVERSITY_ROLE) {
        require(
            studentWallets.length == studentNames.length &&
            studentNames.length == degreeNames.length &&
            degreeNames.length == certificateHashArray.length,
            "Array lengths must match"
        );
        require(studentNames.length > 0, "Empty arrays not allowed");
        require(studentNames.length <= 100, "Maximum 100 degrees per batch");

        for (uint256 i = 0; i < studentNames.length; i++) {
            require(certificateHashArray[i] != bytes32(0), "Invalid certificate hash");
            require(studentWallets[i] != address(0), "Invalid student wallet");
            require(bytes(studentNames[i]).length > 0, "Student name required");
            require(bytes(degreeNames[i]).length > 0, "Degree name required");
            require(degrees[certificateHashArray[i]].issueDate == 0, "Degree already issued");

            degrees[certificateHashArray[i]] = Degree({
                studentWallet: studentWallets[i],
                studentName: studentNames[i],
                degreeName: degreeNames[i],
                issueDate: block.timestamp,
                isValid: true,
                certificateHash: certificateHashArray[i]
            });

            certificateHashes.push(certificateHashArray[i]);

            uint256 tokenId = _nextTokenId++;
            _safeMint(studentWallets[i], tokenId);

            emit DegreeIssued(certificateHashArray[i], studentNames[i], studentWallets[i]);
        }

        emit BatchDegreesIssued(studentNames.length);
    }

    function verifyDegree(bytes32 certificateHash)
        external
        view
        returns (
            address studentWallet,
            string memory studentName,
            string memory degreeName,
            uint256 issueDate,
            bool isValid
        )
    {
        require(degrees[certificateHash].issueDate != 0, "Degree not found");

        Degree memory degree = degrees[certificateHash];

        return (
            degree.studentWallet,
            degree.studentName,
            degree.degreeName,
            degree.issueDate,
            degree.isValid
        );
    }

    function revokeDegree(bytes32 certificateHash)
        external
        onlyRole(UNIVERSITY_ROLE)
    {
        require(degrees[certificateHash].issueDate != 0, "Degree not found");
        require(degrees[certificateHash].isValid, "Degree already revoked");

        degrees[certificateHash].isValid = false;

        emit DegreeRevoked(certificateHash);
    }

    function getTotalDegrees() external view returns (uint256) {
        return certificateHashes.length;
    }

    function getDegreeByIndex(uint256 index) 
        external 
        view 
        returns (
            address studentWallet,
            string memory studentName,
            string memory degreeName,
            uint256 issueDate,
            bool isValid,
            bytes32 certificateHash
        )
    {
        require(index < certificateHashes.length, "Index out of bounds");
        bytes32 hash = certificateHashes[index];
        Degree memory degree = degrees[hash];
        
        return (
            degree.studentWallet,
            degree.studentName,
            degree.degreeName,
            degree.issueDate,
            degree.isValid,
            degree.certificateHash
        );
    }

    // --- Soulbound Token Logic (OpenZeppelin v5) ---

    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal virtual override returns (address) {
        address from = _ownerOf(tokenId);
        // Only allow minting (from zero address) or burning (to zero address)
        require(
            from == address(0) || to == address(0),
            "DegreeVault: Degrees are Soulbound (Non-Transferable)"
        );
        return super._update(to, tokenId, auth);
    }

    // --- Overrides required by Solidity due to Multiple Inheritance ---
    
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}