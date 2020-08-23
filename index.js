var BN = require('bn.js')
const ext = require('./bn-extensions')
const utils = require('./utils')
const syscoinBufferUtils = require('./bufferutilsassets.js')
const bitcoin = require('bitcoinjs-lib')
const coinSelect = require('coinselectsyscoin')
const bitcoinops = require('bitcoin-ops')

function createTransaction (txOpts, utxos, changeAddress, outputsArr, feeRate, network) {
  utxos = utils.sanitizeBlockbookUTXOs(utxos, network, txOpts)
  let txVersion = 2
  const inputsArr = []
  let res = coinSelect.coinSelect(utxos, inputsArr, outputsArr, feeRate, utxos.assets)
  if (!res.inputs || !res.outputs) {
    const assetAllocations = []
    console.log('createTransaction: inputs or outputs are empty after coinSelect trying to fund with Syscoin Asset inputs...')
    res = coinSelect.coinSelectAssetGas(assetAllocations, utxos, inputsArr, outputsArr, feeRate, utils.SYSCOIN_TX_VERSION_ALLOCATION_SEND, utxos.assets)
    if (!res.inputs || !res.outputs) {
      console.log('createTransaction: inputs or outputs are empty after coinSelectAssetGas')
      return null
    }
    if (assetAllocations.length > 0) {
      txVersion = utils.SYSCOIN_TX_VERSION_ALLOCATION_SEND
      // re-use syscoin change outputs for allocation change outputs where we can, this will possible remove one output and save fees
      optimizeOutputs(res.outputs, assetAllocations)
      const assetAllocationsBuffer = syscoinBufferUtils.serializeAssetAllocations(assetAllocations)
      const buffArr = [assetAllocationsBuffer]
      // create and add data script for OP_RETURN
      const dataScript = bitcoin.payments.embed({ data: [Buffer.concat(buffArr)] }).output
      const dataOutput = {
        script: dataScript,
        value: ext.BN_ZERO
      }
      res.outputs.push(dataOutput)
      let bOverrideRBF = false
      assetAllocations.forEach(assetAllocation => {
        const assetObj = utxos.assets.get(assetAllocation.assetGuid)
        if (assetObj && assetObj.notarydetails && assetObj.notarydetails.instanttransfers) {
          bOverrideRBF = true
        }
      })
      // if rbf not set but one asset was notarized turn on rbf
      if (bOverrideRBF && txOpts.rbf !== true) {
        console.log('override RBF settings due to notary with instant transfers enabled')
        txOpts.rbf = true
      }
    }
  }
  const inputs = res.inputs
  const outputs = res.outputs

  optimizeFees(txVersion, inputs, outputs, feeRate)
  if (txOpts && txOpts.rbf) {
    inputs.forEach(input => {
      input.sequence = utils.MAX_BIP125_RBF_SEQUENCE
    })
  }
  outputs.forEach(output => {
    // watch out, outputs may have been added that you need to provide
    // an output address/script for
    if (!output.address) {
      output.address = changeAddress
    }
  })
  return { txVersion, inputs, outputs }
}
// update all allocations at some index or higher
function updateAllocationIndexes (assetAllocations, index) {
  assetAllocations.forEach(voutAsset => {
    voutAsset.values.forEach(output => {
      if (output.n >= index && output.n > 0) {
        output.n--
      }
    })
  })
}

