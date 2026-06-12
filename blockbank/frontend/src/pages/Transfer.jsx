import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../api';
import { useAuth } from '../AuthContext';

function formatVND(amount) {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' VNĐ';
}

const TABS = [
  { key: 'transfer', label: '💸 Chuyển tiền', icon: '💸' },
  { key: 'deposit', label: '💰 Nạp tiền', icon: '💰' },
  { key: 'withdraw', label: '🏦 Rút tiền', icon: '🏦' },
];

export default function Transfer() {
  const { account, refreshAccount } = useAuth();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('action') || 'transfer';
  const [tab, setTab] = useState(['transfer', 'deposit', 'withdraw'].includes(initialTab) ? initialTab : 'transfer');

  const [toAccount, setToAccount] = useState('');
  const [toAccountName, setToAccountName] = useState(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);

  function resetForm() {
    setToAccount('');
    setToAccountName(null);
    setAmount('');
    setDescription('');
    setError('');
  }

  useEffect(() => { resetForm(); setSuccess(''); }, [tab]);

  // Auto-lookup destination account name (UC: tự động điền tên chủ tài khoản)
  useEffect(() => {
    if (tab !== 'transfer') return;
    const trimmed = toAccount.trim();
    if (trimmed.length < 6) {
      setToAccountName(null);
      return;
    }
    const timer = setTimeout(async () => {
      setLookupLoading(true);
      try {
        const res = await api.get(`/account/lookup/${encodeURIComponent(trimmed)}`);
        setToAccountName(res.data);
      } catch {
        setToAccountName(null);
      } finally {
        setLookupLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [toAccount, tab]);

  function validate() {
    const amt = Number(amount);
    if (!amt || amt <= 0) return 'Số tiền phải lớn hơn 0';
    if (amt > 500000000) return 'Số tiền không vượt quá 500.000.000 VNĐ/lần';
    if (tab === 'transfer') {
      if (!toAccount.trim()) return 'Vui lòng nhập số tài khoản đích';
      if (toAccount.trim() === account?.account_no) return 'Không thể chuyển tiền cho chính tài khoản của mình';
    }
    return null;
  }

  function handleOpenConfirm(e) {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    setShowConfirm(true);
  }

  async function handleConfirm() {
    setLoading(true);
    setError('');
    try {
      let res;
      const amt = Number(amount);
      if (tab === 'deposit') {
        res = await api.post('/transactions/deposit', { amount: amt, description: description || 'Nạp tiền' });
      } else if (tab === 'withdraw') {
        res = await api.post('/transactions/withdraw', { amount: amt, description: description || 'Rút tiền' });
      } else {
        res = await api.post('/transactions/transfer', {
          to_account_no: toAccount.trim(),
          amount: amt,
          description: description || 'Chuyển tiền',
        });
      }
      setSuccess(res.data.message);
      await refreshAccount();
      resetForm();
    } catch (err) {
      setError(err.response?.data?.error || 'Giao dịch thất bại');
    } finally {
      setLoading(false);
      setShowConfirm(false);
    }
  }

  const remainingBalance = (() => {
    const amt = Number(amount) || 0;
    if (!account) return 0;
    if (tab === 'deposit') return account.balance + amt;
    return account.balance - amt;
  })();

  return (
    <Layout>
      <h1 className="page-title">Giao dịch</h1>
      <p className="page-subtitle">Thực hiện nạp tiền, rút tiền hoặc chuyển tiền giữa các tài khoản</p>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={`tab-btn ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="glass-card form-card">
        <div style={{ marginBottom: 16, fontSize: 14, color: 'var(--text-secondary)' }}>
          Tài khoản nguồn: <strong style={{ color: 'var(--text-primary)' }}>{account?.account_no}</strong><br />
          Số dư hiện tại: <strong style={{ color: 'var(--text-primary)' }}>{account ? formatVND(account.balance) : '...'}</strong>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <form onSubmit={handleOpenConfirm}>
          {tab === 'transfer' && (
            <div className="field-group">
              <label className="field-label">Số tài khoản đích</label>
              <input
                className="field-input"
                type="text"
                placeholder="BB-0002-2026"
                value={toAccount}
                onChange={(e) => setToAccount(e.target.value)}
                required
              />
              {lookupLoading && <div className="hint-text">Đang tìm...</div>}
              {!lookupLoading && toAccountName && (
                <div className="hint-text">
                  Chủ tài khoản: <strong style={{ color: 'var(--success)' }}>{toAccountName.full_name}</strong>
                  {toAccountName.status !== 'active' && <span style={{ color: 'var(--danger)' }}> (Đã đóng băng)</span>}
                </div>
              )}
              {!lookupLoading && toAccount.trim().length >= 6 && !toAccountName && (
                <div className="hint-text" style={{ color: 'var(--danger)' }}>Không tìm thấy tài khoản</div>
              )}
            </div>
          )}

          <div className="field-group">
            <label className="field-label">Số tiền (VNĐ)</label>
            <input
              className="field-input"
              type="number"
              min="1"
              placeholder="Ví dụ: 500000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="field-group">
            <label className="field-label">Nội dung</label>
            <input
              className="field-input"
              type="text"
              placeholder={tab === 'deposit' ? 'Nạp tiền' : tab === 'withdraw' ? 'Rút tiền' : 'Nội dung chuyển khoản'}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {tab === 'deposit' ? 'Nạp tiền' : tab === 'withdraw' ? 'Rút tiền' : 'Tiếp tục chuyển tiền'}
          </button>
        </form>
      </div>

      {showConfirm && (
        <div className="modal-overlay" onClick={() => setShowConfirm(false)}>
          <div className="glass-card modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Xác nhận giao dịch</h3>
            {tab === 'transfer' && (
              <>
                <div className="modal-row"><span className="label">Tài khoản đích</span><span className="value">{toAccount}</span></div>
                <div className="modal-row"><span className="label">Chủ tài khoản</span><span className="value">{toAccountName?.full_name || '—'}</span></div>
              </>
            )}
            <div className="modal-row"><span className="label">Số tiền</span><span className="value">{formatVND(Number(amount) || 0)}</span></div>
            <div className="modal-row"><span className="label">Số dư sau giao dịch</span><span className="value">{formatVND(remainingBalance)}</span></div>

            <div className="alert alert-warning" style={{ marginTop: 16, marginBottom: 0 }}>
              ⚠ Giao dịch sẽ được ghi vào sổ cái (Blockchain Ledger) và không thể hủy sau khi xác nhận.
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowConfirm(false)} disabled={loading}>Hủy</button>
              <button className="btn btn-primary" onClick={handleConfirm} disabled={loading}>
                {loading ? 'Đang xử lý...' : 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
