const ext = require('./bn-extensions')
const bitcoin = require('bitcoinjs-lib')
const varuint = require('varuint-bitcoin') 
/*

type AssetOutType struct {
	N uint32
	ValueSat int64
}
type AssetAllocationType struct {
	VoutAssets map[uint32][]AssetOutType
}

type AssetType struct {
	Allocation AssetAllocationType
	Contract []byte
	PrevContract  []byte
	Symbol string
	PubData []byte
	PrevPubData []byte
	Balance int64
	TotalSupply int64
	MaxSupply int64
	Precision uint8
	UpdateFlags uint8
	PrevUpdateFlags uint8
}

type MintSyscoinType struct {
	Allocation AssetAllocationType
    TxValue []byte
    TxParentNodes []byte
    TxRoot []byte
    TxPath []byte
    ReceiptValue []byte
    ReceiptParentNodes []byte
    ReceiptRoot []byte
    ReceiptPath []byte
    BlockNumber uint32
    BridgeTransferId uint32
}

type SyscoinBurnToEthereumType struct {
	Allocation AssetAllocationType
	EthAddress []byte
}
*/
// Amount compression:
// * If the amount is 0, output 0
// * first, divide the amount (in base units) by the largest power of 10 possible; call the exponent e (e is max 9)
// * if e<9, the last digit of the resulting number cannot be 0; store it as d, and drop it (divide by 10)
//   * call the result n
//   * output 1 + 10*(9*n + d - 1) + e
// * if e==9, we only know the resulting number is not zero, so output 1 + 10*(n - 1) + 9
// (this is decodable, as d is in [1-9] and e is in [0-9])

function CompressAmount(n) {
    if(n.isZero()) {
		return n;
	}
    let e = 0;
    let tenBN = new ext.BN(10);
    let nineBN = new ext.BN(9);
    while((ext.eq(ext.mod(n, tenBN), ext.BN_ZERO)) && e < 9) {
        n = ext.div(n, tenBN);
        e++;
    }
    if(e < 9) {
        let d = ext.mod(n, tenBN).toNumber();
        n = ext.div(n, tenBN);
        let retVal = ext.mul(n, nineBN);
        retVal = ext.add(retVal, new ext.BN(d));
        retVal = ext.sub(retVal, ext.BN_ONE);
        retVal = ext.mul(retVal, tenBN);
        retVal = ext.add(retVal, ext.BN_ONE);
        retVal = ext.add(retVal, new ext.BN(e));
        return retVal;
    } else {
        let retVal = ext.sub(n, ext.BN_ONE);
        retVal = ext.mul(retVal, tenBN);
        retVal = ext.add(retVal, ext.BN_ONE);
        retVal = ext.add(retVal, nineBN);
    }
    return retVal;
}

function DecompressAmount(x) {
    // x = 0  OR  x = 1+10*(9*n + d - 1) + e  OR  x = 1+10*(n - 1) + 9
    if(x.isZero()) {
		return x;
    }
    let tenBN = new ext.BN(10);
    let nineBN = new ext.BN(9)
    x = ext.sub(x, ext.BN_ONE);
    // x = 10*(9*n + d - 1) + e
    let e = ext.mod(x,tenBN).toNumber();
    x = ext.div(x, tenBN);
    let n = new ext.BN(0);
    if(ext.lt(e, nineBN)) {
        // x = 9*n + d - 1
        let d = ext.add(ext.mod(x, nineBN), ext.BN_ONE).toNumber();
        x = ext.div(x, nineBN);
        // x = n
        let retVal = ext.mul(x, tenBN);
        n = ext.add(retVal, new ext.BN(d));
    } else {
        n = ext.add(x, ext.BN_ONE);
    }
    while(e) {
        n = ext.mul(n, tenBN);
        e--;
    }
    return n;
}

function PutUint(bufferWriter, n) {
    let tmp = [];
    let len = 0;
    let byteMask = new ext.BN(0x7F);
    while (true)  {
		let mask = ext.BN_ZERO;
		if(len > 0) {
			mask = new ext.BN(0x80);
		}
		tmp[len] = ext.or(ext.and(n, byteMask), mask).toNumber();
        if(ext.lte(n, byteMask)) {
			break;
		}
        n = ext.sub(ext.shrn(n, sevenBN), ext.BN_ONE);
        len++;
	}
	do {
		bufferWriter.writeUInt8(tmp[len]);
	} while(len--);
}

