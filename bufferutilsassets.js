const BN = require('bn.js')
const ext = require('./bn-extensions')
const bufferUtils = require('./bufferutils')
const varuint = require('varuint-bitcoin')
const utils = require('./utils.js')
function putUint (bufferWriter, n) {
  const tmp = []
  let len = 0
  const byteMask = new BN(0x7F)
  while (true) {
    let mask = ext.BN_ZERO
    if (len > 0) {
      mask = new BN(0x80)
    }
    tmp[len] = ext.or(ext.and(n, byteMask), mask).toNumber()
    if (ext.lte(n, byteMask)) {
      break
    }
    n = ext.sub(ext.shrn(n, 7), ext.BN_ONE)
    len++
  }
  do {
    bufferWriter.writeUInt8(tmp[len])
  } while (len--)
}

function readUint (bufferReader) {
  let n = ext.BN_ZERO
  while (true) {
    const chData = bufferReader.readUInt8()
    n = ext.or(ext.shln(n, 7), new BN(chData & 0x7F))
    if (chData & 0x80) {
      n = ext.add(n, ext.BN_ONE)
    } else {
      return n
    }
  }
}

function readUInt64LE (buffer) {
  const a = buffer.readUInt32()
  const b = buffer.readUInt32()
  return new BN(b).shln(32).or(new BN(a))
}

function writeUInt64LE (buffer, value) {
  const a = value.and(new BN(0xFFFFFFFF)).toNumber()
  const b = value.shrn(32).toNumber()
  buffer.writeUInt32(a)
  buffer.writeUInt32(b)
}

function byteLengthAssetVoutValue () {
  let len = 4 // 4 byte n
  len += 16 // 8 byte value + varint variance to be safe
  return len
}

function byteLengthAssetVout (assetAllocation) {
  let len = 8 // 8 byte uint64 asset guid
  len += varuint.encodingLength(assetAllocation.values.length)
  len += byteLengthAssetVoutValue() * assetAllocation.values.length
  return len
}

function byteLengthAssetAllocation (assetAllocations) {
  let len = 0
  len += varuint.encodingLength(assetAllocations.length)
  assetAllocations.forEach(assetAllocation => {
    len += byteLengthAssetVout(assetAllocation)
  })
  return len
}

function byteLengthMintSyscoin (mintSyscoin) {
  let len = 0
  len += 32 // ethtxid
  len += 32 // txroot
  len += varuint.encodingLength(mintSyscoin.txparentnodes.length) + mintSyscoin.txparentnodes.length
  len += varuint.encodingLength(mintSyscoin.txpath.length) + mintSyscoin.txpath.length
  len += 32 // receiptroot
  len += varuint.encodingLength(mintSyscoin.receiptparentnodes.length) + mintSyscoin.receiptparentnodes.length
  len += 32 // blockhash
  len += 2 // receipt pos
  len += 2 // tx pos
  return len
}

function byteLengthAllocationBurn (allocationBurn) {
  return varuint.encodingLength(allocationBurn.ethaddress.length) + allocationBurn.ethaddress.length
}
function byteLengthPoDA (poda) {
  let len = varuint.encodingLength(poda.blobHash.length) + poda.blobHash.length
  if (poda.blobData) {
    len += varuint.encodingLength(poda.blobData.length) + poda.blobData.length
  }
  return len
}

function deserializeAssetVoutValue (bufferReader) {
  const n = bufferReader.readVarInt()
  const valueSat = readUint(bufferReader)
  const value = utils.decompressAmount(valueSat)
  return { n: n, value: value }
}

function deserializeAssetVout (bufferReader) {
  const assetGuid = readUint(bufferReader)
  const numOutputs = bufferReader.readVarInt()
  const values = []
  for (let j = 0; j < numOutputs; j++) {
    values.push(deserializeAssetVoutValue(bufferReader))
  }
  return { assetGuid: assetGuid.toString(10), values: values }
}

function deserializeAssetAllocations (buffer, bufferReaderIn, extractMemo) {
  const bufferReader = bufferReaderIn || new bufferUtils.BufferReader(buffer)
  const assetAllocations = [] // TODO ts this
  const numAllocations = bufferReader.readVarInt()
  for (let i = 0; i < numAllocations; i++) {
    const voutAsset = deserializeAssetVout(bufferReader)
    assetAllocations.push(voutAsset)
  }
  if (extractMemo && !bufferReaderIn && bufferReader.offset !== buffer.length) {
    assetAllocations.memo = buffer.slice(bufferReader.offset)
  }
  return assetAllocations
}

function serializeAssetVoutValue (output, bufferWriter) {
  bufferWriter.writeVarInt(output.n)
  putUint(bufferWriter, utils.compressAmount(output.value))
}