function optimizeOutputs (outputs, assetAllocations) {
  // first find all syscoin outputs that are change (should only be one)
  const changeOutputs = outputs.filter(output => output.changeIndex !== undefined)
  if (changeOutputs.length > 1) {
    console.log('optimizeOutputs: too many change outputs')
    return
  }
  // find all asset change outputs
  const assetChangeOutputs = outputs.filter(assetOutput => assetOutput.assetChangeIndex !== undefined && assetOutput.assetInfo.assetGuid > 0)
  changeOutputs.forEach(output => {
    // for every asset output and find any where the allocation index and change output index don't match
    // make the allocation point to the syscoin change output and we can delete the asset output (it sends dust anyway)
    for (var i = 0; i < assetChangeOutputs.length; i++) {
      const assetOutput = assetChangeOutputs[i]
      // get the allocation by looking up from assetChangeIndex which is indexing into the allocations array for this asset guid
      const allocations = assetAllocations.find(voutAsset => voutAsset.assetGuid === assetOutput.assetInfo.assetGuid)
      const allocation = allocations.values[assetOutput.assetChangeIndex]
      // ensure that the output index's don't match between sys change and asset output
      if (allocation.n !== output.changeIndex) {
        // remove the output, we will recalc and optimize fees after this call
        outputs.splice(allocation.n, 1)

        // because we deleted this index, it will invalidate any indexes after (we must subtract by one on every index after assetChangeIndex)
        updateAllocationIndexes(assetAllocations, allocation.n)
        // set them the same and remove asset output
        if (output.changeIndex >= allocation.n && output.changeIndex > 0) {
          allocation.n = output.changeIndex - 1
        } else {
          allocation.n = output.changeIndex
        }
        // add assetInfo to output as its a sys change output which now becomes asset output as well (only needed for further calls which check assetInfo on outputs, not for signing or verifying the transaction)
        outputs[allocation.n].assetInfo = assetOutput.assetInfo
        // clear change address as it should use sys change address instead (when adding outputs)
        allocation.changeAddress = null
        return
      }
    }
  })
}

function optimizeFees (txVersion, inputs, outputs, feeRate) {
  const changeOutputs = outputs.filter(output => output.changeIndex !== undefined)
  if (changeOutputs.length > 1) {
    console.log('optimizeFees: too many change outputs')
    return
  }
  if (changeOutputs.length === 0) {
    return
  }
  const changeOutput = changeOutputs[0]
  const bytesAccum = coinSelect.utils.transactionBytes(inputs, outputs)
  const feeRequired = ext.mul(feeRate, bytesAccum)
  let feeFoundInOut = ext.sub(coinSelect.utils.sumOrNaN(inputs), coinSelect.utils.sumOrNaN(outputs))
  // first output of burn to sys is not accounted for with inputs, its minted based on sysx asset output to burn
  if (txVersion === utils.SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_SYSCOIN) {
    feeFoundInOut = ext.add(feeFoundInOut, outputs[0].value)
  }
  if (feeFoundInOut && ext.gt(feeFoundInOut, feeRequired)) {
    const reduceFee = ext.sub(feeFoundInOut, feeRequired)
    console.log('optimizeFees: reducing fees by: ' + reduceFee.toNumber())
    // add to change to effectively reduce fee
    changeOutput.value = ext.add(changeOutput.value)
  } else if (ext.lt(feeFoundInOut, feeRequired)) {
    console.log('optimizeFees: warning, not enough fees found in transaction: required: ' + feeRequired.toNumber() + ' found: ' + feeFoundInOut.toNumber())
  }
}

