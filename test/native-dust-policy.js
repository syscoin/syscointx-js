const strictAssert = require('assert')
const assert = { equal: strictAssert.strictEqual, deepEqual: strictAssert.deepStrictEqual, ok: strictAssert.ok }
const tape = require('tape')
const test = (name, body) => tape(name, t => { t.doesNotThrow(body); t.end() })
const path = require('path')
const BN = require('bn.js')
const bitcoin = require('bitcoinjs-lib')
const baseline = process.env.DUST_BASELINE_SOURCE && require(path.resolve(process.env.DUST_BASELINE_SOURCE))
const candidate = process.env.DUST_TEST_BASELINE ? baseline : require('../')
const key = Buffer.from('0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798', 'hex')
const network = candidate.utils.syscoinNetworks.testnet
const owner = bitcoin.payments.p2wpkh({ pubkey: key, network }).address
const destinations = [
  ['P2WPKH', bitcoin.payments.p2wpkh({ pubkey: key, network }), 294],
  ['P2PKH', bitcoin.payments.p2pkh({ pubkey: key, network }), 546],
  ['P2SH', bitcoin.payments.p2sh({ redeem: bitcoin.payments.p2wpkh({ pubkey: key, network }), network }), 540],
  ['P2WSH', bitcoin.payments.p2wsh({ redeem: bitcoin.payments.p2pkh({ pubkey: key, network }), network }), 330],
  ['P2TR', bitcoin.payments.p2tr({ internalPubkey: key.subarray(1), network }), 330]
]
function coins (value = 100000) {
  return { assets: new Map(), utxos: [{ type: 'BECH32', address: owner, txId: '01'.repeat(32), vout: 0, value: new BN(value) }] }
}
function build (amount, destination = destinations[0][1], options = {}) {
  return candidate.createTransaction(options.tx || { rbf: true }, coins(options.input), owner,
    [{ address: destination.address, value: new BN(amount), ...(options.max ? { subtractFeeFrom: true } : {}), ...(options.type ? { type: options.type } : {}) }], new BN(options.rate || 1))
}
for (const [name, destination, minimum] of destinations) {
  test(`${name}: threshold minus one rejected, equality retained exactly`, () => {
    assert.equal(build(minimum - 1, destination).error, 'DUST_OUTPUT')
    const result = build(minimum, destination)
    assert.equal(result.success, true)
    assert.equal(result.outputs[0].address, destination.address)
    assert.equal(result.outputs[0].value.toString(), String(minimum))
  })
}
test('the actual address/script wins over a misleading caller type', () => {
  assert.equal(build(293, destinations[0][1], { type: 'LEGACY' }).error, 'DUST_OUTPUT')
  assert.equal(build(545, destinations[1][1], { type: 'BECH32' }).error, 'DUST_OUTPUT')
})
test('native dust change is folded into fee, without altering the recipient', () => {
  const result = build(99696)
  assert.equal(result.success, true)
  assert.equal(result.outputs.length, 1)
  assert.equal(result.outputs[0].value.toString(), '99696')
  assert.equal(result.fee.toString(), '304')
})
test('ordinary native fee is the actual input/output difference after optimization', () => {
  const result = build(50000)
  const actual = result.inputs.reduce((n, i) => n.add(i.value), new BN(0)).sub(result.outputs.reduce((n, o) => n.add(o.value), new BN(0)))
  assert.equal(result.fee.toString(), actual.toString())
})
test('MAX preserves an exact dust-threshold recipient, never silently drops it', () => {
  assert.ok(build(406, undefined, { input: 406, max: true }).error)
  const result = build(407, undefined, { input: 407, max: true })
  assert.equal(result.success, true)
  assert.equal(result.outputs.length, 1)
  assert.equal(result.outputs[0].value.toString(), '294')
})
test('relay dust does not scale with the transaction fee rate', () => {
  const result = build(11700, undefined, { input: 11700, max: true, rate: 100 })
  assert.equal(result.success, true)
  assert.equal(result.outputs.length, 1)
  assert.equal(result.outputs[0].value.toString(), '400')
  assert.equal(result.fee.toString(), '11300')
})
test('a MAX dust failure never consumes additional asset carrier inputs', () => {
  const input = coins(406)
  input.utxos.push({ type: 'BECH32', address: owner, txId: '02'.repeat(32), vout: 0, value: new BN(100000), assetInfo: { assetGuid: '123456', value: new BN(1000) } })
  const result = candidate.createTransaction({ rbf: true }, input, owner,
    [{ address: owner, value: new BN(406), subtractFeeFrom: true }], new BN(1))
  assert.equal(result.error, 'SUBTRACT_FEE_FAILED')
  assert.equal(result.inputs, undefined)
  assert.equal(result.outputs, undefined)
})
test('multiple MAX recipients keep duplicate identity, order and count', () => {
  const result = candidate.createTransaction({ rbf: true }, coins(1000), owner,
    [{ address: owner, value: new BN(500), subtractFeeFrom: true }, { address: owner, value: new BN(500), subtractFeeFrom: true }], new BN(1))
  assert.equal(result.success, true)
  assert.equal(result.outputs.length, 2)
  assert.deepEqual(result.outputs.map(o => o.address), [owner, owner])
  assert.deepEqual(result.outputs.map(o => o.value.toString()), ['353', '500'])
})
test('native memo retains its zero-valued OP_RETURN', () => {
  const result = build(50000, undefined, { tx: { rbf: true, memo: Buffer.from('test'), memoHeader: Buffer.from([0xff]) } })
  assert.equal(result.success, true)
  const data = result.outputs.find(o => o.script)
  assert.equal(data.script[0], 0x6a)
  assert.equal(data.value.toString(), '0')
})
test('native PoDA retains its zero-valued data output', () => {
  const result = build(50000, undefined, { tx: { rbf: true, blobHash: Buffer.alloc(32, 1), blobData: Buffer.alloc(64, 2) } })
  assert.equal(result.success, true)
  assert.equal(result.txVersion, 137)
  const data = result.outputs.find(o => o.script)
  assert.equal(data.script[0], 0x6a)
  assert.equal(data.value.toString(), '0')
})
test('an unknown output address fails closed', () => {
  assert.equal(build(50000, { address: 'not-an-address' }).error, 'INVALID_OUTPUT_SCRIPT')
})
test('an invalid change address returns a structured failure', () => {
  const result = candidate.createTransaction({ rbf: true }, coins(), 'invalid-change', [{ address: owner, value: new BN(50000) }], new BN(1))
  assert.equal(result.error, 'INVALID_OUTPUT_SCRIPT')
})
function assetInputs () {
  const input = coins()
  input.utxos.push({ type: 'BECH32', address: owner, txId: '02'.repeat(32), vout: 0, value: new BN(680), assetInfo: { assetGuid: '123456', value: new BN(1000) } })
  return input
}
function assetMap () { return new Map([['123456', { changeAddress: owner, outputs: [{ address: owner, value: new BN(500) }] }]]) }
for (const method of ['assetAllocationSend', 'assetAllocationBurn']) {
  test(`${method} keeps the existing asset/data semantics`, () => {
    const run = lib => method === 'assetAllocationSend'
      ? lib[method]({ rbf: true }, assetInputs(), assetMap(), owner, new BN(10))
      : lib[method]({ ethaddress: Buffer.alloc(20, 1) }, { rbf: true }, assetInputs(), assetMap(), owner, new BN(10))
    const result = run(candidate)
    assert.equal(result.success, true)
    assert.ok(result.outputs.some(o => o.script && o.script[0] === 0x6a))
    if (baseline) assert.deepEqual(result, run(baseline))
  })
}
test('native asset-gas fallback retains allocation values and indexes', () => {
  const run = lib => {
    const input = coins()
    input.utxos[0].assetInfo = { assetGuid: '123456', value: new BN(1000) }
    return lib.createTransaction({ rbf: true }, input, owner, [{ address: owner, value: new BN(50000) }], new BN(10))
  }
  const result = run(candidate)
  assert.equal(result.success, true)
  assert.equal(result.txVersion, 142)
  assert.equal(result.inputs[0].assetInfo.value.toString(), '1000')
  const carriers = result.outputs.filter(o => o.assetInfo)
  assert.equal(carriers.reduce((n, o) => n.add(o.assetInfo.value), new BN(0)).toString(), '1000')
  if (baseline) {
    const old = run(baseline)
    assert.deepEqual(result.outputs, old.outputs)
    assert.deepEqual(result.inputs, old.inputs)
  }
  const actualFee = result.inputs.reduce((n, i) => n.add(i.value), new BN(0)).sub(result.outputs.reduce((n, o) => n.add(o.value), new BN(0)))
  assert.equal(result.fee.toString(), actualFee.toString())
})
function clone (value) {
  if (BN.isBN(value)) return value.clone()
  if (Buffer.isBuffer(value)) return Buffer.from(value)
  if (value instanceof Map) return new Map([...value].map(([k, v]) => [k, clone(v)]))
  if (Array.isArray(value)) return value.map(clone)
  if (value && typeof value === 'object') {
    const result = {}
    Object.keys(value).forEach(k => { result[k] = clone(value[k]) })
    return result
  }
  return value
}
// Reuse the repository fixtures' public Blockbook shape without importing a
// wallet SDK. This only prepares input data; the production builder is real.
function fixtureInputs (f) {
  const assets = new Map((f.utxoObj.assets || []).map(a => [a.assetGuid, { maxsupply: new BN(a.maxSupply), precision: a.decimals }]))
  return {
    assets,
    utxos: f.utxoObj.utxos.map(u => ({
      type: u.address.startsWith(candidate.utils.syscoinNetworks.mainnet.bech32) ? 'BECH32' : 'LEGACY',
      address: u.address,
      txId: u.txid,
      path: u.path,
      vout: u.vout,
      value: new BN(u.value),
      locktime: u.locktime,
      ...(u.assetInfo ? { assetInfo: { assetGuid: u.assetInfo.assetGuid, value: new BN(u.assetInfo.value) } } : {})
    }))
  }
}
for (const fixture of require('./fixtures').filter(f => [138, 139, 140, 141, 142].includes(f.version))) {
  test(`existing allocation fixture is unchanged: ${fixture.description}`, () => {
    const run = lib => {
      const f = clone(fixture)
      const options = f.txOpts || { rbf: false }
      const inputs = fixtureInputs(f)
      if (f.version === 142) return lib.assetAllocationSend(options, inputs, f.assetMap, f.sysChangeAddress, f.feeRate)
      if (f.version === 139) return lib.syscoinBurnToAssetAllocation(options, inputs, f.assetMap, f.sysChangeAddress, f.feeRate)
      if (f.version === 140) return lib.assetAllocationMint(f.assetOpts, options, inputs, f.assetMap, f.sysChangeAddress, f.feeRate)
      return lib.assetAllocationBurn(f.assetOpts, options, inputs, f.assetMap, f.sysChangeAddress, f.feeRate)
    }
    const result = run(candidate)
    assert.equal(result.success, true)
    assert.equal(result.txVersion, fixture.version)
    assert.equal(result.outputs.length, fixture.expected.numOutputs)
    assert.deepEqual(Buffer.from(result.outputs.find(o => o.script).script), fixture.expected.script)
    if (baseline) assert.deepEqual(result, run(baseline))
  })
}
