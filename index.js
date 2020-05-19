const ext = require('./bn-extensions')
const syscoinBufferUtils = require('./bufferutils.js')
const bitcoin = require('bitcoinjs-lib')
const coinSelect = require('coinselectsyscoin')
let sysChangeAddress = "sdfsdf"
let feeRate = 55 // satoshis per byte
let assetObj1 = {assetGuid: 1234, changeAddress: "sdfdsf", outputs: [{value: 100, address: "23232"}]}
let assetObj2 = {assetGuid: 12345, changeAddress: "sdfdsf", outputs: [{value: 100, address: "23232"}]}
let assetObj3 = {assetGuid: 12346, changeAddress: "sdfdsf", outputs: [{value: 100, address: "23232"}]}
let assetArray = [assetObj1, assetObj2, assetObj3]
let txVersion = 131
/*let utxos = [
  ...,
  {
    txId: '...',
    vout: 0,
    ...,
    value: 10000,
    // For use with PSBT:
    // not needed for coinSelect, but will be passed on to inputs later
    nonWitnessUtxo: Buffer.from('...full raw hex of txId tx...', 'hex'),
    // OR
    // if your utxo is a segwit output, you can use witnessUtxo instead
    witnessUtxo: {
      script: Buffer.from('... scriptPubkey hex...', 'hex'),
      value: 10000 // 0.0001 BTC and is the exact same as the value above
    }
  }
]
let systargets = [
  ...,
  {
    address: '1EHNa6Q4Jz2uvNExL497mE43ikXhwF6kZm',
    value: 0
  }
]*/
const SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_SYSCOIN = 128;
const SYSCOIN_TX_VERSION_SYSCOIN_BURN_TO_ALLOCATION = 129;
const SYSCOIN_TX_VERSION_ASSET_ACTIVATE = 130;
const SYSCOIN_TX_VERSION_ASSET_UPDATE = 131;
const SYSCOIN_TX_VERSION_ASSET_SEND = 132;
const SYSCOIN_TX_VERSION_ALLOCATION_MINT = 133;
const SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_ETHEREUM = 134;
const SYSCOIN_TX_VERSION_ALLOCATION_SEND = 135;

module.exports = function assetNew (assetOpts, utxos, assetArray, sysChangeAddress, outputs, feeRate) {
    let txVersion = SYSCOIN_TX_VERSION_ASSET_ACTIVATE;
    let dataAmount = 150*COIN;
    let dataBuffer = syscoinBufferUtils.SerializeAsset(assetOpts);
    return createAssetTransaction(txVersion, utxos, dataBuffer, dataAmount, assetArray, sysChangeAddress, outputs, feeRate);
}

module.exports = function assetUpdate (assetOpts, utxos, assetArray, sysChangeAddress, outputs, feeRate) {
    let txVersion = SYSCOIN_TX_VERSION_ASSET_UPDATE;
    let dataAmount = 0;
    let dataBuffer = syscoinBufferUtils.SerializeAsset(assetOpts);
    return createAssetTransaction(txVersion, utxos, dataBuffer, dataAmount, assetArray, sysChangeAddress, outputs, feeRate);
}

module.exports = function assetSend (utxos, assetArray, sysChangeAddress, outputs, feeRate) {
    let txVersion = SYSCOIN_TX_VERSION_ASSET_SEND;
    let dataAmount = 0;
    let dataBuffer = null;
    return createAssetTransaction(txVersion, utxos, dataBuffer, dataAmount, assetArray, sysChangeAddress, outputs, feeRate);
}

module.exports = function assetAllocationSend (utxos, assetArray, sysChangeAddress, outputs, feeRate) {
    let txVersion = SYSCOIN_TX_VERSION_ALLOCATION_SEND;
    let dataAmount = 0;
    let dataBuffer = null;
    return createAssetTransaction(txVersion, utxos, dataBuffer, dataAmount, assetArray, sysChangeAddress, outputs, feeRate);
}

module.exports = function assetAllocationBurn (syscoinBurnToEthereum, utxos, assetArray, sysChangeAddress, outputs, feeRate) {
    let txVersion = 0;
    if(syscoinBurnToEthereum && syscoinBurnToEthereum.ethAddress && syscoinBurnToEthereum.ethAddress.length > 0) {
        txVersion = SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_ETHEREUM;
    } else {
        txVersion = SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_SYSCOIN;
    }
    let dataAmount = 0;
    let dataBuffer = null;
    if(txVersion === SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_ETHEREUM) {
        dataBuffer = syscoinBufferUtils.SerializeSyscoinBurnToEthereum(syscoinBurnToEthereum);
    }
    return createAssetTransaction(txVersion, utxos, dataBuffer, dataAmount, assetArray, sysChangeAddress, outputs, feeRate);
}

