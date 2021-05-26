
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
        // not sending this asset (assetMap) and assetWhiteList option if set with this asset will skip this check, by default this check is done and inputs will be skipped if they are notary asset inputs and user is not sending those assets (used as gas to fulfill requested output amount of SYS)
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
  assert.notEqual(syscointx.addNotarizationSignatures(tx.version, assets, tx.outs), { output: null, index: -1 })
  assert.equal(tx.toHex(), txHex)
  // asset map has notarysig in buffer ie: assets.get('650700076').notarysig
  const jsonOut = syscointx.createNotarizationOutput(assets)
  // output to client
  assert.equal(JSON.stringify(jsonOut), '[{"asset":"2369540753","sig":"HzA01At+Ipkfxgs2wiZOD23j0lPY5PxEt6S4QYbv2L96VgLo4QBsX/fTtjqxDADLljZp/wSquNmWzfd5VtRYbKM="},{"asset":"650700076","sig":"IB2HqxXLma9nc60lNTLkEsmbClqz3loBKd0CGZf7ZM4DYUKWk9z7wrrWlUt5Nwb9clvUed0vRh3Amkgnk9aW0gk="},{"asset":"2699372871","sig":"H/QRY9EMSK4Jx/fNPRZhbE+q4pXjoZeiFBaoLBNKLTqQXeQSMN97LCbLhJVd/t+DJVng+dkJJzTKuLcXepy/WVk="},{"asset":"402223530","sig":"H/92vEOHlgkXM4N0O/flKK5/U9ElB1XNWKDTrpusqyLbS0XlLUAGxPc90gfVV1wAIjx84VDzVQWOOoazHyoYTYo="},{"asset":"1537060536","sig":"IH9XYZ5ZKmwao09sFiw3i4+WnmrrHVh7aLck+7gUmiSRB2AbCvt/wft6xJLgUbcQcaUaGT+2r1yCx71fJs22SJ4="}]')
  assert.end()
})
tape.test('test notary signing with nfts.', (assert) => {
  const txHexUnsigned = '8700000000010b1baa373f936800946a61af3db94f3e138bd319f9f570d9b8133f8152202502a60000000000fdffffff7b650004c88d908966b835195fc336bbc9e1fac86ba4f530912002682aa3087d0100000000fdffffff6637b673c5da08af1cd0b686ed9f12c06c2b0c31112e39a3eba8f5a9ea2713250000000000fdffffff43b683459f84406ddcbea72b13bfffacfb60973b2afbcf1773a6eb9f183ecdc50000000000fdffffff1baa373f936800946a61af3db94f3e138bd319f9f570d9b8133f8152202502a60100000000fdffffff6637b673c5da08af1cd0b686ed9f12c06c2b0c31112e39a3eba8f5a9ea2713250100000000fdffffff43b683459f84406ddcbea72b13bfffacfb60973b2afbcf1773a6eb9f183ecdc50100000000fdffffff1baa373f936800946a61af3db94f3e138bd319f9f570d9b8133f8152202502a60200000000fdffffff6637b673c5da08af1cd0b686ed9f12c06c2b0c31112e39a3eba8f5a9ea2713250200000000fdffffff43b683459f84406ddcbea72b13bfffacfb60973b2afbcf1773a6eb9f183ecdc50200000000fdffffff6637b673c5da08af1cd0b686ed9f12c06c2b0c31112e39a3eba8f5a9ea2713250300000000fdffffff15d403000000000000160014edb0e59a33e126a879574bd71901264f6d59718fd403000000000000160014edb0e59a33e126a879574bd71901264f6d59718f86c6340c0100000016001461fd7c2a7d9f4ee1eff9bcfec56f50e5566bb849d403000000000000160014edb0e59a33e126a879574bd71901264f6d59718fd403000000000000160014edb0e59a33e126a879574bd71901264f6d59718fd403000000000000160014edb0e59a33e126a879574bd71901264f6d59718fbc7a00000000000016001476f73bd33a7fc207f7b78b2be0d482c33b630cd9d403000000000000160014edb0e59a33e126a879574bd71901264f6d59718fd403000000000000160014edb0e59a33e126a879574bd71901264f6d59718fe05b000000000000160014acc1381e651924963238353f761e456f5facfb4f147300000000000016001410ad6303a87bf348824031cfd3e8b0c75f6ff40a586b00000000000016001460c5e01e4d356ffb5b8bd6946350f09b1ab75b043854000000000000160014f61f0c39da484f544e61c3d37dd946130c4706c2d403000000000000160014edb0e59a33e126a879574bd71901264f6d59718fd403000000000000160014edb0e59a33e126a879574bd71901264f6d59718fd403000000000000160014edb0e59a33e126a879574bd71901264f6d59718f7c4c00000000000016001481c9907cb8fb3da2cf41f666cc968141c7e09e480000000000000000ec6a4ce90a9af6c18627010026410000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000aaf6c18627010130008af6c186270203803c12844e00baf6c1862701043a009bb1d3e024010526410000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000abb1d3e024010730008bb1d3e0240208803c13844e0092e38abe6a010d2600a2e38abe6a010e300082e38abe6a020f803c02844e008c3c00000000000016001400333adc981f2e8877f4edffb403947391bb644f8444000000000000160014d853281514cde6080deb2e6994e6854f3b7c72db9c63000000000000160014cd1aa816d8b91df7d4f9cb095517bd6e1620201c0247304402203c0425755b3ea9d16f8e85605493b033d6e331fc329beadd093502b1a8ac5e6e022068ac54aae3be73b50cf1c0db19f200b99112bbb86af952252f426eddf05665e2012103f765b874a5de63db47b4d50c487579eb4070591e9554b8e52e3974297e1dc3e80247304402201efaad342410ebbafa0bcfc133e7f01b626fbe4b62122aa9991264f5ac6d3a9402204d926d327a4a079b13ecc84f4f74cd675d658ffc58ac2ed15f56a36213aa685b012102578594bc07fb2895c3c2d7f9f81fc44fd2406f0ebf51144dcb962de747104454024730440220224cd43af84d03c9fe055005213a6b58ad3da14f08aecdb79b9afe287522ab2d02201b1d13ce862103b91bce79178cc8154b7585060d67342e3ef5e4675237bca12801210213c6a1ede6635c59e71a58c9b894a59de489978de58f796885a8df60aea4c29302473044022037201158eecf1aefd6e85eeac9c4e47fe0d3f934697bdd8e3f832bac20db079b02203d3056e7ce4a8511a5726f1443366ad5fac1e82b27f35fa691630043c81a8abc0121027a92bed18226bae05771a232eae3e958fdc68ffe6519e78a26721ecea0c925290247304402200531005ac0a94f55ddd46321dd4f0eff1f0c3376a03d0f1746b0065e19316a9502203cb60812ccaa952fb9bcc4e237909e88d9592210a89670d01901ab0d482d4188012103366a01fb3e1b54c8c3090ccc8e2836de3b60a05b581e3b6078725190eba1f7c70247304402203c390216502f22ef35069bdb78349cae2e1e7021310c4dcefc34085e2fd828c802206f55536a8d2a11b9f94dc35999f4fcad3f8c7e2f91ce3b2c88e3262f2737e96101210242cf43740126cd5245020756fc301fed4dde1ff4314e773802ab5661d599c56302473044022031c8edb6750f63a7665d45082cc4b0f0c1969e70b37f68f282dbb64f2303695902200638c7223e5dc76493dd4baa76706e1ed61c36f2777975bcdf823853b347b3f5012103d97d2a21a7a0ae9e0806e5e739d53d822d35a45d748160b08a8e53cd8163ea33024730440220784ac7e6975d38420fc694278b74039042acd75370896122e2cbdc58a28df426022048b909e4a09010aced89f5577a943fe4c792003a1ef89b60f18884107264e999012102f2c1568e39088bb9b32a2416f439c611963ed60fe1212d906f9e0168c0be0be7024730440220354ccdb69d93ac38403c2094249a2a32442ccec50e2d80bfec34cc851ae09083022060621f96e97fe559b18b71e482ce4673448723bf7bd18b88932df6e895588f00012103fe8611ff596a4b44a7c701d274eb7c1d34a2e4d343973569758213b64b1b34020247304402205870dd0cbc97f37bc6281ef5c0e803ce5f5c48effb5a8ea95fbb127a8f85506b02207fa03dc66d7d5031e82ea55377fd7eb8f6e38d83f8487dcbab797a054c035a430121036bbdb18a095b5a095e602633a9c84fb8ce22501fbfdc14f62c2e7bbaeecc42200247304402201964b4fe917f5c70c0269992b5d92be98cd337e4e55fbc339517fe12b28f89d202203a2ba6b9c3a9e8930bc12122c310bad67585db38acc620dd268a2227e999a3a3012103275516c294dbe5e34c962f5db1a9f4423ac8614cad3602306d70584ec274ef7300000000'
  // private key in WIF format
  const WIF1 = 'cVjS6ohgv538iP6W9GnUNdu2GzMiKDuM6g4juFuUCMgu155uNKwE'
  const WIF2 = 'cV7sKqKi3o4PjLmJ2my1jywraSf89Jq1ZLwEAEDpMtUwgbWsHKuu'
  const tx = bitcoin.Transaction.fromHex(txHexUnsigned)
  assert.equal(syscointx.utils.isAssetAllocationTx(tx.version), true)
  const assetsParsed = syscointx.getAssetsFromTx(tx)
  assert.equal(assetsParsed.has('3203433383'), true)
  assert.equal(assetsParsed.has('3327471780'), true)
  assert.equal(assetsParsed.has('1015209962'), true)
  const assets1 = new Map()
  assets1.set('3203433383', {})
  assert.equal(syscointx.getNotarizationSigHash(tx, assets1, syscoinNetworks.testnet), true)
  assert.equal(syscointx.signNotarizationSigHashesWithWIF(assets1, WIF1, syscoinNetworks.testnet), true)
  const assets2 = new Map()
  assets2.set('3327471780', {})
  assert.equal(syscointx.getNotarizationSigHash(tx, assets2, syscoinNetworks.testnet), true)
  assert.equal(syscointx.signNotarizationSigHashesWithWIF(assets2, WIF2, syscoinNetworks.testnet), true)
  const assets = new Map()
  assets.set('3203433383', assets1.get('3203433383'))
  assets.set('3327471780', assets2.get('3327471780'))
  assert.notEqual(syscointx.addNotarizationSignatures(tx.version, assets, tx.outs), { output: null, index: -1 })
  // asset map has notarysig in buffer ie: assets.get('650700076').notarysig
  const jsonOut = syscointx.createNotarizationOutput(assets)
  // output to client
  assert.equal(JSON.stringify(jsonOut), '[{"asset":"3203433383","sig":"H5hH5jMVmxP4fXPkNGW4eAQNfb0MJnebUmISrfFWoeYofA6yMdeC7YI8KGRN3jYiUErVGR7rCDzQI9PfICAvlYM="},{"asset":"3327471780","sig":"H/2Em9EvC9DRX9+BXVg4xK7Ga8SO2w3600SM9+Gxkq1gPveFsA3x9vejNsUtn3ojtp9nGjqp7YpOu7rtU3NW7vg="}]')
  assert.end()
})
tape.test('test extract memo.', (assert) => {
  // transaction hex that has all notary signatures already but we will re-confirm them by assert.equal(tx.toHex(), txHex)
  const txHex = '87000000000101d4de2a743378a40229f180bda29c701ec5761b95c2bb54b049937b4d02e894130300000000ffffffff04a8020000000000001600140b26e3403eeccdcf176b8c041ee99abf23e676e2a8020000000000001600144a1a3fb9007e655786946f3bac7bc2157bac56a60000000000000000676a4c640180a283a46703000f0111038ecde3c865411f21c18a05a3869649ffd01d335cebe56326b832ee1876bc6d785dc594b08165136664789379df4305bb09cefb23d1a743569e6fb1ec04923fbce2f7b9efde4104fefeafafafaf6d656d6f207465737420326a1a8747020000001600147dccd91471590db1eb4bcddb7bfe34fd076af31d02473044022032ea8f812ea8783aa8a436484b262e75b79c9b1f0677e8e4ddb41ee0e984e64102201f710f31e1c7a1a2be7994a556e8c094c7632b3bc926890c44643626b523dea101210288644767b596e5781bcc840fdbdf730bed12d4e0962e842b27ab8276ab409f4800000000'
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
