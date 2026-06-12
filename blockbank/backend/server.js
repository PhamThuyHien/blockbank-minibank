// server.js - BlockBank Mini Digital Bank backend
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { transaction, load } = require('./db');
const { appendBlock, verifyChain } = require('./ledger');
const { authMiddleware, adminOnly, JWT_SECRET } = require('./authMiddleware');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;
const MAX_TX_AMOUNT = 500000000; // 500 triệu VNĐ / lần (per use-case spec UC04)

// ---------- Helpers ----------
function genAccountNumber(seq) {
  return `BB-${String(seq).padStart(4, '0')}-2026`;
}

function publicAccount(acc) {
  return {
    id: acc.id,
    account_no: acc.account_no,
    balance: acc.balance,
    status: acc.status,
    user_id: acc.user_id,
  };
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

// ---------- UC01: Đăng ký ----------
app.post('/api/auth/register', async (req, res) => {
  const { username, password, full_name, phone } = req.body;
  if (!username || !password || !full_name) {
    return res.status(400).json({ error: 'Vui lòng nhập đầy đủ thông tin (username, password, họ tên)' });
  }
  if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return res.status(400).json({ error: 'Mật khẩu phải có tối thiểu 8 ký tự, gồm chữ hoa và số' });
  }

  try {
    const result = await transaction(async (data) => {
      if (data.users.find(u => u.username === username)) {
        throw { status: 409, message: 'Username đã tồn tại' };
      }
      const password_hash = await bcrypt.hash(password, 10);
      data.counters.user += 1;
      const userId = data.counters.user;
      const role = data.users.length === 0 ? 'admin' : 'user'; // first user = admin

      const user = {
        id: userId,
        username,
        password_hash,
        full_name,
        phone: phone || '',
        role,
        created_at: new Date().toISOString(),
      };
      data.users.push(user);

      data.counters.account += 1;
      const accountId = data.counters.account;
      const account = {
        id: accountId,
        user_id: userId,
        account_no: genAccountNumber(accountId),
        balance: 0,
        status: 'active',
        created_at: new Date().toISOString(),
      };
      data.accounts.push(account);

      return { user, account };
    });

    return res.status(201).json({
      message: 'Đăng ký thành công',
      user: { id: result.user.id, username: result.user.username, full_name: result.user.full_name, role: result.user.role },
      account: publicAccount(result.account),
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error(err);
    return res.status(500).json({ error: 'Lỗi server' });
  }
});

// ---------- UC02: Đăng nhập ----------
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Vui lòng nhập username và password' });
  }
  const data = load();
  const user = data.users.find(u => u.username === username);
  if (!user) return res.status(401).json({ error: 'Sai username hoặc mật khẩu' });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Sai username hoặc mật khẩu' });

  const account = data.accounts.find(a => a.user_id === user.id);
  const token = signToken(user);

  return res.json({
    token,
    user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role },
    account: account ? publicAccount(account) : null,
  });
});

// ---------- UC03: Xem số dư / thông tin tài khoản ----------
app.get('/api/account/me', authMiddleware, (req, res) => {
  const data = load();
  const account = data.accounts.find(a => a.user_id === req.user.id);
  if (!account) return res.status(404).json({ error: 'Không tìm thấy tài khoản' });
  res.json({ account: publicAccount(account) });
});

// Recent transactions for current user
app.get('/api/account/transactions', authMiddleware, (req, res) => {
  const data = load();
  const account = data.accounts.find(a => a.user_id === req.user.id);
  if (!account) return res.status(404).json({ error: 'Không tìm thấy tài khoản' });

  const txs = data.transactions
    .filter(t => t.from_account === account.account_no || t.to_account === account.account_no)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 20);

  res.json({ transactions: txs });
});

