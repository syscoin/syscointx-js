const ext = require('./bn-extensions')
const bitcoin = require('bitcoinjs-lib')
const varuint = require('varuint-bitcoin')
// Amount compression:
// * If the amount is 0, output 0
// * first, divide the amount (in base units) by the largest power of 10 possible; call the exponent e (e is max 9)
// * if e<9, the last digit of the resulting number cannot be 0; store it as d, and drop it (divide by 10)
//   * call the result n
//   * output 1 + 10*(9*n + d - 1) + e
// * if e==9, we only know the resulting number is not zero, so output 1 + 10*(n - 1) + 9
// (this is decodable, as d is in [1-9] and e is in [0-9])

function compressAmount (n) {
  if (n.isZero()) {
    return n
  }
  let e = 0
  const tenBN = new ext.BN(10)
  const nineBN = new ext.BN(9)
  while ((ext.eq(ext.mod(n, tenBN), ext.BN_ZERO)) && e < 9) {
    n = ext.div(n, tenBN)
    e++
  }
  if (e < 9) {
    const d = ext.mod(n, tenBN).toNumber()
    n = ext.div(n, tenBN)
    let retVal = ext.mul(n, nineBN)
    retVal = ext.add(retVal, new ext.BN(d))
    retVal = ext.sub(retVal, ext.BN_ONE)
    retVal = ext.mul(retVal, tenBN)
    retVal = ext.add(retVal, ext.BN_ONE)
    retVal = ext.add(retVal, new ext.BN(e))
    return retVal
  } else {
    let retVal = ext.sub(n, ext.BN_ONE)
    retVal = ext.mul(retVal, tenBN)
    retVal = ext.add(retVal, ext.BN_ONE)
    retVal = ext.add(retVal, nineBN)
    return retVal
  }
}

function decompressAmount (x) {
  // x = 0  OR  x = 1+10*(9*n + d - 1) + e  OR  x = 1+10*(n - 1) + 9
  if (x.isZero()) {
    return x
  }
  const tenBN = new ext.BN(10)
  const nineBN = new ext.BN(9)
  x = ext.sub(x, ext.BN_ONE)
  // x = 10*(9*n + d - 1) + e
  let e = ext.mod(x, tenBN).toNumber()
  x = ext.div(x, tenBN)
  let n = new ext.BN(0)
  if (ext.lt(e, nineBN)) {
    // x = 9*n + d - 1
    const d = ext.add(ext.mod(x, nineBN), ext.BN_ONE).toNumber()
    x = ext.div(x, nineBN)
    // x = n
    const retVal = ext.mul(x, tenBN)
    n = ext.add(retVal, new ext.BN(d))
  } else {
    n = ext.add(x, ext.BN_ONE)
  }
  while (e) {
    n = ext.mul(n, tenBN)
    e--
  }
  return n
}

function putUint (bufferWriter, n) {
  const tmp = []
  let len = 0
  const byteMask = new ext.BN(0x7F)
  const sevenBN = new ext.BN(7)
  while (true) {
    let mask = ext.BN_ZERO
    if (len > 0) {
      mask = new ext.BN(0x80)
    }
    tmp[len] = ext.or(ext.and(n, byteMask), mask).toNumber()
    if (ext.lte(n, byteMask)) {
      break
    }
    n = ext.sub(ext.shrn(n, sevenBN), ext.BN_ONE)
    len++
  }
  do {
    bufferWriter.writeUInt8(tmp[len])
  } while (len--)
}

function readUint (bufferReader) {
  let n = ext.BN_ZERO
  const sevenBN = new ext.BN(7)
  while (true) {
    const chData = bufferReader.readUInt8()
    n = ext.or(ext.shln(n, sevenBN), new ext.BN(chData & 0x7F))
    if (chData & 0x80) {
      n = ext.add(n, ext.BN_ONE)
    } else {
      return n
    }
  }
}

function byteLengthAsset (asset) {
  let len = 1 // precision
  len += varuint.encodingLength(asset.contract.length) + asset.contract.length
  len += varuint.encodingLength(asset.pubdata.length) + asset.pubdata.length
  len += varuint.encodingLength(asset.symbol.length) + asset.symbol.length
  len += 1 // updateflags
  len += varuint.encodingLength(asset.prevcontract.length) + asset.pevcontract.length
  len += varuint.encodingLength(asset.prevpubdata.length) + asset.prevpubdata.length
  len += 1 // prevupdateflags
  len += 8 // balance
  len += 8 // total supply
  len += 8 // max supply
  return len
}