// update all notarizations stored in signatures map into re-serialized output scripts
function addNotarizationSignatures (txVersion, signatures, outputs) {
  // if no sigs then just return, not applicable to notarizing
  if (signatures.size === 0) {
    return -1
  }
  let opReturnScript = null
  let dataScript = null
  let opReturnIndex = 0
  for (var i = 0; i < outputs.length; i++) {
    const output = outputs[i]
    if (!output.script) {
      continue
    }
    // find opreturn
    const chunks = bitcoin.script.decompile(output.script)
    if (chunks[0] === bitcoinops.OP_RETURN) {
      opReturnScript = chunks[1]
      opReturnIndex = i
    }
  }

  if (opReturnScript === null) {
    console.log('no OPRETURN script found')
    return -1
  }

  if (txVersion === utils.SYSCOIN_TX_VERSION_ALLOCATION_MINT) {
    const mintSyscoin = syscoinBufferUtils.deserializeMintSyscoin(opReturnScript)
    const assetAllocations = mintSyscoin.allocation.find(voutAsset => signatures.has(voutAsset.assetGuid))
    if (assetAllocations !== undefined) {
      assetAllocations.forEach(assetAllocation => {
        assetAllocation.notarysig = signatures.get(assetAllocation.assetGuid)
      })
      const assetAllocationsBuffer = syscoinBufferUtils.serializeAssetAllocations(assetAllocations)
      const mintBuffer = syscoinBufferUtils.serializeMintSyscoin(mintSyscoin)
      const buffArr = [assetAllocationsBuffer, mintBuffer]
      dataScript = bitcoin.payments.embed({ data: [Buffer.concat(buffArr)] }).output
    }
  } else if (txVersion === utils.SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_ETHEREUM) {
    const burnToEthereum = syscoinBufferUtils.deserializeAllocationBurnToEthereum(opReturnScript)
    const assetAllocations = burnToEthereum.allocation.find(voutAsset => signatures.has(voutAsset.assetGuid))
    if (assetAllocations !== undefined) {
      assetAllocations.forEach(assetAllocation => {
        assetAllocation.notarysig = signatures.get(assetAllocation.assetGuid)
      })
      const assetAllocationsBuffer = syscoinBufferUtils.serializeAssetAllocations(assetAllocations)
      const burnToEthereumBuffer = syscoinBufferUtils.serializeAllocationBurnToEthereum(burnToEthereum)
      const buffArr = [assetAllocationsBuffer, burnToEthereumBuffer]
      dataScript = bitcoin.payments.embed({ data: [Buffer.concat(buffArr)] }).output
    }
  } else if (txVersion === utils.SYSCOIN_TX_VERSION_ALLOCATION_SEND) {
    const allocation = syscoinBufferUtils.deserializeAssetAllocations(opReturnScript)
    const assetAllocations = allocation.find(voutAsset => signatures.has(voutAsset.assetGuid))
    if (assetAllocations !== undefined) {
      assetAllocations.forEach(assetAllocation => {
        assetAllocation.notarysig = signatures.get(assetAllocation.assetGuid)
      })
      const assetAllocationsBuffer = syscoinBufferUtils.serializeAssetAllocations(assetAllocations)
      const buffArr = [assetAllocationsBuffer]
      dataScript = bitcoin.payments.embed({ data: [Buffer.concat(buffArr)] }).output
    }
  }
  if (dataScript !== null) {
    outputs[opReturnIndex].script = dataScript
  }
  return opReturnIndex
}

