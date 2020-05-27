const ext = require('./bn-extensions')
const utils = require('./utils')
const syscoinBufferUtils = require('./bufferutils.js')
const bitcoin = require('bitcoinjs-lib')
const coinSelect = require('coinselectsyscoin')
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

function createAssetTransaction (txVersion, utxos, dataBuffer, dataAmount, assetMap, sysChangeAddress, feeRate) {
  const psbt = new bitcoin.Psbt()
  psbt.setVersion(txVersion)
  const isNonAssetFunded = txVersion === utils.SYSCOIN_TX_VERSION_ASSET_ACTIVATE || txVersion === utils.SYSCOIN_TX_VERSION_SYSCOIN_BURN_TO_ALLOCATION ||
    txVersion === utils.SYSCOIN_TX_VERSION_ALLOCATION_MINT
  let { inputs, outputs, assetAllocations } = coinSelect.coinSelectAsset(utxos, assetMap, feeRate, isNonAssetFunded)
  // .inputs and .outputs will be undefined if no solution was found

  if (!inputs || !outputs) return null
  let assetAllocationsBuffer = syscoinBufferUtils.serializeAssetAllocations(assetAllocations)
  let buffArr = [assetAllocationsBuffer, dataBuffer]
  // create and add data script for OP_RETURN
  let dataScript = bitcoin.payments.embed({ data: Buffer.concat(buffArr) })
  const dataOutput = {
    script: dataScript,
    value: dataAmount.toNumber()
  }
  outputs.push(dataOutput)
  const { inputsRet, outputsRet, fee } = coinSelect.coinSelect(utxos, inputs, outputs, feeRate)
  inputs = inputsRet
  outputs = outputsRet

  if (txVersion === utils.SYSCOIN_TX_VERSION_ASSET_ACTIVATE) {
    const newAllocation = new Map()
    const deterministicGuid = utils.generateAssetGuid(inputs[0].txId)
    for (var guid in assetAllocations) {
      if (guid in assetAllocations) {
        const allocation = assetAllocations[guid]
        newAllocation.set(deterministicGuid, [{ index: allocation.index, value: allocation.value }])
        // only expect one allocation for a new asset
        break
      }
    }
    console.log('assetAllocationsBuffer length before ' + assetAllocationsBuffer.length + ' dataBuffer length before ' + dataBuffer.length)
    assetAllocationsBuffer = syscoinBufferUtils.serializeAssetAllocations(newAllocation)
    buffArr = [assetAllocationsBuffer, dataBuffer]
    console.log('assetAllocationsBuffer length after ' + assetAllocationsBuffer.length + ' dataBuffer length after ' + dataBuffer.length)
    // update script with new guid
    dataScript = bitcoin.payments.embed({ data: Buffer.concat(buffArr) })
    // update output with new data output with new guid
    outputs.forEach(output => {
      if (output.script) {
        output.script = dataScript
      }
    })
  }

  // the accumulated fee is always returned for analysis
  console.log(fee)

  // .inputs and .outputs will be undefined if no solution was found
  if (!inputs || !outputs) return null
  inputs.forEach(input => {
    psbt.addInput({
      hash: input.txId,
      index: input.vout,
      witnessUtxo: input.witnessUtxo
    })
  })
  outputs.forEach(output => {
    // watch out, outputs may have been added that you need to provide
    // an output address/script for
    if (!output.address) {
      if (output.assetInfo) {
        if (output.assetInfo.assetGuid in assetMap) {
          output.address = assetMap[output.assetInfo.assetGuid].changeAddress
        }
      } else {
        output.address = sysChangeAddress
      }
    }
    psbt.addOutput({
      script: output.script,
      address: output.script ? null : output.address,
      value: output.value.toNumber()
    })
  })

  return psbt
}
function assetNew (assetOpts, assetOptsOptional, utxos, sysChangeAddress, feeRate) {
  const txVersion = utils.SYSCOIN_TX_VERSION_ASSET_ACTIVATE
  const dataAmount = new ext.BN(150 * utils.COIN)
  assetOpts.contract = assetOpts.contract || assetOptsOptional.contract
  assetOpts.pubdata = assetOpts.pubdata || assetOptsOptional.pubdata
  assetOpts.prevcontract = assetOpts.prevcontract || assetOptsOptional.prevcontract
  assetOpts.prevpubdata = assetOpts.prevpubdata || assetOptsOptional.prevpubdata
  const dataBuffer = syscoinBufferUtils.serializeAsset(assetOpts)
  // create dummy map where GUID will be replaced by deterministic one based on first input txid, we need this so fees will be accurately determined on first place of coinselect
  const assetMap = new Map([
    [0, { changeAddress: sysChangeAddress, outputs: [{ value: new ext.BN(0), address: sysChangeAddress }] }]
  ])
  return createAssetTransaction(txVersion, utxos, dataBuffer, dataAmount, assetMap, sysChangeAddress, feeRate)
}

