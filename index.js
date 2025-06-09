const BN = require('bn.js')
const ext = require('./bn-extensions')
const utils = require('./utils')
const syscoinBufferUtils = require('./bufferutilsassets.js')
const bitcoin = require('bitcoinjs-lib')
const coinSelect = require('coinselectsyscoin')
const bitcoinops = require('bitcoin-ops')

function createTransaction (txOpts, utxos, changeAddress, outputsArr, feeRate, inputsArr) {
  let dataBuffer = null
  let totalMemoLen = 0
  let totalBlobLen = 0
  if (txOpts.memo) {
    if (!txOpts.memoHeader) {
      console.log('No Memo header defined')
      return {
        error: 'INVALID_MEMO',
        message: 'No Memo header defined'
      }
    }
    totalMemoLen = txOpts.memo.length + txOpts.memoHeader.length
  }
  if (totalMemoLen > 80) {
    console.log('Memo too big! Max is 80 bytes, found: ' + totalMemoLen)
    return {
      error: 'INVALID_MEMO',
      message: 'Memo too big! Max is 80 bytes, found: ' + totalMemoLen
    }
  }
  if (txOpts.memo) {
    dataBuffer = Buffer.concat([txOpts.memoHeader, txOpts.memo])
  }
  let txVersion = 2
  inputsArr = inputsArr || []
  if (txOpts.blobHash) {
    if (!txOpts.blobData) {
      console.log('blobHash provided but no blobData in txOptions')
      return {
        error: 'INVALID_BLOB',
        message: 'blobHash provided but no blobData in txOptions'
      }
    }
    totalBlobLen = txOpts.blobData.length
    txVersion = utils.SYSCOIN_TX_VERSION_NEVM_DATA
    dataBuffer = syscoinBufferUtils.serializePoDA({ blobHash: txOpts.blobHash })
  }
  let res = coinSelect.coinSelect(utxos.utxos, inputsArr, outputsArr, feeRate, txVersion, totalMemoLen, totalBlobLen)
  if (!res.inputs && !res.outputs) {
    if (txOpts.blobHash) {
      console.log('createTransaction: inputs or outputs are empty after coinSelect creating blob')
      // Return the complete error object from coinselect
      return res
    }
    const assetAllocations = []
    console.log('createTransaction: inputs or outputs are empty after coinSelect trying to fund with Syscoin Asset inputs...')
    res = coinSelect.coinSelectAssetGas(assetAllocations, utxos.utxos, inputsArr, outputsArr, feeRate, utils.SYSCOIN_TX_VERSION_ALLOCATION_SEND, utxos.assets, null)
    if (!res.inputs || !res.outputs) {
      console.log('createTransaction: inputs or outputs are empty after coinSelectAssetGas')
      // Return the complete error object from coinselect
      return res
    }
    if (assetAllocations.length > 0) {
      txVersion = utils.SYSCOIN_TX_VERSION_ALLOCATION_SEND
      // re-use syscoin change outputs for allocation change outputs where we can, this will possible remove one output and save fees
      optimizeOutputs(res.outputs, assetAllocations)
      const assetAllocationsBuffer = syscoinBufferUtils.serializeAssetAllocations(assetAllocations)
      let buffArr
      if (dataBuffer) {
        buffArr = [assetAllocationsBuffer, dataBuffer]
      } else {
        buffArr = [assetAllocationsBuffer]
      }
      // create and add data script for OP_RETURN
      const dataScript = bitcoin.payments.embed({ data: [Buffer.concat(buffArr)] }).output
      const dataOutput = {
        script: dataScript,
        value: ext.BN_ZERO
      }
      res.outputs.push(dataOutput)
    }
  } else if (dataBuffer) {
    const updatedData = [dataBuffer]
    const dataScript = bitcoin.payments.embed({ data: [Buffer.concat(updatedData)] }).output
    const dataOutput = {
      script: dataScript,
      value: ext.BN_ZERO
    }
    res.outputs.push(dataOutput)
  }
  const inputs = res.inputs
  const outputs = res.outputs

  optimizeFees(txVersion, inputs, outputs, feeRate)
  if (txVersion === utils.SYSCOIN_TX_VERSION_ALLOCATION_SEND) {
    // ensure ZDAG is only enable for transactions <= 1100 bytes
    const bytesAccum = coinSelect.utils.transactionBytes(inputs, outputs)
    // if size too large we ensure ZDAG isn't set by enabling RBF (disable ZDAG)
    if (bytesAccum > 1100) {
      if (!txOpts.rbf) {
        txOpts.rbf = true
      }
    }
  }
  if (txOpts.rbf) {
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

  // Get the actual fee and size
  const bytesAccum = coinSelect.utils.transactionBytes(inputs, outputs)

  return {
    success: true,
    txVersion,
    inputs,
    outputs,
    fee: res.fee,
    feeRate,
    size: bytesAccum
  }
}
// update all allocations at some index or higher
function updateAllocationIndexes (assetAllocations, index) {
  assetAllocations.forEach(voutAsset => {
    voutAsset.values.forEach(output => {
      if (output.n > index) {
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
    for (let i = 0; i < assetChangeOutputs.length; i++) {
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
        // we reduce index by one because any index > allocation.n would have been reduced by updateAllocationIndexes and so changeIndex should also by reduced by 1 if its above allocation.n
        if (output.changeIndex > allocation.n) {
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
    console.log('optimizeFees: no change outputs')
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
    changeOutput.value = ext.add(changeOutput.value, reduceFee)
  } else if (ext.lt(feeFoundInOut, feeRequired)) {
    console.log('optimizeFees: warning, not enough fees found in transaction: required: ' + feeRequired.toNumber() + ' found: ' + feeFoundInOut.toNumber())
  }
}

function getAllocationsFromOutputs (outputs) {
  let opReturnScript = null
  for (let i = 0; i < outputs.length; i++) {
    const output = outputs[i]
    if (!output.script) {
      continue
    }
    // find opreturn
    const chunks = bitcoin.script.decompile(output.script)
    if (chunks[0] === bitcoinops.OP_RETURN) {
      opReturnScript = chunks[1]
      break
    }
  }

  if (opReturnScript === null) {
    console.log('no OPRETURN script found')
    return null
  }

  const allocation = syscoinBufferUtils.deserializeAssetAllocations(opReturnScript)
  if (!allocation) {
    return null
  }
  return allocation
}

function getAllocationsFromTx (tx) {
  if (!utils.isSyscoinTx(tx.version)) {
    return null
  }
  return getAllocationsFromOutputs(tx.outs)
}

function getPoDAFromOutputs (outputs) {
  let opReturnScript = null
  for (let i = 0; i < outputs.length; i++) {
    const output = outputs[i]
    if (!output.script) {
      continue
    }
    // find opreturn
    const chunks = bitcoin.script.decompile(output.script)
    if (chunks[0] === bitcoinops.OP_RETURN) {
      opReturnScript = chunks[1]
      break
    }
  }

  if (opReturnScript === null) {
    console.log('no OPRETURN script found')
    return null
  }

  const blob = syscoinBufferUtils.deserializePoDA(opReturnScript)
  if (!blob) {
    return null
  }
  return blob
}

function getPoDAFromTx (tx) {
  if (!utils.isPoDATx(tx.version)) {
    return null
  }
  return getPoDAFromOutputs(tx.outs)
}

function getAssetsFromOutputs (outputs) {
  const allocation = getAllocationsFromOutputs(outputs)
  if (!allocation) {
    return null
  }
  const assets = new Map()
  allocation.forEach(assetAllocation => {
    assets.set(assetAllocation.assetGuid, {})
  })
  return assets
}

// get all assets found in an asset tx returned in a map of assets keyed by asset guid
function getAssetsFromTx (tx) {
  const allocation = getAllocationsFromTx(tx)
  if (!allocation) {
    return null
  }
  const assets = new Map()
  allocation.forEach(assetAllocation => {
    assets.set(assetAllocation.assetGuid, {})
  })
  return assets
}

function createAssetTransaction (txVersion, txOpts, utxos, dataBuffer, dataAmount, assetMap, sysChangeAddress, feeRate) {
  const assetSelectResult = coinSelect.coinSelectAsset(utxos.utxos, assetMap, feeRate, txVersion)
  let { inputs, outputs, assetAllocations } = assetSelectResult

  // .inputs and .outputs will be undefined if no solution was found
  if (!inputs || !outputs) {
    console.log('createAssetTransaction: inputs or outputs are empty after coinSelectAsset')
    // Return the complete error object from coinselect
    return assetSelectResult
  }

  let burnAllocationValue
  if (utils.isAllocationBurn(txVersion)) {
    // ensure only 1 to 2 outputs (2 if change was required)
    if (outputs.length > 2 && outputs.length < 1) {
      console.log('Assetallocationburn: expect output of length 1 got: ' + outputs.length)
      return {
        error: 'INVALID_OUTPUT_COUNT',
        message: 'Assetallocationburn: expect output of length 1 got: ' + outputs.length
      }
    }
    const assetAllocation = assetAllocations.find(voutAsset => voutAsset.assetGuid === outputs[0].assetInfo.assetGuid)
    if (assetAllocation === undefined) {
      console.log('Assetallocationburn: assetAllocations map does not have key: ' + outputs[0].assetInfo.assetGuid)
      return {
        error: 'INVALID_ASSET_ALLOCATION',
        message: 'Assetallocationburn: assetAllocations map does not have key: ' + outputs[0].assetInfo.assetGuid
      }
    }
    burnAllocationValue = new BN(assetAllocation.values[0].value)
    // remove first output if there is more than one
    // it will be size of 1 if you burn the exact right amount you own (ie utxo has 5 sysx and you burn 5 sysx)
    // it will be size of 2 if you burn less than what you own (ie utxo has 5 sysx and you burn 4 sysx, 1 sysx should be change)
    if (outputs.length > 1) {
      outputs.splice(0, 1)
      // we removed the first index via slice above, so all N's at index 1 or above should be reduced by 1
      updateAllocationIndexes(assetAllocations, 0)
    } else {
      outputs[0].assetChangeIndex = undefined
    }
    // point first allocation to next output (burn output)
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
  const res = coinSelect.coinSelectAssetGas(assetAllocations, utxos.utxos, inputs, outputs, feeRate, txVersion, utxos.assets, assetMap)
  if (!res.inputs || !res.outputs) {
    console.log('createAssetTransaction: inputs or outputs are empty after coinSelectAssetGas')
    // Return the complete error object from coinselect
    return res
  }
  inputs = res.inputs
  outputs = res.outputs
  // once funded we should swap the first output asset amount to sys amount as we are burning sysx to sys in output 0
  if (utils.isAllocationBurn(txVersion)) {
    if (txVersion === utils.SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_SYSCOIN) {
      // modify output from asset value to syscoin value
      // first output is special it is the sys amount being minted
      outputs[0].value = burnAllocationValue
    }
  }
  // optimizeOutputs reorganizes outputs and we need to ensure we don't do this with burntosyscoin since its assumed first output has the sys value we need to create
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
  if (txVersion === utils.SYSCOIN_TX_VERSION_ALLOCATION_SEND) {
    // ensure ZDAG is only enable for transactions <= 1100 bytes
    const bytesAccum = coinSelect.utils.transactionBytes(inputs, outputs)
    // if size too large we ensure ZDAG isn't set by enabling RBF (disable ZDAG)
    if (bytesAccum > 1100) {
      if (!txOpts.rbf) {
        txOpts.rbf = true
      }
    }
  }
  if (txOpts.rbf) {
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

  // Get the actual fee and size
  const bytesAccum = coinSelect.utils.transactionBytes(inputs, outputs)

  return {
    success: true,
    txVersion,
    inputs,
    outputs,
    fee: res.fee,
    feeRate,
    size: bytesAccum
  }
}

function assetAllocationSend (txOpts, utxos, assetMap, sysChangeAddress, feeRate) {
  const txVersion = utils.SYSCOIN_TX_VERSION_ALLOCATION_SEND
  const dataAmount = ext.BN_ZERO
  let dataBuffer = null
  if (txOpts.memo) {
    if (!Buffer.isBuffer(txOpts.memo)) {
      console.log('Memo must be Buffer object')
      return {
        error: 'INVALID_MEMO',
        message: 'Memo must be Buffer object'
      }
    }
    const totalLen = txOpts.memo.length + txOpts.memoHeader.length
    if (!txOpts.memoHeader) {
      console.log('No Memo header defined')
      return {
        error: 'INVALID_MEMO',
        message: 'No Memo header defined'
      }
    }
    if (totalLen > 80) {
      console.log('Memo too big! Max is 80 bytes, found: ' + totalLen)
      return {
        error: 'INVALID_MEMO',
        message: 'Memo too big! Max is 80 bytes, found: ' + totalLen
      }
    }
    dataBuffer = Buffer.concat([txOpts.memoHeader, txOpts.memo])
  }
  return createAssetTransaction(txVersion, txOpts, utxos, dataBuffer, dataAmount, assetMap, sysChangeAddress, feeRate)
}

function assetAllocationBurn (assetOpts, txOpts, utxos, assetMap, sysChangeAddress, feeRate) {
  let txVersion = 0
  if (assetOpts.ethaddress.length > 0) {
    txVersion = utils.SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_ETHEREUM
  } else {
    txVersion = utils.SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_SYSCOIN
  }
  const dataAmount = ext.BN_ZERO
  const dataBuffer = syscoinBufferUtils.serializeAllocationBurn(assetOpts)
  return createAssetTransaction(txVersion, txOpts, utxos, dataBuffer, dataAmount, assetMap, sysChangeAddress, feeRate)
}

function assetAllocationMint (assetOpts, txOpts, utxos, assetMap, sysChangeAddress, feeRate) {
  const txVersion = utils.SYSCOIN_TX_VERSION_ALLOCATION_MINT
  const dataAmount = ext.BN_ZERO
  if (assetOpts.txparentnodes.length > utils.USHRT_MAX()) {
    console.log('tx parent nodes exceeds maximum allowable size of: ', utils.USHRT_MAX(), '. Found size: ', assetOpts.txparentnodes.length)
    return {
      error: 'INVALID_PARENT_NODES',
      message: 'tx parent nodes exceeds maximum allowable size of: ' + utils.USHRT_MAX() + '. Found size: ' + assetOpts.txparentnodes.length
    }
  }
  if (assetOpts.receiptparentnodes.length > utils.USHRT_MAX()) {
    console.log('receipt parent nodes exceeds maximum allowable size of: ', utils.USHRT_MAX(), '. Found size: ', assetOpts.receiptparentnodes.length)
    return {
      error: 'INVALID_PARENT_NODES',
      message: 'receipt parent nodes exceeds maximum allowable size of: ' + utils.USHRT_MAX() + '. Found size: ' + assetOpts.receiptparentnodes.length
    }
  }
  // find byte offset of tx data in the parent nodes
  assetOpts.txpos = assetOpts.txparentnodes.indexOf(assetOpts.txvalue)
  if (assetOpts.txpos === -1) {
    console.log('Could not find tx value in tx parent nodes')
    return {
      error: 'INVALID_TX_VALUE',
      message: 'Could not find tx value in tx parent nodes'
    }
  }
  // find byte offset of receipt data in the parent nodes
  assetOpts.receiptpos = assetOpts.receiptparentnodes.indexOf(assetOpts.receiptvalue)
  if (assetOpts.receiptpos === -1) {
    console.log('Could not find receipt value in receipt parent nodes')
    return {
      error: 'INVALID_RECEIPT_VALUE',
      message: 'Could not find receipt value in receipt parent nodes'
    }
  }
  const dataBuffer = syscoinBufferUtils.serializeMintSyscoin(assetOpts)
  return createAssetTransaction(txVersion, txOpts, utxos, dataBuffer, dataAmount, assetMap, sysChangeAddress, feeRate)
}

function syscoinBurnToAssetAllocation (txOpts, utxos, assetMap, sysChangeAddress, feeRate) {
  const txVersion = utils.SYSCOIN_TX_VERSION_SYSCOIN_BURN_TO_ALLOCATION
  const dataBuffer = null
  let dataAmount = ext.BN_ZERO
  const valueAssetObj = assetMap.values().next().value
  if (valueAssetObj.outputs.length > 0) {
    dataAmount = valueAssetObj.outputs[0].value
  }
  return createAssetTransaction(txVersion, txOpts, utxos, dataBuffer, dataAmount, assetMap, sysChangeAddress, feeRate)
}
function createPoDA (txOpts, utxos, sysChangeAddress, feeRate) {
  if (!txOpts.blobData || !txOpts.blobHash) {
    console.log('Could not find blob txOpt fields, cannot create PoDA transaction')
    return {
      error: 'INVALID_BLOB',
      message: 'Could not find blob txOpt fields, cannot create PoDA transaction'
    }
  }
  return createTransaction(txOpts, utxos, sysChangeAddress, [], feeRate)
}

function decodeRawTransaction (tx, network) {
  const decoded = {
    txid: tx.getId(),
    hash: tx.getHash().toString('hex'),
    version: tx.version,
    size: tx.byteLength(),
    vsize: tx.virtualSize(),
    weight: tx.weight(),
    locktime: tx.locktime,
    vin: [],
    vout: [],
    syscoin: null
  }

  // Decode inputs
  tx.ins.forEach((input, index) => {
    const vin = {
      txid: Buffer.from(input.hash).reverse().toString('hex'),
      vout: input.index,
      scriptSig: {
        asm: bitcoin.script.toASM(input.script),
        hex: input.script.toString('hex')
      },
      sequence: input.sequence
    }

    // Add witness data if present
    if (input.witness && input.witness.length > 0) {
      vin.txinwitness = input.witness.map(w => w.toString('hex'))
    }

    decoded.vin.push(vin)
  })

  // Decode outputs
  tx.outs.forEach((output, index) => {
    const vout = {
      value: output.value / 100000000, // Convert satoshis to coins
      n: index,
      scriptPubKey: {
        asm: bitcoin.script.toASM(output.script),
        hex: output.script.toString('hex'),
        type: getOutputType(output.script),
        reqSigs: getRequiredSigs(output.script),
        addresses: getOutputAddresses(output.script, network)
      }
    }
    decoded.vout.push(vout)
  })

  // Decode Syscoin-specific data
  decoded.syscoin = decodeSyscoinData(tx)

  return decoded
}

function getOutputType (script) {
  try {
    const chunks = bitcoin.script.decompile(script)
    if (!chunks) return 'nonstandard'

    // OP_RETURN
    if (chunks[0] === bitcoinops.OP_RETURN) {
      return 'nulldata'
    }

    // P2PKH
    if (chunks.length === 5 &&
        chunks[0] === bitcoinops.OP_DUP &&
        chunks[1] === bitcoinops.OP_HASH160 &&
        Buffer.isBuffer(chunks[2]) &&
        chunks[2].length === 20 &&
        chunks[3] === bitcoinops.OP_EQUALVERIFY &&
        chunks[4] === bitcoinops.OP_CHECKSIG) {
      return 'pubkeyhash'
    }

    // P2SH
    if (chunks.length === 3 &&
        chunks[0] === bitcoinops.OP_HASH160 &&
        Buffer.isBuffer(chunks[1]) &&
        chunks[1].length === 20 &&
        chunks[2] === bitcoinops.OP_EQUAL) {
      return 'scripthash'
    }

    // P2WPKH
    if (chunks.length === 2 &&
        chunks[0] === bitcoinops.OP_0 &&
        Buffer.isBuffer(chunks[1]) &&
        chunks[1].length === 20) {
      return 'witness_v0_keyhash'
    }

    // P2WSH
    if (chunks.length === 2 &&
        chunks[0] === bitcoinops.OP_0 &&
        Buffer.isBuffer(chunks[1]) &&
        chunks[1].length === 32) {
      return 'witness_v0_scripthash'
    }

    // P2PK
    if (chunks.length === 2 &&
        Buffer.isBuffer(chunks[0]) &&
        (chunks[0].length === 33 || chunks[0].length === 65) &&
        chunks[1] === bitcoinops.OP_CHECKSIG) {
      return 'pubkey'
    }

    // Multisig
    if (chunks.length >= 4 &&
        chunks[chunks.length - 1] === bitcoinops.OP_CHECKMULTISIG) {
      return 'multisig'
    }

    return 'nonstandard'
  } catch (error) {
    return 'nonstandard'
  }
}

function getRequiredSigs (script) {
  try {
    const chunks = bitcoin.script.decompile(script)
    if (!chunks) return null

    // Multisig
    if (chunks.length >= 4 &&
        chunks[chunks.length - 1] === bitcoinops.OP_CHECKMULTISIG) {
      const m = chunks[0]
      // Handle OP_1 through OP_16 opcodes
      if (typeof m === 'number') {
        if (m >= bitcoinops.OP_1 && m <= bitcoinops.OP_16) {
          return m - bitcoinops.OP_1 + 1
        } else if (m >= 1 && m <= 16) {
          return m
        }
      }
    }

    // Standard single sig types
    const type = getOutputType(script)
    if (['pubkeyhash', 'scripthash', 'witness_v0_keyhash', 'witness_v0_scripthash', 'pubkey'].includes(type)) {
      return 1
    }

    return null
  } catch (error) {
    return null
  }
}

function getOutputAddresses (script, network) {
  try {
    const chunks = bitcoin.script.decompile(script)
    if (!chunks) return []

    const type = getOutputType(script)
    const targetNetwork = network || utils.syscoinNetworks.mainnet

    switch (type) {
      case 'pubkeyhash':
        return [bitcoin.address.fromOutputScript(script, targetNetwork)]
      case 'scripthash':
        return [bitcoin.address.fromOutputScript(script, targetNetwork)]
      case 'witness_v0_keyhash':
        return [bitcoin.address.fromOutputScript(script, targetNetwork)]
      case 'witness_v0_scripthash':
        return [bitcoin.address.fromOutputScript(script, targetNetwork)]
      case 'multisig': {
        const addresses = []
        for (let i = 1; i < chunks.length - 2; i++) {
          if (Buffer.isBuffer(chunks[i])) {
            try {
              const pubkey = chunks[i]
              const hash = bitcoin.crypto.hash160(pubkey)
              addresses.push(bitcoin.address.toBase58Check(hash, targetNetwork.pubKeyHash))
            } catch (e) {
              // Skip invalid pubkeys
            }
          }
        }
        return addresses
      }
      default:
        return []
    }
  } catch (error) {
    return []
  }
}

function decodeSyscoinData (tx) {
  const syscoinData = {
    txtype: getSyscoinTxType(tx.version),
    version: tx.version,
    allocations: null,
    burn: null,
    mint: null,
    poda: null
  }

  try {
    // Decode asset allocations
    if (utils.isAssetAllocationTx(tx.version)) {
      const allocations = getAllocationsFromTx(tx)
      if (allocations) {
        syscoinData.allocations = {
          assets: allocations.map(allocation => ({
            assetGuid: allocation.assetGuid,
            values: allocation.values.map(value => ({
              n: value.n,
              value: value.value.toString(),
              valueFormatted: (value.value.toNumber() / 100000000).toFixed(8)
            }))
          }))
        }
      }
    }

    // Decode allocation burn data
    if (utils.isAllocationBurn(tx.version)) {
      const burnData = decodeBurnData(tx)
      if (burnData) {
        syscoinData.burn = burnData
      }
    }

    // Decode mint data
    if (tx.version === utils.SYSCOIN_TX_VERSION_ALLOCATION_MINT) {
      const mintData = decodeMintData(tx)
      if (mintData) {
        syscoinData.mint = mintData
      }
    }

    // Decode PoDA data
    if (utils.isPoDATx(tx.version)) {
      const podaData = getPoDAFromTx(tx)
      if (podaData) {
        syscoinData.poda = {
          blobHash: podaData.blobHash.toString('hex'),
          blobData: podaData.blobData ? podaData.blobData.toString('hex') : null
        }
      }
    }

    return syscoinData
  } catch (error) {
    console.log('Error decoding Syscoin data:', error)
    return syscoinData
  }
}

function getSyscoinTxType (version) {
  switch (version) {
    case utils.SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_SYSCOIN:
      return 'assetallocationburn_to_syscoin'
    case utils.SYSCOIN_TX_VERSION_SYSCOIN_BURN_TO_ALLOCATION:
      return 'syscoinburn_to_allocation'
    case utils.SYSCOIN_TX_VERSION_ALLOCATION_MINT:
      return 'assetallocation_mint'
    case utils.SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_ETHEREUM:
      return 'assetallocationburn_to_ethereum'
    case utils.SYSCOIN_TX_VERSION_ALLOCATION_SEND:
      return 'assetallocation_send'
    case utils.SYSCOIN_TX_VERSION_NEVM_DATA:
      return 'nevm_data'
    default:
      return version === 1 || version === 2 ? 'bitcoin' : 'unknown'
  }
}

function decodeBurnData (tx) {
  try {
    let opReturnScript = null
    for (let i = 0; i < tx.outs.length; i++) {
      const output = tx.outs[i]
      const chunks = bitcoin.script.decompile(output.script)
      if (chunks && chunks[0] === bitcoinops.OP_RETURN && chunks[1]) {
        opReturnScript = chunks[1]
        break
      }
    }

    if (!opReturnScript) {
      return null
    }

    const burnData = syscoinBufferUtils.deserializeAllocationBurn(opReturnScript, true)
    if (!burnData) {
      return null
    }

    return {
      ethaddress: burnData.ethaddress.toString('hex'),
      allocation: burnData.allocation
        ? burnData.allocation.map(allocation => ({
          assetGuid: allocation.assetGuid,
          values: allocation.values.map(value => ({
            n: value.n,
            value: value.value.toString(),
            valueFormatted: (value.value.toNumber() / 100000000).toFixed(8)
          }))
        }))
        : null
    }
  } catch (error) {
    console.log('Error decoding burn data:', error)
    return null
  }
}

function decodeMintData (tx) {
  try {
    let opReturnScript = null
    for (let i = 0; i < tx.outs.length; i++) {
      const output = tx.outs[i]
      const chunks = bitcoin.script.decompile(output.script)
      if (chunks && chunks[0] === bitcoinops.OP_RETURN && chunks[1]) {
        opReturnScript = chunks[1]
        break
      }
    }

    if (!opReturnScript) {
      return null
    }

    const mintData = syscoinBufferUtils.deserializeMintSyscoin(opReturnScript)
    if (!mintData) {
      return null
    }

    return {
      allocation: mintData.allocation
        ? mintData.allocation.map(allocation => ({
          assetGuid: allocation.assetGuid,
          values: allocation.values.map(value => ({
            n: value.n,
            value: value.value.toString(),
            valueFormatted: (value.value.toNumber() / 100000000).toFixed(8)
          }))
        }))
        : null,
      ethtxid: mintData.ethtxid.toString('hex'),
      blockhash: mintData.blockhash.toString('hex'),
      txpos: mintData.txpos,
      txparentnodes: mintData.txparentnodes.toString('hex'),
      txpath: mintData.txpath.toString('hex'),
      receiptpos: mintData.receiptpos,
      receiptparentnodes: mintData.receiptparentnodes.toString('hex'),
      txroot: mintData.txroot.toString('hex'),
      receiptroot: mintData.receiptroot.toString('hex')
    }
  } catch (error) {
    console.log('Error decoding mint data:', error)
    return null
  }
}

module.exports = {
  utils,
  coinSelect,
  bufferUtils: syscoinBufferUtils,
  createTransaction,
  createAssetTransaction,
  createPoDA,
  assetAllocationSend,
  assetAllocationBurn,
  assetAllocationMint,
  syscoinBurnToAssetAllocation,
  getAssetsFromTx,
  getAllocationsFromTx,
  getAllocationsFromOutputs,
  getPoDAFromOutputs,
  getPoDAFromTx,
  getAssetsFromOutputs,
  decodeRawTransaction,
  decodeSyscoinData,
  getSyscoinTxType
}
