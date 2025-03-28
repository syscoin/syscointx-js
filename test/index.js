
const syscointx = require('..')
const fixtures = require('./fixtures')
const tape = require('tape')
const utils = require('../utils')
const bitcoin = require('bitcoinjs-lib')
const bitcoinops = require('bitcoin-ops')
const syscoinBufferUtils = require('../bufferutilsassets.js')
const bufferUtils = require('../bufferutils')
const BN = require('bn.js')
// test uint64 BN write/read
function testPairUInt64 (number) {
  let tbuffer = Buffer.from([])
  tbuffer = Buffer.allocUnsafe(8)
  const bufferWriter = new bufferUtils.BufferWriter(tbuffer, 0)
  syscoinBufferUtils.writeUInt64LE(bufferWriter, number)
  tbuffer = tbuffer.slice(0, bufferWriter.offset)
  const bufferReader = new bufferUtils.BufferReader(tbuffer, 0)
  return syscoinBufferUtils.readUInt64LE(bufferReader).eq(number)
}
// test compress/uncompress
function testPair (dec, enc) {
  return utils.compressAmount(dec).eq(enc) &&
  utils.decompressAmount(enc).eq(dec)
}
const syscoinNetworks = {
  mainnet: {
    messagePrefix: '\x18Syscoin Signed Message:\n',
    bech32: 'bc',
    bip32: {
      public: 0x0488b21e,
      private: 0x0488ade4
    },
    pubKeyHash: 0x3f,
    scriptHash: 0x05,
    wif: 0x80
  },
  testnet: {
    messagePrefix: '\x18Syscoin Signed Message:\n',
    bech32: 'tsys',
    bip32: {
      public: 0x043587cf,
      private: 0x04358394
    },
    pubKeyHash: 0x41,
    scriptHash: 0xc4,
    wif: 0xef
  }
}
const memoHeader = Buffer.from([0xff, 0xff, 0xaf, 0xaf, 0xaa, 0xaa])

