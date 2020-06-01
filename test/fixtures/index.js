var BN = require('bn.js')
var utils = require('../../utils')

module.exports = [{
  description: 'new asset',
  version: utils.SYSCOIN_TX_VERSION_ASSET_ACTIVATE,
  feeRate: new BN(10),
  utxos: [
    { txId: 'add9bf0783d1e18bccf016e5c779be5cd390d8906f7b2ef4afa28c775c888b21', vout: 0, script: Buffer.from('001495e1cb724b74c32526209265c9f96a4e8ed256db', 'hex'), value: 100000000000 }
  ],
  assetOpts: { precision: 8, symbol: Buffer.from('CAT'), updateflags: 31, prevupdateflags: 31, balance: new BN(10000000000), maxsupply: new BN(100000000000) },
  assetOptsOptional: { contract: Buffer.from(''), pubdata: Buffer.from('{"description":"publicvalue"}'), prevcontract: Buffer.from(''), prevpubdata: Buffer.from('') },
  sysChangeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
  expected: {
    script: Buffer.from('6a3401218b885c01000008001d7b226465736372697074696f6e223a227075626c696376616c7565227d034341541f00001f64008668', 'hex'),
    asset: {
      allocation: new Map([
        [1552452385, [{ n: 0, value: new BN(0) }]]
      ]),
      precision: 8,
      contract: Buffer.from(''),
      pubdata: Buffer.from('{"description":"publicvalue"}'),
      symbol: Buffer.from('CAT'),
      updateflags: 31,
      prevcontract: Buffer.from(''),
      prevpubdata: Buffer.from(''),
      prevupdateflags: 31,
      balance: new BN(10000000000),
      totalsupply: new BN(0),
      maxsupply: new BN(100000000000)
    }
  }
},
{
  description: 'update asset',
  version: utils.SYSCOIN_TX_VERSION_ASSET_UPDATE,
  feeRate: new BN(10),
  utxos: [
    { txId: 'd31783dcbb96cf104970a5fd427f3c9f91921233478f80d8b63d80b2089ea15c', vout: 0, script: Buffer.from('0014f0cb48bf627b8603adfa80be7cbe980f1964294b', 'hex'), value: 99999796, assetInfo: { assetGuid: 1552452385, value: new BN(0) } },
    { txId: 'd31783dcbb96cf104970a5fd427f3c9f91921233478f80d8b63d80b2089ea15c', vout: 2, script: Buffer.from('001493b69b7e29c5869a50a41c122c51423003335184', 'hex'), value: 84900000000 }
  ],
  assetOpts: { assetGuid: 1552452385, precision: 8 },
  assetOptsOptional: { updateflags: 16, prevupdateflags: 31, balance: new BN(42000000000), contract: Buffer.from('2b1e58b979e4b2d72d8bca5bb4646ccc032ddbfc', 'hex'), pubdata: Buffer.from('{"description":"new publicvalue"}'), prevcontract: Buffer.from(''), prevpubdata: Buffer.from('{"description":"publicvalue"}') },
  sysChangeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
  assetMap: new Map([
    [1552452385, { changeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', outputs: [{ value: new BN(0), address: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq' }] }]
  ]),
  expected: {
    script: Buffer.from('6a4c6601218b885c01000008142b1e58b979e4b2d72d8bca5bb4646ccc032ddbfc217b226465736372697074696f6e223a226e6577207075626c696376616c7565227d0010001d7b226465736372697074696f6e223a227075626c696376616c7565227d1f82240000', 'hex'),
    asset: {
      allocation: new Map([
        [1552452385, [{ n: 0, value: new BN(0) }]]
      ]),
      precision: 8,
      contract: Buffer.from('2b1e58b979e4b2d72d8bca5bb4646ccc032ddbfc', 'hex'),
      pubdata: Buffer.from('{"description":"new publicvalue"}'),
      symbol: Buffer.from(''),
      updateflags: 16,
      prevcontract: Buffer.from(''),
      prevpubdata: Buffer.from('{"description":"publicvalue"}'),
      prevupdateflags: 31,
      balance: new BN(42000000000),
      totalsupply: new BN(0),
      maxsupply: new BN(0)
    }
  }
}
]