function createAssetTransaction (txVersion, txOpts, utxos, dataBuffer, dataAmount, assetMap, sysChangeAddress, feeRate) {
  let { inputs, outputs, assetAllocations } = coinSelect.coinSelectAsset(utxos, assetMap, feeRate, txVersion, utxos.assets)

  // .inputs and .outputs will be undefined if no solution was found
  if (!inputs || !outputs) {
    console.log('createAssetTransaction: inputs or outputs are empty after coinSelectAsset')
    return null
  }

  let burnAllocationValue
  if (utils.isAllocationBurn(txVersion)) {
    // ensure only 1 to 2 outputs (2 if change was required)
    if (outputs.length > 2 && outputs.length < 1) {
      console.log('Assetallocationburn: expect output of length 1 got: ' + outputs.length)
      return null
    }
    const assetAllocation = assetAllocations.find(voutAsset => voutAsset.assetGuid === outputs[0].assetInfo.assetGuid)
    if (assetAllocation === undefined) {
      console.log('Assetallocationburn: assetAllocations map does not have key: ' + outputs[0].assetInfo.assetGuid)
      return null
    }
    burnAllocationValue = new BN(assetAllocation.values[0].value)
    if (txVersion === utils.SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_ETHEREUM) {
      outputs.splice(0, 1)
      // we removed the first index via slice above, so all N's at index 1 or above should be reduced by 1
      updateAllocationIndexes(assetAllocations, 0)
    }
    // point first allocation to next output (burn output)
    // now this index is available we can use it
    assetAllocation.values[0].n = outputs.length
  }

  let assetAllocationsBuffer = syscoinBufferUtils.serializeAssetAllocations(assetAllocations)
  let buffArr
  if (dataBuffer) {
    buffArr = [assetAllocationsBuffer, dataBuffer]
  } else {
    buffArr = [assetAllocationsBuffer]
  }
  // create and add data script for OP_RETURN
  let dataScript = bitcoin.payments.embed({ data: [Buffer.concat(buffArr)] }).output
  const dataOutput = {
    script: dataScript,
    value: dataAmount
  }
  outputs.push(dataOutput)
  let res = coinSelect.coinSelect(utxos, inputs, outputs, feeRate, utxos.assets)
  if (!res.inputs || !res.outputs) {
    console.log('createAssetTransaction: inputs or outputs are empty after coinSelect trying to fund with asset inputs...')
    res = coinSelect.coinSelectAssetGas(assetAllocations, utxos, inputs, outputs, feeRate, txVersion, utxos.assets)
    if (!res.inputs || !res.outputs) {
      console.log('createAssetTransaction: inputs or outputs are empty after coinSelectAssetGas')
      return null
    }
  }
  inputs = res.inputs
  outputs = res.outputs
  // once funded we should swap the first output asset amount to sys amount as we are burning sysx to sys in output 0
  if (utils.isAllocationBurn(txVersion)) {
    if (txVersion === utils.SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_SYSCOIN) {
      // modify output from asset value to syscoin value
      // first output is special it is the sys amount bring minted
      outputs[0].value = burnAllocationValue
    }
  } else if (txVersion === utils.SYSCOIN_TX_VERSION_ASSET_ACTIVATE) {
    assetAllocations[0].assetGuid = utils.generateAssetGuid(inputs[0])
    const assetOutput = outputs.filter(output => output.assetInfo && output.assetInfo.assetGuid === 0)
    if (assetOutput.length !== 1) {
      console.log('createAssetTransaction: invalid number of asset outputs for activate')
      return null
    }
    // update outputs
    assetOutput[0].assetInfo.assetGuid = assetAllocations[0].assetGuid
    // update assetMap with new key
    const oldAssetMapEntry = assetMap.get(0)
    assetMap.delete(0)
    assetMap.set(assetAllocations[0].assetGuid, oldAssetMapEntry)
  }
  if (txVersion !== utils.SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_SYSCOIN) {
    // re-use syscoin change outputs for allocation change outputs where we can, this will possible remove one output and save fees
    optimizeOutputs(outputs, assetAllocations)
  }
  // serialize allocations again they may have been changed in optimization
  assetAllocationsBuffer = syscoinBufferUtils.serializeAssetAllocations(assetAllocations)
  if (dataBuffer) {
    buffArr = [assetAllocationsBuffer, dataBuffer]
  } else {
    buffArr = [assetAllocationsBuffer]
  }
  // update script with new guid
  dataScript = bitcoin.payments.embed({ data: [Buffer.concat(buffArr)] }).output
  // update output with new data output with new guid
  outputs.forEach(output => {
    if (output.script) {
      output.script = dataScript
    }
  })

  optimizeFees(txVersion, inputs, outputs, feeRate)
  if (utxos.assets) {
    let bOverrideRBF = false
    assetAllocations.forEach(assetAllocation => {
      const assetObj = utxos.assets.get(assetAllocation.assetGuid)
      if (assetObj && assetObj.notarydetails && assetObj.notarydetails.instanttransfers) {
        bOverrideRBF = true
      }
    })
    // if rbf not set but one asset was notarized turn on rbf
    if (bOverrideRBF && txOpts.rbf !== true) {
      console.log('override RBF settings due to notary with instant transfers enabled')
      txOpts.rbf = true
    }
  }
  // asset activates not allowed to use RBF because of deterministic asset GUID requirements based on input hash
  if (txVersion === utils.SYSCOIN_TX_VERSION_ASSET_ACTIVATE) {
    txOpts.rbf = false
  }

  if (txOpts && txOpts.rbf) {
    inputs.forEach(input => {
      input.sequence = utils.MAX_BIP125_RBF_SEQUENCE
    })
  }
  outputs.forEach(output => {
    // watch out, outputs may have been added that you need to provide
    // an output address/script for
    if (!output.address) {
      if (output.assetInfo) {
        if (assetMap.has(output.assetInfo.assetGuid)) {
          const changeAddress = assetMap.get(output.assetInfo.assetGuid).changeAddress
          if (changeAddress) {
            output.address = changeAddress
          }
        }
      }
    }
    // if we still don't have address set to sys change address
    if (!output.address) {
      output.address = sysChangeAddress
    }
  })
  return { txVersion, inputs, outputs }
}
function assetNew (assetOpts, txOpts, utxos, sysChangeAddress, feeRate, network) {
  // create dummy map where GUID will be replaced by deterministic one based on first input txid, we need this so fees will be accurately determined on first place of coinselect
  const assetMap = new Map([
    [0, { changeAddress: sysChangeAddress, outputs: [{ value: ext.BN_ZERO, address: sysChangeAddress }] }]
  ])
  utxos = utils.sanitizeBlockbookUTXOs(utxos, network, txOpts, assetMap)
  const txVersion = utils.SYSCOIN_TX_VERSION_ASSET_ACTIVATE
  const dataAmount = new BN(150 * utils.COIN)
  assetOpts.contract = assetOpts.contract || Buffer.from('')
  if (assetOpts.description) {
    assetOpts.pubdata = Buffer.from(utils.encodePubDataFromFields(assetOpts.description))
  } else {
    assetOpts.pubdata = Buffer.from('')
  }
  assetOpts.symbol = Buffer.from(utils.encodeToBase64(assetOpts.symbol))
  assetOpts.description = null
  assetOpts.prevcontract = Buffer.from('')
  assetOpts.prevpubdata = Buffer.from('')
  assetOpts.notarykeyid = assetOpts.notarykeyid || Buffer.from('')
  assetOpts.prevnotarykeyid = Buffer.from('')
  assetOpts.notarydetails = assetOpts.notarydetails || Buffer.from('')
  assetOpts.prevnotarydetails = Buffer.from('')
  assetOpts.auxfeekeyid = assetOpts.auxfeekeyid || Buffer.from('')
  assetOpts.prevauxfeekeyid = Buffer.from('')
  assetOpts.auxfeedetails = assetOpts.auxfeedetails || Buffer.from('')
  assetOpts.prevauxfeedetails = Buffer.from('')
  assetOpts.updatecapabilityflags = assetOpts.updatecapabilityflags || 255
  assetOpts.prevupdatecapabilityflags = 0
  assetOpts.totalsupply = ext.BN_ZERO

  let updateflags = utils.ASSET_UPDATE_SUPPLY | utils.ASSET_UPDATE_CAPABILITYFLAGS
  if (assetOpts.contract.length > 0) {
    updateflags = updateflags | utils.ASSET_UPDATE_CONTRACT
  }
  if (assetOpts.pubdata.length > 0) {
    updateflags = updateflags | utils.ASSET_UPDATE_DATA
  }
  if (assetOpts.notarykeyid.length > 0) {
    updateflags = updateflags | utils.ASSET_UPDATE_NOTARY_KEY
  }
  if (assetOpts.notarydetails.length > 0) {
    updateflags = updateflags | utils.ASSET_UPDATE_NOTARY_DETAILS
  }
  if (assetOpts.auxfeekeyid.length > 0) {
    updateflags = updateflags | utils.ASSET_UPDATE_AUXFEE_KEY
  }
  if (assetOpts.auxfeedetails.length > 0) {
    updateflags = updateflags | utils.ASSET_UPDATE_AUXFEE_DETAILS
  }
  assetOpts.updateflags = updateflags

  const dataBuffer = syscoinBufferUtils.serializeAsset(assetOpts)
  return createAssetTransaction(txVersion, txOpts, utxos, dataBuffer, dataAmount, assetMap, sysChangeAddress, feeRate)
}

