from sys import exit
from bitcoin.core.script import *
from bitcoin.wallet import CBitcoinSecret

from lib.utils import *
from lib.config import (my_private_key, my_public_key, my_address,
                    faucet_address, network_type)
from Q1 import send_from_P2PKH_transaction


cust1_private_key = CBitcoinSecret(
    'cQmfQDCz25m4LQSNWsnNKRDzRdyGRRDh8XYGAxoNKYETgw8jXLbh')
cust1_public_key = cust1_private_key.pub
cust2_private_key = CBitcoinSecret(
    'cUpDGNUgcVURBNBJkgnKrBqU5y4BLr643Uf76WkjjYmFPi15RMwC')
cust2_public_key = cust2_private_key.pub
cust3_private_key = CBitcoinSecret(
    'cPwd1cPN5k5tjurSSvt95X7mQQ8UGgZDux9C4dVkkDwcYX8357av')
cust3_public_key = cust3_private_key.pub


######################################################################
# TODO: Complete the scriptPubKey implementation for Exercise 3

# You can assume the role of the bank for the purposes of this problem
# and use my_public_key and my_private_key in lieu of bank_public_key and
# bank_private_key.

Q3a_txout_scriptPubKey = [

        my_public_key,
        OP_CHECKSIGVERIFY,
        OP_1,
        cust1_public_key,
        cust2_public_key,
        cust3_public_key, 
        OP_3,
        OP_CHECKMULTISIG

         # mandatory syntax implemented is dummy for CHECKMULTISIG bug, cust sig, bank sig LAST
]
######################################################################

if __name__ == '__main__':
    ######################################################################
    # TODO: set these parameters correctly
    amount_to_send = 0.000004 # amount of BTC in the output you're sending minus fee
    txid_to_spend = (
        '732568f3562868fc77019c58dcef9edbb0a25068a300d50495b933652b708abe')
    utxo_index = 0 # index of the output you are spending, indices start at 0
    ######################################################################

    response = send_from_P2PKH_transaction(amount_to_send, txid_to_spend, 
        utxo_index, Q3a_txout_scriptPubKey, my_private_key, network_type)
    print(response.status_code, response.reason)
    print(response.text)