function ReadUint(bufferReader) {
    let n = ext.BN_ZERO;
    let sevenBN = new ext.BN(7);
    while(true) {
		let chData = bufferReader.readUInt8();
        n = ext.or(ext.shln(n, sevenBN), new ext.BN(chData & 0x7F));
        if(chData & 0x80) {
            n = ext.add(n, ext.BN_ONE);
        } else {
            return n;
        }
	}
	return n;
}

function byteLengthAsset(asset) {
    let len = 1; // precision
    len += varuint.encodingLength(asset.contract.length) + asset.contract.length;
    len += varuint.encodingLength(asset.pubdata.length) + asset.pubdata.length;
    len += varuint.encodingLength(asset.symbol.length) + asset.symbol.length;
    len += 1; // updateflags
    len += varuint.encodingLength(asset.prevcontract.length) + asset.pevcontract.length;
    len += varuint.encodingLength(asset.prevpubdata.length) + asset.prevpubdata.length;
    len += 1; // prevupdateflags
    len += 8; // balance
    len += 8; // total supply
    len += 8; // max supply
    return len;
}

function byteLengthAssetAllocation(assetAllocations) {
    let len = 0;
    len += varuint.encodingLength(assetAllocations.length);
    for (var guid in assetAllocations) {
        if (assetAllocations.hasOwnProperty(guid)) {
            let allocation = assetAllocations[guid];
            len += 4; // 4 byte uint32 asset guid
            len += varuint.encodingLength(allocation.length);
            len += 12*allocation.length; // 4 bytes for n, 8 bytes for value
        }
    }
    return len;
}

function byteLengthMintSyscoin(mintSyscoin) {
    let len = 0;
    len += varuint.encodingLength(mintSyscoin.txvalue.length) + mintSyscoin.txvalue.length;
    len += varuint.encodingLength(mintSyscoin.txparentnodes.length) + mintSyscoin.txparentnodes.length;
    len += varuint.encodingLength(mintSyscoin.txroot.length) + mintSyscoin.txroot.length;
    len += varuint.encodingLength(mintSyscoin.txpath.length) + mintSyscoin.txpath.length;
    len += varuint.encodingLength(mintSyscoin.receiptpath.length) + mintSyscoin.receiptpath.length;
    len += varuint.encodingLength(mintSyscoin.receiptparentnodes.length) + mintSyscoin.receiptparentnodes.length;
    len += varuint.encodingLength(mintSyscoin.receiptroot.length) + mintSyscoin.receiptroot.length;
    len += 4; // block number
    len += 4; // bridge xfer id
    return len;
}

function byteLengthSyscoinBurnToEthereum(syscoinBurnToEtereum) {
    return syscoinBurnToEtereum.ethaddress.length;
}

module.exports = function SerializeAsset (asset) {
    let buffer = Buffer.allocUnsafe(byteLengthAsset(asset));
    let bufferWriter = new bitcoin.BufferWriter(buffer, 0);
    bufferWriter.writeUInt8(asset.precision);
    bufferWriter.writeVarSlice(asset.contract);
	bufferWriter.writeVarSlice(asset.pubdata);
	bufferWriter.writeVarSlice(asset.symbol);
	bufferWriter.writeUInt8(asset.updateflags);
	bufferWriter.writeVarSlice(asset.prevcontract);
	bufferWriter.writeVarSlice(asset.prevpubdata);
	bufferWriter.writeUInt8(asset.prevupdateflags);
	
	PutUint(bufferWriter, CompressAmount(asset.balance));
	PutUint(bufferWriter, CompressAmount(asset.totalsupply));
    PutUint(bufferWriter, CompressAmount(asset.maxsupply));
    // need to slice because of compress varInt functionality which is not accounted for in byteLengthAsset
    return buffer.slice(0, bufferWriter.offset);
}

module.exports = function DeserializeAsset (buffer) {
    const bufferReader = new bitcoin.BufferReader(buffer);
    let asset = {}; // TODO ts this

    asset.allocation = DeserializeAssetAllocations(bufferReader);
    asset.precision = bufferReader.readUInt8();
    asset.contract = bufferReader.readVarSlice();
	asset.pubdata = bufferReader.readVarSlice();
	asset.symbol = bufferReader.readVarSlice();
	asset.updateflags = bufferReader.readUInt8()
	asset.prevcontract = bufferReader.readVarSlice();
	asset.prevpubdata = bufferReader.readVarSlice();
	asset.prevupdateflags = bufferReader.readUInt8();
	var valueSat = ReadUint(bufferReader);
	asset.balance = DecompressAmount(valueSat);

	valueSat = ReadUint(bufferReader);
	asset.totalsupply = DecompressAmount(valueSat);
	
	valueSat = ReadUint(bufferReader);
    asset.maxsupply = DecompressAmount(valueSat);
    return asset;
}

