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

function byteLengthAuxFee (auxfee) {
  let len = 8 // bound
  len += varuint.encodingLength(auxfee.percent.length) + auxfee.percent.length // string percentage
  return len
}

function byteLengthAuxFeeDetails (auxfeedetails) {
  let len = 0
  len += varuint.encodingLength(auxfeedetails.auxfeekeyid.length) + auxfeedetails.auxfeekeyid.length
  auxfeedetails.auxfees.forEach(auxfee => {
    len += byteLengthAuxFee(auxfee)
  })
  return len
}

function byteLengthNotaryDetails (notary) {
  let len = varuint.encodingLength(notary.endpoint.length) + notary.endpoint.length
  len += 1 // bEnableInstantTransfers
  len += 1 // bRequireHD
  return len
}

function byteLengthAsset (asset) {
  let len = 1 // precision
  len += 1 // updateflags

  if (asset.updateflags & utils.ASSET_INIT) {
    len += varuint.encodingLength(asset.symbol.length) + asset.symbol.length
    len += 8 // max supply
  }
  if (asset.updateflags & utils.ASSET_UPDATE_CONTRACT) {
    len += varuint.encodingLength(asset.contract.length) + asset.contract.length
    len += varuint.encodingLength(asset.prevcontract.length) + asset.prevcontract.length
  }
  if (asset.updateflags & utils.ASSET_UPDATE_DATA) {
    len += varuint.encodingLength(asset.pubdata.length) + asset.pubdata.length
    len += varuint.encodingLength(asset.prevpubdata.length) + asset.prevpubdata.length
  }
  if (asset.updateflags & utils.ASSET_UPDATE_SUPPLY) {
    len += 8 // total supply
  }
  if (asset.updateflags & utils.ASSET_UPDATE_NOTARY_KEY) {
    len += varuint.encodingLength(asset.notarykeyid.length) + asset.notarykeyid.length
    len += varuint.encodingLength(asset.prevnotarykeyid.length) + asset.prevnotarykeyid.length
  }
  if (asset.updateflags & utils.ASSET_UPDATE_NOTARY_DETAILS) {
    len += byteLengthNotaryDetails(asset.notarydetails)
    len += byteLengthNotaryDetails(asset.prevotarydetails)
  }
  if (asset.updateflags & utils.ASSET_UPDATE_AUXFEE) {
    len += byteLengthAuxFeeDetails(asset.auxfeedetails)
    len += byteLengthAuxFeeDetails(asset.prevauxfeedetails)
  }
  if (asset.updateflags & utils.ASSET_UPDATE_CAPABILITYFLAGS) {
    len += 1 // updatecapabilityflags
    len += 1 // prevupdatecapabilityflags
  }
  return len
}

function byteLengthAssetVoutValue () {
  let len = 4 // 4 byte n
  len += 8 // 8 byte value
  return len
}

function byteLengthAssetVout (assetAllocation) {
  let len = 4 // 4 byte uint32 asset guid
  len += varuint.encodingLength(assetAllocation.values.length)
  len += byteLengthAssetVoutValue() * assetAllocation.values.length
  len += varuint.encodingLength(assetAllocation.notarysig.length) + assetAllocation.notarysig.length
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
  len += varuint.encodingLength(mintSyscoin.txparentnodes.length) + mintSyscoin.txparentnodes.length
  len += varuint.encodingLength(mintSyscoin.txpath.length) + mintSyscoin.txpath.length
  len += varuint.encodingLength(mintSyscoin.receiptparentnodes.length) + mintSyscoin.receiptparentnodes.length
  len += 4 // block number
  len += 4 // bridge xfer id
  len += 2 // receipt pos
  len += 2 // tx pos
  return len
}

function byteLengthSyscoinBurnToEthereum (syscoinBurnToEtereum) {
  return varuint.encodingLength(syscoinBurnToEtereum.ethaddress.length) + syscoinBurnToEtereum.ethaddress.length
}

function serializeNotaryDetails (notaryDetails, bufferWriter) {
  bufferWriter.writeVarSlice(notaryDetails.endpoint)
  bufferWriter.writeUInt8(notaryDetails.instanttransfers)
  bufferWriter.writeUInt8(notaryDetails.hdrequired)
}

function serializeAuxFee (auxFee, bufferWriter) {
  putUint(bufferWriter, utils.compressAmount(auxFee.bound))
  bufferWriter.writeUInt16(auxFee.percent)
}

function serializeAuxFeeDetails (auxFeeDetails, bufferWriter) {
  bufferWriter.writeVarSlice(auxFeeDetails.auxfeekeyid)
  bufferWriter.writeVarInt(auxFeeDetails.auxfees.length)
  auxFeeDetails.auxfees.forEach(auxfee => {
    serializeAuxFee(auxfee, bufferWriter)
  })
}