function assetUpdate (assetGuid, assetOpts, txOpts, utxos, assetMap, sysChangeAddress, feeRate, network) {
  utxos = utils.sanitizeBlockbookUTXOs(utxos, network, txOpts, assetMap)
  if (!utxos.assets.has(assetGuid)) {
    console.log('Asset input found in UTXO set passed in')
    return null
  }
  const assetObj = utxos.assets.get(assetGuid)
  const txVersion = utils.SYSCOIN_TX_VERSION_ASSET_UPDATE
  const dataAmount = ext.BN_ZERO
  assetOpts.precision = assetObj.precision
  assetOpts.symbol = Buffer.from('')
  assetOpts.balance = assetOpts.balance || ext.BN_ZERO
  assetOpts.contract = assetOpts.contract || assetObj.contract
  if (assetOpts.description) {
    assetOpts.pubdata = utils.encodePubDataFromFields(assetOpts.description)
  } else {
    assetOpts.pubdata = assetObj.pubdata
  }
  assetOpts.notarykeyid = assetOpts.notarykeyid || assetObj.notarykeyid
  assetOpts.notarydetails = assetOpts.notarydetails || assetObj.notarydetails
  assetOpts.auxfeekeyid = assetOpts.auxfeekeyid || assetObj.auxfeekeyid
  assetOpts.auxfeedetails = assetOpts.auxfeedetails || assetObj.auxfeedetails
  assetOpts.updatecapabilityflags = assetOpts.updatecapabilityflags || assetObj.updatecapabilityflags
  let updateflags = 0
  // if fields that can be edited are the same we clear them so they aren't updated and we reduce tx payload
  if (assetObj.contract !== assetOpts.contract) {
    assetOpts.prevcontract = assetObj.contract || Buffer.from('')
    updateflags = updateflags | utils.ASSET_UPDATE_CONTRACT
  }
  if (assetObj.pubdata !== assetOpts.pubdata) {
    assetOpts.prevpubdata = assetObj.pubdata || Buffer.from('')
    updateflags = updateflags | utils.ASSET_UPDATE_DATA
  }
  if (assetObj.updatecapabilityflags !== assetOpts.updatecapabilityflags) {
    assetOpts.prevupdatecapabilityflags = assetObj.updatecapabilityflags
    updateflags = updateflags | utils.ASSET_UPDATE_CAPABILITYFLAGS
  }
  if (assetObj.notarykeyid !== assetOpts.notarykeyid) {
    assetOpts.prevnotarykeyid = assetObj.notarykeyid || Buffer.from('')
    updateflags = updateflags | utils.ASSET_UPDATE_NOTARY_KEY
  }
  if (assetObj.notarydetails !== assetOpts.notarydetails) {
    assetOpts.prevnotarydetails = assetObj.notarydetails || Buffer.from('')
    updateflags = updateflags | utils.ASSET_UPDATE_NOTARY_DETAILS
  }
  if (assetObj.auxfeekeyid !== assetOpts.auxfeekeyid) {
    assetOpts.prevauxfeekeyid = assetObj.auxfeekeyid || Buffer.from('')
    updateflags = updateflags | utils.ASSET_UPDATE_AUXFEE_KEY
  }
  if (assetObj.auxfeedetails !== assetOpts.auxfeedetails) {
    assetOpts.prevauxfeedetails = assetObj.auxfeedetails || Buffer.from('')
    updateflags = updateflags | utils.ASSET_UPDATE_AUXFEE_DETAILS
  }
  if (!assetOpts.balance.eq(ext.BN_ZERO)) {
    assetOpts.totalsupply = ext.BN_ZERO
    assetOpts.maxsupply = ext.BN_ZERO
    updateflags = updateflags | utils.ASSET_UPDATE_SUPPLY
  }
  assetOpts.updateflags = updateflags
  const dataBuffer = syscoinBufferUtils.serializeAsset(assetOpts)
  return createAssetTransaction(txVersion, txOpts, utxos, dataBuffer, dataAmount, assetMap, sysChangeAddress, feeRate)
}

