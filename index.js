const ext = require('./bn-extensions')
const syscoinBufferUtils = require('./bufferutils.js')
const bitcoin = require('bitcoinjs-lib')
const coinSelect = require('coinselectsyscoin')
/* onst sysChangeAddress = 'sdfsdf'
const feeRate = 55 // satoshis per byte
const assetObj1 = { assetGuid: 1234, changeAddress: 'sdfdsf', outputs: [{ value: 100, address: '23232' }] }
const assetObj2 = { assetGuid: 12345, changeAddress: 'sdfdsf', outputs: [{ value: 100, address: '23232' }] }
const assetObj3 = { assetGuid: 12346, changeAddress: 'sdfdsf', outputs: [{ value: 100, address: '23232' }] }
const assetArray = [assetObj1, assetObj2, assetObj3]
const txVersion = 131
 let utxos = [
  ...,
  {
    txId: '...',
    vout: 0,
    ...,
    value: 10000,
    // For use with PSBT:
    // not needed for coinSelect, but will be passed on to inputs later
    nonWitnessUtxo: Buffer.from('...full raw hex of txId tx...', 'hex'),
    // OR
    // if your utxo is a segwit output, you can use witnessUtxo instead
    witnessUtxo: {
      script: Buffer.from('... scriptPubkey hex...', 'hex'),
      value: 10000 // 0.0001 BTC and is the exact same as the value above
    }
  }
]
let systargets = [
  ...,
  {
    address: '1EHNa6Q4Jz2uvNExL497mE43ikXhwF6kZm',
    value: 0
  }
] */
const SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_SYSCOIN = 128
const SYSCOIN_TX_VERSION_SYSCOIN_BURN_TO_ALLOCATION = 129
const SYSCOIN_TX_VERSION_ASSET_ACTIVATE = 130
const SYSCOIN_TX_VERSION_ASSET_UPDATE = 131
const SYSCOIN_TX_VERSION_ASSET_SEND = 132
const SYSCOIN_TX_VERSION_ALLOCATION_MINT = 133
const SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_ETHEREUM = 134
const SYSCOIN_TX_VERSION_ALLOCATION_SEND = 135
const COIN = 100000000
function createSyscoinTransaction (utxos, sysChangeAddress, outputsArr, feeRate) {
  const psbt = new bitcoin.Psbt()
  const inputsArr = []
  const { inputs, outputs, fee } = coinSelect.coinSelect(utxos, inputsArr, outputsArr, feeRate)
  // the accumulated fee is always returned for analysis
  console.log(fee)

  // .inputs and .outputs will be undefined if no solution was found
  if (!inputs || !outputs) return null

  inputs.forEach(input =>
    psbt.addInput({
      hash: input.txId,
      index: input.vout,
      nonWitnessUtxo: input.nonWitnessUtxo,
      // OR (not both)
      witnessUtxo: input.witnessUtxo
    })
  )
  outputs.forEach(output => {
    // watch out, outputs may have been added that you need to provide
    // an output address/script for
    if (!output.address) {
      output.address = sysChangeAddress
    }
    psbt.addOutput({
      address: output.address,
      value: output.value.toNumber()
    })
  })
  return psbt
}

function createAssetTransaction (txVersion, utxos, dataBuffer, dataAmount, assetArray, sysChangeAddress, feeRate) {
  const psbt = new bitcoin.Psbt()
  psbt.setVersion(txVersion)
  const isNonAssetFunded = txVersion === SYSCOIN_TX_VERSION_ASSET_ACTIVATE || txVersion === SYSCOIN_TX_VERSION_SYSCOIN_BURN_TO_ALLOCATION ||
    txVersion === SYSCOIN_TX_VERSION_ALLOCATION_MINT
  let { inputs, outputs, assetAllocations } = coinSelect.coinSelectAsset(utxos, assetArray, feeRate, isNonAssetFunded)
  // .inputs and .outputs will be undefined if no solution was found

  if (!inputs || !outputs) return null

  const assetAllocationsBuffer = syscoinBufferUtils.serializeAssetAllocations(assetAllocations)
  const buffArr = [assetAllocationsBuffer, dataBuffer]
  // create and add data script for OP_RETURN
  const dataScript = bitcoin.payments.embed({ data: Buffer.concat(buffArr) })
  const dataOutput = {
    script: dataScript,
    value: dataAmount.toNumber()
  }
  outputs.push(dataOutput)
  const { inputsRet, outputsRet, fee } = coinSelect.coinSelect(utxos, inputs, outputs, feeRate)
  inputs = inputsRet
  outputs = outputsRet
  // the accumulated fee is always returned for analysis
  console.log(fee)

  // .inputs and .outputs will be undefined if no solution was found
  if (!inputs || !outputs) return null
  inputs.forEach(input => {
    psbt.addInput({
      hash: input.txId,
      index: input.vout,
      nonWitnessUtxo: input.nonWitnessUtxo,
      // OR (not both)
      witnessUtxo: input.witnessUtxo
    })
  })
  outputs.forEach(output => {
    // watch out, outputs may have been added that you need to provide
    // an output address/script for
    if (!output.address) {
      output.address = sysChangeAddress
    }
    psbt.addOutput({
      address: output.address,
      value: output.value.toNumber()
    })
  })

  return psbt
}
function assetNew (assetOpts, utxos, assetArray, sysChangeAddress, feeRate) {
  const txVersion = SYSCOIN_TX_VERSION_ASSET_ACTIVATE
  const dataAmount = new ext.BN(150 * COIN)
  const dataBuffer = syscoinBufferUtils.serializeAsset(assetOpts)
  return createAssetTransaction(txVersion, utxos, dataBuffer, dataAmount, assetArray, sysChangeAddress, feeRate)
}