function serializeAsset (asset) {
  const buffer = Buffer.allocUnsafe(byteLengthAsset(asset))
  const bufferWriter = new bufferUtils.BufferWriter(buffer, 0)
  bufferWriter.writeUInt8(asset.precision)
  bufferWriter.writeUInt8(asset.updateflags)
  if (asset.updateflags & utils.ASSET_INIT) {
    bufferWriter.writeVarSlice(asset.symbol)
    putUint(bufferWriter, utils.compressAmount(asset.maxsupply))
  }
  if (asset.updateflags & utils.ASSET_UPDATE_CONTRACT) {
    bufferWriter.writeVarSlice(asset.contract)
    bufferWriter.writeVarSlice(asset.prevcontract)
  }
  if (asset.updateflags & utils.ASSET_UPDATE_DATA) {
    bufferWriter.writeVarSlice(asset.pubdata)
    bufferWriter.writeVarSlice(asset.prevpubdata)
  }
  if (asset.updateflags & utils.ASSET_UPDATE_SUPPLY) {
    putUint(bufferWriter, utils.compressAmount(asset.totalsupply))
  }
  if (asset.updateflags & utils.ASSET_UPDATE_NOTARY_KEY) {
    bufferWriter.writeVarSlice(asset.notarykeyid)
    bufferWriter.writeVarSlice(asset.prevnotarykeyid)
  }
  if (asset.updateflags & utils.ASSET_UPDATE_NOTARY_DETAILS) {
    serializeNotaryDetails(asset.notarydetails, bufferWriter)
    serializeNotaryDetails(asset.prevnotarydetails, bufferWriter)
  }
  if (asset.updateflags & utils.ASSET_UPDATE_AUXFEE) {
    serializeAuxFeeDetails(asset.auxfeedetails, bufferWriter)
    serializeAuxFeeDetails(asset.prevauxfeedetails, bufferWriter)
  }
  if (asset.updateflags & utils.ASSET_UPDATE_CAPABILITYFLAGS) {
    bufferWriter.writeUInt8(asset.updatecapabilityflags)
    bufferWriter.writeUInt8(asset.prevupdatecapabilityflags)
  }

  // need to slice because of compress varInt functionality which is not accounted for in byteLengthAsset
  return buffer.slice(0, bufferWriter.offset)
}

function deserializeAssetVoutValue (bufferReader) {
  const n = bufferReader.readVarInt()
  const valueSat = readUint(bufferReader)
  const value = utils.decompressAmount(valueSat)
  return { n: n, value: value }
}

function deserializeAssetVout (bufferReader) {
  const assetGuid = bufferReader.readUInt32()
  const numOutputs = bufferReader.readVarInt()
  const values = []
  for (var j = 0; j < numOutputs; j++) {
    values.push(deserializeAssetVoutValue(bufferReader))
  }
  const notarysig = bufferReader.readVarSlice()
  return { assetGuid: assetGuid, values: values, notarysig: notarysig }
}

function deserializeAssetAllocations (buffer, bufferReaderIn) {
  const bufferReader = bufferReaderIn || new bufferUtils.BufferReader(buffer)
  const assetAllocations = [] // TODO ts this
  const numAllocations = bufferReader.readVarInt()
  for (var i = 0; i < numAllocations; i++) {
    const voutAsset = deserializeAssetVout(bufferReader)
    assetAllocations.push(voutAsset)
  }
  return assetAllocations
}

function deserializeNotaryDetails (bufferReaderIn) {
  const bufferReader = bufferReaderIn
  const notarydetails = {} // TODO ts this
  notarydetails.endpoint = bufferReader.readVarSlice()
  notarydetails.instanttransfers = bufferReader.readUInt8()
  notarydetails.requirehd = bufferReader.readUInt8()
  return notarydetails
}

function deserializeAuxFee (bufferReaderIn) {
  const bufferReader = bufferReaderIn
  const auxFee = {} // TODO ts this
  var valueSat = readUint(bufferReader)
  auxFee.bound = utils.decompressAmount(valueSat)
  auxFee.percent = bufferReader.readUInt16()
  return auxFee
}

function deserializeAuxFeeDetails (bufferReaderIn) {
  const bufferReader = bufferReaderIn
  const auxFeeDetails = {} // TODO ts this
  auxFeeDetails.auxfees = []
  auxFeeDetails.auxfeekeyid = bufferReaderIn.readVarSlice()
  const numAuxFees = bufferReader.readVarInt()
  for (var i = 0; i < numAuxFees; i++) {
    const auxfee = deserializeAuxFee(bufferReader)
    auxFeeDetails.auxfees.push(auxfee)
  }
  return auxFeeDetails
}

