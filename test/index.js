
var syscointx = require('..')
var fixtures = require('./fixtures')
var tape = require('tape')
var utils = require('../utils')
const bitcoin = require('bitcoinjs-lib')
const bitcoinops = require('bitcoin-ops')
const syscoinBufferUtils = require('../bufferutilsassets.js')
const BN = require('bn.js')
function compareMaps (map1, map2) {
  var testVal
  if (map1.size !== map2.size) {
    return false
  }
  for (var [key, val] of map1) {
    testVal = map2.get(key)
    // in cases of an undefined value, make sure the key
    // actually exists on the object so there are no false positives
    if (JSON.stringify(testVal) !== JSON.stringify(val) || (testVal === undefined && !map2.has(key))) {
      return false
    }
  }
  return true
}
// test compress/uncompress
function testPair (dec, enc) {
  return syscoinBufferUtils.compressAmount(dec).eq(enc) &&
  syscoinBufferUtils.decompressAmount(enc).eq(dec)
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
    var utxos = utils.sanitizeBlockbookUTXOs(f.utxos)
    var txOutputs = []
    if (f.version === utils.SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_SYSCOIN) {
      const psbt = syscointx.assetAllocationBurn(f.assetOpts, utxos, f.assetMap, f.sysChangeAddress, f.feeRate)
      txOutputs = psbt.txOutputs
      t.same(txOutputs.length, f.expected.numOutputs)
      txOutputs.forEach(output => {
        // find opreturn
        const chunks = bitcoin.script.decompile(output.script)
        if (chunks[0] === bitcoinops.OP_RETURN) {
          t.same(output.script, f.expected.script)
          const assetAllocations = syscoinBufferUtils.deserializeAssetAllocations(chunks[1])
          t.same(compareMaps(assetAllocations, f.expected.asset.allocation), true)
        }
      })
    } else if (f.version === utils.SYSCOIN_TX_VERSION_SYSCOIN_BURN_TO_ALLOCATION) {
      const psbt = syscointx.syscoinBurnToAssetAllocation(utxos, f.assetMap, f.sysChangeAddress, f.dataAmount, f.feeRate)
      txOutputs = psbt.txOutputs
      t.same(txOutputs.length, f.expected.numOutputs)
      txOutputs.forEach(output => {
        // find opreturn
        const chunks = bitcoin.script.decompile(output.script)
        if (chunks[0] === bitcoinops.OP_RETURN) {
          t.same(output.script, f.expected.script)
          const assetAllocations = syscoinBufferUtils.deserializeAssetAllocations(chunks[1])
          t.same(compareMaps(assetAllocations, f.expected.asset.allocation), true)
        }
      })
    } else if (f.version === utils.SYSCOIN_TX_VERSION_ASSET_ACTIVATE) {
      const psbt = syscointx.assetNew(f.assetOpts, f.assetOptsOptional, utxos, f.sysChangeAddress, f.feeRate)
      txOutputs = psbt.txOutputs
      t.same(txOutputs.length, f.expected.numOutputs)
      txOutputs.forEach(output => {
        // find opreturn
        const chunks = bitcoin.script.decompile(output.script)
        if (chunks[0] === bitcoinops.OP_RETURN) {
          t.same(output.script, f.expected.script)
          const asset = syscoinBufferUtils.deserializeAsset(chunks[1])
          t.same(asset, f.expected.asset)
          t.same(compareMaps(asset.allocation, f.expected.asset.allocation), true)
        }
      })
    } else if (f.version === utils.SYSCOIN_TX_VERSION_ASSET_UPDATE) {
      const psbt = syscointx.assetUpdate({}, f.assetOpts, f.assetOptsOptional, utxos, f.assetMap, f.sysChangeAddress, f.feeRate)
      txOutputs = psbt.txOutputs
      t.same(txOutputs.length, f.expected.numOutputs)
      txOutputs.forEach(output => {
        // find opreturn
        const chunks = bitcoin.script.decompile(output.script)
        if (chunks[0] === bitcoinops.OP_RETURN) {
          t.same(output.script, f.expected.script)
          const asset = syscoinBufferUtils.deserializeAsset(chunks[1])
          t.same(asset, f.expected.asset)
          t.same(compareMaps(asset.allocation, f.expected.asset.allocation), true)
        }
      })
    } else if (f.version === utils.SYSCOIN_TX_VERSION_ASSET_SEND) {
      const psbt = syscointx.assetSend(utxos, f.assetMap, f.sysChangeAddress, f.feeRate)
      txOutputs = psbt.txOutputs
      t.same(txOutputs.length, f.expected.numOutputs)
      txOutputs.forEach(output => {
        // find opreturn
        const chunks = bitcoin.script.decompile(output.script)
        if (chunks[0] === bitcoinops.OP_RETURN) {
          t.same(output.script, f.expected.script)
          const assetAllocations = syscoinBufferUtils.deserializeAssetAllocations(chunks[1])
          t.same(compareMaps(assetAllocations, f.expected.asset.allocation), true)
        }
      })
    } else if (f.version === utils.SYSCOIN_TX_VERSION_ALLOCATION_MINT) {
      const psbt = syscointx.assetAllocationMint(f.mintSyscoin, utxos, f.assetMap, f.sysChangeAddress, f.feeRate)
      txOutputs = psbt.txOutputs
      t.same(txOutputs.length, f.expected.numOutputs)
      txOutputs.forEach(output => {
        // find opreturn
        const chunks = bitcoin.script.decompile(output.script)
        if (chunks[0] === bitcoinops.OP_RETURN) {
          t.same(output.script, f.expected.script)
          const asset = syscoinBufferUtils.deserializeAllocationBurnToEthereum(chunks[1])
          t.same(asset, f.expected.asset)
          t.same(compareMaps(asset.allocation, f.expected.asset.allocation), true)
        }
      })
    } else if (f.version === utils.SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_ETHEREUM) {
      const psbt = syscointx.assetAllocationBurn(f.assetOpts, utxos, f.assetMap, f.sysChangeAddress, f.feeRate)
      txOutputs = psbt.txOutputs
      t.same(txOutputs.length, f.expected.numOutputs)
      txOutputs.forEach(output => {
        // find opreturn
        const chunks = bitcoin.script.decompile(output.script)
        if (chunks[0] === bitcoinops.OP_RETURN) {
          t.same(output.script, f.expected.script)
          const asset = syscoinBufferUtils.deserializeAllocationBurnToEthereum(chunks[1])
          t.same(asset, f.expected.asset)
          t.same(compareMaps(asset.allocation, f.expected.asset.allocation), true)
        }
      })
    } else if (f.version === utils.SYSCOIN_TX_VERSION_ALLOCATION_SEND) {
      const psbt = syscointx.assetAllocationSend(utxos, f.assetMap, f.sysChangeAddress, f.feeRate)
      txOutputs = psbt.txOutputs
      t.same(txOutputs.length, f.expected.numOutputs)
      txOutputs.forEach(output => {
        // find opreturn
        const chunks = bitcoin.script.decompile(output.script)
        if (chunks[0] === bitcoinops.OP_RETURN) {
          t.same(output.script, f.expected.script)
          const assetAllocations = syscoinBufferUtils.deserializeAssetAllocations(chunks[1])
          t.same(compareMaps(assetAllocations, f.expected.asset.allocation), true)
        }
      })
    }

    t.end()
  })
})
