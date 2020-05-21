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
    let dataAmount = new ext.BN(150*COIN);
    let dataBuffer = syscoinBufferUtils.SerializeAsset(assetOpts);
    return createAssetTransaction(txVersion, utxos, dataBuffer, dataAmount, assetArray, sysChangeAddress, outputs, feeRate);
}

module.exports = function assetUpdate (assetOpts, utxos, assetArray, sysChangeAddress, outputs, feeRate) {
    let txVersion = SYSCOIN_TX_VERSION_ASSET_UPDATE;
    let dataAmount = ext.BN_ZERO;
    let dataBuffer = syscoinBufferUtils.SerializeAsset(assetOpts);
    return createAssetTransaction(txVersion, utxos, dataBuffer, dataAmount, assetArray, sysChangeAddress, outputs, feeRate);
}

module.exports = function assetSend (utxos, assetArray, sysChangeAddress, outputs, feeRate) {
    let txVersion = SYSCOIN_TX_VERSION_ASSET_SEND;
    let dataAmount = ext.BN_ZERO;
    let dataBuffer = null;
    return createAssetTransaction(txVersion, utxos, dataBuffer, dataAmount, assetArray, sysChangeAddress, outputs, feeRate);
}

module.exports = function assetAllocationSend (utxos, assetArray, sysChangeAddress, outputs, feeRate) {
    let txVersion = SYSCOIN_TX_VERSION_ALLOCATION_SEND;
    let dataAmount = ext.BN_ZERO;
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
    let dataAmount = ext.BN_ZERO;
    let dataBuffer = null;
    if(txVersion === SYSCOIN_TX_VERSION_ALLOCATION_BURN_TO_ETHEREUM) {
        dataBuffer = syscoinBufferUtils.SerializeSyscoinBurnToEthereum(syscoinBurnToEthereum);
    }
    return createAssetTransaction(txVersion, utxos, dataBuffer, dataAmount, assetArray, sysChangeAddress, outputs, feeRate);
}

module.exports = function assetAllocationMint (mintSyscoin, utxos, assetArray, sysChangeAddress, outputs, feeRate) {
    let txVersion = SYSCOIN_TX_VERSION_ALLOCATION_MINT;
    let dataAmount = ext.BN_ZERO;
    let dataBuffer = syscoinBufferUtils.SerializeMintSyscoin(mintSyscoin);
    return createAssetTransaction(txVersion, utxos, dataBuffer, dataAmount, assetArray, sysChangeAddress, outputs, feeRate);
}

module.exports = function syscoinBurnToAssetAllocation (utxos, assetArray, sysChangeAddress, outputs, feeRate) {
    if(!outputs || outputs.length <= 0 || !outputs[0].value || outputs[0].isZero()) {
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
    let inputs = [];
    let { inputs, outputs, fee } = coinSelect.coinSelect(utxos, inputs, outputs, feeRate);
    // the accumulated fee is always returned for analysis
    console.log(fee);

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
            value: output.value.toNumber(),
        });
    })
    return psbt;
}

module.exports = function createAssetTransaction (txVersion, utxos, dataBuffer, dataAmount, assetArray, sysChangeAddress, outputs, feeRate) {
    let psbt = new bitcoin.Psbt();
    psbt.setVersion(txVersion);
    let isNonAssetFunded = txVersion === SYSCOIN_TX_VERSION_ASSET_ACTIVATE || txVersion === SYSCOIN_TX_VERSION_SYSCOIN_BURN_TO_ALLOCATION ||
    txVersion === SYSCOIN_TX_VERSION_ALLOCATION_MINT;
    let { inputs, outputs, assetAllocations } = coinSelect.coinSelectAsset(utxos, assetArray, feeRate, isNonAssetFunded);
    // .inputs and .outputs will be undefined if no solution was found

    if (!inputs || !outputs) return null;
    
    let assetAllocationsBuffer = syscoinBufferUtils.SerializeAssetAllocations(assetAllocations);
    let buffArr = [assetAllocationsBuffer, dataBuffer];
    // create and add data script for OP_RETURN
    const dataScript = bitcoin.payments.embed({ data: Buffer.concat(buffArr) });
    let dataOutput = {
        script: dataScript,
        value: dataAmount.toNumber(),
    };
    outputs.push(dataOutput);
    let { inputs, outputs, fee } = coinSelect.coinSelect(utxos, inputs, outputs, feeRate);
    // the accumulated fee is always returned for analysis
    console.log(fee);

    // .inputs and .outputs will be undefined if no solution was found
    if (!inputs || !outputs) return null;
    inputs.forEach(input => {
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
            value: output.value.toNumber(),
        });
    });
    
    return psbt;
}