/* getMemoFromScript
Purpose: Return memo from a script, null otherwise
Param script: Required. OP_RETURN script output
Param memoHeader: Required. Prefix header to look for, application specific
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
Param memoHeader: Required. Prefix header to look for, application specific
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

function sanitizeBlockbookUTXOs (utxoObj, network, txOpts, assetMap, excludeZeroConf) {
  if (!txOpts) {
    txOpts = { rbf: false }
  }
  const sanitizedUtxos = { utxos: [] }
  if (Array.isArray(utxoObj)) {
    utxoObj.utxos = utxoObj
  }
  if (utxoObj.assets) {
    sanitizedUtxos.assets = new Map()
    utxoObj.assets.forEach(asset => {
      const assetObj = {}
      if (asset.contract) {
        asset.contract = asset.contract.replace(/^0x/, '')
        assetObj.contract = Buffer.from(asset.contract, 'hex')
      }
      assetObj.maxsupply = new BN(asset.maxSupply)
      assetObj.precision = asset.decimals
      sanitizedUtxos.assets.set(asset.assetGuid, assetObj)
    })
  }
  if (utxoObj.utxos) {
    utxoObj.utxos.forEach(utxo => {
      if (!utxo.address) {
        console.log('SKIPPING utxo: no address field defined')
        return
      }
      if (excludeZeroConf && utxo.confirmations <= 0) {
        return
      }
      const newUtxo = { type: 'LEGACY', address: utxo.address, txId: utxo.txid, path: utxo.path, vout: utxo.vout, value: new BN(utxo.value), locktime: utxo.locktime }
      if (newUtxo.address.startsWith(network.bech32)) {
        newUtxo.type = 'BECH32'
      }
      if (utxo.assetInfo) {
        newUtxo.assetInfo = { assetGuid: utxo.assetInfo.assetGuid, value: new BN(utxo.assetInfo.value) }
        const assetObj = sanitizedUtxos.assets.get(utxo.assetInfo.assetGuid)
        // sanity check to ensure sanitizedUtxos.assets has all of the assets being added to UTXO that are assets
        if (!assetObj) {
          return
        }
        // not sending this asset (assetMap) and assetWhiteList option if set with this asset will skip this check, by default this check is done and inputs will be skipped
        if ((!assetMap || !assetMap.has(utxo.assetInfo.assetGuid)) && (txOpts.assetWhiteList && !txOpts.assetWhiteList.has(utxo.assetInfo.assetGuid))) {
          console.log('SKIPPING utxo')
          return
        }
      }
      sanitizedUtxos.utxos.push(newUtxo)
    })
  }

  return sanitizedUtxos
}
tape.test('Assertions with tape.', (assert) => {
  assert.equal(testPairUInt64(new BN(0)), true)
  assert.equal(testPairUInt64(new BN(utils.CENT)), true)
  assert.equal(testPairUInt64(new BN(utils.COIN)), true)
  assert.equal(testPairUInt64(new BN(16 * utils.COIN)), true)
  assert.equal(testPairUInt64(new BN(50 * utils.COIN)), true)
  assert.equal(testPairUInt64(new BN(21000000).mul(new BN(utils.COIN))), true)
  // max uint64
  assert.equal(testPairUInt64(new BN('18446744073709551615')), true)
  assert.end()
})
tape.test('test uint64 ser/der with BN.', (assert) => {
  assert.equal(testPair(new BN(0), new BN(0x0)), true)
  assert.equal(testPair(new BN(1), new BN(0x1)), true)
  assert.equal(testPair(new BN(utils.CENT), new BN(0x7)), true)
  assert.equal(testPair(new BN(utils.COIN), new BN(0x9)), true)
  assert.equal(testPair(new BN(16 * utils.COIN), new BN(149)), true)
  assert.equal(testPair(new BN(50 * utils.COIN), new BN(0x32)), true)
  assert.equal(testPair(new BN(21000000).mul(new BN(utils.COIN)), new BN(0x1406f40)), true)
  assert.end()
})

tape.test('test extract memo.', (assert) => {
  // transaction hex that has all notary signatures already but we will re-confirm them by assert.equal(tx.toHex(), txHex)
  const txHex = '8e000000000101d4de2a743378a40229f180bda29c701ec5761b95c2bb54b049937b4d02e894130300000000ffffffff04a8020000000000001600140b26e3403eeccdcf176b8c041ee99abf23e676e2a8020000000000001600144a1a3fb9007e655786946f3bac7bc2157bac56a60000000000000000676a4c640180a283a46703000f0111038ecde3c865411f21c18a05a3869649ffd01d335cebe56326b832ee1876bc6d785dc594b08165136664789379df4305bb09cefb23d1a743569e6fb1ec04923fbce2f7b9efde4104fefeafafafaf6d656d6f207465737420326a1a8747020000001600147dccd91471590db1eb4bcddb7bfe34fd076af31d02473044022032ea8f812ea8783aa8a436484b262e75b79c9b1f0677e8e4ddb41ee0e984e64102201f710f31e1c7a1a2be7994a556e8c094c7632b3bc926890c44643626b523dea101210288644767b596e5781bcc840fdbdf730bed12d4e0962e842b27ab8276ab409f4800000000'
  const tx = bitcoin.Transaction.fromHex(txHex)
  assert.equal(syscointx.utils.isAssetAllocationTx(tx.version), true)
  const memo = getMemoFromOpReturn(tx.outs, Buffer.from([0xfe, 0xfe, 0xaf, 0xaf, 0xaf, 0xaf]))
  assert.equal(memo.toString(), 'memo test 2')
  assert.end()
})
fixtures.forEach(function (f) {
  tape(f.description, function (t) {
    let utxos = f.utxoObj
    let txOpts = f.txOpts
    if (!txOpts) {
      txOpts = { rbf: false }
    }
    if (f.version === utils.SYSCOIN_TX_VERSION_SYSCOIN_BURN_TO_ALLOCATION) {
      utxos = sanitizeBlockbookUTXOs(utxos, syscoinNetworks.mainnet, txOpts, f.assetMap)
      const res = syscointx.syscoinBurnToAssetAllocation(txOpts, utxos, f.assetMap, f.sysChangeAddress, f.feeRate)
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
      utxos = sanitizeBlockbookUTXOs(utxos, syscoinNetworks.mainnet, txOpts, f.assetMap)
      const res = syscointx.assetAllocationMint(f.assetOpts, txOpts, utxos, f.assetMap, f.sysChangeAddress, f.feeRate)
      t.same(res.outputs.length, f.expected.numOutputs)
      t.same(res.txVersion, f.version)
      res.outputs.forEach(output => {
        if (output.script) {
          // find opreturn
          const chunks = bitcoin.script.decompile(output.script)
          if (chunks[0] === bitcoinops.OP_RETURN) {
            t.same(output.script, f.expected.script)
            const asset = syscoinBufferUtils.deserializeMintSyscoin(chunks[1])
            t.same(asset, f.expected.asset)
            t.same(asset.allocation, f.expected.asset.allocation)
          }
        }
      })
    } else if (f.version === utils.SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_ETHEREUM || f.version === utils.SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_SYSCOIN) {
      utxos = sanitizeBlockbookUTXOs(utxos, syscoinNetworks.mainnet, txOpts, f.assetMap)
      const res = syscointx.assetAllocationBurn(f.assetOpts, txOpts, utxos, f.assetMap, f.sysChangeAddress, f.feeRate)
      t.same(res.outputs.length, f.expected.numOutputs)
      t.same(res.txVersion, f.version)
      res.outputs.forEach(output => {
        if (output.script) {
          // find opreturn
          const chunks = bitcoin.script.decompile(output.script)
          if (chunks[0] === bitcoinops.OP_RETURN) {
            t.same(output.script, f.expected.script)
            const asset = syscoinBufferUtils.deserializeAllocationBurn(chunks[1])
            t.same(asset, f.expected.asset)
            t.same(asset.allocation, f.expected.asset.allocation)
          }
        }
      })
    } else if (f.version === utils.SYSCOIN_TX_VERSION_ALLOCATION_SEND) {
      utxos = sanitizeBlockbookUTXOs(utxos, syscoinNetworks.mainnet, txOpts, f.assetMap)
      const res = syscointx.assetAllocationSend(txOpts, utxos, f.assetMap, f.sysChangeAddress, f.feeRate)
      t.same(res.outputs.length, f.expected.numOutputs)
      t.same(res.txVersion, f.version)
      if (txOpts.memo) {
        t.same(getMemoFromOpReturn(res.outputs, memoHeader), txOpts.memo)
      }
      res.outputs.forEach(output => {
        if (output.script) {
          // find opreturn
          const chunks = bitcoin.script.decompile(output.script)
          if (chunks[0] === bitcoinops.OP_RETURN) {
            t.same(output.script, f.expected.script)
            const assetAllocations = syscoinBufferUtils.deserializeAssetAllocations(chunks[1])
            if (f.expected.memo) {
              t.same(getMemoFromScript(chunks[1], memoHeader), f.expected.memo)
            }
            t.same(assetAllocations, f.expected.asset.allocation)
          }
        }
      })
    } else if (f.version === utils.SYSCOIN_TX_VERSION_NEVM_DATA) {
      utxos = sanitizeBlockbookUTXOs(utxos, syscoinNetworks.mainnet, txOpts)
      const res = syscointx.createPoDA(txOpts, utxos, f.sysChangeAddress, f.feeRate)
      t.same(res.outputs.length, f.expected.numOutputs)
      t.same(res.txVersion, f.version)
      res.outputs.forEach(output => {
        if (output.script) {
          // find opreturn
          const chunks = bitcoin.script.decompile(output.script)
          if (chunks[0] === bitcoinops.OP_RETURN) {
            t.same(output.script, f.expected.script)
          }
        }
      })
    } else if (f.version === 2) {
      utxos = sanitizeBlockbookUTXOs(utxos, syscoinNetworks.mainnet, txOpts)
      const res = syscointx.createTransaction(txOpts, utxos, f.sysChangeAddress, f.outputs, f.feeRate)
      t.same(res.outputs.length, f.expected.numOutputs)
      t.same(res.txVersion, f.expected.version)
      if (txOpts.memo) {
        t.same(getMemoFromOpReturn(res.outputs, memoHeader), txOpts.memo)
      }
      if (res.txVersion === utils.SYSCOIN_TX_VERSION_ALLOCATION_SEND) {
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
    }
    t.same(txOpts.rbf, f.expected.rbf)
    t.end()
  })
})