function assetUpdate (assetOpts, assetOptsOptional, utxos, assetMap, sysChangeAddress, feeRate) {
  const txVersion = utils.SYSCOIN_TX_VERSION_ASSET_UPDATE
  const dataAmount = ext.BN_ZERO
  assetOpts.contract = assetOpts.contract || assetOptsOptional.contract
  assetOpts.pubdata = assetOpts.pubdata || assetOptsOptional.pubdata
  assetOpts.prevcontract = assetOpts.prevcontract || assetOptsOptional.prevcontract
  assetOpts.prevpubdata = assetOpts.prevpubdata || assetOptsOptional.prevpubdata
  const dataBuffer = syscoinBufferUtils.serializeAsset(assetOpts)
  return createAssetTransaction(txVersion, utxos, dataBuffer, dataAmount, assetMap, sysChangeAddress, feeRate)
}

function assetSend (utxos, assetMap, sysChangeAddress, feeRate) {
  const txVersion = utils.SYSCOIN_TX_VERSION_ASSET_SEND
  const dataAmount = ext.BN_ZERO
  const dataBuffer = null
  return createAssetTransaction(txVersion, utxos, dataBuffer, dataAmount, assetMap, sysChangeAddress, feeRate)
}

function assetAllocationSend (utxos, assetMap, sysChangeAddress, feeRate) {
  const txVersion = utils.SYSCOIN_TX_VERSION_ALLOCATION_SEND
  const dataAmount = ext.BN_ZERO
  const dataBuffer = null
  return createAssetTransaction(txVersion, utxos, dataBuffer, dataAmount, assetMap, sysChangeAddress, feeRate)
}

function assetAllocationBurn (syscoinBurnToEthereum, utxos, assetMap, sysChangeAddress, feeRate) {
  let txVersion = 0
  if (syscoinBurnToEthereum && syscoinBurnToEthereum.ethAddress && syscoinBurnToEthereum.ethAddress.length > 0) {
    txVersion = utils.SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_ETHEREUM
  } else {
    txVersion = utils.SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_SYSCOIN
  }
  const dataAmount = ext.BN_ZERO
  let dataBuffer = null
  if (txVersion === utils.SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_ETHEREUM) {
    dataBuffer = syscoinBufferUtils.serializeSyscoinBurnToEthereum(syscoinBurnToEthereum)
  }
  return createAssetTransaction(txVersion, utxos, dataBuffer, dataAmount, assetMap, sysChangeAddress, feeRate)
}

function assetAllocationMint (mintSyscoin, utxos, assetMap, sysChangeAddress, feeRate) {
  const txVersion = utils.SYSCOIN_TX_VERSION_ALLOCATION_MINT
  const dataAmount = ext.BN_ZERO
  const dataBuffer = syscoinBufferUtils.serializeMintSyscoin(mintSyscoin)
  return createAssetTransaction(txVersion, utxos, dataBuffer, dataAmount, assetMap, sysChangeAddress, feeRate)
}

function syscoinBurnToAssetAllocation (utxos, assetMap, sysChangeAddress, dataAmount, feeRate) {
  const txVersion = utils.SYSCOIN_TX_VERSION_SYSCOIN_BURN_TO_ALLOCATION
  const dataBuffer = null
  return createAssetTransaction(txVersion, utxos, dataBuffer, dataAmount, assetMap, sysChangeAddress, feeRate)
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