function assetUpdate (assetOpts, utxos, assetArray, sysChangeAddress, feeRate) {
  const txVersion = SYSCOIN_TX_VERSION_ASSET_UPDATE
  const dataAmount = ext.BN_ZERO
  const dataBuffer = syscoinBufferUtils.serializeAsset(assetOpts)
  return createAssetTransaction(txVersion, utxos, dataBuffer, dataAmount, assetArray, sysChangeAddress, feeRate)
}

function assetSend (utxos, assetArray, sysChangeAddress, feeRate) {
  const txVersion = SYSCOIN_TX_VERSION_ASSET_SEND
  const dataAmount = ext.BN_ZERO
  const dataBuffer = null
  return createAssetTransaction(txVersion, utxos, dataBuffer, dataAmount, assetArray, sysChangeAddress, feeRate)
}

function assetAllocationSend (utxos, assetArray, sysChangeAddress, feeRate) {
  const txVersion = SYSCOIN_TX_VERSION_ALLOCATION_SEND
  const dataAmount = ext.BN_ZERO
  const dataBuffer = null
  return createAssetTransaction(txVersion, utxos, dataBuffer, dataAmount, assetArray, sysChangeAddress, feeRate)
}

function assetAllocationBurn (syscoinBurnToEthereum, utxos, assetArray, sysChangeAddress, feeRate) {
  let txVersion = 0
  if (syscoinBurnToEthereum && syscoinBurnToEthereum.ethAddress && syscoinBurnToEthereum.ethAddress.length > 0) {
    txVersion = SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_ETHEREUM
  } else {
    txVersion = SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_SYSCOIN
  }
  const dataAmount = ext.BN_ZERO
  let dataBuffer = null
  if (txVersion === SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_ETHEREUM) {
    dataBuffer = syscoinBufferUtils.serializeSyscoinBurnToEthereum(syscoinBurnToEthereum)
  }
  return createAssetTransaction(txVersion, utxos, dataBuffer, dataAmount, assetArray, sysChangeAddress, feeRate)
}

function assetAllocationMint (mintSyscoin, utxos, assetArray, sysChangeAddress, feeRate) {
  const txVersion = SYSCOIN_TX_VERSION_ALLOCATION_MINT
  const dataAmount = ext.BN_ZERO
  const dataBuffer = syscoinBufferUtils.serializeMintSyscoin(mintSyscoin)
  return createAssetTransaction(txVersion, utxos, dataBuffer, dataAmount, assetArray, sysChangeAddress, feeRate)
}

function syscoinBurnToAssetAllocation (utxos, assetArray, sysChangeAddress, dataAmount, feeRate) {
  const txVersion = SYSCOIN_TX_VERSION_SYSCOIN_BURN_TO_ALLOCATION
  const dataBuffer = null
  return createAssetTransaction(txVersion, utxos, dataBuffer, dataAmount, assetArray, sysChangeAddress, feeRate)
}

module.exports = {
  createSyscoinTransaction: createSyscoinTransaction,
  createAssetTransaction: createAssetTransaction,
  assetNew: assetNew,
  assetUpdate: assetUpdate,
  assetSend: assetSend,
  assetAllocationSend: assetAllocationSend,
  assetAllocationBurn: assetAllocationBurn,
  assetAllocationMint: assetAllocationMint,
  syscoinBurnToAssetAllocation: syscoinBurnToAssetAllocation
}
