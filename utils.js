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
      sanitizedUtxos.assets.set(asset.assetGuid, { notarizationEndPoint: asset.notarizationEndPoint, auxFees: asset.auxFees })
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

module.exports = {
  sanitizeBlockbookUTXOs: sanitizeBlockbookUTXOs,
  generateAssetGuid: generateAssetGuid,
  encodeToBase64: encodeToBase64,
  decodeFromBase64: decodeFromBase64,
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
