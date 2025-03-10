const BN = require('bn.js')
const utils = require('../../utils')
const scalarPct = 1000
const COIN = 100000000
const memoHeader = Buffer.from([0xff, 0xff, 0xaf, 0xaf, 0xaa, 0xaa])
module.exports = [{
  description: 'new asset',
  version: utils.SYSCOIN_TX_VERSION_ASSET_ACTIVATE,
  txOpts: {
    rbf: false
  },
  feeRate: new BN(10),
  utxoObj: {
    utxos: [
      { txid: 'add9bf0783d1e18bccf016e5c779be5cd390d8906f7b2ef4afa28c775c888b21', vout: 0, address: '001495e1cb724b74c32526209265c9f96a4e8ed256db', value: '100000000000' }
    ]
  },
  assetOpts: { precision: 8, symbol: 'CAT', updatecapabilityflags: 127, maxsupply: new BN(100000000000), description: 'publicvalue' },
  sysChangeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
  assetMap: new Map([
    ['0', { changeAddress: 'bc1qc7slrfxkknqcq2jevvvkdgvrt8080852dfjewde450xdlk4ugp7szw5tk9', outputs: [{ value: new BN(0), address: 'bc1qc7slrfxkknqcq2jevvvkdgvrt8080852dfjewde450xdlk4ugp7szw5tk9' }] }]
  ]),
  expected: {
    rbf: false,
    numOutputs: 2,
    script: Buffer.from('6a320184e3a195210101000008c1045130465586681b7b2264657363223a226348566962476c6a646d46736457553d227d007f00', 'hex'),
    asset: {
      allocation: [{ assetGuid: '1552452385', values: [{ n: 1, value: new BN(0) }] }],
      precision: 8,
      updateflags: 193,
      symbol: Buffer.from(utils.encodeToBase64('CAT')),
      maxsupply: new BN(100000000000),
      pubdata: utils.encodePubDataFromFields({ desc: 'publicvalue' }),
      prevpubdata: Buffer.from(''),
      updatecapabilityflags: 127,
      prevupdatecapabilityflags: 0
    }
  }
},
{
  description: 'update asset',
  version: utils.SYSCOIN_TX_VERSION_ASSET_UPDATE,
  txOpts: {
    rbf: true
  },
  feeRate: new BN(10),
  utxoObj: {
    utxos: [
      { txid: 'd31783dcbb96cf104970a5fd427f3c9f91921233478f80d8b63d80b2089ea15c', vout: 0, address: '0014f0cb48bf627b8603adfa80be7cbe980f1964294b', value: '99999796', assetInfo: { assetGuid: '1552452385', value: '0' } },
      { txid: 'd31783dcbb96cf104970a5fd427f3c9f91921233478f80d8b63d80b2089ea15c', vout: 2, address: '001493b69b7e29c5869a50a41c122c51423003335184', value: '84900000000' }
    ],
    assets: [
      {
        assetGuid: '1552452385',
        decimals: 8,
        pubData: { desc: utils.encodeToBase64('publicvalue') },
        symbol: utils.encodeToBase64('CAT'),
        updateCapabilityFlags: 127,
        totalSupply: '0',
        maxSupply: '100000000000'
      }
    ]
  },
  assetGuid: '1552452385',
  assetOpts: { updatecapabilityflags: 123, contract: Buffer.from('2b1e58b979e4b2d72d8bca5bb4646ccc032ddbfc', 'hex'), description: 'new publicvalue' },
  sysChangeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
  assetMap: new Map([
    ['1552452385', { changeAddress: 'bc1qc7slrfxkknqcq2jevvvkdgvrt8080852dfjewde450xdlk4ugp7szw5tk9', outputs: [{ value: new BN(0), address: 'bc1qc7slrfxkknqcq2jevvvkdgvrt8080852dfjewde450xdlk4ugp7szw5tk9' }] }]
  ]),
  expected: {
    rbf: true,
    numOutputs: 2,
    script: Buffer.from('6a4c600184e3a19521010100000843142b1e58b979e4b2d72d8bca5bb4646ccc032ddbfc001f7b2264657363223a22626d563349484231596d787059335a686248566c227d1b7b2264657363223a226348566962476c6a646d46736457553d227d7b7f', 'hex'),
    asset: {
      allocation: [{ assetGuid: '1552452385', values: [{ n: 1, value: new BN(0) }] }],
      precision: 8,
      updateflags: 67,
      contract: Buffer.from('2b1e58b979e4b2d72d8bca5bb4646ccc032ddbfc', 'hex'),
      prevcontract: Buffer.from(''),
      pubdata: utils.encodePubDataFromFields({ desc: 'new publicvalue' }),
      prevpubdata: utils.encodePubDataFromFields({ desc: 'publicvalue' }),
      updatecapabilityflags: 123,
      prevupdatecapabilityflags: 127
    }
  }
},
{
  description: 'send asset',
  version: utils.SYSCOIN_TX_VERSION_ASSET_SEND,
  txOpts: {
    rbf: true
  },
  feeRate: new BN(10),
  utxoObj: {
    utxos: [
      { txid: 'befed752e1444b66fd91dd121f772d0f2f081c579f04b419eb18960dcd55e84f', vout: 2, address: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', value: '84900000000' },
      { txid: '5e9c72abf1d3df7ac5f673de603cd7946b25e58de8e8f87a852ba291790a5181', vout: 0, address: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', value: '99999593', assetInfo: { assetGuid: '1635229536', value: '0' } }
    ],
    assets: [
      {
        assetGuid: '1635229536',
        decimals: 8,
        pubData: { desc: utils.encodeToBase64('publicvalue') },
        symbol: utils.encodeToBase64('CAT'),
        updateCapabilityFlags: 127,
        totalSupply: '0',
        maxSupply: '100000000000'
      }
    ]
  },
  sysChangeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
  assetMap: new Map([
    ['1635229536', { changeAddress: 'bc1qc7slrfxkknqcq2jevvvkdgvrt8080852dfjewde450xdlk4ugp7szw5tk9', outputs: [{ value: new BN(1000000000), address: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq' }, { value: new BN(0), address: 'bc1qc7slrfxkknqcq2jevvvkdgvrt8080852dfjewde450xdlk4ugp7szw5tk9' }] }]
  ]),
  expected: {
    rbf: true,
    numOutputs: 3,
    script: Buffer.from('6a0c01858addbd6002000a020000', 'hex'),
    asset: {
      allocation: [{ assetGuid: '1635229536', values: [{ n: 0, value: new BN(1000000000) }, { n: 2, value: new BN(0) }] }]
    }
  }
},
{
  description: 'send asset with zero val input',
  version: utils.SYSCOIN_TX_VERSION_ASSET_SEND,
  txOpts: {
    rbf: true
  },
  feeRate: new BN(10),
  utxoObj: {
    utxos: [
      { txid: '5e9c72abf1d3df7ac5f673de603cd7946b25e58de8e8f87a852ba291790a5181', vout: 0, address: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', value: '5000', assetInfo: { assetGuid: '1635229536', value: '886' } },
      { txid: '5e9c72abf1d3df7ac5f673de603cd7946b25e58de8e8f87a852ba291790a5181', vout: 1, address: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', value: '690', assetInfo: { assetGuid: '1635229536', value: '0' } }
    ],
    assets: [
      {
        assetGuid: '1635229536',
        decimals: 8,
        pubData: { desc: utils.encodeToBase64('publicvalue') },
        symbol: utils.encodeToBase64('CAT'),
        updateCapabilityFlags: 127,
        totalSupply: '0',
        maxSupply: '100000000000'
      }
    ]
  },
  sysChangeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
  assetMap: new Map([
    ['1635229536', { changeAddress: 'bc1qc7slrfxkknqcq2jevvvkdgvrt8080852dfjewde450xdlk4ugp7szw5tk9', outputs: [{ value: new BN(1000000000), address: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq' }, { value: new BN(0), address: 'bc1qc7slrfxkknqcq2jevvvkdgvrt8080852dfjewde450xdlk4ugp7szw5tk9' }] }]
  ]),
  expected: {
    rbf: true,
    numOutputs: 4,
    script: Buffer.from('6a0f01858addbd6003000a010003bd2300', 'hex'),
    asset: {
      allocation: [{ assetGuid: '1635229536', values: [{ n: 0, value: new BN(1000000000) }, { n: 1, value: new BN(0) }, { n: 3, value: new BN(886) }] }]
    }
  }
},
{
  description: 'send asset allocation',
  version: utils.SYSCOIN_TX_VERSION_ALLOCATION_SEND,
  txOpts: {
    rbf: true
  },
  feeRate: new BN(10),
  utxoObj: {
    utxos: [
      { txid: 'c6e7702f1ab817bacf81e5678ba89e0b43a8a7b6f56c4c055aa8aeda87197a62', vout: 0, address: '0014712a0433b3be8c2860db2d313c44fa1967542780', value: '980', assetInfo: { assetGuid: '1635229536', value: '1000000000' } },
      { txid: '2cf903537c6c161a1c65d940758b63efd4706fc8f78eb21d252612407e59e865', vout: 0, address: '0014ab0ed68aa74cc422d69e4d675eb029ab93211c4c', value: '100000000' }
    ],
    assets: [
      {
        assetGuid: '1635229536',
        decimals: 8,
        pubData: { desc: utils.encodeToBase64('publicvalue') },
        symbol: utils.encodeToBase64('CAT'),
        updateCapabilityFlags: 127,
        totalSupply: '0',
        maxSupply: '100000000000'
      }
    ]
  },
  sysChangeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
  assetMap: new Map([
    ['1635229536', { changeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', outputs: [{ value: new BN(600000000), address: 'bc1qc7slrfxkknqcq2jevvvkdgvrt8080852dfjewde450xdlk4ugp7szw5tk9' }] }]
  ]),
  expected: {
    rbf: true,
    numOutputs: 3,
    script: Buffer.from('6a0c01858addbd6002003b022700', 'hex'),
    asset: {
      allocation: [{ assetGuid: '1635229536', values: [{ n: 0, value: new BN(600000000) }, { n: 2, value: new BN(400000000) }] }]
    }
  }
},
{
  description: 'send asset allocation with memo',
  version: utils.SYSCOIN_TX_VERSION_ALLOCATION_SEND,
  txOpts: {
    rbf: true,
    memo: Buffer.from('memo for send'),
    memoHeader: memoHeader
  },
  feeRate: new BN(10),
  utxoObj: {
    utxos: [
      { txid: 'c6e7702f1ab817bacf81e5678ba89e0b43a8a7b6f56c4c055aa8aeda87197a62', vout: 0, address: '0014712a0433b3be8c2860db2d313c44fa1967542780', value: '980', assetInfo: { assetGuid: '1635229536', value: '1000000000' } },
      { txid: '2cf903537c6c161a1c65d940758b63efd4706fc8f78eb21d252612407e59e865', vout: 0, address: '0014ab0ed68aa74cc422d69e4d675eb029ab93211c4c', value: '100000000' }
    ],
    assets: [
      {
        assetGuid: '1635229536',
        decimals: 8,
        pubData: { desc: utils.encodeToBase64('publicvalue') },
        symbol: utils.encodeToBase64('CAT'),
        updateCapabilityFlags: 127,
        totalSupply: '0',
        maxSupply: '100000000000'
      }
    ]
  },
  sysChangeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
  assetMap: new Map([
    ['1635229536', { changeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', outputs: [{ value: new BN(600000000), address: 'bc1qc7slrfxkknqcq2jevvvkdgvrt8080852dfjewde450xdlk4ugp7szw5tk9' }] }]
  ]),
  expected: {
    rbf: true,
    numOutputs: 3,
    script: Buffer.from('6a1f01858addbd6002003b022700ffffafafaaaa6d656d6f20666f722073656e64', 'hex'),
    asset: {
      allocation: [{ assetGuid: '1635229536', values: [{ n: 0, value: new BN(600000000) }, { n: 2, value: new BN(400000000) }] }]
    },
    memo: Buffer.from('memo for send')
  }
},
{
  description: 'send multi asset allocations with notarization',
  version: utils.SYSCOIN_TX_VERSION_ALLOCATION_SEND,
  feeRate: new BN(10),
  utxoObj: {
    utxos: [
      { txid: 'c6e7702f1ab817bacf81e5678ba89e0b43a8a7b6f56c4c055aa8aeda87197a62', vout: 0, address: '0014712a0433b3be8c2860db2d313c44fa1967542780', value: '980', assetInfo: { assetGuid: '1635229536', value: '100000000' } },
      { txid: 'c6e7702f1ab817bacf81e5678ba89e0b43a8a7b6f56c4c055aa8aeda87197a63', vout: 0, address: '0014712a0433b3be8c2860db2d313c44fa1967542781', value: '980', assetInfo: { assetGuid: '1635229537', value: '200000000' } },
      { txid: 'c6e7702f1ab817bacf81e5678ba89e0b43a8a7b6f56c4c055aa8aeda87197a64', vout: 0, address: '0014712a0433b3be8c2860db2d313c44fa1967542782', value: '980', assetInfo: { assetGuid: '1635229538', value: '300000000' } },
      { txid: 'c6e7702f1ab817bacf81e5678ba89e0b43a8a7b6f56c4c055aa8aeda87197a65', vout: 0, address: '0014712a0433b3be8c2860db2d313c44fa1967542783', value: '980', assetInfo: { assetGuid: '1635229539', value: '400000000' } },
      { txid: 'c6e7702f1ab817bacf81e5678ba89e0b43a8a7b6f56c4c055aa8aeda87197a66', vout: 0, address: '0014712a0433b3be8c2860db2d313c44fa1967542784', value: '980', assetInfo: { assetGuid: '1635229540', value: '500000000' } },
      { txid: 'c6e7702f1ab817bacf81e5678ba89e0b43a8a7b6f56c4c055aa8aeda87197a67', vout: 0, address: '0014712a0433b3be8c2860db2d313c44fa1967542785', value: '980', assetInfo: { assetGuid: '1635229541', value: '600000000' } },
      { txid: '2cf903537c6c161a1c65d940758b63efd4706fc8f78eb21d252612407e59e865', vout: 0, address: '0014ab0ed68aa74cc422d69e4d675eb029ab93211c4c', value: '100000000' }
    ],
    assets: [
      {
        assetGuid: '1635229536',
        decimals: 8,
        pubData: { desc: utils.encodeToBase64('publicvalue') },
        symbol: utils.encodeToBase64('CAT'),
        updateCapabilityFlags: 127,
        totalSupply: '0',
        maxSupply: '100000000000',
        notaryKeyID: '6m1SXAyVXZDT29Kage+L+3kANyc=',
        notaryDetails: {
          endPoint: 'https://test.com',
          instantTransfers: 0,
          HDRequired: 1
        }
      },
      {
        assetGuid: '1635229537',
        decimals: 8,
        pubData: { desc: utils.encodeToBase64('publicvalue') },
        symbol: utils.encodeToBase64('CAT'),
        updateCapabilityFlags: 127,
        totalSupply: '0',
        maxSupply: '100000000000',
        notaryKeyID: '6m1SXAyVXZDT29Kage+L+3kANyc=',
        notaryDetails: {
          endPoint: 'https://test.com',
          instantTransfers: 0,
          HDRequired: 1
        }
      },
      {
        assetGuid: '1635229538',
        decimals: 8,
        pubData: { desc: utils.encodeToBase64('publicvalue') },
        symbol: utils.encodeToBase64('CAT'),
        updateCapabilityFlags: 127,
        totalSupply: '0',
        maxSupply: '100000000000',
        notaryKeyID: '6m1SXAyVXZDT29Kage+L+3kANyc=',
        notaryDetails: {
          endPoint: 'https://test.com',
          instantTransfers: 0,
          HDRequired: 1
        }
      },
      {
        assetGuid: '1635229539',
        decimals: 8,
        pubData: { desc: utils.encodeToBase64('publicvalue') },
        symbol: utils.encodeToBase64('CAT'),
        updateCapabilityFlags: 127,
        totalSupply: '0',
        maxSupply: '100000000000',
        notaryKeyID: '6m1SXAyVXZDT29Kage+L+3kANyc=',
        notaryDetails: {
          endPoint: 'https://test.com',
          instantTransfers: 0,
          HDRequired: 1
        }
      },
      {
        assetGuid: '1635229540',
        decimals: 8,
        pubData: { desc: utils.encodeToBase64('publicvalue') },
        symbol: utils.encodeToBase64('CAT'),
        updateCapabilityFlags: 127,
        totalSupply: '0',
        maxSupply: '100000000000',
        notaryKeyID: '6m1SXAyVXZDT29Kage+L+3kANyc=',
        notaryDetails: {
          endPoint: 'https://test.com',
          instantTransfers: 0,
          HDRequired: 1
        }
      },
      {
        assetGuid: '1635229541',
        decimals: 8,
        pubData: { desc: utils.encodeToBase64('publicvalue') },
        symbol: utils.encodeToBase64('CAT'),
        updateCapabilityFlags: 127,
        totalSupply: '0',
        maxSupply: '100000000000'
      }
    ]
  },
  sysChangeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
  assetMap: new Map([
    ['1635229536', { changeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', outputs: [{ value: new BN(50000000), address: 'bc1qc7slrfxkknqcq2jevvvkdgvrt8080852dfjewde450xdlk4ugp7szw5tk9' }, { value: new BN(50000000), address: 'bc1qc7slrfxkknqcq2jevvvkdgvrt8080852dfjewde450xdlk4ugp7szw5tk9' }] }],
    ['1635229537', { changeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', outputs: [{ value: new BN(200000000), address: 'bc1qc7slrfxkknqcq2jevvvkdgvrt8080852dfjewde450xdlk4ugp7szw5tk9' }] }],
    ['1635229538', { changeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', outputs: [{ value: new BN(250000000), address: 'bc1qc7slrfxkknqcq2jevvvkdgvrt8080852dfjewde450xdlk4ugp7szw5tk9' }] }],
    ['1635229539', { changeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', outputs: [{ value: new BN(300000000), address: 'bc1qc7slrfxkknqcq2jevvvkdgvrt8080852dfjewde450xdlk4ugp7szw5tk9' }] }],
    ['1635229540', { changeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', outputs: [{ value: new BN(350000000), address: 'bc1qc7slrfxkknqcq2jevvvkdgvrt8080852dfjewde450xdlk4ugp7szw5tk9' }] }],
    ['1635229541', { changeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', outputs: [{ value: new BN(500000000), address: 'bc1qc7slrfxkknqcq2jevvvkdgvrt8080852dfjewde450xdlk4ugp7szw5tk9' }] }]
  ]),
  expected: {
    rbf: true, // by default rbf is false but here it should be automatically set to true as size > 1100 bytes
    numOutputs: 12,
    script: Buffer.from('6a4d890106858addbd600200300130410000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000858addbd61010213410000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000858addbd62020380640b30410000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000858addbd6302041d0509410000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000858addbd640206813e07800a410000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000858addbd65020831090900', 'hex'),
    asset: {
      allocation: [{ assetGuid: '1635229536', values: [{ n: 0, value: new BN(50000000) }, { n: 1, value: new BN(50000000) }] },
        { assetGuid: '1635229537', values: [{ n: 2, value: new BN(200000000) }] },
        { assetGuid: '1635229538', values: [{ n: 3, value: new BN(250000000) }, { n: 11, value: new BN(50000000) }] },
        { assetGuid: '1635229539', values: [{ n: 4, value: new BN(300000000) }, { n: 5, value: new BN(100000000) }] },
        { assetGuid: '1635229540', values: [{ n: 6, value: new BN(350000000) }, { n: 7, value: new BN(150000000) }] },
        { assetGuid: '1635229541', values: [{ n: 8, value: new BN(500000000) }, { n: 9, value: new BN(100000000) }] }]
    }
  }
},
{
  description: 'send multi asset allocations (varied sys values) with notarization',
  version: utils.SYSCOIN_TX_VERSION_ALLOCATION_SEND,
  feeRate: new BN(10),
  utxoObj: {
    utxos: [
      { txid: 'c6e7702f1ab817bacf81e5678ba89e0b43a8a7b6f56c4c055aa8aeda87197a62', vout: 0, address: '0014712a0433b3be8c2860db2d313c44fa1967542780', value: '9800', assetInfo: { assetGuid: '1635229536', value: '100000000' } },
      { txid: 'c6e7702f1ab817bacf81e5678ba89e0b43a8a7b6f56c4c055aa8aeda87197a63', vout: 0, address: '0014712a0433b3be8c2860db2d313c44fa1967542781', value: '9800', assetInfo: { assetGuid: '1635229537', value: '200000000' } },
      { txid: 'c6e7702f1ab817bacf81e5678ba89e0b43a8a7b6f56c4c055aa8aeda87197a64', vout: 0, address: '0014712a0433b3be8c2860db2d313c44fa1967542782', value: '980', assetInfo: { assetGuid: '1635229538', value: '300000000' } },
      { txid: 'c6e7702f1ab817bacf81e5678ba89e0b43a8a7b6f56c4c055aa8aeda87197a65', vout: 0, address: '0014712a0433b3be8c2860db2d313c44fa1967542783', value: '9800', assetInfo: { assetGuid: '1635229539', value: '400000000' } },
      { txid: 'c6e7702f1ab817bacf81e5678ba89e0b43a8a7b6f56c4c055aa8aeda87197a66', vout: 0, address: '0014712a0433b3be8c2860db2d313c44fa1967542784', value: '980', assetInfo: { assetGuid: '1635229540', value: '500000000' } },
      { txid: 'c6e7702f1ab817bacf81e5678ba89e0b43a8a7b6f56c4c055aa8aeda87197a67', vout: 0, address: '0014712a0433b3be8c2860db2d313c44fa1967542785', value: '980', assetInfo: { assetGuid: '1635229541', value: '600000000' } }
    ],
    assets: [
      {
        assetGuid: '1635229536',
        decimals: 8,
        pubData: { desc: utils.encodeToBase64('publicvalue') },
        symbol: utils.encodeToBase64('CAT'),
        updateCapabilityFlags: 127,
        totalSupply: '0',
        maxSupply: '100000000000',
        notaryKeyID: '6m1SXAyVXZDT29Kage+L+3kANyc=',
        notaryDetails: {
          endPoint: 'https://test.com',
          instantTransfers: 0,
          HDRequired: 1
        }
      },
      {
        assetGuid: '1635229537',
        decimals: 8,
        pubData: { desc: utils.encodeToBase64('publicvalue') },
        symbol: utils.encodeToBase64('CAT'),
        updateCapabilityFlags: 127,
        totalSupply: '0',
        maxSupply: '100000000000',
        notaryKeyID: '6m1SXAyVXZDT29Kage+L+3kANyc=',
        notaryDetails: {
          endPoint: 'https://test.com',
          instantTransfers: 0,
          HDRequired: 1
        }
      },
      {
        assetGuid: '1635229538',
        decimals: 8,
        pubData: { desc: utils.encodeToBase64('publicvalue') },
        symbol: utils.encodeToBase64('CAT'),
        updateCapabilityFlags: 127,
        totalSupply: '0',
        maxSupply: '100000000000',
        notaryKeyID: '6m1SXAyVXZDT29Kage+L+3kANyc=',
        notaryDetails: {
          endPoint: 'https://test.com',
          instantTransfers: 0,
          HDRequired: 1
        }
      },
      {
        assetGuid: '1635229539',
        decimals: 8,
        pubData: { desc: utils.encodeToBase64('publicvalue') },
        symbol: utils.encodeToBase64('CAT'),
        updateCapabilityFlags: 127,
        totalSupply: '0',
        maxSupply: '100000000000',
        notaryKeyID: '6m1SXAyVXZDT29Kage+L+3kANyc=',
        notaryDetails: {
          endPoint: 'https://test.com',
          instantTransfers: 0,
          HDRequired: 1
        }
      },
      {
        assetGuid: '1635229540',
        decimals: 8,
        pubData: { desc: utils.encodeToBase64('publicvalue') },
        symbol: utils.encodeToBase64('CAT'),
        updateCapabilityFlags: 127,
        totalSupply: '0',
        maxSupply: '100000000000',
        notaryKeyID: '6m1SXAyVXZDT29Kage+L+3kANyc=',
        notaryDetails: {
          endPoint: 'https://test.com',
          instantTransfers: 1,
          HDRequired: 1
        }
      },
      {
        assetGuid: '1635229541',
        decimals: 8,
        pubData: { desc: utils.encodeToBase64('publicvalue') },
        symbol: utils.encodeToBase64('CAT'),
        updateCapabilityFlags: 127,
        totalSupply: '0',
        maxSupply: '100000000000'
      }
    ]
  },

  sysChangeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
  assetMap: new Map([
    ['1635229536', { changeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', outputs: [{ value: new BN(50000000), address: 'bc1qc7slrfxkknqcq2jevvvkdgvrt8080852dfjewde450xdlk4ugp7szw5tk9' }, { value: new BN(50000000), address: 'bc1qc7slrfxkknqcq2jevvvkdgvrt8080852dfjewde450xdlk4ugp7szw5tk9' }] }],
    ['1635229537', { changeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', outputs: [{ value: new BN(200000000), address: 'bc1qc7slrfxkknqcq2jevvvkdgvrt8080852dfjewde450xdlk4ugp7szw5tk9' }] }],
    ['1635229538', { changeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', outputs: [{ value: new BN(250000000), address: 'bc1qc7slrfxkknqcq2jevvvkdgvrt8080852dfjewde450xdlk4ugp7szw5tk9' }] }],
    ['1635229539', { changeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', outputs: [{ value: new BN(300000000), address: 'bc1qc7slrfxkknqcq2jevvvkdgvrt8080852dfjewde450xdlk4ugp7szw5tk9' }] }],
    ['1635229540', { changeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', outputs: [{ value: new BN(350000000), address: 'bc1qc7slrfxkknqcq2jevvvkdgvrt8080852dfjewde450xdlk4ugp7szw5tk9' }] }],
    ['1635229541', { changeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', outputs: [{ value: new BN(500000000), address: 'bc1qc7slrfxkknqcq2jevvvkdgvrt8080852dfjewde450xdlk4ugp7szw5tk9' }] }]
  ]),
  expected: {
    rbf: true,
    numOutputs: 12,
    script: Buffer.from('6a4d890106858addbd600200300130410000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000858addbd61010213410000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000858addbd62020380640b30410000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000858addbd6302041d0509410000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000858addbd640206813e07800a410000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000858addbd65020831090900', 'hex'),
    asset: {
      allocation: [{ assetGuid: '1635229536', values: [{ n: 0, value: new BN(50000000) }, { n: 1, value: new BN(50000000) }] },
        { assetGuid: '1635229537', values: [{ n: 2, value: new BN(200000000) }] },
        { assetGuid: '1635229538', values: [{ n: 3, value: new BN(250000000) }, { n: 11, value: new BN(50000000) }] },
        { assetGuid: '1635229539', values: [{ n: 4, value: new BN(300000000) }, { n: 5, value: new BN(100000000) }] },
        { assetGuid: '1635229540', values: [{ n: 6, value: new BN(350000000) }, { n: 7, value: new BN(150000000) }] },
        { assetGuid: '1635229541', values: [{ n: 8, value: new BN(500000000) }, { n: 9, value: new BN(100000000) }] }]
    }
  }
},
{
  description: 'send multi asset allocations with notarization + gas in non-selected asset',
  version: utils.SYSCOIN_TX_VERSION_ALLOCATION_SEND,
  txOpts: {
    assetWhiteList: new Map([['1635229542', {}]])
  },
  feeRate: new BN(10),
  utxoObj: {
    utxos: [
      { txid: 'c6e7702f1ab817bacf81e5678ba89e0b43a8a7b6f56c4c055aa8aeda87197a62', vout: 0, address: '0014712a0433b3be8c2860db2d313c44fa1967542780', value: '980', assetInfo: { assetGuid: '1635229536', value: '100000000' } },
      { txid: 'c6e7702f1ab817bacf81e5678ba89e0b43a8a7b6f56c4c055aa8aeda87197a63', vout: 0, address: '0014712a0433b3be8c2860db2d313c44fa1967542781', value: '980', assetInfo: { assetGuid: '1635229537', value: '200000000' } },
      { txid: 'c6e7702f1ab817bacf81e5678ba89e0b43a8a7b6f56c4c055aa8aeda87197a64', vout: 0, address: '0014712a0433b3be8c2860db2d313c44fa1967542782', value: '980', assetInfo: { assetGuid: '1635229538', value: '300000000' } },
      { txid: 'c6e7702f1ab817bacf81e5678ba89e0b43a8a7b6f56c4c055aa8aeda87197a65', vout: 0, address: '0014712a0433b3be8c2860db2d313c44fa1967542783', value: '980', assetInfo: { assetGuid: '1635229539', value: '400000000' } },
      { txid: 'c6e7702f1ab817bacf81e5678ba89e0b43a8a7b6f56c4c055aa8aeda87197a66', vout: 0, address: '0014712a0433b3be8c2860db2d313c44fa1967542784', value: '980', assetInfo: { assetGuid: '1635229540', value: '500000000' } },
      { txid: 'c6e7702f1ab817bacf81e5678ba89e0b43a8a7b6f56c4c055aa8aeda87197a67', vout: 0, address: '0014712a0433b3be8c2860db2d313c44fa1967542785', value: '980', assetInfo: { assetGuid: '1635229541', value: '600000000' } },
      { txid: 'c6e7702f1ab817bacf81e5678ba89e0b43a8a7b6f56c4c055aa8aeda87197a68', vout: 0, address: '0014712a0433b3be8c2860db2d313c44fa1967542786', value: '980000', assetInfo: { assetGuid: '1635229542', value: '1000000000' } }
    ],
    assets: [
      {
        assetGuid: '1635229536',
        decimals: 8,
        pubData: { desc: utils.encodeToBase64('publicvalue') },
        symbol: utils.encodeToBase64('CAT'),
        updateCapabilityFlags: 127,
        totalSupply: '0',
        maxSupply: '100000000000',
        notaryKeyID: '6m1SXAyVXZDT29Kage+L+3kANyc=',
        notaryDetails: {
          endPoint: 'https://test.com',
          instantTransfers: 0,
          HDRequired: 1
        }
      },
      {
        assetGuid: '1635229537',
        decimals: 8,
        pubData: { desc: utils.encodeToBase64('publicvalue') },
        symbol: utils.encodeToBase64('CAT'),
        updateCapabilityFlags: 127,
        totalSupply: '0',
        maxSupply: '100000000000',
        notaryKeyID: '6m1SXAyVXZDT29Kage+L+3kANyc=',
        notaryDetails: {
          endPoint: 'https://test.com',
          instantTransfers: 0,
          HDRequired: 1
        }
      },
      {
        assetGuid: '1635229538',
        decimals: 8,
        pubData: { desc: utils.encodeToBase64('publicvalue') },
        symbol: utils.encodeToBase64('CAT'),
        updateCapabilityFlags: 127,
        totalSupply: '0',
        maxSupply: '100000000000',
        notaryKeyID: '6m1SXAyVXZDT29Kage+L+3kANyc=',
        notaryDetails: {
          endPoint: 'https://test.com',
          instantTransfers: 1,
          HDRequired: 1
        }
      },
      {
        assetGuid: '1635229539',
        decimals: 8,
        pubData: { desc: utils.encodeToBase64('publicvalue') },
        symbol: utils.encodeToBase64('CAT'),
        updateCapabilityFlags: 127,
        totalSupply: '0',
        maxSupply: '100000000000',
        notaryKeyID: '6m1SXAyVXZDT29Kage+L+3kANyc=',
        notaryDetails: {
          endPoint: 'https://test.com',
          instantTransfers: 0,
          HDRequired: 1
        }
      },
      {
        assetGuid: '1635229540',
        decimals: 8,
        pubData: { desc: utils.encodeToBase64('publicvalue') },
        symbol: utils.encodeToBase64('CAT'),
        updateCapabilityFlags: 127,
        totalSupply: '0',
        maxSupply: '100000000000',
        notaryKeyID: '6m1SXAyVXZDT29Kage+L+3kANyc=',
        notaryDetails: {
          endPoint: 'https://test.com',
          instantTransfers: 0,
          HDRequired: 1
        }
      },
      {
        assetGuid: '1635229541',
        decimals: 8,
        pubData: { desc: utils.encodeToBase64('publicvalue') },
        symbol: utils.encodeToBase64('CAT'),
        updateCapabilityFlags: 127,
        totalSupply: '0',
        maxSupply: '100000000000'
      },
      {
        assetGuid: '1635229542',
        decimals: 8,
        pubData: { desc: utils.encodeToBase64('publicvalue') },
        symbol: utils.encodeToBase64('CAT'),
        updateCapabilityFlags: 127,
        totalSupply: '0',
        maxSupply: '100000000000',
        notaryKeyID: '6m1SXAyVXZDT29Kage+L+3kANyc=',
        notaryDetails: {
          endPoint: 'https://test.com',
          instantTransfers: 0,
          HDRequired: 1
        }
      }
    ]
  },

  sysChangeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
  assetMap: new Map([
    ['1635229536', { changeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', outputs: [{ value: new BN(50000000), address: 'bc1qc7slrfxkknqcq2jevvvkdgvrt8080852dfjewde450xdlk4ugp7szw5tk9' }, { value: new BN(50000000), address: 'bc1qc7slrfxkknqcq2jevvvkdgvrt8080852dfjewde450xdlk4ugp7szw5tk9' }] }],
    ['1635229537', { changeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', outputs: [{ value: new BN(200000000), address: 'bc1qc7slrfxkknqcq2jevvvkdgvrt8080852dfjewde450xdlk4ugp7szw5tk9' }] }],
    ['1635229538', { changeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', outputs: [{ value: new BN(250000000), address: 'bc1qc7slrfxkknqcq2jevvvkdgvrt8080852dfjewde450xdlk4ugp7szw5tk9' }] }],
    ['1635229539', { changeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', outputs: [{ value: new BN(300000000), address: 'bc1qc7slrfxkknqcq2jevvvkdgvrt8080852dfjewde450xdlk4ugp7szw5tk9' }] }],
    ['1635229540', { changeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', outputs: [{ value: new BN(350000000), address: 'bc1qc7slrfxkknqcq2jevvvkdgvrt8080852dfjewde450xdlk4ugp7szw5tk9' }] }],
    ['1635229541', { changeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', outputs: [{ value: new BN(500000000), address: 'bc1qc7slrfxkknqcq2jevvvkdgvrt8080852dfjewde450xdlk4ugp7szw5tk9' }] }]
  ]),
  expected: {
    rbf: true,
    numOutputs: 13,
    script: Buffer.from('6a4dd30107858addbd600200300130410000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000858addbd61010213410000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000858addbd62020380640b30410000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000858addbd6302041d0509410000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000858addbd640206813e07800a410000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000858addbd65020831090900858addbd66010c0a410000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000', 'hex'),
    asset: {
      allocation: [{ assetGuid: '1635229536', values: [{ n: 0, value: new BN(50000000) }, { n: 1, value: new BN(50000000) }] },
        { assetGuid: '1635229537', values: [{ n: 2, value: new BN(200000000) }] },
        { assetGuid: '1635229538', values: [{ n: 3, value: new BN(250000000) }, { n: 11, value: new BN(50000000) }] },
        { assetGuid: '1635229539', values: [{ n: 4, value: new BN(300000000) }, { n: 5, value: new BN(100000000) }] },
        { assetGuid: '1635229540', values: [{ n: 6, value: new BN(350000000) }, { n: 7, value: new BN(150000000) }] },
        { assetGuid: '1635229541', values: [{ n: 8, value: new BN(500000000) }, { n: 9, value: new BN(100000000) }] },
        { assetGuid: '1635229542', values: [{ n: 12, value: new BN(1000000000) }] }]
    }
  }
},
{
  description: 'send asset allocation with auxfees',
  version: utils.SYSCOIN_TX_VERSION_ALLOCATION_SEND,
  txOpts: {
    rbf: false
  },
  feeRate: new BN(10),
  utxoObj: {
    utxos: [
      { txid: 'c6e7702f1ab817bacf81e5678ba89e0b43a8a7b6f56c4c055aa8aeda87197a62', vout: 0, address: '0014712a0433b3be8c2860db2d313c44fa1967542780', value: '980', assetInfo: { assetGuid: '1635229536', value: '1000000000' } },
      { txid: '2cf903537c6c161a1c65d940758b63efd4706fc8f78eb21d252612407e59e865', vout: 0, address: '0014ab0ed68aa74cc422d69e4d675eb029ab93211c4c', value: '100000000' }
    ],
    assets: [
      {
        assetGuid: '1635229536',
        decimals: 8,
        pubData: { desc: utils.encodeToBase64('publicvalue') },
        symbol: utils.encodeToBase64('CAT'),
        updateCapabilityFlags: 127,
        totalSupply: '0',
        maxSupply: '100000000000',
        auxFeeDetails: {
          auxFeeKeyID: '6m1SXAyVXZDT29Kage+L+3kANyc=',
          auxFees: [{
            bound: 0,
            percent: 1 * scalarPct
          },
          {
            bound: 10 * COIN,
            percent: 0.4 * scalarPct
          },
          {
            bound: 250 * COIN,
            percent: 0.2 * scalarPct
          },
          {
            bound: 2500 * COIN,
            percent: 0.07 * scalarPct
          },
          {
            bound: 25000 * COIN,
            percent: 0.007 * scalarPct
          },
          {
            bound: 250000 * COIN,
            percent: 0
          }
          ]
        }
      }
    ]
  },
  sysChangeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
  assetMap: new Map([
    ['1635229536', { changeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', outputs: [{ value: new BN(600000000), address: 'bc1qc7slrfxkknqcq2jevvvkdgvrt8080852dfjewde450xdlk4ugp7szw5tk9' }] }]
  ]),
  expected: {
    rbf: false,
    numOutputs: 4,
    script: Buffer.from('6a0f01858addbd60030039013b039a5b00', 'hex'),
    asset: {
      allocation: [{ assetGuid: '1635229536', values: [{ n: 0, value: new BN(6000000) }, { n: 1, value: new BN(600000000) }, { n: 3, value: new BN(394000000) }] }]
    }
  }
},
{
  description: 'burn asset allocation to syscoin',
  version: utils.SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_SYSCOIN,
  txOpts: {
    rbf: true
  },
  feeRate: new BN(10),
  utxoObj: {
    utxos: [
      { txid: 'e77901b5181e1ac5dc428d43ccc7e677c8c9179b982c779464e95c3190054c0e', vout: 0, address: '001483516da577935f20272bca9b62d262a4226f9c72', value: '980', assetInfo: { assetGuid: '1635229536', value: '600000000' } },
      { txid: 'e77901b5181e1ac5dc428d43ccc7e677c8c9179b982c779464e95c3190054c0e', vout: 2, address: '001461dffc7defeb8e0b5cd00ff24c196f71fe31feee', value: '99999771', assetInfo: { assetGuid: '1635229536', value: '400000000' } }
    ],
    assets: [
      {
        assetGuid: '1635229536',
        decimals: 8,
        pubData: { desc: utils.encodeToBase64('publicvalue') },
        symbol: utils.encodeToBase64('CAT'),
        updateCapabilityFlags: 127,
        totalSupply: '0',
        maxSupply: '100000000000'
      }
    ]
  },
  assetOpts: { ethaddress: Buffer.from('', 'hex') },
  sysChangeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
  assetMap: new Map([
    ['1635229536', { changeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', outputs: [{ value: new BN(500000000) }] }]
  ]),
  expected: {
    rbf: true,
    numOutputs: 3,
    script: Buffer.from('6a0d01858addbd6002013100310000', 'hex'),
    asset: {
      allocation: [{ assetGuid: '1635229536', values: [{ n: 1, value: new BN(500000000) }, { n: 0, value: new BN(500000000) }] }], ethaddress: Buffer.from('', 'hex')
    }
  }
},
{
  description: 'burn asset allocation to syscoin with 0 val input',
  version: utils.SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_SYSCOIN,
  txOpts: {
    rbf: true
  },
  feeRate: new BN(10),
  utxoObj: {
    utxos: [
      { txid: 'e77901b5181e1ac5dc428d43ccc7e677c8c9179b982c779464e95c3190054c0e', vout: 0, address: '001483516da577935f20272bca9b62d262a4226f9c72', value: '690', assetInfo: { assetGuid: '1635229536', value: '1000000000' } },
      { txid: 'e77901b5181e1ac5dc428d43ccc7e677c8c9179b982c779464e95c3190054c0e', vout: 2, address: '001461dffc7defeb8e0b5cd00ff24c196f71fe31feee', value: '113889979672', assetInfo: { assetGuid: '1635229536', value: '0' } }
    ],
    assets: [
      {
        assetGuid: '1635229536',
        decimals: 8,
        pubData: { desc: utils.encodeToBase64('publicvalue') },
        symbol: utils.encodeToBase64('CAT'),
        updateCapabilityFlags: 127,
        totalSupply: '0',
        maxSupply: '100000000000'
      }
    ]
  },
  assetOpts: { ethaddress: Buffer.from('', 'hex') },
  sysChangeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
  assetMap: new Map([
    ['1635229536', { changeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', outputs: [{ value: new BN(1) }] }]
  ]),
  expected: {
    rbf: true,
    numOutputs: 4,
    script: Buffer.from('6a1301858addbd6003010100a0c2c3b27703000000', 'hex'),
    asset: {
      allocation: [{ assetGuid: '1635229536', values: [{ n: 1, value: new BN(1) }, { n: 0, value: new BN(999999999) }, { n: 3, value: new BN(0) }] }], ethaddress: Buffer.from('', 'hex')
    }
  }
},
{
  description: 'burn asset allocation to syscoin with asset change',
  version: utils.SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_SYSCOIN,
  txOpts: {
    rbf: true
  },
  feeRate: new BN(10),
  utxoObj: {
    utxos: [
      { txid: '8f83fa7a076c2aa4cdc4a2f2880c6582ffe698d01c368ffde957210bee76da46', vout: 0, address: '001483516da577935f20272bca9b62d262a4226f9c72', value: '680', assetInfo: { assetGuid: '123456', value: '300000000' } },
      { txid: '8f83fa7a076c2aa4cdc4a2f2880c6582ffe698d01c368ffde957210bee76da46', vout: 2, address: '001461dffc7defeb8e0b5cd00ff24c196f71fe31feee', value: '18999985280', assetInfo: { assetGuid: '123456', value: '500000000' } }
    ],
    assets: [
      {
        assetGuid: '123456',
        decimals: 8,
        pubData: { desc: utils.encodeToBase64('publicvalue') },
        symbol: utils.encodeToBase64('SYSX'),
        updateCapabilityFlags: 127,
        totalSupply: '0',
        maxSupply: '100000000000'
      }
    ]
  },
  assetOpts: { ethaddress: Buffer.from('', 'hex') },
  sysChangeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
  assetMap: new Map([
    ['123456', { changeAddress: 'tsys1qayjjfphgsf960jlu0amqvnl5kudv53wapvng0p', outputs: [{ value: new BN(300000000) }] }]
  ]),
  expected: {
    rbf: true,
    numOutputs: 3,
    script: Buffer.from('6a0b0186c34002011d00130000', 'hex'),
    asset: {
      allocation: [{ assetGuid: '123456', values: [{ n: 1, value: new BN(300000000) }, { n: 0, value: new BN(200000000) }] }], ethaddress: Buffer.from('', 'hex')
    }
  }
},
{
  description: 'burn asset allocation to ethereum',
  version: utils.SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_ETHEREUM,
  txOpts: {
    rbf: true
  },
  feeRate: new BN(10),
  utxoObj: {
    utxos: [
      { txid: '26f6b17b715bcd5fda921108b3bedd9a3d89ea58c666a40a3e5a6f833a454e36', vout: 1, address: '001487e5ec8eb455b3bbf42c5d5f952f67c26793115d', value: '100000914', assetInfo: { assetGuid: '1635229536', value: '900000000' } }
    ],
    assets: [
      {
        assetGuid: '1635229536',
        decimals: 8,
        pubData: { desc: utils.encodeToBase64('publicvalue') },
        symbol: utils.encodeToBase64('CAT'),
        updateCapabilityFlags: 127,
        totalSupply: '0',
        maxSupply: '100000000000'
      }
    ]
  },
  assetOpts: { ethaddress: Buffer.from('9667de58c15475626165eaa4c9970e409e1181d0', 'hex') },
  sysChangeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
  assetMap: new Map([
    ['1635229536', { changeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', outputs: [{ value: new BN(100000000) }] }]
  ]),
  expected: {
    rbf: true,
    numOutputs: 2,
    script: Buffer.from('6a2101858addbd60020009014f00149667de58c15475626165eaa4c9970e409e1181d0', 'hex'),
    asset: {
      allocation: [{ assetGuid: '1635229536', values: [{ n: 0, value: new BN(100000000) }, { n: 1, value: new BN(800000000) }] }],
      ethaddress: Buffer.from('9667de58c15475626165eaa4c9970e409e1181d0', 'hex')
    }
  }
},
{
  description: 'burn asset allocation to ethereum multiple inputs',
  version: utils.SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_ETHEREUM,
  txOpts: {
    rbf: true
  },
  feeRate: new BN(10),
  utxoObj: {
    utxos: [
      { txid: '26f6b17b715bcd5fda921108b3bedd9a3d89ea58c666a40a3e5a6f833a454e36', vout: 1, address: '001487e5ec8eb455b3bbf42c5d5f952f67c26793115d', value: '980', assetInfo: { assetGuid: '1635229536', value: '900000000' } },
      { txid: '36f6b17b715ccd5fda921108b3bedd9a3d89ea58c666a40a3e5a6f833a454e36', vout: 0, address: '001497e5ec8eb455b3bba42c5d5f952f67c26793115d', value: '100000914' }
    ],
    assets: [
      {
        assetGuid: '1635229536',
        decimals: 8,
        pubData: { desc: utils.encodeToBase64('publicvalue') },
        symbol: utils.encodeToBase64('CAT'),
        updateCapabilityFlags: 127,
        totalSupply: '0',
        maxSupply: '100000000000'
      }
    ]
  },
  assetOpts: { ethaddress: Buffer.from('9667de58c15475626165eaa4c9970e409e1181d0', 'hex') },
  sysChangeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
  assetMap: new Map([
    ['1635229536', { changeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', outputs: [{ value: new BN(100000000) }] }]
  ]),
  expected: {
    rbf: true,
    numOutputs: 2,
    script: Buffer.from('6a2101858addbd60020009014f00149667de58c15475626165eaa4c9970e409e1181d0', 'hex'),
    asset: {
      allocation: [{ assetGuid: '1635229536', values: [{ n: 0, value: new BN(100000000) }, { n: 1, value: new BN(800000000) }] }],
      ethaddress: Buffer.from('9667de58c15475626165eaa4c9970e409e1181d0', 'hex')
    }
  }
},
{
  description: 'burn asset allocation to ethereum multiple inputs, change has asset',
  version: utils.SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_ETHEREUM,
  txOpts: {
    rbf: true
  },
  feeRate: new BN(10),
  utxoObj: {
    utxos: [
      { txid: '26f6b17b715bcd5fda921108b3bedd9a3d89ea58c666a40a3e5a6f833a454e36', vout: 1, address: '001487e5ec8eb455b3bbf42c5d5f952f67c26793115d', value: '980', assetInfo: { assetGuid: '1635229536', value: '900000000' } },
      { txid: '36f6b17b715ccd5fda921108b3bedd9a3d89ea58c666a40a3e5a6f833a454e36', vout: 0, address: '001497e5ec8eb455b3bba42c5d5f952f67c26793115d', value: '100000914', assetInfo: { assetGuid: '1635229536', value: '800000000' } }
    ],
    assets: [
      {
        assetGuid: '1635229536',
        decimals: 8,
        pubData: { desc: utils.encodeToBase64('publicvalue') },
        symbol: utils.encodeToBase64('CAT'),
        updateCapabilityFlags: 127,
        totalSupply: '0',
        maxSupply: '100000000000'
      }
    ]
  },
  assetOpts: { ethaddress: Buffer.from('9667de58c15475626165eaa4c9970e409e1181d0', 'hex') },
  sysChangeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
  assetMap: new Map([
    ['1635229536', { changeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', outputs: [{ value: new BN(100000000) }] }]
  ]),
  expected: {
    rbf: true,
    numOutputs: 2,
    script: Buffer.from('6a2201858addbd6002000901801500149667de58c15475626165eaa4c9970e409e1181d0', 'hex'),
    asset: {
      allocation: [{ assetGuid: '1635229536', values: [{ n: 0, value: new BN(100000000) }, { n: 1, value: new BN(1600000000) }] }],
      ethaddress: Buffer.from('9667de58c15475626165eaa4c9970e409e1181d0', 'hex')
    }
  }
},
{
  description: 'mint assetallocation',
  version: utils.SYSCOIN_TX_VERSION_ALLOCATION_MINT,
  txOpts: {
    rbf: true
  },
  feeRate: new BN(10),
  utxoObj: {
    utxos: [
      { txid: '64dbfb02268b642f6a32a266bdd54add8989a1fa913b7414a642b5d85e964c68', vout: 0, address: '001487e5ec8eb455b3bbf42c5d5f952f67c26793115d', value: '100000000', assetInfo: { assetGuid: '2305793883', value: '90000000' } },
      { txid: '9f586de3e6d8ce33b1c6de709c992cb431cc324ab3bc6dff5537137aa4b17022', vout: 1, address: '001487e5ec8eb455b3bbf42c5d5f952f67c26793115d', value: '6900', assetInfo: { assetGuid: '2369540753', value: '10000000' } }
    ],
    assets: [
      {
        assetGuid: '2305793883',
        decimals: 8,
        pubData: { desc: utils.encodeToBase64('publicvalue') },
        symbol: utils.encodeToBase64('CAT'),
        updateCapabilityFlags: 127,
        totalSupply: '0',
        maxSupply: '100000000000'
      },
      {
        assetGuid: '2369540753',
        decimals: 8,
        pubData: { desc: utils.encodeToBase64('publicvalue') },
        symbol: utils.encodeToBase64('CAT'),
        updateCapabilityFlags: 127,
        totalSupply: '0',
        maxSupply: '100000000000'
      }
    ]
  },
  assetOpts: {
    ethtxid: Buffer.from('3c3bfe141fcbe313f2afd31be1b63dd3a0147235161e637407fbb8605d3d294f', 'hex'),
    blockhash: Buffer.from('ee524852fb7df5a6c27106f4bc47e740e6a6751e66bce1f98363ff2eecbf8c0d', 'hex'),
    txvalue: Buffer.from('f9012b82051f843b9aca008307a120940765efb302d504751c652c5b1d65e8e9edf2e70f80b8c454c988ff00000000000000000000000000000000000000000000000000000002540be400000000000000000000000000000000000000000000000000000000009be8894b0000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000002c62637274317130667265323430737939326d716b386b6b377073616561366b74366d3537323570377964636a00000000000000000000000000000000000000002ca0dccb6e077c3f6252d199202113893407119d4ba09667113f2d20c63a31487b87a01e0a059e50f08f2772781691f2c9e43a9503a167c98cf467b1afc177b74d84e6', 'hex'),
    txroot: Buffer.from('842ab40a9c4770c8ec74158aadcf943e8158128fdd1ba8cef9c7cb8eda732692', 'hex'),
    txparentnodes: Buffer.from('f9039cf871a04442f3f69add48df0531fe3c0025103b53fcf3fe38060e5f29366caec8855e4fa0229f7b7e69c0b5793f8a61c06f5cc09b0f4938561856c632ee56c3b2c4d6d153808080808080a07720fff5e8eabef55fa129ee55b3b0d82875e2b25b8f26e22cf6b5c4f9cec7ab8080808080808080f901f180a03ee147749c5b769bc5d1a53e4f37567506d417de4ec4e67722130eda4638427da043caa62b40dad61bce4d50fb62ea485729a6687c3aa13895cf4ba234b92afe82a0b79958e4aa63104da4599ebb91e712375e6adfc89abc14b9533c5778f107e7d8a01bc7f80f81a8d281253ac882bb89aca6131e5794bfcbdccde990bb6d5be6cb2fa0aedad62f1426b68e395a59e06bf242fb28b882af67589bce3495a99650058ec4a0c21a7e0b9d0948bb6b65a5e73f5f01173064d20e4819ca4884d1eabc22bf737da090087708c533b10af8925eebf398c005fc16cb6a515111f2be4f328f762949d0a02827daacd6a52ae6c74a78791ff0c5e33a7a85f5ca0a47cdfbcd5219f75f705ca0af7ecf31d56575155d272cd813bf7d7ac435f62b0538c31771e407dafef6be53a09b74707c3abdbfa305cb61f23c940f063f553f17d0bd3013126aad357193353ea067a52ed59820bb48f8010d2b2bb0ee92803b1a00a8341fd4c3269b065ed070d9a0bf0e9b45955283e6e04b71eda63bfc7b55d9f54527943aa1c159b4161b1e1daea0ecabd4c00deacf9a7ff25be942c9f468628eb776fbec23a9ca0d8fc256f14a31a0df406c7ac7f38c2ea1d9bdb06c2e51db3de8cf0e655a8e0e683e19ca1ddf83d3a08360ec6c5e26614f144520ed9d0b577640381f0f38b5429b67422f75d603ad5a80f9013220b9012ef9012b82051f843b9aca008307a120940765efb302d504751c652c5b1d65e8e9edf2e70f80b8c454c988ff00000000000000000000000000000000000000000000000000000002540be400000000000000000000000000000000000000000000000000000000009be8894b0000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000002c62637274317130667265323430737939326d716b386b6b377073616561366b74366d3537323570377964636a00000000000000000000000000000000000000002ca0dccb6e077c3f6252d199202113893407119d4ba09667113f2d20c63a31487b87a01e0a059e50f08f2772781691f2c9e43a9503a167c98cf467b1afc177b74d84e6', 'hex'),
    txpath: Buffer.from('0b', 'hex'),
    receiptvalue: Buffer.from('f902e00183192ee2b9010000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000200000000000200000000000000008000000000000000000000100200000000000000000010000000000000200000000000000000000000000000000000010000000000000000000000000000004000000000000000000000000400004001000000000020000000000000000000000000080000000000000408000000040000000000000000002000000000000000000000000000000000000000000000000000000000010000000000000000010000000000000000000000000000000000000000000f901d5f89b94f2bb7bfa19e7c4b6bb333ee1afdf8e5e8f9b3561f863a0ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3efa0000000000000000000000000b0ea8c9ee8aa87efd28a12de8c034f947c144053a00000000000000000000000000765efb302d504751c652c5b1d65e8e9edf2e70fa000000000000000000000000000000000000000000000000000000002540be400f89b94f2bb7bfa19e7c4b6bb333ee1afdf8e5e8f9b3561f863a08c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925a0000000000000000000000000b0ea8c9ee8aa87efd28a12de8c034f947c144053a00000000000000000000000000765efb302d504751c652c5b1d65e8e9edf2e70fa00000000000000000000000000000000000000000000000000000000000000000f899940765efb302d504751c652c5b1d65e8e9edf2e70fe1a09c6dea23fe3b510bb5d170df49dc74e387692eaa3258c691918cd3aa94f5fb74b860000000000000000000000000b0ea8c9ee8aa87efd28a12de8c034f947c14405300000000000000000000000000000000000000000000000000000002540be4000000000000000000000000000000000000000000000000000000080800000002', 'hex'),
    receiptroot: Buffer.from('a958499bf48fcce17672b58aa9037bd3dafeb6231880722d909c60bacfaaa8d4', 'hex'),
    receiptparentnodes: Buffer.from('f90551f871a0cab13def05783d763febde31920bd234d0486c26955c2937e0486db909a28eeea09cf564a668a29a5f1cc5d6ef8e19988dfd2b30d290672f0ffc4200e608cb65ac808080808080a029b8ed2258c53562954c87bcd7f60671029680d2a19ef8bcd3ad470ea48d57d18080808080808080f901f180a07c21ca39872e6b8f611bc6b1b295c24f988b5cf944625eabf5236b37ea3b9f01a0edb9e63fdc31ba41f11a8b2fb8000ad1357b3c0b27a8483968d75e93e7b488a1a02231847aa3c5dde2f2a1851a66aabec65e5eaae8c28110756f122c72be1fba05a08fa87809e5b7f989e78ccbe1a6bc4924115d5747529af879f2fe196f959b64fca091f1bf748061eba21a413b72d70afccb8daebb5906d5cd9dda06d5f877065d5ba0d7e6c82dd1c25eb2f90b02f038beaff98c260d46992d0b3c1eac7d51552c7417a01d5c43deb2e3794292cdffb04f82ab25bc4e75f5e0cab928b66582e08026f5b1a0d7323a87dc8fbc66c7b34810d2cad92fc0da168d962b4556e825a3266a148b74a0af31f0b7cdcd6a855ac7678ef2b8fcb1afeda918b0c8e4696a4013f2b75ca402a0f9d63f2db8ab6d3c3e12073ac2910ee575832bde3e4586f18e59dd26a16adb7ca0f0c91e059c43780617d304fe8992511f096ccc35232da1f25127db53ba4fb05aa052030932d0a9026efd2a3ada67f33d401cd9a97ddb24c606af3a0a0c24e432aba0142af9b4686c6ca30b0ac39133fa76d8682b7bbbec488e62e652d3f25419777da0940f31617e91cfbabaa9d0d1638949f8125f80a43027122778522675194a4e65a0edc4c7d2cf30150fdf7e502d0ef06c80c85fc37260134a112493c6183f62f4b580f902e720b902e3f902e00183192ee2b9010000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000200000000000200000000000000008000000000000000000000100200000000000000000010000000000000200000000000000000000000000000000000010000000000000000000000000000004000000000000000000000000400004001000000000020000000000000000000000000080000000000000408000000040000000000000000002000000000000000000000000000000000000000000000000000000000010000000000000000010000000000000000000000000000000000000000000f901d5f89b94f2bb7bfa19e7c4b6bb333ee1afdf8e5e8f9b3561f863a0ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3efa0000000000000000000000000b0ea8c9ee8aa87efd28a12de8c034f947c144053a00000000000000000000000000765efb302d504751c652c5b1d65e8e9edf2e70fa000000000000000000000000000000000000000000000000000000002540be400f89b94f2bb7bfa19e7c4b6bb333ee1afdf8e5e8f9b3561f863a08c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925a0000000000000000000000000b0ea8c9ee8aa87efd28a12de8c034f947c144053a00000000000000000000000000765efb302d504751c652c5b1d65e8e9edf2e70fa00000000000000000000000000000000000000000000000000000000000000000f899940765efb302d504751c652c5b1d65e8e9edf2e70fe1a09c6dea23fe3b510bb5d170df49dc74e387692eaa3258c691918cd3aa94f5fb74b860000000000000000000000000b0ea8c9ee8aa87efd28a12de8c034f947c14405300000000000000000000000000000000000000000000000000000002540be4000000000000000000000000000000000000000000000000000000080800000002', 'hex')
  },
  sysChangeAddress: 'tsys1qp7qn0t0t6ymwhdwne9uku7v3dhw07a7tra8hzl',
  assetMap: new Map([
    ['2615707979', { changeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', outputs: [{ value: new BN(10000000000), address: 'tsys1qdflre2yd37qtpqe2ykuhwandlhq04r2td2t9ae' }] }]
  ]),
  expected: {
    rbf: true,
    version: utils.SYSCOIN_TX_VERSION_ALLOCATION_MINT,
    numOutputs: 3,
    script: Buffer.from('6a4d92090288dea1914b0100640087cabdbd5b010258003c3bfe141fcbe313f2afd31be1b63dd3a0147235161e637407fbb8605d3d294fee524852fb7df5a6c27106f4bc47e740e6a6751e66bce1f98363ff2eecbf8c0d7102fd9f03f9039cf871a04442f3f69add48df0531fe3c0025103b53fcf3fe38060e5f29366caec8855e4fa0229f7b7e69c0b5793f8a61c06f5cc09b0f4938561856c632ee56c3b2c4d6d153808080808080a07720fff5e8eabef55fa129ee55b3b0d82875e2b25b8f26e22cf6b5c4f9cec7ab8080808080808080f901f180a03ee147749c5b769bc5d1a53e4f37567506d417de4ec4e67722130eda4638427da043caa62b40dad61bce4d50fb62ea485729a6687c3aa13895cf4ba234b92afe82a0b79958e4aa63104da4599ebb91e712375e6adfc89abc14b9533c5778f107e7d8a01bc7f80f81a8d281253ac882bb89aca6131e5794bfcbdccde990bb6d5be6cb2fa0aedad62f1426b68e395a59e06bf242fb28b882af67589bce3495a99650058ec4a0c21a7e0b9d0948bb6b65a5e73f5f01173064d20e4819ca4884d1eabc22bf737da090087708c533b10af8925eebf398c005fc16cb6a515111f2be4f328f762949d0a02827daacd6a52ae6c74a78791ff0c5e33a7a85f5ca0a47cdfbcd5219f75f705ca0af7ecf31d56575155d272cd813bf7d7ac435f62b0538c31771e407dafef6be53a09b74707c3abdbfa305cb61f23c940f063f553f17d0bd3013126aad357193353ea067a52ed59820bb48f8010d2b2bb0ee92803b1a00a8341fd4c3269b065ed070d9a0bf0e9b45955283e6e04b71eda63bfc7b55d9f54527943aa1c159b4161b1e1daea0ecabd4c00deacf9a7ff25be942c9f468628eb776fbec23a9ca0d8fc256f14a31a0df406c7ac7f38c2ea1d9bdb06c2e51db3de8cf0e655a8e0e683e19ca1ddf83d3a08360ec6c5e26614f144520ed9d0b577640381f0f38b5429b67422f75d603ad5a80f9013220b9012ef9012b82051f843b9aca008307a120940765efb302d504751c652c5b1d65e8e9edf2e70f80b8c454c988ff00000000000000000000000000000000000000000000000000000002540be400000000000000000000000000000000000000000000000000000000009be8894b0000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000002c62637274317130667265323430737939326d716b386b6b377073616561366b74366d3537323570377964636a00000000000000000000000000000000000000002ca0dccb6e077c3f6252d199202113893407119d4ba09667113f2d20c63a31487b87a01e0a059e50f08f2772781691f2c9e43a9503a167c98cf467b1afc177b74d84e6010b7102fd5405f90551f871a0cab13def05783d763febde31920bd234d0486c26955c2937e0486db909a28eeea09cf564a668a29a5f1cc5d6ef8e19988dfd2b30d290672f0ffc4200e608cb65ac808080808080a029b8ed2258c53562954c87bcd7f60671029680d2a19ef8bcd3ad470ea48d57d18080808080808080f901f180a07c21ca39872e6b8f611bc6b1b295c24f988b5cf944625eabf5236b37ea3b9f01a0edb9e63fdc31ba41f11a8b2fb8000ad1357b3c0b27a8483968d75e93e7b488a1a02231847aa3c5dde2f2a1851a66aabec65e5eaae8c28110756f122c72be1fba05a08fa87809e5b7f989e78ccbe1a6bc4924115d5747529af879f2fe196f959b64fca091f1bf748061eba21a413b72d70afccb8daebb5906d5cd9dda06d5f877065d5ba0d7e6c82dd1c25eb2f90b02f038beaff98c260d46992d0b3c1eac7d51552c7417a01d5c43deb2e3794292cdffb04f82ab25bc4e75f5e0cab928b66582e08026f5b1a0d7323a87dc8fbc66c7b34810d2cad92fc0da168d962b4556e825a3266a148b74a0af31f0b7cdcd6a855ac7678ef2b8fcb1afeda918b0c8e4696a4013f2b75ca402a0f9d63f2db8ab6d3c3e12073ac2910ee575832bde3e4586f18e59dd26a16adb7ca0f0c91e059c43780617d304fe8992511f096ccc35232da1f25127db53ba4fb05aa052030932d0a9026efd2a3ada67f33d401cd9a97ddb24c606af3a0a0c24e432aba0142af9b4686c6ca30b0ac39133fa76d8682b7bbbec488e62e652d3f25419777da0940f31617e91cfbabaa9d0d1638949f8125f80a43027122778522675194a4e65a0edc4c7d2cf30150fdf7e502d0ef06c80c85fc37260134a112493c6183f62f4b580f902e720b902e3f902e00183192ee2b9010000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000200000000000200000000000000008000000000000000000000100200000000000000000010000000000000200000000000000000000000000000000000010000000000000000000000000000004000000000000000000000000400004001000000000020000000000000000000000000080000000000000408000000040000000000000000002000000000000000000000000000000000000000000000000000000000010000000000000000010000000000000000000000000000000000000000000f901d5f89b94f2bb7bfa19e7c4b6bb333ee1afdf8e5e8f9b3561f863a0ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3efa0000000000000000000000000b0ea8c9ee8aa87efd28a12de8c034f947c144053a00000000000000000000000000765efb302d504751c652c5b1d65e8e9edf2e70fa000000000000000000000000000000000000000000000000000000002540be400f89b94f2bb7bfa19e7c4b6bb333ee1afdf8e5e8f9b3561f863a08c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925a0000000000000000000000000b0ea8c9ee8aa87efd28a12de8c034f947c144053a00000000000000000000000000765efb302d504751c652c5b1d65e8e9edf2e70fa00000000000000000000000000000000000000000000000000000000000000000f899940765efb302d504751c652c5b1d65e8e9edf2e70fe1a09c6dea23fe3b510bb5d170df49dc74e387692eaa3258c691918cd3aa94f5fb74b860000000000000000000000000b0ea8c9ee8aa87efd28a12de8c034f947c14405300000000000000000000000000000000000000000000000000000002540be4000000000000000000000000000000000000000000000000000000080800000002842ab40a9c4770c8ec74158aadcf943e8158128fdd1ba8cef9c7cb8eda732692a958499bf48fcce17672b58aa9037bd3dafeb6231880722d909c60bacfaaa8d4', 'hex'),
    asset: {
      allocation: [{ assetGuid: '2615707979', values: [{ n: 0, value: new BN(10000000000) }] }, { assetGuid: '2305793883', values: [{ n: 2, value: new BN(90000000) }] }],
      ethtxid: Buffer.from('3c3bfe141fcbe313f2afd31be1b63dd3a0147235161e637407fbb8605d3d294f', 'hex'),
      blockhash: Buffer.from('ee524852fb7df5a6c27106f4bc47e740e6a6751e66bce1f98363ff2eecbf8c0d', 'hex'),
      txpos: 625,
      txroot: Buffer.from('842ab40a9c4770c8ec74158aadcf943e8158128fdd1ba8cef9c7cb8eda732692', 'hex'),
      txparentnodes: Buffer.from('f9039cf871a04442f3f69add48df0531fe3c0025103b53fcf3fe38060e5f29366caec8855e4fa0229f7b7e69c0b5793f8a61c06f5cc09b0f4938561856c632ee56c3b2c4d6d153808080808080a07720fff5e8eabef55fa129ee55b3b0d82875e2b25b8f26e22cf6b5c4f9cec7ab8080808080808080f901f180a03ee147749c5b769bc5d1a53e4f37567506d417de4ec4e67722130eda4638427da043caa62b40dad61bce4d50fb62ea485729a6687c3aa13895cf4ba234b92afe82a0b79958e4aa63104da4599ebb91e712375e6adfc89abc14b9533c5778f107e7d8a01bc7f80f81a8d281253ac882bb89aca6131e5794bfcbdccde990bb6d5be6cb2fa0aedad62f1426b68e395a59e06bf242fb28b882af67589bce3495a99650058ec4a0c21a7e0b9d0948bb6b65a5e73f5f01173064d20e4819ca4884d1eabc22bf737da090087708c533b10af8925eebf398c005fc16cb6a515111f2be4f328f762949d0a02827daacd6a52ae6c74a78791ff0c5e33a7a85f5ca0a47cdfbcd5219f75f705ca0af7ecf31d56575155d272cd813bf7d7ac435f62b0538c31771e407dafef6be53a09b74707c3abdbfa305cb61f23c940f063f553f17d0bd3013126aad357193353ea067a52ed59820bb48f8010d2b2bb0ee92803b1a00a8341fd4c3269b065ed070d9a0bf0e9b45955283e6e04b71eda63bfc7b55d9f54527943aa1c159b4161b1e1daea0ecabd4c00deacf9a7ff25be942c9f468628eb776fbec23a9ca0d8fc256f14a31a0df406c7ac7f38c2ea1d9bdb06c2e51db3de8cf0e655a8e0e683e19ca1ddf83d3a08360ec6c5e26614f144520ed9d0b577640381f0f38b5429b67422f75d603ad5a80f9013220b9012ef9012b82051f843b9aca008307a120940765efb302d504751c652c5b1d65e8e9edf2e70f80b8c454c988ff00000000000000000000000000000000000000000000000000000002540be400000000000000000000000000000000000000000000000000000000009be8894b0000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000002c62637274317130667265323430737939326d716b386b6b377073616561366b74366d3537323570377964636a00000000000000000000000000000000000000002ca0dccb6e077c3f6252d199202113893407119d4ba09667113f2d20c63a31487b87a01e0a059e50f08f2772781691f2c9e43a9503a167c98cf467b1afc177b74d84e6', 'hex'),
      txpath: Buffer.from('0b', 'hex'),
      receiptpos: 625,
      receiptroot: Buffer.from('a958499bf48fcce17672b58aa9037bd3dafeb6231880722d909c60bacfaaa8d4', 'hex'),
      receiptparentnodes: Buffer.from('f90551f871a0cab13def05783d763febde31920bd234d0486c26955c2937e0486db909a28eeea09cf564a668a29a5f1cc5d6ef8e19988dfd2b30d290672f0ffc4200e608cb65ac808080808080a029b8ed2258c53562954c87bcd7f60671029680d2a19ef8bcd3ad470ea48d57d18080808080808080f901f180a07c21ca39872e6b8f611bc6b1b295c24f988b5cf944625eabf5236b37ea3b9f01a0edb9e63fdc31ba41f11a8b2fb8000ad1357b3c0b27a8483968d75e93e7b488a1a02231847aa3c5dde2f2a1851a66aabec65e5eaae8c28110756f122c72be1fba05a08fa87809e5b7f989e78ccbe1a6bc4924115d5747529af879f2fe196f959b64fca091f1bf748061eba21a413b72d70afccb8daebb5906d5cd9dda06d5f877065d5ba0d7e6c82dd1c25eb2f90b02f038beaff98c260d46992d0b3c1eac7d51552c7417a01d5c43deb2e3794292cdffb04f82ab25bc4e75f5e0cab928b66582e08026f5b1a0d7323a87dc8fbc66c7b34810d2cad92fc0da168d962b4556e825a3266a148b74a0af31f0b7cdcd6a855ac7678ef2b8fcb1afeda918b0c8e4696a4013f2b75ca402a0f9d63f2db8ab6d3c3e12073ac2910ee575832bde3e4586f18e59dd26a16adb7ca0f0c91e059c43780617d304fe8992511f096ccc35232da1f25127db53ba4fb05aa052030932d0a9026efd2a3ada67f33d401cd9a97ddb24c606af3a0a0c24e432aba0142af9b4686c6ca30b0ac39133fa76d8682b7bbbec488e62e652d3f25419777da0940f31617e91cfbabaa9d0d1638949f8125f80a43027122778522675194a4e65a0edc4c7d2cf30150fdf7e502d0ef06c80c85fc37260134a112493c6183f62f4b580f902e720b902e3f902e00183192ee2b9010000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000200000000000200000000000000008000000000000000000000100200000000000000000010000000000000200000000000000000000000000000000000010000000000000000000000000000004000000000000000000000000400004001000000000020000000000000000000000000080000000000000408000000040000000000000000002000000000000000000000000000000000000000000000000000000000010000000000000000010000000000000000000000000000000000000000000f901d5f89b94f2bb7bfa19e7c4b6bb333ee1afdf8e5e8f9b3561f863a0ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3efa0000000000000000000000000b0ea8c9ee8aa87efd28a12de8c034f947c144053a00000000000000000000000000765efb302d504751c652c5b1d65e8e9edf2e70fa000000000000000000000000000000000000000000000000000000002540be400f89b94f2bb7bfa19e7c4b6bb333ee1afdf8e5e8f9b3561f863a08c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925a0000000000000000000000000b0ea8c9ee8aa87efd28a12de8c034f947c144053a00000000000000000000000000765efb302d504751c652c5b1d65e8e9edf2e70fa00000000000000000000000000000000000000000000000000000000000000000f899940765efb302d504751c652c5b1d65e8e9edf2e70fe1a09c6dea23fe3b510bb5d170df49dc74e387692eaa3258c691918cd3aa94f5fb74b860000000000000000000000000b0ea8c9ee8aa87efd28a12de8c034f947c14405300000000000000000000000000000000000000000000000000000002540be4000000000000000000000000000000000000000000000000000000080800000002', 'hex')
    }
  }
},
{
  description: 'sys to sysx',
  version: utils.SYSCOIN_TX_VERSION_SYSCOIN_BURN_TO_ALLOCATION,
  txOpts: {
    rbf: true
  },
  feeRate: new BN(10),
  utxoObj: {
    utxos: [
      { txid: '64dbfb02268b642f6a32a266bdd54add8989a1fa913b7414a642b5d85e964c68', vout: 0, address: '001487e5ec8eb455b3bbf42c5d5f952f67c26793115d', value: '1000000' },
      { txid: '9f586de3e6d8ce33b1c6de709c992cb431cc324ab3bc6dff5537137aa4b17022', vout: 1, address: '001487e5ec8eb455b3bbf42c5d5f952f67c26793115d', value: '6900' }
    ],
    assets: [
    ]
  },
  sysChangeAddress: 'tsys1qp7qn0t0t6ymwhdwne9uku7v3dhw07a7tra8hzl',
  assetMap: new Map([
    ['2615707979', { changeAddress: 'tsys1qjfcltq5yljfzkljxdnlc0ffmhqudz8ltq0z695', outputs: [{ value: new BN(1000000), address: 'tsys1qdflre2yd37qtpqe2ykuhwandlhq04r2td2t9ae' }] }]
  ]),
  expected: {
    rbf: true,
    version: utils.SYSCOIN_TX_VERSION_SYSCOIN_BURN_TO_ALLOCATION,
    numOutputs: 3,
    script: Buffer.from('6a0a0188dea1914b01000700', 'hex'),
    asset: {
      allocation: [{ assetGuid: '2615707979', values: [{ n: 0, value: new BN(1000000) }] }]
    },
    receivingIndex: 11,
    changeIndex: 3
  }
},
{
  description: 'sys to sysx with asset inputs',
  version: utils.SYSCOIN_TX_VERSION_SYSCOIN_BURN_TO_ALLOCATION,
  txOpts: {
    rbf: true
  },
  feeRate: new BN(10),
  utxoObj: {
    utxos: [
      { txid: '64dbfb02268b642f6a32a266bdd54add8989a1fa913b7414a642b5d85e964c68', vout: 0, address: '001487e5ec8eb455b3bbf42c5d5f952f67c26793115d', value: '1000000', assetInfo: { assetGuid: '2305793883', value: '90000000' } },
      { txid: '9f586de3e6d8ce33b1c6de709c992cb431cc324ab3bc6dff5537137aa4b17022', vout: 1, address: '001487e5ec8eb455b3bbf42c5d5f952f67c26793115d', value: '6900', assetInfo: { assetGuid: '2369540753', value: '10000000' } }
    ],
    assets: [
      {
        assetGuid: '2305793883',
        decimals: 8,
        pubData: { desc: utils.encodeToBase64('publicvalue') },
        symbol: utils.encodeToBase64('CAT'),
        updateCapabilityFlags: 127,
        totalSupply: '0',
        maxSupply: '100000000000'
      },
      {
        assetGuid: '2369540753',
        decimals: 8,
        pubData: { desc: utils.encodeToBase64('publicvalue') },
        symbol: utils.encodeToBase64('CAT'),
        updateCapabilityFlags: 127,
        totalSupply: '0',
        maxSupply: '100000000000'
      }
    ]
  },
  sysChangeAddress: 'tsys1qp7qn0t0t6ymwhdwne9uku7v3dhw07a7tra8hzl',
  assetMap: new Map([
    ['2615707979', { changeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', outputs: [{ value: new BN(900000), address: 'tsys1qdflre2yd37qtpqe2ykuhwandlhq04r2td2t9ae' }] }]
  ]),
  expected: {
    rbf: true,
    version: utils.SYSCOIN_TX_VERSION_SYSCOIN_BURN_TO_ALLOCATION,
    numOutputs: 3,
    script: Buffer.from('6a130288dea1914b0100560087cabdbd5b01025800', 'hex'),
    asset: {
      allocation: [{ assetGuid: '2615707979', values: [{ n: 0, value: new BN(900000) }] }, { assetGuid: '2305793883', values: [{ n: 2, value: new BN(90000000) }] }]
    }
  }
},
{
  description: 'sys to sysx with sysx input',
  version: utils.SYSCOIN_TX_VERSION_SYSCOIN_BURN_TO_ALLOCATION,
  txOpts: {
    rbf: true
  },
  feeRate: new BN(10),
  utxoObj: {
    utxos: [
      { txid: '64dbfb02268b642f6a32a266bdd54add8989a1fa913b7414a642b5d85e964c68', vout: 0, address: '001487e5ec8eb455b3bbf42c5d5f952f67c26793115d', value: '10000000000', assetInfo: { assetGuid: '2615707979', value: '90000000' } },
      { txid: '9f586de3e6d8ce33b1c6de709c992cb431cc324ab3bc6dff5537137aa4b17022', vout: 1, address: '001487e5ec8eb455b3bbf42c5d5f952f67c26793115d', value: '6900', assetInfo: { assetGuid: '2369540753', value: '10000000' } }
    ],
    assets: [
      {
        assetGuid: '2615707979',
        decimals: 8,
        pubData: { desc: utils.encodeToBase64('publicvalue') },
        symbol: utils.encodeToBase64('CAT'),
        updateCapabilityFlags: 127,
        totalSupply: '0',
        maxSupply: '100000000000'
      },
      {
        assetGuid: '2369540753',
        decimals: 8,
        pubData: { desc: utils.encodeToBase64('publicvalue') },
        symbol: utils.encodeToBase64('CAT'),
        updateCapabilityFlags: 127,
        totalSupply: '0',
        maxSupply: '100000000000'
      }
    ]
  },
  sysChangeAddress: 'tsys1qp7qn0t0t6ymwhdwne9uku7v3dhw07a7tra8hzl',
  assetMap: new Map([
    ['2615707979', { changeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', outputs: [{ value: new BN(900000000), address: 'tsys1qdflre2yd37qtpqe2ykuhwandlhq04r2td2t9ae' }] }]
  ]),
  expected: {
    rbf: true,
    version: utils.SYSCOIN_TX_VERSION_SYSCOIN_BURN_TO_ALLOCATION,
    numOutputs: 3,
    script: Buffer.from('6a0c0188dea1914b020059025800', 'hex'),
    asset: {
      allocation: [{ assetGuid: '2615707979', values: [{ n: 0, value: new BN(900000000) }, { n: 2, value: new BN(90000000) }] }]
    }
  }
},
{
  description: 'create blob',
  version: utils.SYSCOIN_TX_VERSION_NEVM_DATA,
  txOpts: {
    rbf: true,
    blobData: Buffer.from('64dbfb02268b642f6a32a266bdd54add8989a1fa913b7414a642b5d85e964c68aa', 'hex'),
    blobHash: Buffer.from('f991f396a7ff769af02e0bd4cefe5c61e952eab289254348d49723da1fe420c9', 'hex')
  },
  feeRate: new BN(10),
  utxoObj: {
    utxos: [
      { txid: '64dbfb02268b642f6a32a266bdd54add8989a1fa913b7414a642b5d85e964c68', vout: 0, address: '001487e5ec8eb455b3bbf42c5d5f952f67c26793115d', value: '1000000' },
      { txid: '9f586de3e6d8ce33b1c6de709c992cb431cc324ab3bc6dff5537137aa4b17022', vout: 1, address: '001487e5ec8eb455b3bbf42c5d5f952f67c26793115d', value: '6900' }
    ]
  },
  sysChangeAddress: 'tsys1qp7qn0t0t6ymwhdwne9uku7v3dhw07a7tra8hzl',
  expected: {
    rbf: true,
    version: utils.SYSCOIN_TX_VERSION_NEVM_DATA,
    numOutputs: 2,
    script: Buffer.from('6a2120f991f396a7ff769af02e0bd4cefe5c61e952eab289254348d49723da1fe420c9', 'hex')
  }
},
{
  description: 'standard sys send',
  version: 2,
  txOpts: {
    rbf: true
  },
  feeRate: new BN(10),
  utxoObj: {
    utxos: [
      { txid: '26f6b17b715bcd5fda921108b3bedd9a3d89ea58c666a40a3e5a6f833a454e36', vout: 1, address: '001487e5ec8eb455b3bbf42c5d5f952f67c26793115d', value: '100000000' },
      { txid: '36f6b17b715ccd5fda921108b3bedd9a3d89ea58c666a40a3e5a6f833a454e36', vout: 0, address: '001497e5ec8eb455b3bba42c5d5f952f67c26793115d', value: '100000914' }
    ]
  },
  sysChangeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
  outputs: [
    { address: 'bc1qc7slrfxkknqcq2jevvvkdgvrt8080852dfjewde450xdlk4ugp7szw5tk9', value: new BN(150000000) }
  ],
  expected: {
    rbf: true,
    version: 2,
    numOutputs: 2
  }
},
{
  description: 'standard sys send with memo',
  version: 2,
  txOpts: {
    rbf: true,
    memo: Buffer.from('test'),
    memoHeader: memoHeader
  },
  feeRate: new BN(10),
  utxoObj: {
    utxos: [
      { txid: '26f6b17b715bcd5fda921108b3bedd9a3d89ea58c666a40a3e5a6f833a454e36', vout: 1, address: '001487e5ec8eb455b3bbf42c5d5f952f67c26793115d', value: '100000000' },
      { txid: '36f6b17b715ccd5fda921108b3bedd9a3d89ea58c666a40a3e5a6f833a454e36', vout: 0, address: '001497e5ec8eb455b3bba42c5d5f952f67c26793115d', value: '100000914' }
    ]
  },
  sysChangeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
  outputs: [
    { address: 'bc1qc7slrfxkknqcq2jevvvkdgvrt8080852dfjewde450xdlk4ugp7szw5tk9', value: new BN(150000000) }
  ],
  expected: {
    rbf: true,
    version: 2,
    numOutputs: 3,
    memo: Buffer.from('test')
  }
},
{
  description: 'standard sys send with memo in hex',
  version: 2,
  txOpts: {
    rbf: true,
    memo: Buffer.from('26f6b17b715bcd5fda921108b3bedd9a3d89ea58c666a40a3e5a6f833a454e36'),
    memoHeader: memoHeader
  },
  feeRate: new BN(10),
  utxoObj: {
    utxos: [
      { txid: '26f6b17b715bcd5fda921108b3bedd9a3d89ea58c666a40a3e5a6f833a454e36', vout: 1, address: '001487e5ec8eb455b3bbf42c5d5f952f67c26793115d', value: '100000000' },
      { txid: '36f6b17b715ccd5fda921108b3bedd9a3d89ea58c666a40a3e5a6f833a454e36', vout: 0, address: '001497e5ec8eb455b3bba42c5d5f952f67c26793115d', value: '100000914' }
    ]
  },
  sysChangeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
  outputs: [
    { address: 'bc1qc7slrfxkknqcq2jevvvkdgvrt8080852dfjewde450xdlk4ugp7szw5tk9', value: new BN(150000000) }
  ],
  expected: {
    rbf: true,
    version: 2,
    numOutputs: 3,
    memo: Buffer.from('test')
  }
},
{
  description: 'standard sys send with asset inputs',
  version: 2,
  txOpts: {
    rbf: true
  },
  feeRate: new BN(10),
  utxoObj: {
    utxos: [
      { txid: '26f6b17b715bcd5fda921108b3bedd9a3d89ea58c666a40a3e5a6f833a454e36', vout: 1, address: '001487e5ec8eb455b3bbf42c5d5f952f67c26793115d', value: '100000000', assetInfo: { assetGuid: '1635229536', value: '900000000' } },
      { txid: '36f6b17b715ccd5fda921108b3bedd9a3d89ea58c666a40a3e5a6f833a454e36', vout: 0, address: '001497e5ec8eb455b3bba42c5d5f952f67c26793115d', value: '100000914', assetInfo: { assetGuid: '1635229536', value: '800000000' } }
    ],
    assets: [
      {
        assetGuid: '1635229536',
        decimals: 8,
        pubData: { desc: utils.encodeToBase64('publicvalue') },
        symbol: utils.encodeToBase64('CAT'),
        updateCapabilityFlags: 127,
        totalSupply: '0',
        maxSupply: '100000000000'
      }
    ]
  },
  sysChangeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
  outputs: [
    { address: 'bc1qc7slrfxkknqcq2jevvvkdgvrt8080852dfjewde450xdlk4ugp7szw5tk9', value: new BN(150000000) }
  ],
  expected: {
    rbf: true,
    version: utils.SYSCOIN_TX_VERSION_ALLOCATION_SEND,
    numOutputs: 3, // 3 because new opreturn will be created
    script: Buffer.from('6a0b01858addbd600101801f00', 'hex'),
    asset: {
      allocation: [{ assetGuid: '1635229536', values: [{ n: 1, value: new BN(1700000000) }] }]
    }
  }
},
{
  description: 'standard sys send with asset input and regular input',
  version: 2,
  txOpts: {
    rbf: false
  },
  feeRate: new BN(10),
  utxoObj: {
    utxos: [
      { txid: '26f6b17b715bcd5fda921108b3bedd9a3d89ea58c666a40a3e5a6f833a454e36', vout: 1, address: '001487e5ec8eb455b3bbf42c5d5f952f67c26793115d', value: '100000000', assetInfo: { assetGuid: '1635229536', value: '900000000' } },
      { txid: '36f6b17b715ccd5fda921108b3bedd9a3d89ea58c666a40a3e5a6f833a454e36', vout: 0, address: '001497e5ec8eb455b3bba42c5d5f952f67c26793115d', value: '100000914' }
    ],
    assets: [
      {
        assetGuid: '1635229536',
        decimals: 8,
        pubData: { desc: utils.encodeToBase64('publicvalue') },
        symbol: utils.encodeToBase64('CAT'),
        updateCapabilityFlags: 127,
        totalSupply: '0',
        maxSupply: '100000000000'
      }
    ]
  },
  sysChangeAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
  outputs: [
    { address: 'bc1qc7slrfxkknqcq2jevvvkdgvrt8080852dfjewde450xdlk4ugp7szw5tk9', value: new BN(150000000) }
  ],
  expected: {
    rbf: false,
    version: utils.SYSCOIN_TX_VERSION_ALLOCATION_SEND,
    numOutputs: 3, // 3 because new opreturn will be created
    script: Buffer.from('6a0a01858addbd6001015900', 'hex'),
    asset: {
      allocation: [{ assetGuid: '1635229536', values: [{ n: 1, value: new BN(900000000) }] }]
    }
  }
}
]
