// =============================================================================
//                                  Config
// =============================================================================

let web3 = new Web3(Web3.givenProvider || "ws://localhost:8545");

// Constant we use later
var GENESIS = '0x0000000000000000000000000000000000000000000000000000000000000000';

// This is the ABI for your contract (get it from Remix, in the 'Compile' tab)
// ============================================================
var abi = [
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "creditor",
				"type": "address"
			},
			{
				"internalType": "uint32",
				"name": "amount",
				"type": "uint32"
			},
			{
				"internalType": "address[]",
				"name": "loopAddresses",
				"type": "address[]"
			},
			{
				"internalType": "uint32",
				"name": "loopDebt",
				"type": "uint32"
			}
		],
		"name": "add_IOU",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "debtor",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "creditor",
				"type": "address"
			}
		],
		"name": "lookup",
		"outputs": [
			{
				"internalType": "uint32",
				"name": "ret",
				"type": "uint32"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
]; // FIXME: fill this in with your contract's ABI //Be sure to only have one array, not two

// ============================================================
abiDecoder.addABI(abi);
// call abiDecoder.decodeMethod to use this - see 'getAllFunctionCalls' for more

var contractAddress = '0x88Cb6815Eb5Ccac5c2e18c1cAbD1129ebB1C476D'.toLowerCase(); // FIXME: fill this in with your contract's address/hash
var BlockchainSplitwise = new web3.eth.Contract(abi, contractAddress);

// =============================================================================
//                            Functions To Implement
// =============================================================================

// TODO: Add any helper functions here!

async function getNeighborsFunc(node) {
	var allUsers = await getUsers();
	var neighbors = [];
	var debt;
	for (var i = 0; i < allUsers.length; i++) {
		debt = parseInt(await BlockchainSplitwise.methods.lookup(node.toLowerCase(), allUsers[i].toLowerCase()).call());

		// If you owe someone then they are your "neighbor" (more like directed graph children)
		if (debt > 0)
			neighbors.push(allUsers[i].toLowerCase());
	}
	return neighbors;
}

// TODO: Return a list of all users (creditors or debtors) in the system
// You can return either:
//   - a list of everyone who has ever sent or received an IOU
// OR
//   - a list of everyone currently owing or being owed money
async function getUsers() {
	var add_IOU_calls = await getAllFunctionCalls(contractAddress, "add_IOU");
	var userSet = new Set();
	for (var i = 0; i < add_IOU_calls.length; i++) {

		// Add from and to addresses that ever used add_IOU to the set
		userSet.add(add_IOU_calls[i].from.toLowerCase());
		userSet.add(add_IOU_calls[i].args[0].toLowerCase());
	}
	return Array.from(userSet);
}

// TODO: Get the total amount owed by the user specified by 'user'
async function getTotalOwed(user) {
	var allUsers = await getUsers();
	var debt = 0;
	for (var i = 0; i < allUsers.length; i++) {
		debt += parseInt(await BlockchainSplitwise.methods.lookup(user.toLowerCase(), allUsers[i].toLowerCase()).call());
	}
	return debt;
}

// TODO: Get the last time this user has sent or received an IOU, in seconds since Jan. 1, 1970
// Return null if you can't find any activity for the user.
// HINT: Try looking at the way 'getAllFunctionCalls' is written. You can modify it if you'd like.
async function getLastActive(user) {
	var add_IOU_calls = await getAllFunctionCalls(contractAddress, "add_IOU");
	for (var i = 0; i < add_IOU_calls.length; i++) { 

		// Only look for original credit/debit add_IOU activity timestamps, ignore debt loop clearing timestamps (internal workings)
		if(add_IOU_calls[i].from.toLowerCase() === user.toLowerCase() || add_IOU_calls[i].args[0].toLowerCase() === user.toLowerCase()) {
			return add_IOU_calls[i].t;
		}
	}
	return null;
}

// TODO: add an IOU ('I owe you') to the system
// The person you owe money is passed as 'creditor'
// The amount you owe them is passed as 'amount'
async function add_IOU(creditor, amount) {
	var lcCreditor = creditor.toLowerCase();
	var lcDebtor = web3.eth.defaultAccount.toLowerCase();
	var numAmount = parseInt(amount);
	if (numAmount <= 0 || lcCreditor === lcDebtor || creditor === "") {
		console.log("Bad inputs");
		return;
	}

	// Find a potential loop from creditor back at debtor
	var debtLoop = await doBFS(lcCreditor,lcDebtor,getNeighborsFunc);
	var maxDebt = 0;

	// If found a viable loop from creditor back to debtor
	if (debtLoop != null) {

		// Initialize possible max loop-debt-amount to newly updated debt from debtor to creditor (first two node debt)
		maxDebt = numAmount + parseInt(await BlockchainSplitwise.methods.lookup(lcDebtor,lcCreditor).call());

		for (var i = 0; i < debtLoop.length-1; i++) { 

			// Max debt to clear is the lowest debt alongside the rest of the closed loop
			maxDebt = Math.min(maxDebt, parseInt(await BlockchainSplitwise.methods.lookup(debtLoop[i],debtLoop[i+1]).call()));
		}

		// Insert debtor node as first node in loop (debtor - creditor - ... - debtor)
		debtLoop.unshift(lcDebtor);
	} else {
		debtLoop = [];
	}

	return BlockchainSplitwise.methods.add_IOU(lcCreditor, numAmount, debtLoop, maxDebt).send({from:lcDebtor, gas: 200000});
}

// =============================================================================
//                              Provided Functions
// =============================================================================
// Reading and understanding these should help you implement the above

// This searches the block history for all calls to 'functionName' (string) on the 'addressOfContract' (string) contract
// It returns an array of objects, one for each call, containing the sender ('from'), arguments ('args'), and the timestamp ('t')
async function getAllFunctionCalls(addressOfContract, functionName) {
	var curBlock = await web3.eth.getBlockNumber();
	var function_calls = [];

	while (curBlock !== GENESIS) {
	  var b = await web3.eth.getBlock(curBlock, true);
	  var txns = b.transactions;
	  for (var j = 0; j < txns.length; j++) {
	  	var txn = txns[j];

	  	// check that destination of txn is our contract
			if(txn.to == null){continue;}
	  	if (txn.to.toLowerCase() === addressOfContract.toLowerCase()) {
	  		var func_call = abiDecoder.decodeMethod(txn.input);

				// check that the function getting called in this txn is 'functionName'
				if (func_call && func_call.name === functionName) {
					var time = await web3.eth.getBlock(curBlock);
	  			var args = func_call.params.map(function (x) {return x.value});
	  			function_calls.push({
	  				from: txn.from.toLowerCase(),
	  				args: args,
						t: time.timestamp
	  			})
	  		}
	  	}
	  }
	  curBlock = b.parentHash;
	}
	return function_calls;
}

// We've provided a breadth-first search implementation for you, if that's useful
// It will find a path from start to end (or return null if none exists)
// You just need to pass in a function ('getNeighbors') that takes a node (string) and returns its neighbors (as an array)
async function doBFS(start, end, getNeighbors) {
	var queue = [[start]];
	while (queue.length > 0) {
		var cur = queue.shift();
		var lastNode = cur[cur.length-1]
		if (lastNode === end) {
			return cur;
		} else {
			var neighbors = await getNeighbors(lastNode);
			for (var i = 0; i < neighbors.length; i++) {
				queue.push(cur.concat([neighbors[i]]));
			}
		}
	}
	return null;
}

// =============================================================================
//                                      UI
// =============================================================================

// This sets the default account on load and displays the total owed to that
// account.
web3.eth.getAccounts().then((response)=> {
	web3.eth.defaultAccount = response[0];

	getTotalOwed(web3.eth.defaultAccount).then((response)=>{
		$("#total_owed").html("$"+response);
	});

	getLastActive(web3.eth.defaultAccount).then((response)=>{
		time = timeConverter(response)
		$("#last_active").html(time)
	});
});

// This code updates the 'My Account' UI with the results of your functions
$("#myaccount").change(function() {
	web3.eth.defaultAccount = $(this).val();

	getTotalOwed(web3.eth.defaultAccount).then((response)=>{
		$("#total_owed").html("$"+response);
	})

	getLastActive(web3.eth.defaultAccount).then((response)=>{
		time = timeConverter(response)
		$("#last_active").html(time)
	});
});

// Allows switching between accounts in 'My Account' and the 'fast-copy' in 'Address of person you owe
web3.eth.getAccounts().then((response)=>{
	var opts = response.map(function (a) { return '<option value="'+
			a.toLowerCase()+'">'+a.toLowerCase()+'</option>' });
	$(".account").html(opts);
	$(".wallet_addresses").html(response.map(function (a) { return '<li>'+a.toLowerCase()+'</li>' }));
});

// This code updates the 'Users' list in the UI with the results of your function
getUsers().then((response)=>{
	$("#all_users").html(response.map(function (u,i) { return "<li>"+u+"</li>" }));
});

// This runs the 'add_IOU' function when you click the button
// It passes the values from the two inputs above
$("#addiou").click(function() {
	web3.eth.defaultAccount = $("#myaccount").val(); //sets the default account
  add_IOU($("#creditor").val(), $("#amount").val()).then((response)=>{
		window.location.reload(true); // refreshes the page after add_IOU returns and the promise is unwrapped
	})
});

// This is a log function, provided if you want to display things to the page instead of the JavaScript console
// Pass in a discription of what you're printing, and then the object to print
function log(description, obj) {
	$("#log").html($("#log").html() + description + ": " + JSON.stringify(obj, null, 2) + "\n\n");
}


// =============================================================================
//                                      TESTING
// =============================================================================

// This section contains a sanity check test that you can use to ensure your code
// works. We will be testing your code this way, so make sure you at least pass
// the given test. You are encouraged to write more tests!

// Remember: the tests will assume that each of the four client functions are
// async functions and thus will return a promise. Make sure you understand what this means.

function check(name, condition) {
	if (condition) {
		console.log(name + ": SUCCESS");
		return 3;
	} else {
		console.log(name + ": FAILED");
		return 0;
	}
}

async function sanityCheck() {
	console.log ("\nTEST", "Simplest possible test: only runs one add_IOU; uses all client functions: lookup, getTotalOwed, getUsers, getLastActive");

	var score = 0;

	var accounts = await web3.eth.getAccounts();
	web3.eth.defaultAccount = accounts[0];

	var users = await getUsers();
	score += check("getUsers() initially empty", users.length === 0);

	var owed = await getTotalOwed(accounts[0]);
	score += check("getTotalOwed(0) initially empty", owed === 0);

	var lookup_0_1 = await BlockchainSplitwise.methods.lookup(accounts[0], accounts[1]).call({from:web3.eth.defaultAccount});
	score += check("lookup(0,1) initially 0", parseInt(lookup_0_1, 10) === 0);

	var response = await add_IOU(accounts[1], "10");

	users = await getUsers();
	score += check("getUsers() now length 2", users.length === 2);

	owed = await getTotalOwed(accounts[0]);
	score += check("getTotalOwed(0) now 10", owed === 10);

	lookup_0_1 = await BlockchainSplitwise.methods.lookup(accounts[0], accounts[1]).call({from:web3.eth.defaultAccount});
	score += check("lookup(0,1) now 10", parseInt(lookup_0_1, 10) === 10);

	var timeLastActive = await getLastActive(accounts[0]);
	var timeNow = Date.now()/1000;
	var difference = timeNow - timeLastActive;
	score += check("getLastActive(0) works", difference <= 60 && difference >= -3); // -3 to 60 seconds

	// test against a big cycle uses up no more than 120k gas or so

	var cycleClear = 15;

	for(var i = 1; i<8; i++) {
		web3.eth.defaultAccount = accounts[i];
		await add_IOU(accounts[i+1],10+i);
	}
	
	web3.eth.defaultAccount = accounts[i];
	await add_IOU(accounts[0], cycleClear);

	for(var i = 0; i<8; i++) {
		score += check("account "+i, await getTotalOwed(accounts[i]) === Math.max(10+i-cycleClear,i));
	}

	score += check("account 8", await getTotalOwed(accounts[8]) === Math.max(0,cycleClear-10));

	console.log("Final Score: " + score +"/48");
}

// sanityCheck() //Uncomment this line to run the sanity check when you first open index.html
