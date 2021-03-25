const BN = require('bn.js')
const ext = require('./bn-extensions')
const bitcoin = require('bitcoinjs-lib')
const secp256k1 = require('secp256k1')
const bitcoinops = require('bitcoin-ops')
const MAX_BIP125_RBF_SEQUENCE = 0xfffffffd
const SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_SYSCOIN = 128
const SYSCOIN_TX_VERSION_SYSCOIN_BURN_TO_ALLOCATION = 129
const SYSCOIN_TX_VERSION_ASSET_ACTIVATE = 130
const SYSCOIN_TX_VERSION_ASSET_UPDATE = 131
const SYSCOIN_TX_VERSION_ASSET_SEND = 132
const SYSCOIN_TX_VERSION_ALLOCATION_MINT = 133
const SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_ETHEREUM = 134
const SYSCOIN_TX_VERSION_ALLOCATION_SEND = 135
const COIN = 100000000
const CENT = 1000000
const ASSET_UPDATE_DATA = 1 // can you update public data field?
const ASSET_UPDATE_CONTRACT = 2 // can you update smart contract?
const ASSET_UPDATE_SUPPLY = 4 // can you update supply?
const ASSET_UPDATE_NOTARY_KEY = 8 // can you update notary?
const ASSET_UPDATE_NOTARY_DETAILS = 16 // can you update notary details?
const ASSET_UPDATE_AUXFEE = 32 // can you update aux fees?
const ASSET_UPDATE_CAPABILITYFLAGS = 64 // can you update capability flags?
const ASSET_CAPABILITY_ALL = 127
const ASSET_INIT = 128 // upon asset creation
const memoHeader = Buffer.from([0xff, 0xff, 0xaf, 0xaf, 0xaa, 0xaa])
function isNonAssetFunded (txVersion) {
  return txVersion === SYSCOIN_TX_VERSION_ASSET_ACTIVATE || txVersion === SYSCOIN_TX_VERSION_SYSCOIN_BURN_TO_ALLOCATION || txVersion === SYSCOIN_TX_VERSION_ALLOCATION_MINT
}
function isAsset (txVersion) {
  return txVersion === SYSCOIN_TX_VERSION_ASSET_ACTIVATE || txVersion === SYSCOIN_TX_VERSION_ASSET_UPDATE || txVersion === SYSCOIN_TX_VERSION_ASSET_SEND
}
function isAllocationBurn (txVersion) {
  return txVersion === SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_SYSCOIN || txVersion === SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_ETHEREUM
}
function isAssetAllocationTx (txVersion) {
  return txVersion === SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_ETHEREUM || txVersion === SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_SYSCOIN || txVersion === SYSCOIN_TX_VERSION_SYSCOIN_BURN_TO_ALLOCATION || txVersion === SYSCOIN_TX_VERSION_ALLOCATION_SEND
}
function isSyscoinTx (txVersion) {
  return isAsset(txVersion) || isAssetAllocationTx(txVersion)
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

function encodeToBase64 (input) {
  return Buffer.from(input).toString('base64')
}

function decodeFromBase64ToASCII (input) {
  return Buffer.from(input, 'base64').toString()
}

function decodeFieldsFromPubData (jsonData) {
  const res = {}
  if (jsonData.desc) {
    res.desc = decodeFromBase64ToASCII(jsonData.desc)
  }
  return res
}

function encodePubDataFromFields (pubData) {
  const obj = {}
  if (pubData && pubData.desc) {
    obj.desc = encodeToBase64(pubData.desc)
  }
  return Buffer.from(JSON.stringify(obj))
}

function generateAssetGuid (input) {
  let bigNum = new BN(input.txId, 16)
  bigNum = ext.add(bigNum, new BN(input.vout))
  // clear bits 33 and up to keep low 32 bits
  bigNum = bigNum.maskn(32)
  return bigNum.toString(10)
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

/* getMemoFromScript
Purpose: Return memo from a script, null otherwise
Param script: Required. OP_RETURN script output
Param memoHeader: Required. Memo prefix, application specific
*/
function getMemoFromScript (script, memoHeader) {
  const pos = script.indexOf(memoHeader)
  if (pos >= 0) {
    return script.slice(pos + memoHeader.length)
  }
  return null
}

/* getMemoFromOpReturn
Purpose: Return memo from an array of outputs by finding the OP_RETURN output and extracting the memo from the script, return null if not found
Param outputs: Required. Tx output array
Param memoHeader: Required. Memo prefix, application specific
*/
function getMemoFromOpReturn (outputs, memoHeader) {
  for (let i = 0; i < outputs.length; i++) {
    const output = outputs[i]
    if (output.script) {
      // find opreturn
      const chunks = bitcoin.script.decompile(output.script)
      if (chunks[0] === bitcoinops.OP_RETURN) {
        return getMemoFromScript(chunks[1], memoHeader)
      }
    }
  }
  return null
}

/* setTransactionMemo
Purpose: Return transaction with memo appended to the inside of the OP_RETURN output, return null if not found
Param rawHex: Required. Raw transaction hex
Param memoHeader: Required. Memo prefix, application specific
Param buffMemo: Required. Buffer memo to put into the transaction
*/
function setTransactionMemo (rawHex, memoHeader, buffMemo) {
  const txn = bitcoin.Transaction.fromHex(rawHex)
  let processed = false
  if (!buffMemo) {
    return txn
  }
  for (let key = 0; key < txn.outs.length; key++) {
    const out = txn.outs[key]
    const chunksIn = bitcoin.script.decompile(out.script)
    if (chunksIn[0] !== bitcoin.opcodes.OP_RETURN) {
      continue
    }
    txn.outs.splice(key, 1)
    const updatedData = [chunksIn[1], memoHeader, buffMemo]
    txn.addOutput(bitcoin.payments.embed({ data: [Buffer.concat(updatedData)] }).output, 0)
    processed = true
    break
  }
  if (processed) {
    const memoRet = getMemoFromOpReturn(txn.outs, memoHeader)
    if (!memoRet || !memoRet.equals(buffMemo)) {
      return null
    }
    return txn
  }
  const updatedData = [memoHeader, buffMemo]
  txn.addOutput(bitcoin.payments.embed({ data: [Buffer.concat(updatedData)] }).output, 0)
  const memoRet = getMemoFromOpReturn(txn.outs, memoHeader)
  if (!memoRet || !memoRet.equals(buffMemo)) {
    return null
  }
  return txn
}

module.exports = {
  generateAssetGuid: generateAssetGuid,
  encodeToBase64: encodeToBase64,
  decodeFromBase64ToASCII: decodeFromBase64ToASCII,
  encodePubDataFromFields: encodePubDataFromFields,
  decodeFieldsFromPubData: decodeFieldsFromPubData,
  compressAmount: compressAmount,
  decompressAmount: decompressAmount,
  USHRT_MAX: USHRT_MAX,
  COIN: COIN,
  CENT: CENT,
  SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_SYSCOIN: SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_SYSCOIN,
  SYSCOIN_TX_VERSION_SYSCOIN_BURN_TO_ALLOCATION: SYSCOIN_TX_VERSION_SYSCOIN_BURN_TO_ALLOCATION,
  SYSCOIN_TX_VERSION_ASSET_ACTIVATE: SYSCOIN_TX_VERSION_ASSET_ACTIVATE,
  SYSCOIN_TX_VERSION_ASSET_UPDATE: SYSCOIN_TX_VERSION_ASSET_UPDATE,
  SYSCOIN_TX_VERSION_ASSET_SEND: SYSCOIN_TX_VERSION_ASSET_SEND,
  SYSCOIN_TX_VERSION_ALLOCATION_MINT: SYSCOIN_TX_VERSION_ALLOCATION_MINT,
  SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_ETHEREUM: SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_ETHEREUM,
  SYSCOIN_TX_VERSION_ALLOCATION_SEND: SYSCOIN_TX_VERSION_ALLOCATION_SEND,
  ASSET_UPDATE_DATA: ASSET_UPDATE_DATA,
  ASSET_UPDATE_CONTRACT: ASSET_UPDATE_CONTRACT,
  ASSET_UPDATE_SUPPLY: ASSET_UPDATE_SUPPLY,
  ASSET_UPDATE_NOTARY_KEY: ASSET_UPDATE_NOTARY_KEY,
  ASSET_UPDATE_NOTARY_DETAILS: ASSET_UPDATE_NOTARY_DETAILS,
  ASSET_UPDATE_AUXFEE: ASSET_UPDATE_AUXFEE,
  ASSET_UPDATE_CAPABILITYFLAGS: ASSET_UPDATE_CAPABILITYFLAGS,
  ASSET_INIT: ASSET_INIT,
  ASSET_CAPABILITY_ALL: ASSET_CAPABILITY_ALL,
  isNonAssetFunded: isNonAssetFunded,
  isAsset: isAsset,
  isAllocationBurn: isAllocationBurn,
  isAssetAllocationTx: isAssetAllocationTx,
  isSyscoinTx: isSyscoinTx,
  signHash: signHash,
  getMemoFromScript: getMemoFromScript,
  getMemoFromOpReturn: getMemoFromOpReturn,
  setTransactionMemo: setTransactionMemo,
  MAX_BIP125_RBF_SEQUENCE: MAX_BIP125_RBF_SEQUENCE,
  memoHeader: memoHeader

}
