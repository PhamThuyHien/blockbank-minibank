import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../api';
import { useAuth } from '../AuthContext';

function formatVND(amount) {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' VNĐ';
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const TX_LABELS = {
  deposit: 'Nạp tiền',
  withdraw: 'Rút tiền',
  transfer: 'Chuyển tiền',
};

export default function Dashboard() {
  const { account, refreshAccount } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  async function load() {
    setLoading(true);
    try {
      await refreshAccount();
      const res = await api.get('/account/transactions');
      setTransactions(res.data.transactions);
    } catch (err) {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000); // real-time polling every 5s (per report spec)
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function txDirection(tx) {
    if (tx.type === 'deposit') return 'in';
    if (tx.type === 'withdraw') return 'out';
    return tx.to_account === account?.account_no ? 'in' : 'out';
  }

  return (
    <Layout>
      <h1 className="page-title">Xin chào, {account ? '' : ''}Trang chủ</h1>
      <p className="page-subtitle">Thông tin tài khoản và giao dịch gần đây của bạn</p>

      <div className="cards-row">
        <div className="balance-card">
          <div className="balance-label">Số dư hiện tại</div>
          <div className="balance-amount">{account ? formatVND(account.balance) : '...'}</div>
          <div className="balance-meta">Số tài khoản: {account?.account_no}</div>
        </div>
        <div className="glass-card stat-card">
          <div className="stat-label">Trạng thái tài khoản</div>
          <div className="stat-value">
            <span className={`badge ${account?.status === 'active' ? 'badge-active' : 'badge-frozen'}`}>
              {account?.status === 'active' ? 'Đang hoạt động' : 'Đã đóng băng'}
            </span>
          </div>
        </div>
        <div className="glass-card stat-card">
          <div className="stat-label">Tổng số giao dịch (20 gần nhất)</div>
          <div className="stat-value">{transactions.length}</div>
        </div>
      </div>

      <div className="action-grid">
        <div className="action-btn" onClick={() => navigate('/transfer?action=deposit')}>
          <span className="action-icon">💰</span> Nạp tiền
        </div>
        <div className="action-btn" onClick={() => navigate('/transfer?action=withdraw')}>
          <span className="action-icon">🏦</span> Rút tiền
        </div>
        <div className="action-btn" onClick={() => navigate('/transfer?action=transfer')}>
          <span className="action-icon">💸</span> Chuyển tiền
        </div>
        <div className="action-btn" onClick={() => navigate('/ledger')}>
          <span className="action-icon">🔗</span> Sổ cái
        </div>
      </div>

      <div className="glass-card table-card">
        <h3>Giao dịch gần đây</h3>
        {loading ? (
          <div className="loading-text">Đang tải dữ liệu...</div>
        ) : transactions.length === 0 ? (
          <div className="empty-text">Chưa có giao dịch nào.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Loại</th>
                <th>Mô tả</th>
                <th>Đối tác</th>
                <th style={{ textAlign: 'right' }}>Số tiền</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => {
                const dir = txDirection(tx);
                const partner = dir === 'in'
                  ? (tx.from_account || 'Bên ngoài')
                  : (tx.to_account || 'Bên ngoài');
                return (
                  <tr key={tx.id + '-' + tx.created_at}>
                    <td>{formatDate(tx.created_at)}</td>
                    <td><span className={`badge badge-${tx.type}`}>{TX_LABELS[tx.type] || tx.type}</span></td>
                    <td>{tx.description}</td>
                    <td>{partner}</td>
                    <td style={{ textAlign: 'right' }} className={dir === 'in' ? 'amount-positive' : 'amount-negative'}>
                      {dir === 'in' ? '+' : '-'}{formatVND(tx.amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
}
