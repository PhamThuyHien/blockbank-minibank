import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import api from '../api';

function formatVND(amount) {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' VNĐ';
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function shortHash(h) {
  if (!h) return '';
  return h.slice(0, 10) + '...' + h.slice(-6);
}

const TABS = [
  { key: 'overview', label: 'Tổng quan' },
  { key: 'accounts', label: 'Quản lý tài khoản' },
  { key: 'ledger', label: 'Sổ cái toàn hệ thống' },
];

const TYPE_LABELS = {
  deposit: 'Nạp tiền',
  withdraw: 'Rút tiền',
  transfer_out: 'Chuyển đi',
  transfer_in: 'Chuyển đến',
};

export default function Admin() {
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  async function loadOverview() {
    const res = await api.get('/admin/stats');
    setStats(res.data);
  }
  async function loadAccounts() {
    const res = await api.get('/admin/accounts');
    setAccounts(res.data.accounts);
  }
  async function loadLedger() {
    const res = await api.get('/ledger/all');
    setBlocks(res.data.blocks);
  }

  async function loadAll() {
    setLoading(true);
    setError('');
    try {
      await Promise.all([loadOverview(), loadAccounts(), loadLedger()]);
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể tải dữ liệu quản trị');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  async function toggleStatus(acc) {
    const newStatus = acc.status === 'active' ? 'frozen' : 'active';
    try {
      await api.patch(`/admin/accounts/${acc.id}/status`, { status: newStatus });
      await loadAccounts();
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể cập nhật trạng thái');
    }
  }

  const filteredLedger = blocks.filter((b) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      b.from_account?.toLowerCase().includes(q) ||
      b.to_account?.toLowerCase().includes(q) ||
      String(b.block_id).includes(q) ||
      String(b.tx_id).includes(q)
    );
  });

  if (loading) {
    return <Layout><div className="loading-text">Đang tải dữ liệu quản trị...</div></Layout>;
  }

  return (
    <Layout>
      <h1 className="page-title">Trang quản trị Admin</h1>
      <p className="page-subtitle">Quản lý toàn bộ hệ thống Ngân hàng số mini</p>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={`tab-btn ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && stats && (
        <div className="cards-row">
          <div className="glass-card stat-card">
            <div className="stat-label">Tổng người dùng</div>
            <div className="stat-value">{stats.totalUsers}</div>
          </div>
          <div className="glass-card stat-card">
            <div className="stat-label">Tổng tài khoản</div>
            <div className="stat-value">{stats.totalAccounts}</div>
          </div>
          <div className="glass-card stat-card">
            <div className="stat-label">Tổng giao dịch</div>
            <div className="stat-value">{stats.totalTransactions}</div>
          </div>
          <div className="glass-card stat-card">
            <div className="stat-label">Tổng giá trị lưu chuyển</div>
            <div className="stat-value">{formatVND(stats.totalValue)}</div>
          </div>
        </div>
      )}

      {tab === 'accounts' && (
        <div className="glass-card table-card">
          <h3>Danh sách tài khoản ({accounts.length})</h3>
          <table>
            <thead>
              <tr>
                <th>Số TK</th>
                <th>Chủ tài khoản</th>
                <th>Username</th>
                <th style={{ textAlign: 'right' }}>Số dư</th>
                <th>Trạng thái</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((acc) => (
                <tr key={acc.id}>
                  <td>{acc.account_no}</td>
                  <td>{acc.full_name}</td>
                  <td>{acc.username}</td>
                  <td style={{ textAlign: 'right' }}>{formatVND(acc.balance)}</td>
                  <td>
                    <span className={`badge ${acc.status === 'active' ? 'badge-active' : 'badge-frozen'}`}>
                      {acc.status === 'active' ? 'Hoạt động' : 'Đóng băng'}
                    </span>
                  </td>
                  <td>
                    <button
                      className={`btn ${acc.status === 'active' ? 'btn-danger' : 'btn-success'}`}
                      style={{ width: 'auto', padding: '6px 14px', fontSize: 13 }}
                      onClick={() => toggleStatus(acc)}
                    >
                      {acc.status === 'active' ? 'Đóng băng' : 'Kích hoạt'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'ledger' && (
        <div className="glass-card table-card">
          <h3>Sổ cái toàn hệ thống ({blocks.length} blocks)</h3>
          <div className="field-group" style={{ maxWidth: 320 }}>
            <input
              className="field-input"
              type="text"
              placeholder="Tìm theo số tài khoản, block ID, TX ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <table>
            <thead>
              <tr>
                <th>Block</th>
                <th>TX ID</th>
                <th>Loại</th>
                <th>Từ</th>
                <th>Đến</th>
                <th style={{ textAlign: 'right' }}>Số tiền</th>
                <th>Thời gian</th>
                <th>Hash</th>
              </tr>
            </thead>
            <tbody>
              {filteredLedger.map((b) => (
                <tr key={b.block_id}>
                  <td>#{b.block_id}</td>
                  <td>TX-{String(b.tx_id).padStart(4, '0')}</td>
                  <td><span className={`badge badge-${b.type.startsWith('transfer') ? 'transfer' : b.type}`}>{TYPE_LABELS[b.type] || b.type}</span></td>
                  <td>{b.from_account}</td>
                  <td>{b.to_account}</td>
                  <td style={{ textAlign: 'right' }}>{formatVND(b.amount)}</td>
                  <td>{formatDate(b.created_at)}</td>
                  <td className="hash-row" style={{ marginTop: 0 }}>{shortHash(b.block_hash)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredLedger.length === 0 && <div className="empty-text">Không tìm thấy kết quả phù hợp.</div>}
        </div>
      )}
    </Layout>
  );
}
