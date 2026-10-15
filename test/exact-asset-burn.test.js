const tape = require('tape')
const BN = require('bn.js')
const bitcoin = require('bitcoinjs-lib')
const syscointx = require('../')
const bufferUtils = require('../bufferutilsassets')

const ADDRESS = 'tsys1quracwgy4t3fwlf3ugs25tgkc9qmtf95cmqqt96'
const DESTINATION = 'tsys1qdflre2yd37qtpqe2ykuhwandlhq04r2td2t9ae'
const SYSX_ASSET_GUID = '123456'
const SYSX_AMOUNT = new BN('10000000')

function exactSysxUtxos () {
  return {
    assets: new Map(),
    utxos: [
      {
        type: 'BECH32',
        address: ADDRESS,
        txId: 'bcc5ffea63a4edebe771cbc60713ac9313b006f5dcde5e523028614e1c97a161',
        vout: 1,
        value: new BN('2989998650'),
        assetInfo: {
          assetGuid: SYSX_ASSET_GUID,
          value: SYSX_AMOUNT
        }
      }
    ]
  }
}

function exactSysxAssetMap () {
  return new Map([
    [SYSX_ASSET_GUID, {
      changeAddress: DESTINATION,
      outputs: [{ value: SYSX_AMOUNT }]
    }]
  ])
}

function allocationsFromResult (result) {
  const opReturn = result.outputs.find(output => output.script)
  const chunks = bitcoin.script.decompile(opReturn.script)
  return bufferUtils.deserializeAssetAllocations(Buffer.from(chunks[1]))
}

function finalEconomics (t, result) {
  const allocations = allocationsFromResult(result)
  const dataIndex = result.outputs.findIndex(output => output.script)
  const burn = allocations[0].values.find(value => value.n === dataIndex).value
  const input = result.inputs.reduce((total, row) => total.add(row.value), new BN(0))
  const output = result.outputs.reduce((total, row) => total.add(row.value), new BN(0))
  const nativeMint = result.txVersion === 138 ? burn : new BN(0)
  const actualFee = input.add(nativeMint).sub(output)
  t.ok(actualFee.gte(new BN(0)), 'native outputs plus fee are fully funded')
  t.equal(result.fee.toString(), actualFee.toString(), 'reported fee matches final native accounting')
  for (const row of result.outputs.filter(output => !output.script)) {
    const script = Buffer.from(bitcoin.address.toOutputScript(row.address, syscointx.utils.syscoinNetworks.testnet))
    const witness = script.length >= 4 && script.length <= 42 && (script[0] === 0 || (script[0] >= 0x51 && script[0] <= 0x60)) && script[1] + 2 === script.length
    const floor = new BN((8 + 1 + script.length + (witness ? 67 : 148)) * 3)
    t.ok(row.value.gte(floor), 'every retained spendable native output meets its actual script floor')
    t.deepEqual(row.scriptPubKey, script, 'separate script metadata matches the serialized address')
  }
  t.equal(result.outputs[dataIndex].value.toString(), '0', 'burn OP_RETURN native value remains zero')
  t.equal(burn.toString(), SYSX_AMOUNT.toString(), 'exact asset burn amount is unchanged')
}

tape('exact SYSX burn to NEVM does not leave stale asset output metadata', t => {
  const result = syscointx.assetAllocationBurn(
    { ethaddress: Buffer.alloc(20, 1) },
    { rbf: true },
    exactSysxUtxos(),
    exactSysxAssetMap(),
    ADDRESS,
    new BN(10)
  )

  t.ok(result.success, 'transaction is created')
  if (!result.success) {
    t.end()
    return
  }
  t.equal(result.inputs.length, 1, 'uses the mixed SYS/SYSX input')
  t.equal(result.outputs.filter(output => output.assetInfo).length, 0, 'does not retain an uncommitted SYSX output')
  t.ok(result.outputs[0].value.gt(new BN(0)), 'retains the ordinary native-value output')
  t.equal(result.outputs[0].address, DESTINATION, 'preserves the asset-map destination before clearing metadata')

  const allocations = allocationsFromResult(result)
  t.equal(allocations.length, 1, 'serializes one asset allocation')
  t.equal(allocations[0].assetGuid, SYSX_ASSET_GUID)
  t.equal(allocations[0].values.length, 1, 'serializes only the burn allocation')
  t.equal(allocations[0].values[0].n, result.outputs.findIndex(output => output.script), 'burn allocation points to OP_RETURN')
  t.equal(allocations[0].values[0].value.toString(), SYSX_AMOUNT.toString())
  finalEconomics(t, result)
  t.end()
})

tape('exact SYSX burn to Syscoin converts the destination to native SYS metadata', t => {
  const result = syscointx.assetAllocationBurn(
    { ethaddress: Buffer.alloc(0) },
    { rbf: true },
    exactSysxUtxos(),
    exactSysxAssetMap(),
    ADDRESS,
    new BN(10)
  )

  t.ok(result.success, 'transaction is created')
  if (!result.success) {
    t.end()
    return
  }
  t.equal(result.outputs[0].value.toString(), SYSX_AMOUNT.toString(), 'creates the native SYS mint output')
  t.notOk(result.outputs[0].assetInfo, 'native SYS output has no stale SYSX metadata')
  t.equal(result.outputs[0].address, DESTINATION, 'mints native SYS to the asset-map destination')

  const allocations = allocationsFromResult(result)
  t.equal(allocations[0].values.length, 1, 'serializes only the burn allocation')
  t.equal(allocations[0].values[0].n, result.outputs.findIndex(output => output.script), 'burn allocation points to OP_RETURN')
  finalEconomics(t, result)
  t.end()
})
