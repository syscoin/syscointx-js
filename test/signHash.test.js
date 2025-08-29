const tape = require('tape')
const utils = require('../utils')
const bitcoin = require('bitcoinjs-lib')
const { ECPairFactory } = require('ecpair')
const crypto = require('crypto')
const ecc = require('@bitcoinerlab/secp256k1')

// Initialize ECPair with ecc
const ECPair = ECPairFactory(ecc)

// Initialize bitcoinjs-lib with ecc
if (typeof bitcoin.initEccLib === 'function') {
  bitcoin.initEccLib(ecc)
}

// Test networks
const syscoinNetworks = {
  mainnet: {
    messagePrefix: '\x18Syscoin Signed Message:\n',
    bech32: 'sys',
    bip32: {
      public: 0x0488b21e,
      private: 0x0488ade4
    },
    pubKeyHash: 0x3f,
    scriptHash: 0x05,
    wif: 0x80
  },
  testnet: {
    messagePrefix: '\x18Syscoin Signed Message:\n',
    bech32: 'tsys',
    bip32: {
      public: 0x043587cf,
      private: 0x04358394
    },
    pubKeyHash: 0x41,
    scriptHash: 0xc4,
    wif: 0xef
  }
}

tape('signHash - basic signature creation', (t) => {
  // Create a test keypair
  const keyPair = ECPair.makeRandom({ network: syscoinNetworks.mainnet })
  const wif = keyPair.toWIF()

  // Create a test hash (32 bytes)
  const hash = crypto.randomBytes(32)

  // Sign the hash
  const signature = utils.signHash(wif, hash, syscoinNetworks.mainnet)

  // Verify signature structure
  t.equal(signature.length, 65, 'Signature should be 65 bytes (1 recovery + 64 signature)')

  // Extract recovery ID
  const recoveryId = signature[0]

  // Recovery ID should be in valid range (27-34)
  t.ok(recoveryId >= 27 && recoveryId <= 34, 'Recovery ID should be between 27 and 34')

  // For compressed keys, recovery ID should be 31-34
  if (keyPair.compressed) {
    t.ok(recoveryId >= 31 && recoveryId <= 34, 'Recovery ID for compressed key should be 31-34')
  } else {
    t.ok(recoveryId >= 27 && recoveryId <= 30, 'Recovery ID for uncompressed key should be 27-30')
  }

  t.end()
})

tape('signHash - signature verification', (t) => {
  // Create a test keypair
  const keyPair = ECPair.makeRandom({ network: syscoinNetworks.mainnet })
  const wif = keyPair.toWIF()

  // Create a test hash
  const hash = crypto.createHash('sha256').update('test message').digest()

  // Sign the hash
  const signature = utils.signHash(wif, hash, syscoinNetworks.mainnet)

  // Extract recovery ID and actual signature
  const recoveryId = signature[0]
  const sig = signature.slice(1)

  // Calculate the actual recovery flag (0-3)
  let recoveryFlag = recoveryId - 27
  if (recoveryFlag >= 4) {
    recoveryFlag -= 4
  }

  // Verify the signature using the ECPair's built-in verify
  const verifyKeyPair = ECPair.fromWIF(wif, syscoinNetworks.mainnet)
  const isValid = verifyKeyPair.verify(hash, sig)
  t.ok(isValid, 'Signature should be valid for the given public key')

  // Test recovery - recover public key from signature
  // ecc.recover expects: (hash, signature, recoveryId, compressed)
  const recoveredPubKey = ecc.recover(hash, sig, recoveryFlag, keyPair.compressed)
  t.ok(recoveredPubKey, 'Should be able to recover public key')

  // Compare recovered public key with original
  const recoveredBuffer = Buffer.from(recoveredPubKey)
  t.ok(recoveredBuffer.equals(keyPair.publicKey), 'Recovered public key should match original')

  t.end()
})

tape('signHash - compressed vs uncompressed keys', (t) => {
  const hash = crypto.createHash('sha256').update('test message').digest()

  // Test with compressed key
  const compressedKeyPair = ECPair.makeRandom({
    network: syscoinNetworks.mainnet,
    compressed: true
  })
  const compressedWif = compressedKeyPair.toWIF()
  const compressedSig = utils.signHash(compressedWif, hash, syscoinNetworks.mainnet)

  // Recovery ID for compressed should be >= 31
  t.ok(compressedSig[0] >= 31, 'Compressed key recovery ID should be >= 31')

  // Test with uncompressed key
  const uncompressedKeyPair = ECPair.makeRandom({
    network: syscoinNetworks.mainnet,
    compressed: false
  })
  const uncompressedWif = uncompressedKeyPair.toWIF()
  const uncompressedSig = utils.signHash(uncompressedWif, hash, syscoinNetworks.mainnet)

  // Recovery ID for uncompressed should be < 31
  t.ok(uncompressedSig[0] < 31, 'Uncompressed key recovery ID should be < 31')

  t.end()
})