function serializeAssetVout (assetAllocation, bufferWriter) {
  putUint(bufferWriter, new BN(assetAllocation.assetGuid))
  bufferWriter.writeVarInt(assetAllocation.values.length)
  assetAllocation.values.forEach(output => {
    serializeAssetVoutValue(output, bufferWriter)
  })
}

function serializeAssetAllocations (assetAllocations) {
  const buffer = Buffer.allocUnsafe(byteLengthAssetAllocation(assetAllocations))
  const bufferWriter = new bufferUtils.BufferWriter(buffer, 0)
  bufferWriter.writeVarInt(assetAllocations.length)
  assetAllocations.forEach(assetAllocation => {
    serializeAssetVout(assetAllocation, bufferWriter)
  })
  // need to slice because of compress varInt functionality which is not accounted for in byteLengthAssetAllocation
  return buffer.slice(0, bufferWriter.offset)
}

function serializeMintSyscoin (mintSyscoin) {
  const buffer = Buffer.allocUnsafe(byteLengthMintSyscoin(mintSyscoin))
  const bufferWriter = new bufferUtils.BufferWriter(buffer, 0)
  bufferWriter.writeSlice(mintSyscoin.ethtxid)
  bufferWriter.writeSlice(mintSyscoin.blockhash)
  bufferWriter.writeUInt16(mintSyscoin.txpos)
  bufferWriter.writeVarSlice(mintSyscoin.txparentnodes)
  bufferWriter.writeVarSlice(mintSyscoin.txpath)
  bufferWriter.writeUInt16(mintSyscoin.receiptpos)
  bufferWriter.writeVarSlice(mintSyscoin.receiptparentnodes)
  bufferWriter.writeSlice(mintSyscoin.txroot)
  bufferWriter.writeSlice(mintSyscoin.receiptroot)
  // need to slice because of compress varInt functionality in PutUint which is not accounted for in byteLengthMintSyscoin
  return buffer.slice(0, bufferWriter.offset)
}

function deserializeMintSyscoin (buffer) {
  const bufferReader = new bufferUtils.BufferReader(buffer)
  const mintSyscoin = {} // TODO ts this

  mintSyscoin.allocation = deserializeAssetAllocations(null, bufferReader)
  mintSyscoin.ethtxid = bufferReader.readSlice(32)
  mintSyscoin.blockhash = bufferReader.readSlice(32)
  mintSyscoin.txpos = bufferReader.readUInt16()
  mintSyscoin.txparentnodes = bufferReader.readVarSlice()
  mintSyscoin.txpath = bufferReader.readVarSlice()
  mintSyscoin.receiptpos = bufferReader.readUInt16()
  mintSyscoin.receiptparentnodes = bufferReader.readVarSlice()
  mintSyscoin.txroot = bufferReader.readSlice(32)
  mintSyscoin.receiptroot = bufferReader.readSlice(32)
  return mintSyscoin
}

function serializeAllocationBurn (allocationBurn) {
  const buffer = Buffer.allocUnsafe(byteLengthAllocationBurn(allocationBurn))
  const bufferWriter = new bufferUtils.BufferWriter(buffer, 0)
  bufferWriter.writeVarSlice(allocationBurn.ethaddress)
  return buffer
}

function deserializeAllocationBurn (buffer, extractMemo) {
  const bufferReader = new bufferUtils.BufferReader(buffer)
  const allocationBurn = {} // TODO ts this

  allocationBurn.allocation = deserializeAssetAllocations(null, bufferReader, extractMemo)
  allocationBurn.ethaddress = bufferReader.readVarSlice()
  return allocationBurn
}

function serializePoDA (poda) {
  const buffer = Buffer.allocUnsafe(byteLengthPoDA(poda))
  const bufferWriter = new bufferUtils.BufferWriter(buffer, 0)
  bufferWriter.writeVarSlice(poda.blobHash)
  if (poda.blobData) {
    bufferWriter.writeVarSlice(poda.blobData)
  }
  return buffer
}

function deserializePoDA (buffer) {
  const bufferReader = new bufferUtils.BufferReader(buffer)
  const poda = {} // TODO ts this

  poda.blobHash = bufferReader.readVarSlice()
  return poda
}

module.exports = {
  serializeAssetAllocations: serializeAssetAllocations,
  serializeMintSyscoin: serializeMintSyscoin,
  deserializeMintSyscoin: deserializeMintSyscoin,
  serializeAllocationBurn: serializeAllocationBurn,
  deserializeAllocationBurn: deserializeAllocationBurn,
  deserializeAssetAllocations: deserializeAssetAllocations,
  serializePoDA: serializePoDA,
  deserializePoDA: deserializePoDA,
  writeUInt64LE: writeUInt64LE,
  readUInt64LE: readUInt64LE

}