// ---------- UC04: Nạp tiền ----------
app.post('/api/transactions/deposit', authMiddleware, async (req, res) => {
  const { amount, description } = req.body;
  const amt = Number(amount);

  if (!amt || amt <= 0) return res.status(400).json({ error: 'Số tiền phải lớn hơn 0' });
  if (amt > MAX_TX_AMOUNT) return res.status(400).json({ error: `Số tiền không vượt quá ${MAX_TX_AMOUNT.toLocaleString('vi-VN')} VNĐ/lần` });

  try {
    const result = await transaction(async (data) => {
      const account = data.accounts.find(a => a.user_id === req.user.id);
      if (!account) throw { status: 404, message: 'Không tìm thấy tài khoản' };
      if (account.status !== 'active') throw { status: 403, message: 'Tài khoản đang bị đóng băng' };

      account.balance += amt;

      data.counters.transaction += 1;
      const tx = {
        id: data.counters.transaction,
        from_account: null,
        to_account: account.account_no,
        amount: amt,
        description: description || 'Nạp tiền',
        type: 'deposit',
        created_at: new Date().toISOString(),
      };
      data.transactions.push(tx);

      const block = appendBlock(data, {
        tx_id: tx.id, from_account: 'EXTERNAL', to_account: account.account_no, amount: amt, type: 'deposit'
      });

      return { account, tx, block };
    });

    res.json({ message: 'Nạp tiền thành công', account: publicAccount(result.account), transaction: result.tx, block: result.block });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// ---------- UC05: Rút tiền ----------
app.post('/api/transactions/withdraw', authMiddleware, async (req, res) => {
  const { amount, description } = req.body;
  const amt = Number(amount);

  if (!amt || amt <= 0) return res.status(400).json({ error: 'Số tiền phải lớn hơn 0' });
  if (amt > MAX_TX_AMOUNT) return res.status(400).json({ error: `Số tiền không vượt quá ${MAX_TX_AMOUNT.toLocaleString('vi-VN')} VNĐ/lần` });

  try {
    const result = await transaction(async (data) => {
      const account = data.accounts.find(a => a.user_id === req.user.id);
      if (!account) throw { status: 404, message: 'Không tìm thấy tài khoản' };
      if (account.status !== 'active') throw { status: 403, message: 'Tài khoản đang bị đóng băng' };
      if (account.balance < amt) throw { status: 400, message: 'Số dư không đủ để thực hiện giao dịch' };

      account.balance -= amt;

      data.counters.transaction += 1;
      const tx = {
        id: data.counters.transaction,
        from_account: account.account_no,
        to_account: null,
        amount: amt,
        description: description || 'Rút tiền',
        type: 'withdraw',
        created_at: new Date().toISOString(),
      };
      data.transactions.push(tx);

      const block = appendBlock(data, {
        tx_id: tx.id, from_account: account.account_no, to_account: 'EXTERNAL', amount: amt, type: 'withdraw'
      });

      return { account, tx, block };
    });

    res.json({ message: 'Rút tiền thành công', account: publicAccount(result.account), transaction: result.tx, block: result.block });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// ---------- UC06: Chuyển tiền ----------
app.post('/api/transactions/transfer', authMiddleware, async (req, res) => {
  const { to_account_no, amount, description } = req.body;
  const amt = Number(amount);

  if (!to_account_no) return res.status(400).json({ error: 'Vui lòng nhập số tài khoản đích' });
  if (!amt || amt <= 0) return res.status(400).json({ error: 'Số tiền phải lớn hơn 0' });
  if (amt > MAX_TX_AMOUNT) return res.status(400).json({ error: `Số tiền không vượt quá ${MAX_TX_AMOUNT.toLocaleString('vi-VN')} VNĐ/lần` });

  try {
    const result = await transaction(async (data) => {
      const fromAcc = data.accounts.find(a => a.user_id === req.user.id);
      if (!fromAcc) throw { status: 404, message: 'Không tìm thấy tài khoản của bạn' };
      if (fromAcc.status !== 'active') throw { status: 403, message: 'Tài khoản của bạn đang bị đóng băng' };

      if (fromAcc.account_no === to_account_no) {
        throw { status: 400, message: 'Không thể chuyển tiền cho chính tài khoản của mình' };
      }

      const toAcc = data.accounts.find(a => a.account_no === to_account_no);
      if (!toAcc) throw { status: 404, message: 'Tài khoản đích không tồn tại' };
      if (toAcc.status !== 'active') throw { status: 403, message: 'Tài khoản đích đang bị đóng băng' };

      if (fromAcc.balance < amt) throw { status: 400, message: 'Số dư không đủ để thực hiện giao dịch' };

      fromAcc.balance -= amt;
      toAcc.balance += amt;

      data.counters.transaction += 1;
      const tx = {
        id: data.counters.transaction,
        from_account: fromAcc.account_no,
        to_account: toAcc.account_no,
        amount: amt,
        description: description || 'Chuyển tiền',
        type: 'transfer',
        created_at: new Date().toISOString(),
      };
      data.transactions.push(tx);

      // 2 blocks: debit + credit (per UC06 spec)
      const debitBlock = appendBlock(data, {
        tx_id: tx.id, from_account: fromAcc.account_no, to_account: toAcc.account_no, amount: amt, type: 'transfer_out'
      });
      const creditBlock = appendBlock(data, {
        tx_id: tx.id, from_account: fromAcc.account_no, to_account: toAcc.account_no, amount: amt, type: 'transfer_in'
      });

      return { fromAcc, tx, debitBlock, creditBlock };
    });

    res.json({
      message: 'Chuyển tiền thành công',
      account: publicAccount(result.fromAcc),
      transaction: result.tx,
      blocks: [result.debitBlock, result.creditBlock],
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// ---------- UC07: Lookup account name by account_no (for transfer auto-fill) ----------
app.get('/api/account/lookup/:account_no', authMiddleware, (req, res) => {
  const data = load();
  const acc = data.accounts.find(a => a.account_no === req.params.account_no);
  if (!acc) return res.status(404).json({ error: 'Không tìm thấy tài khoản' });
  const user = data.users.find(u => u.id === acc.user_id);
  res.json({ account_no: acc.account_no, full_name: user ? user.full_name : 'N/A', status: acc.status });
});

// ---------- UC07: Sổ cái giao dịch (Ledger) cá nhân ----------
app.get('/api/ledger/me', authMiddleware, (req, res) => {
  const data = load();
  const account = data.accounts.find(a => a.user_id === req.user.id);
  if (!account) return res.status(404).json({ error: 'Không tìm thấy tài khoản' });

  const blocks = data.ledger_blocks
    .filter(b => b.from_account === account.account_no || b.to_account === account.account_no)
    .sort((a, b) => b.block_id - a.block_id);

  res.json({ blocks });
});

// ---------- UC08: Admin - Toàn bộ sổ cái ----------
app.get('/api/ledger/all', authMiddleware, adminOnly, (req, res) => {
  const data = load();
  const blocks = [...data.ledger_blocks].sort((a, b) => b.block_id - a.block_id);
  res.json({ blocks });
});

// ---------- Xác thực tính toàn vẹn của chuỗi (verify) ----------
app.get('/api/ledger/verify', authMiddleware, (req, res) => {
  const data = load();
  let blocks = data.ledger_blocks;

  // Non-admin can only verify the global chain integrity (read-only check), still useful
  const result = verifyChain(blocks);
  res.json(result);
});

// ---------- UC09 / UC08: Admin - Quản lý tài khoản ----------
app.get('/api/admin/accounts', authMiddleware, adminOnly, (req, res) => {
  const data = load();
  const accounts = data.accounts.map(acc => {
    const user = data.users.find(u => u.id === acc.user_id);
    return {
      ...publicAccount(acc),
      full_name: user ? user.full_name : 'N/A',
      username: user ? user.username : 'N/A',
    };
  });
  res.json({ accounts });
});

app.patch('/api/admin/accounts/:id/status', authMiddleware, adminOnly, async (req, res) => {
  const { status } = req.body; // 'active' | 'frozen'
  if (!['active', 'frozen'].includes(status)) {
    return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
  }
  try {
    const result = await transaction(async (data) => {
      const acc = data.accounts.find(a => a.id === Number(req.params.id));
      if (!acc) throw { status: 404, message: 'Không tìm thấy tài khoản' };
      acc.status = status;
      return acc;
    });
    res.json({ message: 'Cập nhật trạng thái thành công', account: publicAccount(result) });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// ---------- UC10: Admin - Thống kê tổng hợp ----------
app.get('/api/admin/stats', authMiddleware, adminOnly, (req, res) => {
  const data = load();
  const totalUsers = data.users.length;
  const totalAccounts = data.accounts.length;
  const totalTransactions = data.transactions.length;
  const totalValue = data.transactions.reduce((sum, t) => sum + t.amount, 0);

  // Transactions grouped by date (last 7 days) for chart
  const byDate = {};
  data.transactions.forEach(t => {
    const day = t.created_at.slice(0, 10);
    byDate[day] = (byDate[day] || 0) + 1;
  });

  res.json({
    totalUsers,
    totalAccounts,
    totalTransactions,
    totalValue,
    byDate,
  });
});

// ---------- Health check ----------
app.get('/api/health', (req, res) => res.json({ status: 'ok', message: 'BlockBank API is running' }));

app.listen(PORT, () => {
  console.log(`BlockBank backend running on http://localhost:${PORT}`);
});
