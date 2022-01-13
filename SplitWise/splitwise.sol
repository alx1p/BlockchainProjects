// Please paste your contract's solidity code here
// Note that writing a contract here WILL NOT deploy it and allow you to access it from your client
// You should write and develop your contract in Remix and then, before submitting, copy and paste it here

// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.9;

contract SplitWise {
    
    // mapping of debtor - creditor amounts owed, initializes zero
    mapping(address => mapping(address => uint32)) debtOwed;
    
    function lookup(address debtor, address creditor) public view returns (uint32 ret) {
        return debtOwed[debtor][creditor];
    }
    
    
    function add_IOU(address creditor, uint32 amount, address[] memory loopAddresses, uint32 loopDebt) public {
        
        // Check for bad debt inputs
        require(amount > 0, "New debt must be positive");
        require(creditor != msg.sender, "No weird self loops");
                   
        // Push new debt
        debtOwed[msg.sender][creditor] += amount;
        
        // A negative or zero debt loop clearing request will simply be ignored
        if (loopDebt > 0) {
            
            // Ensure attempted cancellation loop is a complete loop eg first and last node are same
            // Minimum size loop is 3 addresses (2 edges) for an IOU payback eg debtor - creditor - debtor
            require(loopAddresses.length > 2 && loopAddresses[loopAddresses.length-1] == loopAddresses[0], 
                "Debt cancellation loop is malformed");
            
            // Cancel debt loop, unless there is an edge that would cause negative debt
            for (uint i = 0; i < loopAddresses.length - 1; i++) {
            
                // Will revert gracefully if attempting to loop-cancel more debt than exists alongside any edge
                require(debtOwed[loopAddresses[i]][loopAddresses[i+1]] >= loopDebt, 
                    "Attempting to loop cancel more debt than available");
                debtOwed[loopAddresses[i]][loopAddresses[i+1]] -= loopDebt;
            } 
        }
    }
}