module.exports = function SerializeAssetAllocations (assetAllocations) {
    let buffer = Buffer.allocUnsafe(byteLengthAssetAllocation(assetAllocations));
    let bufferWriter = new bitcoin.BufferWriter(buffer, 0);

    bufferWriter.writeVarInt(assetAllocations.length);
    for (var guid in assetAllocations) {
        if (assetAllocations.hasOwnProperty(guid)) {
            let allocation = assetAllocations[guid];
            bufferWriter.writeUInt32(guid);
            bufferWriter.writeVarInt(allocation.length);
            bufferWriter.writeUInt32(allocation.index);
            PutUint(bufferWriter, CompressAmount(allocation.value));
        }
    }
    // need to slice because of compress varInt functionality which is not accounted for in byteLengthAssetAllocation
    return buffer.slice(0, bufferWriter.offset);
}

module.exports = function DeserializeAssetAllocations (buffer) {
    const bufferReader = new bitcoin.BufferReader(buffer);
    let assetAllocations = []; // TODO ts this
    numAllocations = bufferReader.readVarInt();
    for (var i = 0; i < numAllocations; i++){
        assetGuid = bufferReader.readUInt32();
        let allocation = assetAllocations[assetGuid]
        allocation = [];
        numOutputs = bufferReader.readVarInt();
        allocation.index = bufferReader.readUInt32();
        valueSat = ReadUint(bufferReader);
        allocation.value = DecompressAmount(valueSat);
    }
    return assetAllocations;
    
}

module.exports = function SerializeMintSyscoin (mintSyscoin) {
    let buffer = Buffer.allocUnsafe(byteLengthMintSyscoin(mintSyscoin));
    let bufferWriter = new bitcoin.BufferWriter(buffer, 0);

    PutUint(bufferWriter, new ext.BN(mintSyscoin.bridgetransferid));
    PutUint(bufferWriter, new ext.BN(mintSyscoin.blocknumber));
    bufferWriter.writeVarSlice(mintSyscoin.txvalue);
    bufferWriter.writeVarSlice(mintSyscoin.txparentnodes);
    bufferWriter.writeVarSlice(mintSyscoin.txroot);
    bufferWriter.writeVarSlice(mintSyscoin.txpath);
    bufferWriter.writeVarSlice(mintSyscoin.receiptvalue);
    bufferWriter.writeVarSlice(mintSyscoin.receiptparentnodes);
    bufferWriter.writeVarSlice(mintSyscoin.receiptroot);
    bufferWriter.writeVarSlice(mintSyscoin.receiptpath);
    
    // need to slice because of compress varInt functionality in PutUint which is not accounted for in byteLengthMintSyscoin
    return buffer.slice(0, bufferWriter.offset);
    
}

module.exports = function DeserializeMintSyscoin (buffer) {
    const bufferReader = new bitcoin.BufferReader(buffer);
    let mintSyscoin = {}; // TODO ts this

    mintSyscoin.allocation = DeserializeAssetAllocations(bufferReader);
    mintSyscoin.bridgetransferid = ReadUint(bufferReader).toNumber();
    mintSyscoin.blocknumber = ReadUint(bufferReader).toNumber();
    mintSyscoin.txvalue = bufferReader.readVarSlice();
    mintSyscoin.txparentnodes = bufferReader.readVarSlice();
    mintSyscoin.txroot = bufferReader.readVarSlice();
    mintSyscoin.txpath = bufferReader.readVarSlice();
    mintSyscoin.receiptvalue = bufferReader.readVarSlice();
    mintSyscoin.receiptparentnodes = bufferReader.readVarSlice();
    mintSyscoin.receiptroot = bufferReader.readVarSlice();
    mintSyscoin.receiptpath = bufferReader.readVarSlice();
    
    return mintSyscoin;
}

module.exports = function SerializeSyscoinBurnToEthereum (syscoinBurnToEthereum) {
    let buffer = Buffer.allocUnsafe(byteLengthSyscoinBurnToEthereum(syscoinBurnToEthereum));
    let bufferWriter = new bitcoin.BufferWriter(buffer, 0);
    bufferWriter.writeVarSlice(syscoinBurnToEthereum.ethaddress);
    return buffer;
}

module.exports = function DeserializeSyscoinBurnToEthereum (buffer) {
    const bufferReader = new bitcoin.BufferReader(buffer);
    let syscoinBurnToEthereum = {}; // TODO ts this

    syscoinBurnToEthereum.allocation = DeserializeAssetAllocations(bufferReader);
    syscoinBurnToEthereum.ethaddress = bufferReader.readVarSlice();
    return syscoinBurnToEthereum;
}