const BN = require('bn.js')
const ext = require('./bn-extensions')
const bitcoin = require('bitcoinjs-lib')
const secp256k1 = require('secp256k1')
const MAX_BIP125_RBF_SEQUENCE = 0xfffffffd

const SYSCOIN_TX_VERSION_NEVM_DATA = 137
const SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_SYSCOIN = 138
const SYSCOIN_TX_VERSION_SYSCOIN_BURN_TO_ALLOCATION = 139
const SYSCOIN_TX_VERSION_ALLOCATION_MINT = 140
const SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_ETHEREUM = 141
const SYSCOIN_TX_VERSION_ALLOCATION_SEND = 142

const COIN = 100000000
const CENT = 1000000

const bitcoinNetworks = { mainnet: bitcoin.networks.bitcoin, testnet: bitcoin.networks.testnet }
const syscoinNetworks = {
  mainnet: {
    messagePrefix: '\x18Syscoin Signed Message:\n',
    bech32: 'sys',
    bip32: {
      public: 0x0488b21e,
      private: 0x0488ade4
    },
    pubKeyHash: 0x3f,
    scriptHash: 0x05,
    wif: 0x80
  },
  testnet: {
    messagePrefix: '\x18Syscoin Signed Message:\n',
    bech32: 'tsys',
    bip32: {
      public: 0x043587cf,
      private: 0x04358394
    },
    pubKeyHash: 0x41,
    scriptHash: 0xc4,
    wif: 0xef
  }
}
function isNonAssetFunded (txVersion) {
  return txVersion === SYSCOIN_TX_VERSION_SYSCOIN_BURN_TO_ALLOCATION || txVersion === SYSCOIN_TX_VERSION_ALLOCATION_MINT
}
function isAllocationBurn (txVersion) {
  return txVersion === SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_SYSCOIN || txVersion === SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_ETHEREUM
}
function isAssetAllocationTx (txVersion) {
  return txVersion === SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_ETHEREUM || txVersion === SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_SYSCOIN || txVersion === SYSCOIN_TX_VERSION_SYSCOIN_BURN_TO_ALLOCATION || txVersion === SYSCOIN_TX_VERSION_ALLOCATION_SEND
}
function isSyscoinTx (txVersion) {
  return isAssetAllocationTx(txVersion)
}
function isPoDATx (txVersion) {
  return txVersion === SYSCOIN_TX_VERSION_NEVM_DATA
}
function USHRT_MAX () {
  return 65535
}
// Amount compression:
// * If the amount is 0, output 0
// * first, divide the amount (in base units) by the largest power of 10 possible; call the exponent e (e is max 9)
// * if e<9, the last digit of the resulting number cannot be 0; store it as d, and drop it (divide by 10)
//   * call the result n
//   * output 1 + 10*(9*n + d - 1) + e
// * if e==9, we only know the resulting number is not zero, so output 1 + 10*(n - 1) + 9
// (this is decodable, as d is in [1-9] and e is in [0-9])

function compressAmount (n) {
  if (n.isZero()) {
    return n
  }
  let e = 0
  const tenBN = new BN(10)
  const nineBN = new BN(9)
  while ((ext.eq(ext.mod(n, tenBN), ext.BN_ZERO)) && e < 9) {
    n = ext.div(n, tenBN)
    e++
  }
  if (e < 9) {
    const d = ext.mod(n, tenBN).toNumber()
    n = ext.div(n, tenBN)
    let retVal = ext.mul(n, nineBN)
    retVal = ext.add(retVal, new BN(d))
    retVal = ext.sub(retVal, ext.BN_ONE)
    retVal = ext.mul(retVal, tenBN)
    retVal = ext.add(retVal, ext.BN_ONE)
    retVal = ext.add(retVal, new BN(e))
    return retVal
  } else {
    let retVal = ext.sub(n, ext.BN_ONE)
    retVal = ext.mul(retVal, tenBN)
    retVal = ext.add(retVal, ext.BN_ONE)
    retVal = ext.add(retVal, nineBN)
    return retVal
  }
}

function decompressAmount (x) {
  // x = 0  OR  x = 1+10*(9*n + d - 1) + e  OR  x = 1+10*(n - 1) + 9
  if (x.isZero()) {
    return x
  }
  const tenBN = new BN(10)
  const nineBN = new BN(9)
  x = ext.sub(x, ext.BN_ONE)
  // x = 10*(9*n + d - 1) + e
  let e = ext.mod(x, tenBN).toNumber()
  x = ext.div(x, tenBN)
  let n = ext.BN_ZERO
  if (e < 9) {
    // x = 9*n + d - 1
    const d = ext.add(ext.mod(x, nineBN), ext.BN_ONE)
    x = ext.div(x, nineBN)
    // x = n
    n = ext.add(ext.mul(x, tenBN), d)
  } else {
    n = ext.add(x, ext.BN_ONE)
  }
  while (e > 0) {
    n = ext.mul(n, tenBN)
    e--
  }
  return n
}

function signHash (WIF, hash, network) {
  const keyPair = bitcoin.ECPair.fromWIF(WIF, network)
  const sigObj = secp256k1.sign(hash, keyPair.privateKey)
  const recId = 27 + sigObj.recovery + (keyPair.compressed ? 4 : 0)

  const recIdBuffer = Buffer.allocUnsafe(1)
  recIdBuffer.writeInt8(recId)
  const rawSignature = Buffer.concat([recIdBuffer, sigObj.signature])
  return rawSignature
}

module.exports = {
  compressAmount,
  decompressAmount,
  USHRT_MAX,
  COIN,
  CENT,
  SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_SYSCOIN,
  SYSCOIN_TX_VERSION_SYSCOIN_BURN_TO_ALLOCATION,
  SYSCOIN_TX_VERSION_ALLOCATION_MINT,
  SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_ETHEREUM,
  SYSCOIN_TX_VERSION_ALLOCATION_SEND,
  SYSCOIN_TX_VERSION_NEVM_DATA,
  isNonAssetFunded,
  isAllocationBurn,
  isAssetAllocationTx,
  isSyscoinTx,
  isPoDATx,
  signHash,
  MAX_BIP125_RBF_SEQUENCE,
  syscoinNetworks,
  bitcoinNetworks
}
