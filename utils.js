var BN = require('bn.js')
const ext = require('./bn-extensions')
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
  if (Buffer.isBuffer(input)) {
    return Buffer.from(input.toString('base64'))
  }
  return Buffer.from(Buffer.from(input).toString('base64'))
}

function decodeFromBase64 (input) {
  if (Buffer.isBuffer(input)) {
    return input.toString()
  }
  return Buffer.from(input, 'base64').toString()
}

function sanitizeBlockbookUTXOs (utxos) {
  const sanitizedUtxos = []
  utxos.utxos.forEach(utxo => {
    const newUtxo = { txId: utxo.txId, vout: utxo.vout, value: new BN(utxo.value), witnessUtxo: { script: utxo.script, value: utxo.value } }
    if (utxo.assetInfo) {
      newUtxo.assetInfo = { assetGuid: utxo.assetInfo.assetGuid, value: new BN(utxo.assetInfo.value) }
    }
    sanitizedUtxos.push(newUtxo)
  })
  sanitizedUtxos.assets = new Map()
  if (utxos.assets) {
    utxos.assets.forEach(asset => {
      const assetObj = {}
      if (asset.contract) {
        assetObj.contract = Buffer.from(asset.contract)
      }
      assetObj.symbol = Buffer.from(asset.symbol)
      assetObj.pubdata = Buffer.from(asset.pubData)
      if (asset.notaryKeyID) {
        assetObj.notarykeyid = Buffer.from(asset.notaryKeyID)
      }
      if (asset.notaryDetails) {
        assetObj.notarydetails = {}
        assetObj.notarydetails.endpoint = Buffer.from(asset.notaryDetails.endPoint)
        assetObj.notarydetails.instanttransfers = asset.notaryDetails.instantTransfers
        assetObj.notarydetails.hdrequired = asset.notaryDetails.HDRequired
      }
      if (asset.auxFeeKeyID) {
        assetObj.auxfeekeyid = Buffer.from(asset.auxFeeKeyID)
      }
      if (asset.auxfeedetails) {
        assetObj.auxfeedetails = {}
        assetObj.auxfeedetails.auxfees = []
        asset.auxfeedetails.forEach(auxfee => {
          const auxfeeObj = {}
          auxfeeObj.bound = new BN(auxfee.bound)
          auxfeeObj.auxfeedetails.percent = Buffer.from(auxfee.percent)
          assetObj.auxfeedetails.auxfees.push(auxfeeObj)
        })
      }
      assetObj.balance = new BN(asset.balance)
      assetObj.totalsupply = new BN(asset.totalSupply)
      assetObj.maxsupply = new BN(asset.maxSupply)
      assetObj.precision = new BN(asset.decimal)
      assetObj.updatecapabilitiesflags = new BN(asset.updateCapabilitiesFlags)
      sanitizedUtxos.assets.set(asset.assetGuid, asset)
    })
  }
  return sanitizedUtxos
}

function generateAssetGuid (input) {
  let bigNum = new BN(input.txId, 16)
  bigNum = ext.add(bigNum, new BN(input.vout))
  // clear bits 33 and up to keep low 32 bits
  bigNum = bigNum.maskn(32)
  return bigNum.toNumber()
}

function decodeFieldsFromPubData (jsonData) {
  let description = null
  if (jsonData.desc) {
    description = jsonData.desc
  }

  return { description }
}

function encodePubDataFromFields (description) {
  const obj = {}
  if (description) {
    obj.desc = encodeToBase64(description)
  }
  return JSON.stringify(obj)
}

module.exports = {
  sanitizeBlockbookUTXOs: sanitizeBlockbookUTXOs,
  generateAssetGuid: generateAssetGuid,
  encodeToBase64: encodeToBase64,
  decodeFromBase64: decodeFromBase64,
  encodePubDataFromFields: encodePubDataFromFields,
  decodeFieldsFromPubData: decodeFieldsFromPubData,
  compressAmount: compressAmount,
  decompressAmount: decompressAmount,
  COIN: COIN,
  CENT: CENT,
  SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_SYSCOIN: SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_SYSCOIN,
  SYSCOIN_TX_VERSION_SYSCOIN_BURN_TO_ALLOCATION: SYSCOIN_TX_VERSION_SYSCOIN_BURN_TO_ALLOCATION,
  SYSCOIN_TX_VERSION_ASSET_ACTIVATE: SYSCOIN_TX_VERSION_ASSET_ACTIVATE,
  SYSCOIN_TX_VERSION_ASSET_UPDATE: SYSCOIN_TX_VERSION_ASSET_UPDATE,
  SYSCOIN_TX_VERSION_ASSET_SEND: SYSCOIN_TX_VERSION_ASSET_SEND,
  SYSCOIN_TX_VERSION_ALLOCATION_MINT: SYSCOIN_TX_VERSION_ALLOCATION_MINT,
  SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_ETHEREUM: SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_ETHEREUM,
  SYSCOIN_TX_VERSION_ALLOCATION_SEND: SYSCOIN_TX_VERSION_ALLOCATION_SEND
}
