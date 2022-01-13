from bitcoin import SelectParams
from bitcoin.base58 import decode
from bitcoin.core import x
from bitcoin.wallet import CBitcoinAddress, CBitcoinSecret, P2PKHBitcoinAddress


SelectParams('testnet')

faucet_address = CBitcoinAddress('mv4rnyY3Su5gjcDNzbMLKBQkBicCtHUtFB')

# For questions 1-3, we are using 'btc-test3' network. For question 4, you will
# set this to be either 'btc-test3' or 'bcy-test'
network_type = 'btc-test3' #'bcy-test' # 'btc-test3'


######################################################################
# This section is for Questions 1-3
# TODO: Fill this in with your private key.
#
# Create a private key and address pair in Base58 with keygen.py
# Send coins at https://testnet-faucet.mempool.co/

my_private_key = CBitcoinSecret(
    'cQDXA5y3EAExcaZTSrzJQnxJeJitTZZQW6iNqKt7bLwnWfFEB4YH')

my_public_key = my_private_key.pub
my_address = P2PKHBitcoinAddress.from_pubkey(my_public_key)

# address mq3ZmZSjiHT1mFPQi2N2gQUkEE85i7d9xi
# txn 732568f3562868fc77019c58dcef9edbb0a25068a300d50495b933652b708abe


######################################################################


######################################################################
# NOTE: This section is for Question 4
# TODO: Fill this in with address secret key for BTC testnet3
#
# Create address in Base58 with keygen.py
# Send coins at https://testnet-faucet.mempool.co/

# Only to be imported by alice.py
# Alice should have coins!!
alice_secret_key_BTC = CBitcoinSecret(
    'cT9jcaNj2uXbdATyRqiBWqAFtai4G43MsKEdQtkEr4t4LBzaxtoV')

# address mgeTiW2eKmaxrEpmQwCXtudKtE1jsy2Mk6
# txn 6a2b7576060947a3c5deddaf1fdec73a210032a09a48ba02fc96a6b0115ce209

# Only to be imported by bob.py
bob_secret_key_BTC = CBitcoinSecret(
    'cNPJ43LDo4Skycnbhg8HDsmAR1PfBByx1W1i6KAZv9Cu5WZmP2Hp')

#address n1zr1yJVcM5axhtQEBAoHoFtkm1Mi9PXZA

# Can be imported by alice.py or bob.py
alice_public_key_BTC = alice_secret_key_BTC.pub
alice_address_BTC = P2PKHBitcoinAddress.from_pubkey(alice_public_key_BTC)

bob_public_key_BTC = bob_secret_key_BTC.pub
bob_address_BTC = P2PKHBitcoinAddress.from_pubkey(bob_public_key_BTC)
######################################################################


######################################################################
# NOTE: This section is for Question 4
# TODO: Fill this in with address secret key for BCY testnet
#
# Create address in hex with
# curl -X POST https://api.blockcypher.com/v1/bcy/test/addrs?token=YOURTOKEN
# This request will return a private key, public key and address. Make sure to save these.
#
# Send coins with
# curl -d '{"address": "BCY_ADDRESS", "amount": 1000000}' https://api.blockcypher.com/v1/bcy/test/faucet?token=YOURTOKEN
# This request will return a transaction reference. Make sure to save this.

# Only to be imported by alice.py
alice_secret_key_BCY = CBitcoinSecret.from_secret_bytes(
    x('6b91e98eca102e57de530e142dde54ce650eaf8c8f4693d5de9384019608d5cc'))

# address BvPEpsirRsYKKg52H2jwsAxcEA7Jy3ApNU

# Only to be imported by bob.py
# Bob should have coins!!
bob_secret_key_BCY = CBitcoinSecret.from_secret_bytes(
    x('22e0ef6505c66d392e719c44066f25deb169dab99e8095fa80befa9f2ab7b650'))

# address Bt5toLRu2weeNhr8GSJoWSgzpFvHanKieh
# txn 518889175cfefd6441a0677397dd1fbf5412fbd2b0c8765ae398a2447f1add61

# Can be imported by alice.py or bob.py
alice_public_key_BCY = alice_secret_key_BCY.pub
alice_address_BCY = P2PKHBitcoinAddress.from_pubkey(alice_public_key_BCY)

bob_public_key_BCY = bob_secret_key_BCY.pub
bob_address_BCY = P2PKHBitcoinAddress.from_pubkey(bob_public_key_BCY)
######################################################################
