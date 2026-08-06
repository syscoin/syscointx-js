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
  t.equal(result.outputs[0].value.toString(), SYSX_AMOUNT.toString(), 'creates the native SYS mint output')
  t.notOk(result.outputs[0].assetInfo, 'native SYS output has no stale SYSX metadata')
  t.equal(result.outputs[0].address, DESTINATION, 'mints native SYS to the asset-map destination')

  const allocations = allocationsFromResult(result)
  t.equal(allocations[0].values.length, 1, 'serializes only the burn allocation')
  t.equal(allocations[0].values[0].n, result.outputs.findIndex(output => output.script), 'burn allocation points to OP_RETURN')
  t.end()
})
