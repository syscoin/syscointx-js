
const syscointx = require('..')
const fixtures = require('./fixtures')
const tape = require('tape')
const utils = require('../utils')
const bitcoin = require('bitcoinjs-lib')
const bitcoinops = require('bitcoin-ops')
const syscoinBufferUtils = require('../bufferutilsassets.js')
const bufferUtils = require('../bufferutils')
const BN = require('bn.js')
const coinSelect = require('coinselectsyscoin')
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
      if (asset.pubData) {
        assetObj.pubdata = Buffer.from(JSON.stringify(asset.pubData))
      }
      if (asset.notaryKeyID) {
        assetObj.notarykeyid = Buffer.from(asset.notaryKeyID, 'base64')
        network = network || syscoinNetworks.mainnet
        assetObj.notaryaddress = bitcoin.payments.p2wpkh({ hash: assetObj.notarykeyid, network: network }).address
        // in unit tests notarySig may be provided
        if (asset.notarySig) {
          assetObj.notarysig = Buffer.from(asset.notarySig, 'base64')
        } else {
          // prefill in this likely case where notarySig isn't provided
          assetObj.notarysig = Buffer.alloc(65, 0)
        }
      }
      if (asset.notaryDetails) {
        assetObj.notarydetails = {}
        if (asset.notaryDetails.endPoint) {
          assetObj.notarydetails.endpoint = Buffer.from(asset.notaryDetails.endPoint, 'base64')
        } else {
          assetObj.notarydetails.endpoint = Buffer.from('')
        }
        assetObj.notarydetails.instanttransfers = asset.notaryDetails.instantTransfers
        assetObj.notarydetails.hdrequired = asset.notaryDetails.HDRequired
      }
      if (asset.auxFeeDetails) {
        assetObj.auxfeedetails = {}
        if (asset.auxFeeDetails.auxFeeKeyID) {
          assetObj.auxfeedetails.auxfeekeyid = Buffer.from(asset.auxFeeDetails.auxFeeKeyID, 'base64')
          assetObj.auxfeedetails.auxfeeaddress = bitcoin.payments.p2wpkh({ hash: assetObj.auxfeedetails.auxfeekeyid, network: syscoinNetworks.testnet }).address
        } else {
          assetObj.auxfeedetails.auxfeekeyid = Buffer.from('')
        }
        assetObj.auxfeedetails.auxfees = asset.auxFeeDetails.auxFees
      }
      if (asset.updateCapabilityFlags) {
        assetObj.updatecapabilityflags = asset.updateCapabilityFlags
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
        const assetObj = sanitizedUtxos.assets.get(coinSelect.utils.getBaseAssetID(utxo.assetInfo.assetGuid))
        // sanity check to ensure sanitizedUtxos.assets has all of the assets being added to UTXO that are assets
        if (!assetObj) {
          return
        }
        // allowOtherNotarizedAssetInputs option if set will skip this check, by default this check is done and inputs will be skipped if they are notary asset inputs and user is not sending those assets (used as gas to fulfill requested output amount of SYS)
        if (!txOpts.allowOtherNotarizedAssetInputs) {
          // if notarization is required but it isn't a requested asset to send we skip this UTXO as would be dependent on a foreign asset notary
          if (assetObj.notarykeyid && assetObj.notarykeyid.length > 0) {
            const baseAssetID = coinSelect.utils.getBaseAssetID(utxo.assetInfo.assetGuid)
            // for allocation sends asset map may have NFT key for asset send it would have base key ID always
            if (!assetMap || (!assetMap.has(baseAssetID) && !assetMap.has(utxo.assetInfo.assetGuid))) {
              console.log('SKIPPING notary utxo')
              return
            }
          }
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
tape.test('test notary signing.', (assert) => {
  // transaction hex that has all notary signatures already but we will re-confirm them by assert.equal(tx.toHex(), txHex)
  const txHex = '87000000000106e073d118d57ec902a8ed14cdb96121f263c0ec6e4150222b73d0f8e664afc2c50000000000fdfffffffb6efdd4f7b12d61a2407ede92a269310bec83978f45c9f0bcf784b920b1da4f0000000000fdffffff22b5f7483a3fc80998660a19064cac2f6c9aeef9c2436c308e919880cdbd1d930000000000fdffffffe184c393f77c969e3ef1b6824bdae939d12c3bd4bb93f74413b992ef1b84d6660000000000fdfffffff2ed472a1d1d28220a7d2cd02eb89652f3b75fdebbc4a219bfd89797578026210000000000fdffffff826608305b2708d5e6421492864c1a18235312f61a4ec506aa2c29fdc09d21570000000000fdffffff0ca802000000000000160014e8cc042a7c976ab0068cf0e4fcae4845d41774a7a8020000000000001600149271f58284fc922b7e466cff87a53bb838d11feba802000000000000160014248a521f8561af8f735d0f5e6d13f41177e423bda802000000000000160014248a521f8561af8f735d0f5e6d13f41177e423bda802000000000000160014581c4fc0439986b761b5110ee86a60f8c563f7caa802000000000000160014581c4fc0439986b761b5110ee86a60f8c563f7caa8020000000000001600147326551112dd129f478b4a3fe4fab809c7fb2d0ca8020000000000001600147326551112dd129f478b4a3fe4fab809c7fb2d0ca802000000000000160014413e8fd29b2f671b6058c9f50bf51bf971274e53a802000000000000160014413e8fd29b2f671b6058c9f50bf51bf971274e530000000000000000fd8d016a4d89010687e8f0a411020b300030411f3034d40b7e22991fc60b36c2264e0f6de3d253d8e4fc44b7a4b84186efd8bf7a5602e8e1006c5ff7d3b63ab10c00cb963669ff04aab8d996cdf77956d4586ca381b5a2c92c01011341201d87ab15cb99af6773ad253532e412c99b0a5ab3de5a0129dd021997fb64ce0361429693dcfbc2bad6954b793706fd725bd479dd2f461dc09a482793d696d209898693d147020280640330411ff41163d10c48ae09c7f7cd3d16616c4faae295e3a197a21416a82c134a2d3a905de41230df7b2c26cb84955dfedf832559e0f9d9092734cab8b7177a9cbf595980bee4e22a02041d0509411fff76bc43879609173383743bf7e528ae7f53d1250755cd58a0d3ae9bacab22db4b45e52d4006c4f73dd207d5575c00223c7ce150f355058e3a86b31f2a184d8a84dbf5dc380206813e07800a41207f57619e592a6c1aa34f6c162c378b8f969e6aeb1d587b68b724fbb8149a249107601b0afb7fc1fb7ac492e051b71071a51a193fb6af5c82c7bd5f26cdb6489e87cabdbd5b0208310909004433000000000000160014e8cc042a7c976ab0068cf0e4fcae4845d41774a70247304402205fbab83550c4ebaaee4bc9c617c37663db85d64fa52401351cf12c2b1bca919a022069a1d2e79e9cc6c2ee1f90a0b0bcf0265d8eed7aa5185fd42646d796f260429401210281c11974da83e7d9ff9f47a3c32e3baa7975b5127eb447b86a2f7fd4c9d12fec0248304502210094198e0d006c878429ee9d040ead335c8a4444685c2d54493b1932ff937dc2c90220573dddf919fcd398df3901d1871bbd0d497800204619d78918f1a5cb70bb826b012103c86473f098d9bb69d31a7851372f9ded7b11691a77c253279e987373164b2ad202483045022100ffb106f82e22f70afdd0895648213fcb3f9cdd393f5075c6eaa6166ab7f6c2a50220731ea74d66acb85742be6c173c1b42af1725254eae5827421e60cd529a0ff087012102f165ced59862353282a8fd32ac10d018c4bc449e6dabc77a7d810ca2be6f69fd02473044022013c9e68ff54b0e871f7c2b8ffcfa795fb58581ffa64e129f1424ad407b0096b102205e4b82345908d5fea48165aeeabbb46dfaf741aedd8b8c4140fb6107da99835f0121025eea502cd2da208247cdd27701a2efea1e64aebf7c476362c1a6c0d1416c25f302473044022078f809b5046953998046f6e9d63a66c6364a89da4ba862748c87999b4fb10b2c02200c66df357b4212f1e5a4711bd9be67cb4dbcd3daec6cba1fa7d516a88ce0327d012102ccb8a1b346388ff9691d6ee1b2019956e93e5550130cbfe2e866477193b22a3f0247304402202fa8c63041e7cb6eccf283a6c28576b4dca56083fa55c7c24dbd0811bd768fbc0220280143bbeff2be0076e0860c22e926925f358854a25180a333acd36342b69141012102b7d4e03f4230eb2406328be6bf9dbd400083b929c07a4b0b3601589b3243067400000000'
  // private key in WIF format
  const WIF = 'cUsb4pbkuv5PGu3yaApXXUSAQNmjTE6aPGMGh32W4j3H3Rn73L7G' //  tsys1qtat6q2y5tad4hg4w7n7jk5fqv0ncth84puexca (m/84’/1’/0’/0/3)
  const tx = bitcoin.Transaction.fromHex(txHex)
  assert.equal(syscointx.utils.isAssetAllocationTx(tx.version), true)
  const assets = syscointx.getAssetsFromTx(tx)
  assert.notEqual(assets, null)
  // if(assets.has('1234')) { console.log('asset guid 1234 output found in transaction')}
  // this asset does not require notarization
  assets.delete('2305793883')
  assert.equal(syscointx.getNotarizationSigHash(tx, assets, syscoinNetworks.testnet), true)
  assert.equal(syscointx.signNotarizationSigHashesWithWIF(assets, WIF, syscoinNetworks.testnet), true)
  assert.notEqual(syscointx.addNotarizationSignatures(tx.version, assets, tx.outs), -1)
  assert.equal(tx.toHex(), txHex)
  // asset map has notarysig in buffer ie: assets.get('650700076').notarysig
  const jsonOut = syscointx.createNotarizationOutput(assets)
  // output to client
  assert.equal(JSON.stringify(jsonOut), '[{"asset":"2369540753","sig":"HzA01At+Ipkfxgs2wiZOD23j0lPY5PxEt6S4QYbv2L96VgLo4QBsX/fTtjqxDADLljZp/wSquNmWzfd5VtRYbKM="},{"asset":"650700076","sig":"IB2HqxXLma9nc60lNTLkEsmbClqz3loBKd0CGZf7ZM4DYUKWk9z7wrrWlUt5Nwb9clvUed0vRh3Amkgnk9aW0gk="},{"asset":"2699372871","sig":"H/QRY9EMSK4Jx/fNPRZhbE+q4pXjoZeiFBaoLBNKLTqQXeQSMN97LCbLhJVd/t+DJVng+dkJJzTKuLcXepy/WVk="},{"asset":"402223530","sig":"H/92vEOHlgkXM4N0O/flKK5/U9ElB1XNWKDTrpusqyLbS0XlLUAGxPc90gfVV1wAIjx84VDzVQWOOoazHyoYTYo="},{"asset":"1537060536","sig":"IH9XYZ5ZKmwao09sFiw3i4+WnmrrHVh7aLck+7gUmiSRB2AbCvt/wft6xJLgUbcQcaUaGT+2r1yCx71fJs22SJ4="}]')
  assert.end()
})
tape.test('test extract memo.', (assert) => {
  // transaction hex that has all notary signatures already but we will re-confirm them by assert.equal(tx.toHex(), txHex)
  const txHex = '87000000000102478fb14bec09d10f15d2ae0a4198b05ea002cab4147a43f1b0ca571504bb20720100000000ffffffffa41cfebe1b3e56da0d42e3629512b7734b52834aa9b7d1b46fd89dc9fa6ed2180100000000ffffffff04a8020000000000001600140b26e3403eeccdcf176b8c041ee99abf23e676e2a8020000000000001600144a1a3fb9007e655786946f3bac7bc2157bac56a60000000000000000546a4c510180a283a46703000601080381d740411f043a95360640953b9daa628c443073b72ea0e8fff0bccb6c5bad9795d447e5ad6c35c4a382d6ea6773bc72bfb9fcf529ef47eabf59750a610eb43193cb82e03b526e8747020000001600147dccd91471590db1eb4bcddb7bfe34fd076af31d0247304402205f66c62875fe973d5ee558984d522962ad00731c5ebd0cb163265ed28d6a9c5b022016391a1ddbaca5fea77abf30ca0c0159c0887e1b5af2b75ff19b1bbf25331fec01210288644767b596e5781bcc840fdbdf730bed12d4e0962e842b27ab8276ab409f4802473044022043a8c6ada327c667177dfb59d73369526d3771e86e3cefd06812aa53c1ae63e7022063eec2090ef8709a4307120fa314274e53776c9eaab43829a1156e34b04e9c3c01210288644767b596e5781bcc840fdbdf730bed12d4e0962e842b27ab8276ab409f4800000000'
  const tx = bitcoin.Transaction.fromHex(txHex)
  assert.equal(syscointx.utils.isAssetAllocationTx(tx.version), true)
  // const memo = getMemoFromOpReturn(tx.outs, Buffer.from([0xfe, 0xfe, 0xaf, 0xaf, 0xaf, 0xaf]))
  // assert.equal(memo, 'memo')
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
    } else if (f.version === utils.SYSCOIN_TX_VERSION_ASSET_ACTIVATE) {
      utxos = sanitizeBlockbookUTXOs(utxos, syscoinNetworks.mainnet, txOpts, f.assetMap)
      const res = syscointx.assetNew(f.assetOpts, txOpts, utxos, f.assetMap, f.sysChangeAddress, f.feeRate)
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
      utxos = sanitizeBlockbookUTXOs(utxos, syscoinNetworks.mainnet, txOpts, f.assetMap)
      const res = syscointx.assetUpdate(f.assetGuid, f.assetOpts, txOpts, utxos, f.assetMap, f.sysChangeAddress, f.feeRate)
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
      utxos = sanitizeBlockbookUTXOs(utxos, syscoinNetworks.mainnet, txOpts, f.assetMap)
      const res = syscointx.assetSend(txOpts, utxos, f.assetMap, f.sysChangeAddress, f.feeRate)
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
        t.same(utils.getMemoFromOpReturn(res.outputs, utils.memoHeader), txOpts.memo)
      }
      res.outputs.forEach(output => {
        if (output.script) {
          // find opreturn
          const chunks = bitcoin.script.decompile(output.script)
          if (chunks[0] === bitcoinops.OP_RETURN) {
            t.same(output.script, f.expected.script)
            const assetAllocations = syscoinBufferUtils.deserializeAssetAllocations(chunks[1])
            if (f.expected.memo) {
              t.same(utils.getMemoFromScript(chunks[1], utils.memoHeader), f.expected.memo)
            }
            t.same(assetAllocations, f.expected.asset.allocation)
          }
        }
      })
    } else if (f.version === 2) {
      utxos = sanitizeBlockbookUTXOs(utxos, syscoinNetworks.mainnet, txOpts)
      const res = syscointx.createTransaction(txOpts, utxos, f.sysChangeAddress, f.outputs, f.feeRate)
      t.same(res.outputs.length, f.expected.numOutputs)
      t.same(res.txVersion, f.expected.version)
      if (txOpts.memo) {
        t.same(utils.getMemoFromOpReturn(res.outputs, utils.memoHeader), txOpts.memo)
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
