const strictAssert = require('assert')
const assert = { equal: strictAssert.strictEqual, deepEqual: strictAssert.deepStrictEqual, ok: strictAssert.ok }
const tape = require('tape')
const test = (name, body) => tape(name, t => { t.doesNotThrow(body); t.end() })
const path = require('path')
const BN = require('bn.js')
const bitcoin = require('bitcoinjs-lib')
const bufferUtils = require('../bufferutilsassets')
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
// Independent default-Core oracle applied to the script the SDK serializes,
// not the caller's fee rate/type hint or the selector's own threshold helper.
function serializedScript (output) {
  if (output.script) return Buffer.from(output.script)
  for (const n of [...Object.values(candidate.utils.syscoinNetworks), ...Object.values(candidate.utils.bitcoinNetworks)]) {
    try { return Buffer.from(bitcoin.address.toOutputScript(output.address, n)) } catch (_) {}
  }
  throw new Error('Missing serializable output destination')
}
function coreFloor (script) {
  if (script[0] === 0x6a || script.length > 10000) return new BN(0)
  const witness = script.length >= 4 && script.length <= 42 &&
    (script[0] === 0 || (script[0] >= 0x51 && script[0] <= 0x60)) &&
    script[1] >= 2 && script[1] <= 40 && script[1] + 2 === script.length
  const compact = script.length < 253 ? 1 : script.length <= 65535 ? 3 : 5
  return new BN(3 * (8 + compact + script.length + (witness ? 67 : 148)))
}
function allocations (result) {
  const data = result.outputs.find(o => o.script && o.script[0] === 0x6a)
  return data ? bufferUtils.deserializeAssetAllocations(Buffer.from(bitcoin.script.decompile(data.script)[1])) : []
}
function canonicalAllocations (rows) {
  return rows.map(asset => ({
    assetGuid: String(asset.assetGuid),
    values: asset.values.map(value => ({ n: value.n, value: value.value.toString() }))
  }))
}
function allocationStatements (result) {
  return allocations(result).flatMap(asset => asset.values.map(value => {
    const output = result.outputs[value.n]
    assert.ok(output, 'baseline and current allocation indexes resolve to actual outputs')
    const script = serializedScript(output)
    return {
      assetGuid: String(asset.assetGuid),
      destination: script[0] === 0x6a ? 'OP_RETURN' : script.toString('hex'),
      value: value.value.toString()
    }
  })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
}
function sum (rows, value = row => row.value) {
  return rows.reduce((total, row) => total.add(value(row)), new BN(0))
}
function units (rows) {
  const totals = new Map()
  for (const row of rows) totals.set(row.assetGuid, (totals.get(row.assetGuid) || new BN(0)).add(row.value))
  return totals
}
function assertFinal (result, minted = new Map()) {
  assert.equal(result.success, true, result.message || result.error)
  const dataIndex = result.outputs.findIndex(o => o.script && o.script[0] === 0x6a)
  for (const output of result.outputs) {
    const script = serializedScript(output)
    assert.ok(output.value.gte(coreFloor(script)), 'every serialized output meets its actual script floor')
    if (script[0] !== 0x6a) {
      assert.ok(Buffer.isBuffer(output.scriptPubKey), 'spendable output retains distinct script metadata')
      assert.deepEqual(output.scriptPubKey, script, 'metadata matches the actual serialized destination')
    }
  }
  const inputUnits = units(result.inputs.filter(i => i.assetInfo).map(i => i.assetInfo))
  const committed = allocations(result)
  const outputUnits = new Map()
  const burned = new Map()
  for (const asset of committed) {
    const indexes = new Set()
    for (const v of asset.values) {
      assert.ok(Number.isInteger(v.n) && v.n >= 0 && v.n < result.outputs.length, 'allocation index is in range')
      assert.ok(!indexes.has(v.n), 'allocation index is unique per asset')
      indexes.add(v.n)
      const output = result.outputs[v.n]
      if (v.n === dataIndex && [138, 141].includes(result.txVersion)) {
        burned.set(asset.assetGuid, (burned.get(asset.assetGuid) || new BN(0)).add(v.value))
      } else {
        assert.ok(output.assetInfo, 'committed spendable allocation retains carrier metadata')
        assert.equal(output.assetInfo.assetGuid, asset.assetGuid)
        assert.equal(output.assetInfo.value.toString(), v.value.toString())
        outputUnits.set(asset.assetGuid, (outputUnits.get(asset.assetGuid) || new BN(0)).add(v.value))
      }
    }
  }
  if (result.txVersion === 139) {
    assert.ok(dataIndex >= 0)
    assert.equal(result.outputs[dataIndex].value.toString(), sum([...minted.values()], v => v).toString(), '139 preserves native burn principal on OP_RETURN')
  }
  for (const guid of new Set([...inputUnits.keys(), ...outputUnits.keys(), ...burned.keys(), ...minted.keys()])) {
    const available = (inputUnits.get(guid) || new BN(0)).add(minted.get(guid) || new BN(0))
    const assigned = (outputUnits.get(guid) || new BN(0)).add(burned.get(guid) || new BN(0))
    assert.equal(assigned.toString(), available.toString(), 'asset units are conserved including explicit mint/burn')
  }
  const nativeMint = result.txVersion === 138 ? sum([...burned.values()], v => v) : new BN(0)
  const actualFee = sum(result.inputs).add(nativeMint).sub(sum(result.outputs))
  assert.ok(actualFee.gte(new BN(0)), 'native principal plus minted SYS covers outputs and fee')
  assert.equal(result.fee.toString(), actualFee.toString(), 'reported fee equals final input/output accounting')
}
for (const [name, destination, minimum] of destinations) {
  for (const rate of [1, 100]) {
    test(`${name}: default floor ${minimum} is independent of fee rate ${rate}`, () => {
      assert.equal(build(minimum - 1, destination, { rate }).error, 'DUST_OUTPUT')
      const result = build(minimum, destination, { rate })
      assertFinal(result)
      assert.equal(result.outputs[0].address, destination.address)
      assert.equal(result.outputs[0].value.toString(), String(minimum))
    })
  }
}
test('the actual address/script wins over a misleading caller type', () => {
  assert.equal(build(293, destinations[0][1], { type: 'LEGACY' }).error, 'DUST_OUTPUT')
  assert.equal(build(545, destinations[1][1], { type: 'BECH32' }).error, 'DUST_OUTPUT')
})
test('caller scriptPubKey cannot lower the floor of the serialized address', () => {
  const output = { address: destinations[1][1].address, scriptPubKey: Buffer.from(destinations[0][1].output), type: 'BECH32', value: new BN(545) }
  assert.equal(candidate.createTransaction({ rbf: true }, coins(), owner, [output], new BN(1)).error, 'DUST_OUTPUT')
  output.value = new BN(546)
  const result = candidate.createTransaction({ rbf: true }, coins(), owner, [output], new BN(1))
  assertFinal(result)
  assert.deepEqual(result.outputs[0].scriptPubKey, Buffer.from(destinations[1][1].output))
})
test('native raw serialized script wins over contradictory address and metadata', () => {
  const output = { address: owner, script: Buffer.from(destinations[1][1].output), scriptPubKey: Buffer.from(destinations[0][1].output), value: new BN(545) }
  assert.equal(candidate.createTransaction({ rbf: true }, coins(), owner, [output], new BN(1)).error, 'DUST_OUTPUT')
  output.value = new BN(546)
  const result = candidate.createTransaction({ rbf: true }, coins(), owner, [output], new BN(1))
  assertFinal(result)
  assert.deepEqual(result.outputs[0].script, Buffer.from(destinations[1][1].output))
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
    assertFinal(result)
    assert.ok(result.outputs.some(o => o.script && o.script[0] === 0x6a))
    if (baseline) assert.deepEqual(allocationStatements(result), allocationStatements(run(baseline)))
  })
}
test('native asset-gas fallback retains allocation values and indexes', () => {
  const run = lib => {
    const input = coins()
    input.utxos[0].assetInfo = { assetGuid: '123456', value: new BN(1000) }
    return lib.createTransaction({ rbf: true }, input, owner, [{ address: owner, value: new BN(50000) }], new BN(10))
  }
  const result = run(candidate)
  assertFinal(result)
  assert.equal(result.txVersion, 142)
  assert.equal(result.inputs[0].assetInfo.value.toString(), '1000')
  const carriers = result.outputs.filter(o => o.assetInfo)
  assert.equal(carriers.reduce((n, o) => n.add(o.assetInfo.value), new BN(0)).toString(), '1000')
  if (baseline) {
    const old = run(baseline)
    assert.deepEqual(allocationStatements(result), allocationStatements(old))
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
  test(`allocation payload, indexes and economics remain correct: ${fixture.description}`, () => {
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
    if (fixture.version === 138) {
      const entry = fixture.assetMap.values().next().value
      const payout = entry.outputs[0]
      const payoutScript = serializedScript({ address: payout.address || entry.changeAddress || fixture.sysChangeAddress })
      if (payout.value.lt(coreFloor(payoutScript))) {
        assert.equal(result.error, 'DUST_OUTPUT', 'a legacy one-satoshi native payout is now correctly refused')
        return
      }
    }
    const minted = [139, 140].includes(fixture.version)
      ? units([...fixture.assetMap].flatMap(([assetGuid, entry]) => entry.outputs.map(v => ({ assetGuid, value: v.value }))))
      : new Map()
    assertFinal(result, minted)
    assert.equal(result.txVersion, fixture.version)
    assert.equal(result.outputs.length, fixture.expected.numOutputs)
    assert.deepEqual(Buffer.from(result.outputs.find(o => o.script).script), fixture.expected.script)
    assert.deepEqual(canonicalAllocations(allocations(result)), canonicalAllocations(fixture.expected.asset.allocation))
    if (fixture.version === 139) {
      const data = result.outputs.find(o => o.script)
      assert.equal(data.value.toString(), fixture.assetMap.values().next().value.outputs[0].value.toString(), 'native burn principal stays on OP_RETURN')
    }
    // Native carrier policy can legitimately change output layout. Preserve
    // baseline asset statements by actual destination/value, while the current
    // exact fixture goldens, index bounds and conservation remain mandatory.
    if (baseline) assert.deepEqual(allocationStatements(result), allocationStatements(run(baseline)))
  })
}

for (const rate of [1, 100]) {
  for (let i = 0; i < destinations.length; i++) {
    const [name, recipient] = destinations[i]
    const nativeChange = destinations[(i + 1) % destinations.length][1]
    const assetChange = destinations[(i + 2) % destinations.length][1]
    test(`SPT send ${name} recipient and distinct change scripts at fee rate ${rate}`, () => {
      const map = new Map([['123456', {
        changeAddress: assetChange.address,
        changeScript: Buffer.from(destinations[0][1].output),
        outputs: [{ address: recipient.address, scriptPubKey: Buffer.from(destinations[(i + 3) % destinations.length][1].output), type: 'LEGACY', value: new BN(500) }]
      }]])
      const result = candidate.assetAllocationSend({ rbf: true }, assetInputs(), map, nativeChange.address, new BN(rate))
      assertFinal(result)
      const allocation = allocations(result)[0]
      const recipientOutput = result.outputs[allocation.values[0].n]
      assert.equal(recipientOutput.address, recipient.address)
      assert.equal(recipientOutput.value.toString(), coreFloor(serializedScript(recipientOutput)).toString(), 'explicit SPT carrier uses the default floor, not transaction fee rate')
      assert.equal(allocation.values[0].value.toString(), '500')
      assert.equal(sum(allocation.values, v => v.value).toString(), '1000')
      const assetChangeOutput = result.outputs.find(o => o.assetInfo && o.address === assetChange.address)
      const sysChangeOutput = result.outputs.find(o => o.changeIndex !== undefined && !o.assetInfo)
      assert.ok(assetChangeOutput, 'asset change retains its distinct requested destination')
      assert.equal(assetChangeOutput.assetInfo.value.toString(), '500')
      assert.ok(sysChangeOutput, 'native change remains separate when its script differs')
      assert.equal(sysChangeOutput.address, nativeChange.address, 'native change is never redirected to the asset change address')
    })
    test(`native MAX ${name} keeps its destination and actual fee at rate ${rate}`, () => {
      const result = candidate.createTransaction({ rbf: true }, coins(), nativeChange.address,
        [{ address: recipient.address, value: new BN(100000), subtractFeeFrom: true }], new BN(rate))
      assertFinal(result)
      assert.equal(result.outputs.length, 1)
      assert.equal(result.outputs[0].address, recipient.address)
      assert.equal(result.outputs[0].value.add(result.fee).toString(), '100000')
    })
    test(`native funded by SPT retains units with ${name} recipient at fee rate ${rate}`, () => {
      const input = coins()
      input.utxos[0].assetInfo = { assetGuid: '123456', value: new BN(1000) }
      const result = candidate.createTransaction({ rbf: true }, input, nativeChange.address,
        [{ address: recipient.address, type: 'LEGACY', value: new BN(50000) }], new BN(rate))
      assertFinal(result)
      assert.equal(result.txVersion, 142)
      assert.equal(result.outputs[0].address, recipient.address)
      assert.equal(result.outputs[0].value.toString(), '50000')
      assert.equal(result.outputs.find(o => o.assetInfo).address, nativeChange.address, 'asset-gas change keeps the requested native change destination')
    })
  }
  for (const ethaddress of [Buffer.alloc(0), Buffer.alloc(20, 1)]) {
    test(`partial SPT burn ${ethaddress.length ? 141 : 138} at fee rate ${rate} retains the unburned allocation`, () => {
      const result = candidate.assetAllocationBurn({ ethaddress }, { rbf: true }, assetInputs(), assetMap(), destinations[1][1].address, new BN(rate))
      assertFinal(result)
      const allocation = allocations(result)[0]
      const dataIndex = result.outputs.findIndex(o => o.script)
      assert.equal(allocation.values.find(v => v.n === dataIndex).value.toString(), '500')
      assert.equal(sum(allocation.values.filter(v => v.n !== dataIndex), v => v.value).toString(), '500')
    })
  }
  test(`139 preserves even a one-satoshi OP_RETURN principal at fee rate ${rate}`, () => {
    const map = new Map([['123456', { changeAddress: destinations[1][1].address, outputs: [{ address: destinations[4][1].address, value: new BN(1) }] }]])
    const result = candidate.syscoinBurnToAssetAllocation({ rbf: true }, coins(), map, destinations[2][1].address, new BN(rate))
    assertFinal(result, new Map([['123456', new BN(1)]]))
    assert.equal(result.txVersion, 139)
    assert.equal(result.outputs.find(o => o.script).value.toString(), '1')
  })
  test(`140 proof serialization and mixed-script carrier accounting at fee rate ${rate}`, () => {
    const fixture = require('./fixtures').find(f => f.version === 140)
    const map = new Map([['2615707979', { changeAddress: destinations[2][1].address, outputs: [{ address: destinations[4][1].address, value: new BN(500) }] }]])
    const result = candidate.assetAllocationMint(clone(fixture.assetOpts), { rbf: true }, coins(1000000), map, destinations[1][1].address, new BN(rate))
    assertFinal(result, new Map([['2615707979', new BN(500)]]))
    assert.equal(result.txVersion, 140)
    const data = result.outputs.find(o => o.script)
    const decoded = bufferUtils.deserializeMintSyscoin(Buffer.from(bitcoin.script.decompile(data.script)[1]))
    assert.deepEqual(decoded.txparentnodes, fixture.assetOpts.txparentnodes)
    assert.deepEqual(decoded.receiptparentnodes, fixture.assetOpts.receiptparentnodes)
    assert.equal(decoded.allocation[0].values[0].value.toString(), '500')
  })
}
