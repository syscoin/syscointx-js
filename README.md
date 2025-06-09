# syscointx-js

[![TRAVIS](https://secure.travis-ci.org/bitcoinjs/coinselect.png)](http://travis-ci.org/syscoin/coinselect)
[![NPM](http://img.shields.io/npm/v/coinselect.svg)](https://www.npmjs.org/package/coinselect)

[![js-standard-style](https://cdn.rawgit.com/feross/standard/master/badge.svg)](https://github.com/feross/standard)

An unspent transaction output (UTXO) selection module for syscoin.

**WARNING:** Value units are in `satoshi`s, **not** Syscoin.


## Algorithms
Module | Algorithm | Re-orders UTXOs?
-|-|-
`require('coinselectsyscoin')` | Blackjack, with Accumulative fallback | By Descending Value
`require('coinselectsyscoin/accumulative')` | Accumulative - accumulates inputs until the target value (+fees) is reached, skipping detrimental inputs | -
`require('coinselectsyscoin/blackjack')` | Blackjack - accumulates inputs until the target value (+fees) is matched, does not accumulate inputs that go over the target value (within a threshold) | -
`require('coinselectsyscoin/break')` | Break - breaks the input values into equal denominations of `output` (as provided) | -
`require('coinselectsyscoin/split')` | Split - splits the input values evenly between all `outputs`, any provided `output` with `.value` remains unchanged | -


**Note:** Each algorithm will add a change output if the `input - output - fee` value difference is over a dust threshold.
This is calculated independently by `utils.finalize`, irrespective of the algorithm chosen, for the purposes of safety.

**Pro-tip:** if you want to send-all inputs to an output address, `coinselectsyscoin/split` with a partial output (`.address` defined, no `.value`) can be used to send-all, while leaving an appropriate amount for the `fee`. 

## Example

``` javascript
let coinSelect = require('coinselectsyscoin')
let feeRate = 55 // satoshis per byte
let utxos = [
  ...,
  {
    txid: '...',
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
let targets = [
  ...,
  {
    address: '1EHNa6Q4Jz2uvNExL497mE43ikXhwF6kZm',
    value: 5000
  }
]

// Subtract fee from output example:
// The fee will be deducted from outputs with subtractFeeFrom in order
let targetsWithFeeSubtraction = [
  {
    address: '1EHNa6Q4Jz2uvNExL497mE43ikXhwF6kZm',
    value: 10000,
    subtractFeeFrom: true // Fee will be subtracted from this output first
  }
]

// Using coinselectsyscoin directly:
let { inputs, outputs, fee } = coinSelect(utxos, targets, feeRate)

// the accumulated fee is always returned for analysis
console.log(fee)

// .inputs and .outputs will be undefined if no solution was found
if (!inputs || !outputs) return

let psbt = new bitcoin.Psbt()

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
    output.address = wallet.getChangeAddress()
    wallet.nextChangeAddress()
  }

  psbt.addOutput({
    address: output.address,
    value: output.value,
  })
})

// Example using syscointx-js with subtractFee:
const syscointx = require('syscointx-js')
const BN = require('bn.js')

// Create transaction that subtracts fee from output
const txOpts = { rbf: true }
const utxos = { utxos: [...] } // Your UTXOs

// Single output with subtractFeeFrom
const outputsArr = [
  {
    address: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
    value: new BN(100000000), // 1 SYS
    subtractFeeFrom: true // Fee will be deducted from this output
  }
]

// Multiple outputs with subtractFeeFrom - fee deducted in order
const multipleOutputs = [
  {
    address: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
    value: new BN(50000000), // 0.5 SYS
    subtractFeeFrom: true // Fee deducted from here first
  },
  {
    address: 'bc1q9vza2e8x573nczrlzms0wvx3gsqjx7vavgkx0l',
    value: new BN(50000000), // 0.5 SYS
    subtractFeeFrom: true // Only touched if first output can't cover full fee
  }
]

const changeAddress = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq'
const feeRate = new BN(10)

const result = syscointx.createTransaction(txOpts, utxos, changeAddress, outputsArr, feeRate)
// Fee is subtracted sequentially from outputs with subtractFeeFrom
```


## License [MIT](LICENSE)