module.exports = function assetAllocationMint (mintSyscoin, utxos, assetArray, sysChangeAddress, outputs, feeRate) {
    let txVersion = SYSCOIN_TX_VERSION_ALLOCATION_MINT;
    let dataAmount = 0;
    let dataBuffer = syscoinBufferUtils.SerializeMintSyscoin(mintSyscoin);
    return createAssetTransaction(txVersion, utxos, dataBuffer, dataAmount, assetArray, sysChangeAddress, outputs, feeRate);
}

module.exports = function syscoinBurnToAssetAllocation (utxos, assetArray, sysChangeAddress, outputs, feeRate) {
    if(!outputs || outputs.length <= 0 || !outputs[0].value) {
        return null;
    }
    let txVersion = SYSCOIN_TX_VERSION_SYSCOIN_BURN_TO_ALLOCATION;
    let dataAmount = outputs[0].value;
    let dataBuffer = null;
    return createAssetTransaction(txVersion, utxos, dataBuffer, dataAmount, assetArray, sysChangeAddress, outputs, feeRate);
}

module.exports = function createSyscoinTransaction (utxos, sysChangeAddress, outputs, feeRate) {
    let psbt = new bitcoin.Psbt();
    // filter out asset utxo's for syscoin-only selection
    let utxos = utxos.filter(utxo => !utxo.assetInfo.assetGuid);
    let { inputs, outputs, totalFeeExisting } = coinSelect.coinSelect(utxos, outputs, feeRate);
    // the accumulated fee is always returned for analysis
    console.log(totalFeeExisting);

    // .inputs and .outputs will be undefined if no solution was found
    if (!inputs || !outputs) return null;

    inputs.forEach(input =>
        psbt.addInput({
        hash: input.txId,
        index: input.vout,
        nonWitnessUtxo: input.nonWitnessUtxo,
        // OR (not both)
        witnessUtxo: input.witnessUtxo,
        })
    )
    outputs.forEach(output => {
        // watch out, outputs may have been added that you need to provide
        // an output address/script for
        if (!output.address) {
            output.address = sysChangeAddress
        }
        psbt.addOutput({
            address: output.address,
            value: output.value,
        });
    })
    return psbt;
}
function notFoundInUtxoMap(mapUtxo, utxo) {
    let key = string(utxo.txId) + string(utxo.vout);
    if (key in mapUtxo) {
        return true;
    }
    return false;
}
module.exports = function createAssetTransaction (txVersion, utxos, dataBuffer, dataAmount, assetArray, sysChangeAddress, outputs, feeRate) {
    let psbt = new bitcoin.Psbt();
    psbt.setVersion(txVersion);
    var inputs = [];
    let utxoAssets = utxos.filter(utxo => utxo.assetInfo != null);
    let { inputs, outputs, assetAllocations } = coinSelect.coinSelectAsset(utxoAssets, inputs, assetArray, feeRate);
    // .inputs and .outputs will be undefined if no solution was found
    if (!inputs || !outputs) return null;
    assetAllocationsBuffer = syscoinBufferUtils.SerializeAssetAllocations(assetAllocations);
    var buffArr = [assetAllocationsBuffer, dataBuffer];
    // create and add data script for OP_RETURN
    const dataScript = bitcoin.payments.embed({ data: Buffer.concat(buffArr) });
    let dataOutput = {
        script: dataScript,
        value: dataAmount,
    };
    outputs.push(dataOutput);

    // from asset related utxos as they should be already used to fund assets already
    let utxos = utxos.filter(utxo => !utxo.assetInfo);
    let { inputs, outputs, fee, feeNeeded } = coinSelect.coinSelect(utxos, inputs, outputs, feeRate);
    // the accumulated fee is always returned for analysis
    console.log(fee);

    // .inputs and .outputs will be undefined if no solution was found
    if (!inputs || !outputs) return null;

    inputs.forEach(input => {
            mapUtxo[string(input.txId) + string(input.vout)] = 1;
            psbt.addInput({
                hash: input.txId,
                index: input.vout,
                nonWitnessUtxo: input.nonWitnessUtxo,
                // OR (not both)
                witnessUtxo: input.witnessUtxo,
            });
        }
    );
    outputs.forEach(output => {
        // watch out, outputs may have been added that you need to provide
        // an output address/script for
        if (!output.address) {
            output.address = sysChangeAddress;
        }
        psbt.addOutput({
            address: output.address,
            value: output.value,
        });
    });
    // try again to fund gas with asset utxo's only
    if(ext.gt(feeNeeded, ext.BN_ZERO)) {
        // only use utxo which were not already used
        let utxoNotAdded = utxoAssets.filter(utxo => notFoundInUtxoMap(mapUtxo, utxo));
        let { inputs, outputs, fee, feeNeeded } = coinSelect.coinSelect(utxoNotAdded, inputs, outputs, feeRate);
        // .inputs and .outputs will be undefined if no solution was found
        if (!inputs || !outputs) return null;
        // the accumulated fee is always returned for analysis
        console.log(fee);
        // if we still need more fee, we do not have enough funds to complete this transaction
        if(ext.gt(feeNeeded, ext.BN_ZERO)) {
            return null;
        }
    }
    
    return psbt;
}