function byteLengthAssetAllocation (assetAllocations) {
  let len = 0
  len += varuint.encodingLength(assetAllocations.length)
  for (var guid in assetAllocations) {
    if (guid in assetAllocations) {
      const allocation = assetAllocations[guid]
      len += 4 // 4 byte uint32 asset guid
      len += varuint.encodingLength(allocation.length)
      len += 12 * allocation.length // 4 bytes for n, 8 bytes for value
    }
  }
  return len
}

function byteLengthMintSyscoin (mintSyscoin) {
  let len = 0
  len += varuint.encodingLength(mintSyscoin.txvalue.length) + mintSyscoin.txvalue.length
  len += varuint.encodingLength(mintSyscoin.txparentnodes.length) + mintSyscoin.txparentnodes.length
  len += varuint.encodingLength(mintSyscoin.txroot.length) + mintSyscoin.txroot.length
  len += varuint.encodingLength(mintSyscoin.txpath.length) + mintSyscoin.txpath.length
  len += varuint.encodingLength(mintSyscoin.receiptpath.length) + mintSyscoin.receiptpath.length
  len += varuint.encodingLength(mintSyscoin.receiptparentnodes.length) + mintSyscoin.receiptparentnodes.length
  len += varuint.encodingLength(mintSyscoin.receiptroot.length) + mintSyscoin.receiptroot.length
  len += 4 // block number
  len += 4 // bridge xfer id
  return len
}

function byteLengthSyscoinBurnToEthereum (syscoinBurnToEtereum) {
  return syscoinBurnToEtereum.ethaddress.length
}

function serializeAsset (asset) {
  const buffer = Buffer.allocUnsafe(byteLengthAsset(asset))
  const bufferWriter = new bitcoin.BufferWriter(buffer, 0)
  bufferWriter.writeUInt8(asset.precision)
  bufferWriter.writeVarSlice(asset.contract)
  bufferWriter.writeVarSlice(asset.pubdata)
  bufferWriter.writeVarSlice(asset.symbol)
  bufferWriter.writeUInt8(asset.updateflags)
  bufferWriter.writeVarSlice(asset.prevcontract)
  bufferWriter.writeVarSlice(asset.prevpubdata)
  bufferWriter.writeUInt8(asset.prevupdateflags)

  putUint(bufferWriter, compressAmount(asset.balance))
  putUint(bufferWriter, compressAmount(asset.maxsupply))
  // need to slice because of compress varInt functionality which is not accounted for in byteLengthAsset
  return buffer.slice(0, bufferWriter.offset)
}
function deserializeAssetAllocations (buffer) {
  const bufferReader = new bitcoin.BufferReader(buffer)
  const assetAllocations = [] // TODO ts this
  const numAllocations = bufferReader.readVarInt()
  for (var i = 0; i < numAllocations; i++) {
    const assetGuid = bufferReader.readUInt32()
    assetAllocations[assetGuid] = []
    const numOutputs = bufferReader.readVarInt()
    for (var j = 0; j < numOutputs; j++) {
      const allocation = {}
      allocation.index = bufferReader.readUInt32()
      const valueSat = readUint(bufferReader)
      allocation.value = decompressAmount(valueSat)
      assetAllocations[assetGuid].push(allocation)
    }
  }
  return assetAllocations
}
function deserializeAsset (buffer) {
  const bufferReader = new bitcoin.BufferReader(buffer)
  const asset = {} // TODO ts this

  asset.allocation = deserializeAssetAllocations(bufferReader)
  asset.precision = bufferReader.readUInt8()
  asset.contract = bufferReader.readVarSlice()
  asset.pubdata = bufferReader.readVarSlice()
  asset.symbol = bufferReader.readVarSlice()
  asset.updateflags = bufferReader.readUInt8()
  asset.prevcontract = bufferReader.readVarSlice()
  asset.prevpubdata = bufferReader.readVarSlice()
  asset.prevupdateflags = bufferReader.readUInt8()
  var valueSat = readUint(bufferReader)
  asset.balance = decompressAmount(valueSat)

  valueSat = readUint(bufferReader)
  asset.maxsupply = decompressAmount(valueSat)
  return asset
}

