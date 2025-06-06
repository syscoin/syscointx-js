const syscointx = require('./index.js')
const bitcoin = require('bitcoinjs-lib')

// Example: Decode a real Syscoin asset allocation transaction
const assetAllocationTxHex = '8e000000000101d4de2a743378a40229f180bda29c701ec5761b95c2bb54b049937b4d02e894130300000000ffffffff04a8020000000000001600140b26e3403eeccdcf176b8c041ee99abf23e676e2a8020000000000001600144a1a3fb9007e655786946f3bac7bc2157bac56a60000000000000000676a4c640180a283a46703000f0111038ecde3c865411f21c18a05a3869649ffd01d335cebe56326b832ee1876bc6d785dc594b08165136664789379df4305bb09cefb23d1a743569e6fb1ec04923fbce2f7b9efde4104fefeafafafaf6d656d6f207465737420326a1a8747020000001600147dccd91471590db1eb4bcddb7bfe34fd076af31d02473044022032ea8f812ea8783aa8a436484b262e75b79c9b1f0677e8e4ddb41ee0e984e64102201f710f31e1c7a1a2be7994a556e8c094c7632b3bc926890c44643626b523dea101210288644767b596e5781bcc840fdbdf730bed12d4e0962e842b27ab8276ab409f4800000000'

console.log('=== Syscoin Transaction Decoder Example ===\n')

try {
  // Parse the transaction from hex
  const tx = bitcoin.Transaction.fromHex(assetAllocationTxHex)

  // Decode the transaction
  const decoded = syscointx.decodeRawTransaction(tx, syscointx.utils.syscoinNetworks.mainnet)

  console.log('Transaction ID:', decoded.txid)
  console.log('Version:', decoded.version)
  console.log('Transaction Type:', decoded.syscoin.txtype)
  console.log('Size:', decoded.size, 'bytes')
  console.log('Virtual Size:', decoded.vsize, 'bytes')
  console.log('Weight:', decoded.weight)
  console.log('Locktime:', decoded.locktime)

  console.log('\n=== Inputs ===')
  decoded.vin.forEach((input, index) => {
    console.log(`Input ${index}:`)
    console.log('  TXID:', input.txid)
    console.log('  Vout:', input.vout)
    console.log('  Sequence:', input.sequence)
    console.log('  Script Sig (hex):', input.scriptSig.hex)
    if (input.txinwitness) {
      console.log('  Witness:', input.txinwitness)
    }
  })

  console.log('\n=== Outputs ===')
  decoded.vout.forEach((output, index) => {
    console.log(`Output ${index}:`)
    console.log('  Value:', output.value, 'SYS')
    console.log('  Script Type:', output.scriptPubKey.type)
    console.log('  Required Signatures:', output.scriptPubKey.reqSigs)
    if (output.scriptPubKey.addresses.length > 0) {
      console.log('  Addresses:', output.scriptPubKey.addresses)
    }
    console.log('  Script (hex):', output.scriptPubKey.hex)
  })

  console.log('\n=== Syscoin-Specific Data ===')
  if (decoded.syscoin.allocations) {
    console.log('Asset Allocations:')
    decoded.syscoin.allocations.assets.forEach((asset, index) => {
      console.log(`  Asset ${index + 1}:`)
      console.log('    GUID:', asset.assetGuid)
      asset.values.forEach((value, valueIndex) => {
        console.log(`    Value ${valueIndex + 1}:`)
        console.log('      Output Index:', value.n)
        console.log('      Amount (satoshis):', value.value)
        console.log('      Amount (formatted):', value.valueFormatted, 'tokens')
      })
    })
  }

  if (decoded.syscoin.burn) {
    console.log('Burn Data:')
    console.log('  Ethereum Address:', decoded.syscoin.burn.ethaddress)
    if (decoded.syscoin.burn.memo) {
      console.log('  Memo:', decoded.syscoin.burn.memo)
    }
  }

  if (decoded.syscoin.mint) {
    console.log('Mint Data:')
    console.log('  Ethereum TXID:', decoded.syscoin.mint.ethtxid)
    console.log('  Block Hash:', decoded.syscoin.mint.blockhash)
    console.log('  TX Position:', decoded.syscoin.mint.txpos)
    console.log('  Receipt Position:', decoded.syscoin.mint.receiptpos)
  }

  if (decoded.syscoin.poda) {
    console.log('PoDA Data:')
    console.log('  Blob Hash:', decoded.syscoin.poda.blobHash)
    if (decoded.syscoin.poda.blobData) {
      console.log('  Blob Data:', decoded.syscoin.poda.blobData)
    }
  }

  console.log('\n=== Full JSON Output ===')
  console.log(JSON.stringify(decoded, null, 2))
} catch (error) {
  console.error('Error decoding transaction:', error.message)
}