function deserializeAsset (buffer) {
  const bufferReader = new bufferUtils.BufferReader(buffer)
  const asset = {} // TODO ts this

  asset.allocation = deserializeAssetAllocations(null, bufferReader)
  asset.precision = bufferReader.readUInt8()
  asset.updateflags = bufferReader.readUInt8()

  if (asset.updateflags & utils.ASSET_INIT) {
    asset.symbol = bufferReader.readVarSlice()
    const valueSat = readUint(bufferReader)
    asset.maxsupply = utils.decompressAmount(valueSat)
  }
  if (asset.updateflags & utils.ASSET_UPDATE_CONTRACT) {
    asset.contract = bufferReader.readVarSlice()
    asset.prevcontract = bufferReader.readVarSlice()
  }
  if (asset.updateflags & utils.ASSET_UPDATE_DATA) {
    asset.pubdata = bufferReader.readVarSlice()
    asset.prevpubdata = bufferReader.readVarSlice()
  }
  if (asset.updateflags & utils.ASSET_UPDATE_SUPPLY) {
    const valueSat = readUint(bufferReader)
    asset.totalsupply = utils.decompressAmount(valueSat)
  }
  if (asset.updateflags & utils.ASSET_UPDATE_NOTARY_KEY) {
    asset.notarykeyid = bufferReader.readVarSlice()
    asset.prevnotarykeyid = bufferReader.readVarSlice()
  }
  if (asset.updateflags & utils.ASSET_UPDATE_NOTARY_DETAILS) {
    asset.notarydetails = deserializeNotaryDetails(bufferReader)
    asset.prevnotarydetails = deserializeNotaryDetails(bufferReader)
  }
  if (asset.updateflags & utils.ASSET_UPDATE_AUXFEE) {
    asset.auxfeedetails = deserializeAuxFeeDetails(bufferReader)
    asset.prevauxdetails = deserializeAuxFeeDetails(bufferReader)
  }
  if (asset.updateflags & utils.ASSET_UPDATE_CAPABILITYFLAGS) {
    asset.updatecapabilityflags = bufferReader.readUInt8()
    asset.prevupdatecapabilityflags = bufferReader.readUInt8()
  }
  return asset
}

function serializeAssetVoutValue (output, bufferWriter) {
  bufferWriter.writeVarInt(output.n)
  putUint(bufferWriter, utils.compressAmount(output.value))
}

function serializeAssetVout (assetAllocation, bufferWriter) {
  bufferWriter.writeUInt32(assetAllocation.assetGuid)
  bufferWriter.writeVarInt(assetAllocation.values.length)
  assetAllocation.values.forEach(output => {
    serializeAssetVoutValue(output, bufferWriter)
  })
  bufferWriter.writeVarSlice(assetAllocation.notarysig)
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
  bufferWriter.writeUInt32(mintSyscoin.bridgetransferid)
  bufferWriter.writeUInt32(mintSyscoin.blocknumber)
  bufferWriter.writeUInt16(mintSyscoin.txpos)
  bufferWriter.writeVarSlice(mintSyscoin.txparentnodes)
  bufferWriter.writeVarSlice(mintSyscoin.txpath)
  bufferWriter.writeUInt16(mintSyscoin.receiptpos)
  bufferWriter.writeVarSlice(mintSyscoin.receiptparentnodes)

  // need to slice because of compress varInt functionality in PutUint which is not accounted for in byteLengthMintSyscoin
  return buffer.slice(0, bufferWriter.offset)
}

function deserializeMintSyscoin (buffer) {
  const bufferReader = new bufferUtils.BufferReader(buffer)
  const mintSyscoin = {} // TODO ts this

  mintSyscoin.allocation = deserializeAssetAllocations(null, bufferReader)
  mintSyscoin.bridgetransferid = bufferReader.readUInt32()
  mintSyscoin.blocknumber = bufferReader.readUInt32()
  mintSyscoin.txpos = bufferReader.readUInt16()
  mintSyscoin.txparentnodes = bufferReader.readVarSlice()
  mintSyscoin.txpath = bufferReader.readVarSlice()
  mintSyscoin.receiptpos = bufferReader.readUInt16()
  mintSyscoin.receiptparentnodes = bufferReader.readVarSlice()

  return mintSyscoin
}

function serializeAllocationBurnToEthereum (syscoinBurnToEthereum) {
  const buffer = Buffer.allocUnsafe(byteLengthSyscoinBurnToEthereum(syscoinBurnToEthereum))
  const bufferWriter = new bufferUtils.BufferWriter(buffer, 0)
  bufferWriter.writeVarSlice(syscoinBurnToEthereum.ethaddress)
  return buffer
}

function deserializeAllocationBurnToEthereum (buffer) {
  const bufferReader = new bufferUtils.BufferReader(buffer)
  const syscoinBurnToEthereum = {} // TODO ts this

  syscoinBurnToEthereum.allocation = deserializeAssetAllocations(null, bufferReader)
  syscoinBurnToEthereum.ethaddress = bufferReader.readVarSlice()
  return syscoinBurnToEthereum
}

module.exports = {
  serializeAsset: serializeAsset,
  deserializeAsset: deserializeAsset,
  serializeAssetAllocations: serializeAssetAllocations,
  serializeMintSyscoin: serializeMintSyscoin,
  deserializeMintSyscoin: deserializeMintSyscoin,
  serializeAllocationBurnToEthereum: serializeAllocationBurnToEthereum,
  deserializeAllocationBurnToEthereum: deserializeAllocationBurnToEthereum,
  deserializeAssetAllocations: deserializeAssetAllocations
}
