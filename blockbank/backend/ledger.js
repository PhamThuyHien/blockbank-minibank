// ledger.js - Blockchain-style ledger: each block contains transaction data,
// its own hash (block_hash) and the hash of the previous block (prev_hash).
// block_hash = SHA256(block_id + tx_id + from + to + amount + type + prev_hash + created_at)

const crypto = require('crypto');

function computeHash({ block_id, tx_id, from_account, to_account, amount, type, prev_hash, created_at }) {
  const payload = `${block_id}|${tx_id}|${from_account}|${to_account}|${amount}|${type}|${prev_hash}|${created_at}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

// Append a new block to the ledger (mutates data.ledger_blocks, data.counters)
function appendBlock(data, { tx_id, from_account, to_account, amount, type }) {
  data.counters.block += 1;
  const block_id = data.counters.block;
  const prev_hash = data.ledger_blocks.length > 0
    ? data.ledger_blocks[data.ledger_blocks.length - 1].block_hash
    : '0'.repeat(64); // genesis prev_hash

  const created_at = new Date().toISOString();
  const block_hash = computeHash({ block_id, tx_id, from_account, to_account, amount, type, prev_hash, created_at });

  const block = { block_id, tx_id, from_account, to_account, amount, type, prev_hash, block_hash, created_at };
  data.ledger_blocks.push(block);
  return block;
}

// Verify the integrity of the entire chain
function verifyChain(ledger_blocks) {
  let expectedPrev = '0'.repeat(64);
  for (const block of ledger_blocks) {
    if (block.prev_hash !== expectedPrev) {
      return { valid: false, brokenAt: block.block_id, reason: 'prev_hash mismatch' };
    }
    const recomputed = computeHash(block);
    if (recomputed !== block.block_hash) {
      return { valid: false, brokenAt: block.block_id, reason: 'block_hash mismatch (data tampered)' };
    }
    expectedPrev = block.block_hash;
  }
  return { valid: true };
}

module.exports = { computeHash, appendBlock, verifyChain };
