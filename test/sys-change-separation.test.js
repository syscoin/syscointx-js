const tape = require('tape')
const BN = require('bn.js')
const syscointx = require('../')

const ADDRESS = 'tsys1quracwgy4t3fwlf3ugs25tgkc9qmtf95cmqqt96'
const SYSX_ASSET_GUID = '123456'

tape('SYS to SYSX keeps large native change asset-free', t => {
  const utxos = {
    assets: new Map(),
    utxos: [
      {
        type: 'BECH32',
        address: ADDRESS,
        txId: '70dbc8223d62fd417a2086e136fa8f03e084b1de5bce88121e15d6b991af7964',
        vout: 0,
        value: new BN('3000000000')
      }
    ]
  }
  const assetMap = new Map([
    [SYSX_ASSET_GUID, {
      changeAddress: ADDRESS,
      outputs: [{ value: new BN('10000000'), address: ADDRESS }]
    }]
  ])

  const result = syscointx.syscoinBurnToAssetAllocation(
    { rbf: true },
    utxos,
    assetMap,
    ADDRESS,
    new BN(10)
  )

  t.ok(result.success, 'transaction is created')
  t.equal(result.outputs.length, 3, 'asset, burn, and SYS change stay separate')

  const sysChange = result.outputs.find(output => output.changeIndex !== undefined)
  t.ok(sysChange, 'native SYS change output exists')
  t.notOk(sysChange.assetInfo, 'native SYS change has no asset metadata')
  t.ok(sysChange.value.gt(new BN('2980000000')), 'native SYS remains available for later mint fees')

  const sysxOutput = result.outputs.find(output => output.assetInfo?.assetGuid === SYSX_ASSET_GUID)
  t.ok(sysxOutput, 'SYSX allocation output exists')
  t.equal(sysxOutput.assetInfo.value.toString(), '10000000', 'SYSX amount is preserved')
  t.end()
})
