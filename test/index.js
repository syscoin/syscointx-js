
var syscointx = require('..')
var fixtures = require('./fixtures')
var tape = require('tape')
var utils = require('../utils')
const bitcoin = require('bitcoinjs-lib')
const bitcoinops = require('bitcoin-ops')
const syscoinBufferUtils = require('../bufferutilsassets.js')
const BN = require('bn.js')
// test compress/uncompress
function testPair (dec, enc) {
  return utils.compressAmount(dec).eq(enc) &&
  utils.decompressAmount(enc).eq(dec)
}
tape.test('Assertions with tape.', (assert) => {
  assert.equal(testPair(new BN(0), new BN(0x0)), true)
  assert.equal(testPair(new BN(1), new BN(0x1)), true)
  assert.equal(testPair(new BN(utils.CENT), new BN(0x7)), true)
  assert.equal(testPair(new BN(utils.COIN), new BN(0x9)), true)
  assert.equal(testPair(new BN(16 * utils.COIN), new BN(149)), true)
  assert.equal(testPair(new BN(50 * utils.COIN), new BN(0x32)), true)
  assert.equal(testPair(new BN(21000000).mul(new BN(utils.COIN)), new BN(0x1406f40)), true)
  assert.end()
})
fixtures.forEach(function (f) {
  tape(f.description, function (t) {
    var utxos = f.utxoObj
    if (f.version === utils.SYSCOIN_TX_VERSION_SYSCOIN_BURN_TO_ALLOCATION) {
      const res = syscointx.syscoinBurnToAssetAllocation(utxos, f.assetMap, f.sysChangeAddress, f.dataAmount, f.feeRate)
      t.same(res.outputs.length, f.expected.numOutputs)
      t.same(res.txVersion, f.version)
      res.outputs.forEach(output => {
        if (output.script) {
          // find opreturn
          const chunks = bitcoin.script.decompile(output.script)
          if (chunks[0] === bitcoinops.OP_RETURN) {
            t.same(output.script, f.expected.script)
            const assetAllocations = syscoinBufferUtils.deserializeAssetAllocations(chunks[1])
            t.same(assetAllocations, f.expected.asset.allocation)
          }
        }
      })
    } else if (f.version === utils.SYSCOIN_TX_VERSION_ASSET_ACTIVATE) {
      const res = syscointx.assetNew(f.assetOpts, utxos, f.sysChangeAddress, f.feeRate)
      t.same(res.outputs.length, f.expected.numOutputs)
      t.same(res.txVersion, f.version)
      res.outputs.forEach(output => {
        if (output.script) {
          // find opreturn
          const chunks = bitcoin.script.decompile(output.script)
          if (chunks[0] === bitcoinops.OP_RETURN) {
            t.same(output.script, f.expected.script)
            const asset = syscoinBufferUtils.deserializeAsset(chunks[1])
            t.same(asset, f.expected.asset)
            t.same(asset.allocation, f.expected.asset.allocation)
          }
        }
      })
    } else if (f.version === utils.SYSCOIN_TX_VERSION_ASSET_UPDATE) {
      const res = syscointx.assetUpdate(f.assetGuid, f.assetOpts, utxos, f.assetMap, f.sysChangeAddress, f.feeRate)
      t.same(res.outputs.length, f.expected.numOutputs)
      t.same(res.txVersion, f.version)
      res.outputs.forEach(output => {
        if (output.script) {
          // find opreturn
          const chunks = bitcoin.script.decompile(output.script)
          if (chunks[0] === bitcoinops.OP_RETURN) {
            t.same(output.script, f.expected.script)
            const asset = syscoinBufferUtils.deserializeAsset(chunks[1])
            t.same(asset, f.expected.asset)
            t.same(asset.allocation, f.expected.asset.allocation)
          }
        }
      })
    } else if (f.version === utils.SYSCOIN_TX_VERSION_ASSET_SEND) {
      const res = syscointx.assetSend(utxos, f.assetMap, f.sysChangeAddress, f.feeRate)
      t.same(res.outputs.length, f.expected.numOutputs)
      t.same(res.txVersion, f.version)
      res.outputs.forEach(output => {
        if (output.script) {
          // find opreturn
          const chunks = bitcoin.script.decompile(output.script)
          if (chunks[0] === bitcoinops.OP_RETURN) {
            t.same(output.script, f.expected.script)
            const assetAllocations = syscoinBufferUtils.deserializeAssetAllocations(chunks[1])
            t.same(assetAllocations, f.expected.asset.allocation)
          }
        }
      })
    } else if (f.version === utils.SYSCOIN_TX_VERSION_ALLOCATION_MINT) {
      const res = syscointx.assetAllocationMint(f.assetOpts, utxos, f.assetMap, f.sysChangeAddress, f.feeRate)
      t.same(res.outputs.length, f.expected.numOutputs)
      t.same(res.txVersion, f.version)
      res.outputs.forEach(output => {
        if (output.script) {
          // find opreturn
          const chunks = bitcoin.script.decompile(output.script)
          if (chunks[0] === bitcoinops.OP_RETURN) {
            t.same(output.script, f.expected.script)
            const asset = syscoinBufferUtils.deserializeAllocationBurnToEthereum(chunks[1])
            t.same(asset, f.expected.asset)
            t.same(asset.allocation, f.expected.asset.allocation)
          }
        }
      })
    } else if (f.version === utils.SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_ETHEREUM || f.version === utils.SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_SYSCOIN) {
      const res = syscointx.assetAllocationBurn(f.assetOpts, utxos, f.assetMap, f.sysChangeAddress, f.feeRate)
      t.same(res.outputs.length, f.expected.numOutputs)
      t.same(res.txVersion, f.version)
      res.outputs.forEach(output => {
        if (output.script) {
          // find opreturn
          const chunks = bitcoin.script.decompile(output.script)
          if (chunks[0] === bitcoinops.OP_RETURN) {
            t.same(output.script, f.expected.script)
            const asset = syscoinBufferUtils.deserializeAllocationBurnToEthereum(chunks[1])
            t.same(asset, f.expected.asset)
            t.same(asset.allocation, f.expected.asset.allocation)
          }
        }
      })
    } else if (f.version === utils.SYSCOIN_TX_VERSION_ALLOCATION_SEND) {
      const res = syscointx.assetAllocationSend(utxos, f.assetMap, f.sysChangeAddress, f.feeRate)
      t.same(res.outputs.length, f.expected.numOutputs)
      t.same(res.txVersion, f.version)
      res.outputs.forEach(output => {
        if (output.script) {
          // find opreturn
          const chunks = bitcoin.script.decompile(output.script)
          if (chunks[0] === bitcoinops.OP_RETURN) {
            t.same(output.script, f.expected.script)
            const assetAllocations = syscoinBufferUtils.deserializeAssetAllocations(chunks[1])
            t.same(assetAllocations, f.expected.asset.allocation)
          }
        }
      })
    } else if (f.version === 2) {
      const res = syscointx.createTransaction(utxos, f.sysChangeAddress, f.outputs, f.feeRate)
      t.same(res.outputs.length, f.expected.numOutputs)
      t.same(res.txVersion, f.expected.version)
      res.outputs.forEach(output => {
        if (output.script) {
          // find opreturn
          const chunks = bitcoin.script.decompile(output.script)
          if (chunks[0] === bitcoinops.OP_RETURN) {
            t.same(output.script, f.expected.script)
            const assetAllocations = syscoinBufferUtils.deserializeAssetAllocations(chunks[1])
            t.same(assetAllocations, f.expected.asset.allocation)
          }
        }
      })
    }
    t.end()
  })
})