function assetSend (txOpts, utxos, assetMap, sysChangeAddress, feeRate, network) {
  utxos = utils.sanitizeBlockbookUTXOs(utxos, network, txOpts, assetMap)
  const txVersion = utils.SYSCOIN_TX_VERSION_ASSET_SEND
  const dataAmount = ext.BN_ZERO
  const dataBuffer = null
  return createAssetTransaction(txVersion, txOpts, utxos, dataBuffer, dataAmount, assetMap, sysChangeAddress, feeRate)
}

function assetAllocationSend (txOpts, utxos, assetMap, sysChangeAddress, feeRate, network) {
  utxos = utils.sanitizeBlockbookUTXOs(utxos, network, txOpts, assetMap)
  const txVersion = utils.SYSCOIN_TX_VERSION_ALLOCATION_SEND
  const dataAmount = ext.BN_ZERO
  const dataBuffer = null
  return createAssetTransaction(txVersion, txOpts, utxos, dataBuffer, dataAmount, assetMap, sysChangeAddress, feeRate)
}

function assetAllocationBurn (assetOpts, txOpts, utxos, assetMap, sysChangeAddress, feeRate, network) {
  utxos = utils.sanitizeBlockbookUTXOs(utxos, network, txOpts, assetMap)
  let txVersion = 0
  if (assetOpts.ethaddress.length > 0) {
    txVersion = utils.SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_ETHEREUM
  } else {
    txVersion = utils.SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_SYSCOIN
  }
  const dataAmount = ext.BN_ZERO
  const dataBuffer = syscoinBufferUtils.serializeAllocationBurnToEthereum(assetOpts)
  return createAssetTransaction(txVersion, txOpts, utxos, dataBuffer, dataAmount, assetMap, sysChangeAddress, feeRate)
}

