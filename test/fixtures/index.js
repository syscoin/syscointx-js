var BN = require('bn.js')
var utils = require('../utils')

module.exports = [{
  description: 'new asset',
  version: utils.SYSCOIN_TX_VERSION_ASSET_ACTIVATE,
  feeRate: new BN(10),
  utxos: [
    {txId: '58c6e8163247f7c3fe1f36762eb1d0e2bc9bd438a5cf1823ed57ffa90b1663e8', vout: 0, script: '0014005a9faa5bd4e40aa97e456fe177deea6ce7109a', value: new ext.BN(100000000000) },
  ],
  assetOpts: {precision: 8, contract: 'contractaddr', pubdata: 'publicvalue', symbol: 'CAT', updateflags: 31, prevcontract: '', prevpubdata: '', balance: new ext.BN(10000000000), maxsupply: new ext.BN(100000000000), },
  sysChangeAddress: '',
  expected: {
    script: ''
  }
}
]
