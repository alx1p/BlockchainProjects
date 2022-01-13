// =================== CS251 DEX Project =================== // 
//        @authors: Simon Tao '22, Mathew Hogan '22          //
// ========================================================= //    
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import '../interfaces/erc20_interface.sol';
import '../libraries/safe_math.sol';
import './token.sol';


contract TokenExchange {
    using SafeMath for uint;
    address public admin;

    address tokenAddr = 0x466AF825073BC346180bA2664dBd3F31B9ef22Be;               
    Kongbucks private token = Kongbucks(tokenAddr);               

    // Liquidity pool for the exchange
    uint public token_reserves = 0;
    uint public eth_reserves = 0;
    
    // keeping track of LP shares - poolLP can be seen as a fictional LP "token" which is not distributed out but tracked internally - save gas
    mapping(address => uint) public poolLP;
    uint public totalLP;
    // This should match the JS decimalization to consider the exchange rates in a compatible way for slippage
    uint public constant decimalization = 10 ** 8;  

    // Constant: x * y = k
    uint public k;
    
    // liquidity rewards - as Kongbucks are super risky, the fee is massive. Also, easier to debug at 1pp
    uint private swap_fee_numerator = 1;     
    uint private swap_fee_denominator = 100;
    
    event AddLiquidity(address from, uint amount);
    event RemoveLiquidity(address to, uint amount);
    event Received(address from, uint amountETH);
    event Reinvested(uint amountETH, uint amountToken);

    constructor() 
    {
        admin = msg.sender;
    }
    
    modifier AdminOnly {
        require(msg.sender == admin, "Only admin can use this function!");
        _;
    }

    // Used for receiving ETH
    receive() external payable {
        emit Received(msg.sender, msg.value);
    }
    fallback() external payable{}

    // Function createPool: Initializes a liquidity pool between your Token and ETH.
    // ETH will be sent to pool in this transaction as msg.value
    // amountTokens specifies the amount of tokens to transfer from the liquidity provider.
    // Sets up the initial exchange rate for the pool by setting amount of token and amount of ETH.
    function createPool(uint amountTokens)
        external
        payable
        AdminOnly
    {
        // require pool does not yet exist
        require (token_reserves == 0, "Token reserves was not 0");
        require (eth_reserves == 0, "ETH reserves was not 0.");

        // require nonzero values were sent
        require (msg.value > 0, "Need ETH to create pool.");
        require (amountTokens > 0, "Need tokens to create pool.");

        // Set initial pool LP tracking "tokens" to be consistent with ETH contributed - over time this will deviate
        totalLP = decimalization.mul(msg.value);
        poolLP[msg.sender] = totalLP;

        eth_reserves = msg.value;
        token_reserves = amountTokens;
        k = eth_reserves.mul(token_reserves);
        
        // Transfers always last to eliminate reentrancy risk (mostly this matters on ETH)
        token.transferFrom(msg.sender, address(this), amountTokens);
        
    }

    // ============================================================
    //                    FUNCTIONS TO IMPLEMENT
    // ============================================================
    /* Be sure to use the SafeMath library for all operations! */
    
    // Function priceToken: Calculate the price of your token in ETH.
    // You can change the inputs, or the scope of your function, as needed.
    function priceToken() 
        public 
        view
        returns (uint)
    {
        return decimalization.mul(token_reserves).div(eth_reserves);
    }

    // Function priceETH: Calculate the price of ETH for your token.
    // You can change the inputs, or the scope of your function, as needed.
    function priceETH()
        public
        view
        returns (uint)
    {
        return decimalization.mul(eth_reserves).div(token_reserves);
    }


    /* ========================= Liquidity Provider Functions =========================  */ 

    // Function addLiquidity: Adds liquidity given a supply of ETH (sent to the contract as msg.value)
    // You can change the inputs, or the scope of your function, as needed.
    function addLiquidity(uint max_exchange_rate, uint min_exchange_rate) 
        external 
        payable
    {
        // Attempt to reinvest fees BEFORE adding liquidity; this will distribute as much of the accrued unassigned fees as possible to already EXISTING LPs
        reinvestFees();
        
        // Check the price of token against the min and max exchange rates acceptable; both are decimalized
        require(priceToken() >= min_exchange_rate && priceToken() <= max_exchange_rate, "Slippage too high");
        
        uint amountTokens = msg.value.mul(priceToken()).div(decimalization);
        
        // Calculate new LP "token" amount received based on percent of existing ETH reserves
        uint poolContrib = totalLP.mul(msg.value).div(eth_reserves);
        
        // Keep track of LP "tokens", reserves, and k post changes
        poolLP[msg.sender] = poolLP[msg.sender].add(poolContrib);
        totalLP = totalLP.add(poolContrib);
        eth_reserves = eth_reserves.add(msg.value);
        token_reserves = token_reserves.add(amountTokens);
        k = eth_reserves.mul(token_reserves);

        // Transfers always last to eliminate reentrancy risk (mostly this matters on ETH)
        // requirement for sender to have sufficient permissioned token will be checked by the transferFrom function - saves gas
        token.transferFrom(msg.sender, address(this), amountTokens);
        
        emit AddLiquidity(msg.sender, msg.value);
    }


    // Function removeLiquidity: Removes liquidity given the desired amount of ETH to remove.
    // You can change the inputs, or the scope of your function, as needed.
    function removeLiquidity(uint amountETH, uint max_exchange_rate, uint min_exchange_rate)
        public 
        payable
    {
        // fail if try to remove inexistent LP on "exit all" or another zero ETH call - save gas
        require(amountETH > 0, "Nothing to remove");
        
        // Attempt to reinvest fees BEFORE claim; this will distribute as much of the accrued unassigned fees as possible
        reinvestFees();
        
        // Check the price of token against the min and max exchange rates acceptable; both are decimalized
        require(priceToken() >= min_exchange_rate && priceToken() <= max_exchange_rate, "Slippage too high");
        
        uint amountTokens = amountETH.mul(priceToken()).div(decimalization);
        
        // Calculate LP "token" amount to cancel based on percent of existing ETH reserves
        uint poolContrib = totalLP.mul(amountETH).div(eth_reserves);

        // require remaining ETH and token in the pool and sufficient LP claim to withdraw desired ETH
        require(eth_reserves > amountETH && token_reserves > amountTokens && poolLP[msg.sender] >= poolContrib, "Trying to remove more than max available");
        
        // Keep track of LP "tokens", reserves, and k post changes
        poolLP[msg.sender] = poolLP[msg.sender].sub(poolContrib);
        totalLP = totalLP.sub(poolContrib);
        eth_reserves = eth_reserves.sub(amountETH);
        token_reserves = token_reserves.sub(amountTokens);
        k = eth_reserves.mul(token_reserves);

        // Transfers always last to eliminate reentrancy risk (mostly this matters on ETH)
        token.transfer(msg.sender, amountTokens);
        payable(msg.sender).transfer(amountETH);
        
        emit RemoveLiquidity(msg.sender, amountETH);
    }

    // Function removeAllLiquidity: Removes all liquidity that msg.sender is entitled to withdraw
    // You can change the inputs, or the scope of your function, as needed.
    function removeAllLiquidity(uint max_exchange_rate, uint min_exchange_rate)
        external
        payable
    {
        // Can't remove all liquidity
        require(totalLP > poolLP[msg.sender], "Can't have last provider withdraw all");
        
        // Attempt to reinvest fees BEFORE claim; this will distribute as much of the accrued unassigned fees as possible
        reinvestFees();
        
        // Can withdraw as much of the pool ETH total as the ratio of LP "tokens" owned
        removeLiquidity(eth_reserves.mul(poolLP[msg.sender]).div(totalLP), max_exchange_rate, min_exchange_rate);
    }

    /***  Define helper functions for liquidity management here as needed: ***/
    
    // Anyone can call the public reinvestFees function if concerned too much time has elapsed since last reinvestment. Price should be invariant
    function reinvestFees()
        public
        payable
    {
        // Can only reinvest fees if have positive balances of both ETH and token, not yet assigned to pool. Note we first ensure this, so that exchanges with some rounding error can still function without underflows on fee calcs
        // Also saves gas on second call from removeAllLiquidity -> removeLiquidity - just one if to evaluate
        if (address(this).balance > eth_reserves.add(msg.value) && token.balanceOf(address(this)) > token_reserves)
        {
            // Calculate residual token and ETH balances in contract which are not yet assigned to pool reserves. These will usually be the fees plus any "gifts"
            uint unassignedToken = token.balanceOf(address(this)).sub(token_reserves);
            
            // Since we call this before adding new ETH liquidity to pool, need to make sure we don't yet include new add liquidity as "fee unassigned"
            uint unassignedETH = address(this).balance.sub(msg.value).sub(eth_reserves);
        
            // Project tentative maxETH that would balance all available unassigned tokens being added to pool reserves
            uint maxETH = unassignedToken.mul(priceETH()).div(decimalization);
            uint maxToken;
            
            // The max ETH we can assign to the pool is the max between that unassigned ETH left and the exchange-ratio balancing for unassigned token; and vice-versa for token to assign
            if (unassignedETH >= maxETH) {
                
                // We have sufficient unassigned ETH to cover all the unassigned token; the token is limiting factor. Original maxETH projection correct; use up all unassigned token
                maxToken = unassignedToken;
                
            } else {
                
                // We don't have sufficient unassigned ETH to cover all the unassigned token; ETH is the limiting factor. Update original projection; project maxToken
                maxETH = unassignedETH;
                maxToken = unassignedETH.mul(priceToken()).div(decimalization);
                
            }
            
            // We adjust the reserves and k, but not the LP "tokens" or LP totals - this way the reinvestment goes to existing LPs
            eth_reserves = eth_reserves.add(maxETH);
            token_reserves = token_reserves.add(maxToken);
            k = eth_reserves.mul(token_reserves);
            
            emit Reinvested(maxETH, maxToken);
        }
    }


    /* ========================= Swap Functions =========================  */ 

    // Function swapTokensForETH: Swaps your token with ETH
    // You can change the inputs, or the scope of your function, as needed.
    
    function swapTokensForETH(uint amountTokens, uint max_exchange_rate)
        external 
        payable
    {
        // Calculate the new reserve projections which keep k constant after adding amountTokens KGB's to the pool, less fees
        // The KGB remainder token (fee) just remains in the exchange account, but without being assigned to the pool yet
        uint amountTokensExFee = amountTokens.sub(amountTokens.mul(swap_fee_numerator).div(swap_fee_denominator));
        uint newTokenReserve = token_reserves.add(amountTokensExFee);
        uint newETHReserve = k.div(newTokenReserve);
        
        // Amount to return for the swap falls out directly from projected pool reserve
        uint amountETH = eth_reserves.sub(newETHReserve);
        
        //  If performing the swap would exhaust total ETH supply, transaction must fail.
        require (eth_reserves > amountETH, "This would drain the pool");
        
        // Cannot receive less than max exchange slippage permitted - define this on ex fee basis
        // See "DesignDoc" for important discussion of how slippage is implemented - on actual outcome.
        require(amountETH >= max_exchange_rate.mul(amountTokensExFee).div(decimalization), "Slippage too high");
        
        eth_reserves = newETHReserve;
        token_reserves = newTokenReserve;        

        // Transfers always last to eliminate reentrancy risk (mostly this matters on ETH)
        // Receive all tokens including fee
        token.transferFrom(msg.sender, address(this), amountTokens);
        
        // Send out the k-curve ETH less fees
        payable(msg.sender).transfer(amountETH);

        /***************************/
        // DO NOT MODIFY BELOW THIS LINE
        /* Check for x * y == k, assuming x and y are rounded to the nearest integer. */
        // Check for Math.abs(token_reserves * eth_reserves - k) < (token_reserves + eth_reserves + 1));
        //   to account for the small decimal errors during uint division rounding.
        uint check = token_reserves.mul(eth_reserves);
        if (check >= k) {
            check = check.sub(k);
        }
        else {
            check = k.sub(check);
        }
        assert(check < (token_reserves.add(eth_reserves).add(1)));
    }



    // Function swapETHForTokens: Swaps ETH for your tokens.
    // ETH is sent to contract as msg.value.
    // You can change the inputs, or the scope of your function, as needed.
    function swapETHForTokens(uint max_exchange_rate)
        external
        payable 
    {
        // Calculate the new reserve projections which keep k constant after adding the msg.value to ETH pool, less fees
        // The ETH remainder (fee) just remains in the exchange account, but without being assigned to the pool yet
        uint amountETH = msg.value.sub(msg.value.mul(swap_fee_numerator).div(swap_fee_denominator));
        uint newETHReserve = eth_reserves.add(amountETH);
        uint newTokenReserve = k.div(newETHReserve);
        
        // Amount to return for the swap falls out directly from projected pool reserve
        uint amountTokens = token_reserves.sub(newTokenReserve);
        
        //  If performing the swap would exhaust total token supply, transaction must fail.
        require (token_reserves > amountTokens, "This would drain the pool");
        
        // Cannot receive less than max exchange slippage permitted - define this on ex fee basis
        // See "DesignDoc" for important discussion of how slippage is implemented - on actual outcome.
        require(amountTokens >= max_exchange_rate.mul(amountETH).div(decimalization), "Slippage too high");
        
        eth_reserves = newETHReserve;
        token_reserves = newTokenReserve;

        // Transfers always last to eliminate reentrancy risk (mostly this matters on ETH)
        // Send out the k-curve exchanged tokens, ex fees
        token.transfer(msg.sender, amountTokens);

        /**************************/
        // DO NOT MODIFY BELOW THIS LINE
        /* Check for x * y == k, assuming x and y are rounded to the nearest integer. */
        // Check for Math.abs(token_reserves * eth_reserves - k) < (token_reserves + eth_reserves + 1));
        //   to account for the small decimal errors during uint division rounding.
        uint check = token_reserves.mul(eth_reserves);
        if (check >= k) {
            check = check.sub(k);
        }
        else {
            check = k.sub(check);
        }
        assert(check < (token_reserves.add(eth_reserves).add(1)));
    }

    /***  Define helper functions for swaps here as needed: ***/

}