function assetAllocationMint (assetOpts, txOpts, utxos, assetMap, sysChangeAddress, feeRate, network) {
  utxos = utils.sanitizeBlockbookUTXOs(utxos, network, txOpts, assetMap)
  const txVersion = utils.SYSCOIN_TX_VERSION_ALLOCATION_MINT
  const dataAmount = ext.BN_ZERO
  const dataBuffer = syscoinBufferUtils.serializeMintSyscoin(assetOpts)
  return createAssetTransaction(txVersion, txOpts, utxos, dataBuffer, dataAmount, assetMap, sysChangeAddress, feeRate)
}

function syscoinBurnToAssetAllocation (txOpts, utxos, assetMap, sysChangeAddress, dataAmount, feeRate, network) {
  utxos = utils.sanitizeBlockbookUTXOs(utxos, network, txOpts, assetMap)
  const txVersion = utils.SYSCOIN_TX_VERSION_SYSCOIN_BURN_TO_ALLOCATION
  const dataBuffer = null
  return createAssetTransaction(txVersion, txOpts, utxos, dataBuffer, dataAmount, assetMap, sysChangeAddress, feeRate)
}

module.exports = {
  utils: utils,
  createTransaction: createTransaction,
  createAssetTransaction: createAssetTransaction,
  assetNew: assetNew,
  assetUpdate: assetUpdate,
  assetSend: assetSend,
  assetAllocationSend: assetAllocationSend,
  assetAllocationBurn: assetAllocationBurn,
  assetAllocationMint: assetAllocationMint,
  syscoinBurnToAssetAllocation: syscoinBurnToAssetAllocation,
  addNotarizationSignatures: addNotarizationSignatures
}
