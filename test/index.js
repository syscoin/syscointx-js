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
  const buf = Buffer.isBuffer(script) ? script : Buffer.from(script)
  const pos = buf.indexOf(memoHeader)
  if (pos >= 0) {
    return buf.slice(pos + memoHeader.length)
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
        return getMemoFromScript(Buffer.isBuffer(chunks[1]) ? chunks[1] : Buffer.from(chunks[1]), memoHeader)
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
      t.ok(res.success || res.error, 'Transaction completed')
      t.ok(res.fee !== undefined || res.error, 'Fee is returned or error occurred')
      t.same(res.outputs.length, f.expected.numOutputs)
      t.same(res.txVersion, f.version)
      res.outputs.forEach(output => {
        if (output.script) {
          // find opreturn
          const chunks = bitcoin.script.decompile(output.script)
          if (chunks[0] === bitcoinops.OP_RETURN) {
            const scriptBuf = Buffer.isBuffer(output.script) ? output.script : Buffer.from(output.script)
            t.same(scriptBuf, f.expected.script)
            const chunkBuf = Buffer.isBuffer(chunks[1]) ? chunks[1] : Buffer.from(chunks[1])
            const assetAllocations = syscoinBufferUtils.deserializeAssetAllocations(chunkBuf)
            t.same(assetAllocations, f.expected.asset.allocation)
          }
        }
      })
    } else if (f.version === utils.SYSCOIN_TX_VERSION_ALLOCATION_MINT) {
      utxos = sanitizeBlockbookUTXOs(utxos, syscoinNetworks.mainnet, txOpts, f.assetMap)
      const res = syscointx.assetAllocationMint(f.assetOpts, txOpts, utxos, f.assetMap, f.sysChangeAddress, f.feeRate)
      t.ok(res.success || res.error, 'Transaction completed')
      t.ok(res.fee !== undefined || res.error, 'Fee is returned or error occurred')
      t.same(res.outputs.length, f.expected.numOutputs)
      t.same(res.txVersion, f.version)
      res.outputs.forEach(output => {
        if (output.script) {
          // find opreturn
          const chunks = bitcoin.script.decompile(output.script)
          if (chunks[0] === bitcoinops.OP_RETURN) {
            const scriptBuf = Buffer.isBuffer(output.script) ? output.script : Buffer.from(output.script)
            t.same(scriptBuf, f.expected.script)
            const chunkBuf = Buffer.isBuffer(chunks[1]) ? chunks[1] : Buffer.from(chunks[1])
            const asset = syscoinBufferUtils.deserializeMintSyscoin(chunkBuf)
            t.same(asset, f.expected.asset)
            t.same(asset.allocation, f.expected.asset.allocation)
          }
        }
      })
    } else if (f.version === utils.SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_ETHEREUM || f.version === utils.SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_SYSCOIN) {
      utxos = sanitizeBlockbookUTXOs(utxos, syscoinNetworks.mainnet, txOpts, f.assetMap)
      const res = syscointx.assetAllocationBurn(f.assetOpts, txOpts, utxos, f.assetMap, f.sysChangeAddress, f.feeRate)
      t.ok(res.success || res.error, 'Transaction completed')
      t.ok(res.fee !== undefined || res.error, 'Fee is returned or error occurred')
      t.same(res.outputs.length, f.expected.numOutputs)
      t.same(res.txVersion, f.version)
      res.outputs.forEach(output => {
        if (output.script) {
          // find opreturn
          const chunks = bitcoin.script.decompile(output.script)
          if (chunks[0] === bitcoinops.OP_RETURN) {
            const scriptBuf = Buffer.isBuffer(output.script) ? output.script : Buffer.from(output.script)
            t.same(scriptBuf, f.expected.script)
            const chunkBuf = Buffer.isBuffer(chunks[1]) ? chunks[1] : Buffer.from(chunks[1])
            const asset = syscoinBufferUtils.deserializeAllocationBurn(chunkBuf)
            t.same(asset, f.expected.asset)
            t.same(asset.allocation, f.expected.asset.allocation)
          }
        }
      })
    } else if (f.version === utils.SYSCOIN_TX_VERSION_ALLOCATION_SEND) {
      utxos = sanitizeBlockbookUTXOs(utxos, syscoinNetworks.mainnet, txOpts, f.assetMap)
      const res = syscointx.assetAllocationSend(txOpts, utxos, f.assetMap, f.sysChangeAddress, f.feeRate)
      t.ok(res.success || res.error, 'Transaction completed')
      t.ok(res.fee !== undefined || res.error, 'Fee is returned or error occurred')
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
            const scriptBuf = Buffer.isBuffer(output.script) ? output.script : Buffer.from(output.script)
            t.same(scriptBuf, f.expected.script)
            const chunkBuf = Buffer.isBuffer(chunks[1]) ? chunks[1] : Buffer.from(chunks[1])
            const assetAllocations = syscoinBufferUtils.deserializeAssetAllocations(chunkBuf)
            if (f.expected.memo) {
              t.same(getMemoFromScript(chunkBuf, memoHeader), f.expected.memo)
            }
            t.same(assetAllocations, f.expected.asset.allocation)
          }
        }
      })
    } else if (f.version === utils.SYSCOIN_TX_VERSION_NEVM_DATA) {
      utxos = sanitizeBlockbookUTXOs(utxos, syscoinNetworks.mainnet, txOpts)
      const res = syscointx.createPoDA(txOpts, utxos, f.sysChangeAddress, f.feeRate)
      t.ok(res.success || res.error, 'Transaction completed')
      t.ok(res.fee !== undefined || res.error, 'Fee is returned or error occurred')
      t.same(res.outputs.length, f.expected.numOutputs)
      t.same(res.txVersion, f.version)
      res.outputs.forEach(output => {
        if (output.script) {
          // find opreturn
          const chunks = bitcoin.script.decompile(output.script)
          if (chunks[0] === bitcoinops.OP_RETURN) {
            const scriptBuf = Buffer.isBuffer(output.script) ? output.script : Buffer.from(output.script)
            t.same(scriptBuf, f.expected.script)
          }
        }
      })
    } else if (f.version === 2) {
      utxos = sanitizeBlockbookUTXOs(utxos, syscoinNetworks.mainnet, txOpts)
      const res = syscointx.createTransaction(txOpts, utxos, f.sysChangeAddress, f.outputs, f.feeRate)
      t.ok(res.success || res.error, 'Transaction completed')
      t.ok(res.fee !== undefined || res.error, 'Fee is returned or error occurred')
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
              const scriptBuf = Buffer.isBuffer(output.script) ? output.script : Buffer.from(output.script)
              t.same(scriptBuf, f.expected.script)
              const chunkBuf = Buffer.isBuffer(chunks[1]) ? chunks[1] : Buffer.from(chunks[1])
              const assetAllocations = syscoinBufferUtils.deserializeAssetAllocations(chunkBuf)
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

tape.test('test decode raw transaction - Bitcoin transaction', (assert) => {
  // Create a simple Bitcoin transaction for testing (v7 Transaction)
  const tx = new bitcoin.Transaction()
  tx.version = 2
  tx.addInput(Buffer.from('a04144c6561f9f851985d871f91384b8ee357cd47c3024736e5676eb2debb3f2', 'hex').reverse(), 0)

  // Create P2PKH outputs manually
  const p2pkhScript1 = bitcoin.script.compile([
    bitcoin.opcodes.OP_DUP,
    bitcoin.opcodes.OP_HASH160,
    Buffer.from('1234567890abcdef1234567890abcdef12345678', 'hex'),
    bitcoin.opcodes.OP_EQUALVERIFY,
    bitcoin.opcodes.OP_CHECKSIG
  ])
  const p2pkhScript2 = bitcoin.script.compile([
    bitcoin.opcodes.OP_DUP,
    bitcoin.opcodes.OP_HASH160,
    Buffer.from('abcdef1234567890abcdef1234567890abcdef12', 'hex'),
    bitcoin.opcodes.OP_EQUALVERIFY,
    bitcoin.opcodes.OP_CHECKSIG
  ])

  tx.addOutput(p2pkhScript1, BigInt(100000000))
  tx.addOutput(p2pkhScript2, BigInt(50000000))
  const decoded = syscointx.decodeRawTransaction(tx, syscoinNetworks.mainnet)

  assert.equal(decoded.version, 2)
  assert.equal(decoded.syscoin.txtype, 'bitcoin')
  assert.equal(decoded.syscoin.allocations, null)
  assert.equal(decoded.syscoin.burn, null)
  assert.equal(decoded.syscoin.mint, null)
  assert.equal(decoded.syscoin.poda, null)
  assert.equal(decoded.vin.length, 1)
  assert.equal(decoded.vout.length, 2)
  assert.equal(decoded.vout[0].scriptPubKey.type, 'pubkeyhash')
  assert.equal(decoded.vout[1].scriptPubKey.type, 'pubkeyhash')
  assert.end()
})

tape.test('test decode raw transaction - Asset Allocation Send', (assert) => {
  // Asset allocation send transaction with memo
  const txHex = '8e000000000101d4de2a743378a40229f180bda29c701ec5761b95c2bb54b049937b4d02e894130300000000ffffffff04a8020000000000001600140b26e3403eeccdcf176b8c041ee99abf23e676e2a8020000000000001600144a1a3fb9007e655786946f3bac7bc2157bac56a60000000000000000676a4c640180a283a46703000f0111038ecde3c865411f21c18a05a3869649ffd01d335cebe56326b832ee1876bc6d785dc594b08165136664789379df4305bb09cefb23d1a743569e6fb1ec04923fbce2f7b9efde4104fefeafafafaf6d656d6f207465737420326a1a8747020000001600147dccd91471590db1eb4bcddb7bfe34fd076af31d02473044022032ea8f812ea8783aa8a436484b262e75b79c9b1f0677e8e4ddb41ee0e984e64102201f710f31e1c7a1a2be7994a556e8c094c7632b3bc926890c44643626b523dea101210288644767b596e5781bcc840fdbdf730bed12d4e0962e842b27ab8276ab409f4800000000'
  const tx = bitcoin.Transaction.fromHex(txHex)
  const decoded = syscointx.decodeRawTransaction(tx)

  assert.equal(decoded.version, 142) // SYSCOIN_TX_VERSION_ALLOCATION_SEND
  assert.equal(decoded.syscoin.txtype, 'assetallocation_send')
  assert.equal(decoded.syscoin.allocations !== null, true)
  assert.equal(decoded.syscoin.allocations.assets.length, 1)
  assert.equal(decoded.syscoin.allocations.assets[0].assetGuid, '341906151')
  assert.equal(decoded.vout.length, 4)
  assert.equal(decoded.vout[2].scriptPubKey.type, 'nulldata') // OP_RETURN output
  assert.end()
})

tape.test('test decode raw transaction - Allocation Burn to Ethereum', (assert) => {
  // Create a mock allocation burn transaction
  const txBurn = new bitcoin.Transaction()
  txBurn.version = 141 // SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_ETHEREUM
  const dummyHash = Buffer.from('a04144c6561f9f851985d871f91384b8ee357cd47c3024736e5676eb2debb3f2', 'hex').reverse()
  txBurn.addInput(dummyHash, 0)

  // Add input
  // addInput done above

  // Create mock allocation data
  const assetAllocations = [{
    assetGuid: '12345',
    values: [{ n: 0, value: new BN(100000000) }]
  }]

  // Serialize the allocations first
  const assetAllocationsBuffer = syscoinBufferUtils.serializeAssetAllocations(assetAllocations)

  // Add burn data
  const burnData = {
    ethaddress: Buffer.from('1234567890abcdef1234567890abcdef12345678', 'hex')
  }
  const burnBuffer = syscoinBufferUtils.serializeAllocationBurn(burnData)

  // Combine allocation and burn data
  const combinedBuffer = Buffer.concat([assetAllocationsBuffer, burnBuffer])
  const dataScript = bitcoin.payments.embed({ data: [combinedBuffer] }).output
  txBurn.addOutput(dataScript, BigInt(0))

  const tx = txBurn
  const decoded = syscointx.decodeRawTransaction(tx, syscoinNetworks.mainnet)

  assert.equal(decoded.version, 141)
  assert.equal(decoded.syscoin.txtype, 'assetallocationburn_to_ethereum')
  assert.equal(decoded.syscoin.burn !== null, true)
  assert.equal(decoded.syscoin.burn.ethaddress, '1234567890abcdef1234567890abcdef12345678')
  assert.end()
})

tape.test('test decode raw transaction - PoDA Transaction', (assert) => {
  // Create a mock PoDA transaction
  const txPoda = new bitcoin.Transaction()
  txPoda.version = 137 // SYSCOIN_TX_VERSION_NEVM_DATA

  // Add input
  const dummyHash2 = Buffer.from('a04144c6561f9f851985d871f91384b8ee357cd47c3024736e5676eb2debb3f2', 'hex').reverse()
  txPoda.addInput(dummyHash2, 0)

  // Add output with PoDA data
  const podaData = {
    blobHash: Buffer.from('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', 'hex')
  }
  const podaBuffer = syscoinBufferUtils.serializePoDA(podaData)
  const dataScript = bitcoin.payments.embed({ data: [podaBuffer] }).output
  txPoda.addOutput(dataScript, BigInt(0))

  const tx = txPoda
  const decoded = syscointx.decodeRawTransaction(tx, syscoinNetworks.mainnet)

  assert.equal(decoded.version, 137)
  assert.equal(decoded.syscoin.txtype, 'nevm_data')
  assert.equal(decoded.syscoin.poda !== null, true)
  assert.equal(decoded.syscoin.poda.blobHash, '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef')
  assert.end()
})

tape.test('test decode raw transaction - Multisig Transaction', (assert) => {
  // Create a 2-of-3 multisig transaction
  const pubkeys = [
    Buffer.from('03a34b99f22c790c4e36b2b3c2c35a36db06226e41c692fc82b8b56ac1c540c5bd', 'hex'),
    Buffer.from('035e12a1d23de75b7abff96cb6c2a7b3d6c5e9b8a3c5d8e4f1b2a3d4c5e6f7a8b9', 'hex'),
    Buffer.from('028f2c80e2b7c8a9b6c5d4e3f2a1b9c8d7e6f5a4b3c2d1e0f9e8d7c6b5a4f3e2', 'hex')
  ]

  const multisigScript = bitcoin.script.compile([
    bitcoin.opcodes.OP_2,
    ...pubkeys,
    bitcoin.opcodes.OP_3,
    bitcoin.opcodes.OP_CHECKMULTISIG
  ])

  const txMulti = new bitcoin.Transaction()
  const dummyHash3 = Buffer.from('a04144c6561f9f851985d871f91384b8ee357cd47c3024736e5676eb2debb3f2', 'hex').reverse()
  txMulti.addInput(dummyHash3, 0)
  txMulti.addOutput(multisigScript, BigInt(100000000))

  const tx = txMulti
  const decoded = syscointx.decodeRawTransaction(tx, syscoinNetworks.mainnet)

  assert.equal(decoded.vout[0].scriptPubKey.type, 'multisig')
  assert.equal(decoded.vout[0].scriptPubKey.reqSigs, 2)
  assert.equal(decoded.vout[0].scriptPubKey.addresses.length, 3)
  assert.end()
})

tape.test('test decode raw transaction - P2WPKH Transaction', (assert) => {
  // Create a P2WPKH transaction using raw Transaction
  const txWpkh = new bitcoin.Transaction()
  const dummyHash4 = Buffer.from('a04144c6561f9f851985d871f91384b8ee357cd47c3024736e5676eb2debb3f2', 'hex').reverse()
  txWpkh.addInput(dummyHash4, 0)

  // P2WPKH output (witness v0 keyhash)
  const witnessScript = bitcoin.script.compile([
    bitcoin.opcodes.OP_0,
    Buffer.from('1234567890abcdef1234567890abcdef12345678', 'hex')
  ])
  txWpkh.addOutput(witnessScript, BigInt(50000000))

  const tx = txWpkh
  const decoded = syscointx.decodeRawTransaction(tx, syscoinNetworks.mainnet)

  assert.equal(decoded.vout[0].scriptPubKey.type, 'witness_v0_keyhash')
  assert.equal(decoded.vout[0].scriptPubKey.reqSigs, 1)
  assert.end()
})

tape.test('test decode syscoin transaction types', (assert) => {
  // Test all Syscoin transaction type mappings
  assert.equal(syscointx.getSyscoinTxType(138), 'assetallocationburn_to_syscoin')
  assert.equal(syscointx.getSyscoinTxType(139), 'syscoinburn_to_allocation')
  assert.equal(syscointx.getSyscoinTxType(140), 'assetallocation_mint')
  assert.equal(syscointx.getSyscoinTxType(141), 'assetallocationburn_to_ethereum')
  assert.equal(syscointx.getSyscoinTxType(142), 'assetallocation_send')
  assert.equal(syscointx.getSyscoinTxType(137), 'nevm_data')
  assert.equal(syscointx.getSyscoinTxType(1), 'bitcoin')
  assert.equal(syscointx.getSyscoinTxType(2), 'bitcoin')
  assert.equal(syscointx.getSyscoinTxType(999), 'unknown')
  assert.end()
})
tape.test('test decode transaction with witness data', (assert) => {
  // Create a transaction with witness data
  const txWit = new bitcoin.Transaction()
  const dummyHash5 = Buffer.from('a04144c6561f9f851985d871f91384b8ee357cd47c3024736e5676eb2debb3f2', 'hex').reverse()
  txWit.addInput(dummyHash5, 0)

  // Create P2PKH output manually
  const p2pkhScript = bitcoin.script.compile([
    bitcoin.opcodes.OP_DUP,
    bitcoin.opcodes.OP_HASH160,
    Buffer.from('1234567890abcdef1234567890abcdef12345678', 'hex'),
    bitcoin.opcodes.OP_EQUALVERIFY,
    bitcoin.opcodes.OP_CHECKSIG
  ])
  txWit.addOutput(p2pkhScript, BigInt(50000000))

  const tx = txWit

  // Manually add witness data for testing
  tx.ins[0].witness = [
    Buffer.from('304402203e4b8d5a2c9e7f1a8b6c5d4e3f2a1b9c8d7e6f5a4b3c2d1e0f9e8d7c6b5a4f3e022012345678901234567890123456789012345678901234567890123456789012', 'hex'),
    Buffer.from('03a34b99f22c790c4e36b2b3c2c35a36db06226e41c692fc82b8b56ac1c540c5bd', 'hex')
  ]

  const decoded = syscointx.decodeRawTransaction(tx, syscoinNetworks.mainnet)

  assert.equal(decoded.vin[0].txinwitness && decoded.vin[0].txinwitness.length, 2)
  assert.equal(decoded.vin[0].txinwitness && decoded.vin[0].txinwitness[0], '304402203e4b8d5a2c9e7f1a8b6c5d4e3f2a1b9c8d7e6f5a4b3c2d1e0f9e8d7c6b5a4f3e022012345678901234567890123456789012345678901234567890123456789012')
  assert.equal(decoded.vin[0].txinwitness && decoded.vin[0].txinwitness[1], '03a34b99f22c790c4e36b2b3c2c35a36db06226e41c692fc82b8b56ac1c540c5bd')
  assert.end()
})
