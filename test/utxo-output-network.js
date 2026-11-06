const test = require('tape')
const BN = require('bn.js')
const bitcoin = require('bitcoinjs-lib')
const { createTransaction, utils } = require('..')

const litecoin = { ...utils.bitcoinNetworks.mainnet, bech32: 'ltc', pubKeyHash: 48, scriptHash: 50 }
function payment (network, byte) {
  return bitcoin.payments.p2wpkh({ hash: Buffer.alloc(20, byte), network })
}

test('native payment binds recipient and change to the selected output network', t => {
  const { address: change, output: changeScript } = payment(litecoin, 1)
  const { address: recipient, output: recipientScript } = payment(litecoin, 2)
  const send = (network, address = recipient, script) => createTransaction(
    { rbf: true },
    {
      assets: new Map(),
      utxos: [{
        type: 'BECH32', address: change, txId: 'a1'.repeat(32), vout: 0, value: new BN(100000)
      }]
    },
    change, [{ address, value: new BN(40000), ...(script ? { script } : {}) }], new BN(1), network
  )
  const result = send(litecoin)
  t.notOk(result.error)
  t.equal(result.outputs.length, 2)
  t.deepEqual(result.outputs.map(({ address }) => Buffer.from(bitcoin.address.toOutputScript(address, litecoin))),
    [Buffer.from(recipientScript), Buffer.from(changeScript)])
  t.equal(send().error, 'INVALID_OUTPUT_SCRIPT', 'requires the selected network')
  t.equal(send(utils.bitcoinNetworks.mainnet).error, 'INVALID_OUTPUT_SCRIPT')
  t.equal(send(litecoin, payment(utils.bitcoinNetworks.mainnet, 2).address, recipientScript).error, 'INVALID_OUTPUT_SCRIPT',
    'same script with another chain encoding cannot bypass the destination check')
  t.end()
})

test('asset outputs and their change cannot fall back to another address network', t => {
  const testnet = utils.syscoinNetworks.testnet
  const { address: change } = payment(testnet, 1)
  const { address: foreign } = payment(utils.bitcoinNetworks.mainnet, 2)
  const map = new Map([['123456', {
    changeAddress: change,
    outputs: [{ address: foreign, value: new BN(1) }]
  }]])
  const utxos = { utxos: [], assets: new Map() }
  const send = network => require('..').assetAllocationSend({ rbf: true }, utxos, map, change, new BN(1), network)
  t.equal(send().error, 'INVALID_OUTPUT_SCRIPT')
  t.equal(send(testnet).error, 'INVALID_OUTPUT_SCRIPT')
  t.end()
})
