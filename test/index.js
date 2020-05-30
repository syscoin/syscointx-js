var syscointx = require('..')
var fixtures = require('./fixtures')
var tape = require('tape')
var utils = require('../utils')

fixtures.forEach(function (f) {
  tape(f.description, function (t) {
    var utxos = utils.sanitizeBlockbookUTXOs(f.utxos)
    var txOutputs = []
    if (f.version === utils.SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_SYSCOIN) {
      const psbt = syscointx.assetAllocationBurn(false, utxos, f.assetMap, f.sysChangeAddress, f.feeRate)
      txOutputs = psbt.txOutputs
    } else if (f.version === utils.SYSCOIN_TX_VERSION_SYSCOIN_BURN_TO_ALLOCATION) {
      const psbt = syscointx.syscoinBurnToAssetAllocation(utxos, f.assetMap, f.sysChangeAddress, f.dataAmount, f.feeRate)
      txOutputs = psbt.txOutputs
    } else if (f.version === utils.SYSCOIN_TX_VERSION_ASSET_ACTIVATE) {
      const psbt = syscointx.assetNew(f.assetOpts, f.assetOptsOptional, utxos, f.sysChangeAddress, f.feeRate)
      txOutputs = psbt.txOutputs
    } else if (f.version === utils.SYSCOIN_TX_VERSION_ASSET_UPDATE) {
      const psbt = syscointx.assetUpdate(f.assetOpts, utxos, f.assetMap, f.sysChangeAddress, f.feeRate)
      txOutputs = psbt.txOutputs
    } else if (f.version === utils.SYSCOIN_TX_VERSION_ASSET_SEND) {
      const psbt = syscointx.assetSend(utxos, f.assetMap, f.sysChangeAddress, f.feeRate)
      txOutputs = psbt.txOutputs
    } else if (f.version === utils.SYSCOIN_TX_VERSION_ALLOCATION_MINT) {
      const psbt = syscointx.assetAllocationMint(f.mintSyscoin, utxos, f.assetMap, f.sysChangeAddress, f.feeRate)
      txOutputs = psbt.txOutputs
    } else if (f.version === utils.SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_ETHEREUM) {
      const psbt = syscointx.assetAllocationBurn(true, utxos, f.assetMap, f.sysChangeAddress, f.feeRate)
      txOutputs = psbt.txOutputs
    } else if (f.version === utils.SYSCOIN_TX_VERSION_ALLOCATION_SEND) {
      const psbt = syscointx.assetAllocationSend(utxos, f.assetMap, f.sysChangeAddress, f.feeRate)
      txOutputs = psbt.txOutputs
    }

    txOutputs.forEach(output => {
      // find opreturn
      if (output.script[0] === 0x6a) {
        t.same(output.script.toString('hex'), f.expected.script.toString())
      }
    })
    t.end()
  })
})