function serializeAssetAllocations (assetAllocations) {
  const buffer = Buffer.allocUnsafe(byteLengthAssetAllocation(assetAllocations))
  const bufferWriter = new bitcoin.BufferWriter(buffer, 0)

  bufferWriter.writeVarInt(assetAllocations.length)
  for (var guid in assetAllocations) {
    if (guid in assetAllocations) {
      const allocation = assetAllocations[guid]
      bufferWriter.writeUInt32(guid)
      bufferWriter.writeVarInt(allocation.length)
      bufferWriter.writeUInt32(allocation.index)
      putUint(bufferWriter, compressAmount(allocation.value))
    }
  }
  // need to slice because of compress varInt functionality which is not accounted for in byteLengthAssetAllocation
  return buffer.slice(0, bufferWriter.offset)
}

function serializeMintSyscoin (mintSyscoin) {
  const buffer = Buffer.allocUnsafe(byteLengthMintSyscoin(mintSyscoin))
  const bufferWriter = new bitcoin.BufferWriter(buffer, 0)

  putUint(bufferWriter, new ext.BN(mintSyscoin.bridgetransferid))
  putUint(bufferWriter, new ext.BN(mintSyscoin.blocknumber))
  bufferWriter.writeVarSlice(mintSyscoin.txvalue)
  bufferWriter.writeVarSlice(mintSyscoin.txparentnodes)
  bufferWriter.writeVarSlice(mintSyscoin.txroot)
  bufferWriter.writeVarSlice(mintSyscoin.txpath)
  bufferWriter.writeVarSlice(mintSyscoin.receiptvalue)
  bufferWriter.writeVarSlice(mintSyscoin.receiptparentnodes)
  bufferWriter.writeVarSlice(mintSyscoin.receiptroot)
  bufferWriter.writeVarSlice(mintSyscoin.receiptpath)

  // need to slice because of compress varInt functionality in PutUint which is not accounted for in byteLengthMintSyscoin
  return buffer.slice(0, bufferWriter.offset)
}

function deserializeMintSyscoin (buffer) {
  const bufferReader = new bitcoin.BufferReader(buffer)
  const mintSyscoin = {} // TODO ts this

  mintSyscoin.allocation = deserializeAssetAllocations(bufferReader)
  mintSyscoin.bridgetransferid = readUint(bufferReader).toNumber()
  mintSyscoin.blocknumber = readUint(bufferReader).toNumber()
  mintSyscoin.txvalue = bufferReader.readVarSlice()
  mintSyscoin.txparentnodes = bufferReader.readVarSlice()
  mintSyscoin.txroot = bufferReader.readVarSlice()
  mintSyscoin.txpath = bufferReader.readVarSlice()
  mintSyscoin.receiptvalue = bufferReader.readVarSlice()
  mintSyscoin.receiptparentnodes = bufferReader.readVarSlice()
  mintSyscoin.receiptroot = bufferReader.readVarSlice()
  mintSyscoin.receiptpath = bufferReader.readVarSlice()

  return mintSyscoin
}

function serializeSyscoinBurnToEthereum (syscoinBurnToEthereum) {
  const buffer = Buffer.allocUnsafe(byteLengthSyscoinBurnToEthereum(syscoinBurnToEthereum))
  const bufferWriter = new bitcoin.BufferWriter(buffer, 0)
  bufferWriter.writeVarSlice(syscoinBurnToEthereum.ethaddress)
  return buffer
}

function deserializeSyscoinBurnToEthereum (buffer) {
  const bufferReader = new bitcoin.BufferReader(buffer)
  const syscoinBurnToEthereum = {} // TODO ts this

  syscoinBurnToEthereum.allocation = deserializeAssetAllocations(bufferReader)
  syscoinBurnToEthereum.ethaddress = bufferReader.readVarSlice()
  return syscoinBurnToEthereum
}

module.exports = {
  serializeAsset: serializeAsset,
  deserializeAsset: deserializeAsset,
  serializeAssetAllocations: serializeAssetAllocations,
  serializeMintSyscoin: serializeMintSyscoin,
  deserializeMintSyscoin: deserializeMintSyscoin,
  serializeSyscoinBurnToEthereum: serializeSyscoinBurnToEthereum,
  deserializeSyscoinBurnToEthereum: deserializeSyscoinBurnToEthereum,
  deserializeAssetAllocations: deserializeAssetAllocations
}
