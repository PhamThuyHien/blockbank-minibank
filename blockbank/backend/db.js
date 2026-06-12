// db.js - Simple JSON-file based persistence layer
// Mimics the MySQL schema described in the report:
//   users(id, username, password_hash, full_name, phone, role, created_at)
//   accounts(id, user_id, account_no, balance, status, created_at)
//   transactions(id, from_account, to_account, amount, description, type, created_at)
//   ledger_blocks(block_id, tx_id, from_account, to_account, amount, type, block_hash, prev_hash, created_at)

const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data.json');

function defaultData() {
  return {
    users: [],
    accounts: [],
    transactions: [],
    ledger_blocks: [],
    counters: { user: 0, account: 0, transaction: 0, block: 0 }
  };
}

function load() {
  if (!fs.existsSync(DB_FILE)) {
    save(defaultData());
  }
  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  return JSON.parse(raw);
}

function save(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Simple mutex to avoid concurrent write races (single-process demo app)
let writeLock = Promise.resolve();
function transaction(fn) {
  writeLock = writeLock.then(async () => {
    const data = load();
    const result = await fn(data);
    save(data);
    return result;
  });
  return writeLock;
}

module.exports = { load, save, transaction };