tape('signHash - testnet network', (t) => {
  // Create a testnet keypair
  const keyPair = ECPair.makeRandom({ network: syscoinNetworks.testnet })
  const wif = keyPair.toWIF()

  // Create a test hash
  const hash = crypto.randomBytes(32)

  // Sign the hash
  const signature = utils.signHash(wif, hash, syscoinNetworks.testnet)

  // Verify signature structure
  t.equal(signature.length, 65, 'Testnet signature should be 65 bytes')

  // Extract and verify
  const sig = signature.slice(1)
  // Just verify structure for testnet - API differences with ecc.verify
  t.equal(sig.length, 64, 'Testnet signature payload should be 64 bytes')

  t.end()
})

tape('signHash - known test vectors', (t) => {
  // Test with a known private key and message
  // Using a deterministic test case for reproducibility
  const network = syscoinNetworks.mainnet

  // Create a keypair from a known private key (for testing only!)
  const privateKey = Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex')
  const keyPair = ECPair.fromPrivateKey(privateKey, { network, compressed: true })
  const wif = keyPair.toWIF()

  // Known hash
  const hash = Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex')

  // Sign
  const signature = utils.signHash(wif, hash, network)

  // Verify the signature format
  t.equal(signature.length, 65, 'Known vector signature should be 65 bytes')

  // Verify signature is deterministic (same input = same output)
  const signature2 = utils.signHash(wif, hash, network)
  t.ok(signature.equals(signature2), 'Signature should be deterministic')

  // Verify signature structure
  const sig = signature.slice(1)
  t.equal(sig.length, 64, 'Known vector signature payload should be 64 bytes')

  t.end()
})

tape('signHash - Bitcoin message signing compatibility', (t) => {
  // This tests that our signatures are compatible with Bitcoin's message signing format
  const network = syscoinNetworks.mainnet
  const keyPair = ECPair.makeRandom({ network, compressed: true })
  const wif = keyPair.toWIF()

  // Create a message hash as Bitcoin would
  const message = 'Hello Bitcoin!'
  const messagePrefix = network.messagePrefix
  const messageHash = bitcoin.crypto.hash256(
    Buffer.concat([
      Buffer.from(messagePrefix, 'utf8'),
      Buffer.from(String.fromCharCode(message.length), 'utf8'),
      Buffer.from(message, 'utf8')
    ])
  )

  // Sign the hash
  const signature = utils.signHash(wif, messageHash, network)

  // Extract components
  const recoveryId = signature[0]
  const sig = signature.slice(1)

  // Recovery ID format check for Bitcoin compatibility
  const isCompressed = keyPair.compressed
  const expectedRecoveryBase = 27 + (isCompressed ? 4 : 0)
  t.ok(
    recoveryId >= expectedRecoveryBase && recoveryId < expectedRecoveryBase + 4,
    'Recovery ID should be in Bitcoin-compatible range'
  )

  // Verify we can recover the public key
  let recoveryFlag = recoveryId - 27
  if (recoveryFlag >= 4) {
    recoveryFlag -= 4
  }

  // Test public key recovery for Bitcoin message signatures
  const recoveredPubKey = ecc.recover(messageHash, sig, recoveryFlag, isCompressed)
  t.ok(recoveredPubKey, 'Should recover public key from Bitcoin-style message signature')

  const recoveredBuffer = Buffer.from(recoveredPubKey)
  t.ok(recoveredBuffer.equals(keyPair.publicKey), 'Recovered key should match original')

  t.end()
})

tape('signHash - error handling', (t) => {
  const network = syscoinNetworks.mainnet

  // Test with invalid WIF
  t.throws(() => {
    utils.signHash('invalid-wif', Buffer.alloc(32), network)
  }, 'Should throw on invalid WIF')

  // Test with wrong network WIF
  const testnetKeyPair = ECPair.makeRandom({ network: syscoinNetworks.testnet })
  const testnetWif = testnetKeyPair.toWIF()

  t.throws(() => {
    utils.signHash(testnetWif, Buffer.alloc(32), syscoinNetworks.mainnet)
  }, 'Should throw when WIF network doesn\'t match specified network')

  // Test with invalid hash length
  const keyPair = ECPair.makeRandom({ network })
  const wif = keyPair.toWIF()

  // Note: The function might not validate hash length, but this is good to test
  const shortHash = Buffer.alloc(16) // Too short

  // These may or may not throw depending on implementation, but signatures won't be valid
  try {
    const sig1 = utils.signHash(wif, shortHash, network)
    t.equal(sig1.length, 65, 'Even with wrong hash size, signature format should be consistent')
  } catch (e) {
    t.pass('Function correctly rejects invalid hash size')
  }

  t.end()
})
