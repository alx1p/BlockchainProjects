import time
import alice
import bob
from Q4 import (alice_txid_to_spend, alice_utxo_index, alice_amount_to_send,
                bob_txid_to_spend, bob_utxo_index, bob_amount_to_send,
                btc_test3_chain_height, bcy_test_chain_height, alice_locktime,
                bob_locktime, tx_fee, broadcast_transactions, alice_redeems)

######################################################################
#                                                                    #
#                                                                    #
#              CS251 Project 2: Cross-chain Atomic Swap              #
#                                                                    #
#                                                                    #
#                                                                    #
#              Written by: Max Spero                                 #
#              Edited by: Belce Dogru and Blake Pagon                #
#              September 22, 2020                                    #
#              Version 3                                             #
#                                                                    #
######################################################################
#
# In this assignment we will implement a cross-chain atomic swap
# between two parties, Alice and Bob.
#
# Alice has bitcoin on BTC Testnet3 (the standard bitcoin testnet).
# Bob has bitcoin on BCY Testnet (Blockcypher's Bitcoin testnet).
# They want to trade ownership of their respective coins securely,
# something that can't be done with a simple transaction because
# they are on different blockchains.
#
# This method also works between other cryptocurrencies and altcoins,
# for example trading n Bitcoin for m Litecoin.
#
# The idea here is to set up transactions around a secret x, that
# only one party (Alice) knows. In these transactions only H(x)
# will be published, leaving x secret.
#
# Transactions will be set up in such a way that once x is revealed,
# both parties can redeem the coins sent by the other party.
#
# If x is never revealed, both parties will be able to retrieve their
# original coins safely, without help from the other.
#
#
#
######################################################################
#                           BTC Testnet3                             #
######################################################################
#
# Alice ----> UTXO ----> Bob (with x)
#               |
#               |
#               V
#             Alice (after 48 hours)
#
######################################################################
#                            BCY Testnet                             #
######################################################################
#
#   Bob ----> UTXO ----> Alice (with x)
#               |
#               |
#               V
#              Bob (after 24 hours)
#
######################################################################

######################################################################
#
# Read the following function.
#
# There's nothing to implement here, but it outlines the structure
# of how Alice and Bob will communicate to perform this cross-
# chain atomic swap.
#
# You will run swap.py to test your code.
#
######################################################################

def atomic_swap(broadcast_transactions=False, alice_redeems=True):
    # Alice reveals the hash of her secret x but not the secret itself
    hash_of_secret = alice.hash_of_secret()

    # Alice creates a transaction redeemable by Bob (with x) or by Bob and Alice
    alice_swap_tx, alice_swap_scriptPubKey = alice.alice_swap_tx(
        alice_txid_to_spend,
        alice_utxo_index,
        alice_amount_to_send - tx_fee,
    )

    # Alice creates a time-locked transaction to return coins to herself
    alice_return_coins_tx = alice.return_coins_tx(
        alice_amount_to_send - (2 * tx_fee),
        alice_swap_tx,
        btc_test3_chain_height + alice_locktime,
        alice_swap_scriptPubKey,
    )

    # Alice asks Bob to sign her transaction
    bob_signature_BTC = bob.sign_BTC(alice_return_coins_tx, alice_swap_scriptPubKey)

    # Alice broadcasts her first transaction, only after Bob signs this one
    if broadcast_transactions:
        alice.broadcast_BTC(alice_swap_tx)

    # The same situation occurs, with roles reversed
    bob_swap_tx, bob_swap_scriptPubKey = bob.bob_swap_tx(
        bob_txid_to_spend,
        bob_utxo_index,
        bob_amount_to_send - tx_fee,
        hash_of_secret,
    )
    bob_return_coins_tx = bob.return_coins_tx(
        bob_amount_to_send - (2 * tx_fee),
        bob_swap_tx,
        bcy_test_chain_height + bob_locktime,
    )

    alice_signature_BCY = alice.sign_BCY(bob_return_coins_tx, bob_swap_scriptPubKey)

    if broadcast_transactions:
        bob.broadcast_BCY(bob_swap_tx)

    if broadcast_transactions:
        print('Sleeping for 30 minutes to let transactions confirm...')
        time.sleep(60 * 30)

    if alice_redeems:
        # Alice redeems her coins, revealing x publicly (it's now on the blockchain)
        alice_redeem_tx, alice_secret_x = alice.redeem_swap(
            bob_amount_to_send - (2 * tx_fee),
            bob_swap_tx,
            bob_swap_scriptPubKey,
        )
        if broadcast_transactions:
            alice.broadcast_BCY(alice_redeem_tx)

        # Once x is revealed, Bob may also redeem his coins
        bob_redeem_tx = bob.redeem_swap(
            alice_amount_to_send - (2 * tx_fee),
            alice_swap_tx,
            alice_swap_scriptPubKey,
            alice_secret_x,
        )
        if broadcast_transactions:
            bob.broadcast_BTC(bob_redeem_tx)
    else:

        # Bob and Alice may take back their original coins after the specified time has passed
        completed_bob_return_tx = bob.complete_return_tx(
            bob_return_coins_tx,
            bob_swap_scriptPubKey,
            alice_signature_BCY,
        )
        completed_alice_return_tx = alice.complete_return_tx(
            alice_return_coins_tx,
            alice_swap_scriptPubKey,
            bob_signature_BTC,
        )
        if broadcast_transactions:
            print('Sleeping for bob_locktime blocks to pass locktime...')
            time.sleep(10 * 60 * bob_locktime)
            bob.broadcast_BCY(completed_bob_return_tx)

            print('Sleeping for alice_locktime blocks to pass locktime...')
            time.sleep(10 * 60 * max(alice_locktime - bob_locktime, 0))
            alice.broadcast_BTC(completed_alice_return_tx)

if __name__ == '__main__':
    atomic_swap(broadcast_transactions, alice_redeems)
