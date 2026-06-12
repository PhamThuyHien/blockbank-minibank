import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import api from '../api';
import { useAuth } from '../AuthContext';

function formatVND(amount) {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' VNĐ';
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const TYPE_LABELS = {
  deposit: 'Nạp tiền (Deposit)',
  withdraw: 'Rút tiền (Withdraw)',
  transfer_out: 'Chuyển đi (Transfer Out)',
  transfer_in: 'Chuyển đến (Transfer In)',
};

function shortHash(h) {
  if (!h) return '';
  return h.slice(0, 12) + '...' + h.slice(-8);
}

export default function Ledger() {
  const { account } = useAuth();
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifying, setVerifying] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/ledger/me');
      setBlocks(res.data.blocks);
    } catch (err) {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleVerify() {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await api.get('/ledger/verify');
      setVerifyResult(res.data);
    } catch (err) {
      setVerifyResult({ valid: false, reason: 'Lỗi khi xác thực' });
    } finally {
      setVerifying(false);
    }
  }

  function isCredit(block) {
    return block.to_account === account?.account_no || block.type === 'transfer_in';
  }

  return (
    <Layout>
      <h1 className="page-title">Sổ cái giao dịch (Ledger)</h1>
      <p className="page-subtitle">
        Mỗi giao dịch được ghi nhận thành một block, liên kết với block trước bằng hàm băm SHA-256 — đảm bảo tính bất biến theo nguyên lý Blockchain.
      </p>

      <div style={{ marginBottom: 20 }}>
        <button className="btn btn-secondary" style={{ width: 'auto', padding: '10px 20px' }} onClick={handleVerify} disabled={verifying}>
          {verifying ? 'Đang xác thực...' : '✓ Xác thực tính toàn vẹn chuỗi'}
        </button>
        {verifyResult && (
          <div className={`alert ${verifyResult.valid ? 'alert-success' : 'alert-error'}`} style={{ marginTop: 12 }}>
            {verifyResult.valid
              ? '✓ Tất cả các block đều hợp lệ. Chuỗi sổ cái chưa bị thay đổi.'
              : `✗ Phát hiện bất thường tại block #${verifyResult.brokenAt}: ${verifyResult.reason}`}
          </div>
        )}
      </div>

      {loading ? (
        <div className="loading-text">Đang tải sổ cái...</div>
      ) : blocks.length === 0 ? (
        <div className="glass-card"><div className="empty-text">Chưa có giao dịch nào được ghi vào sổ cái.</div></div>
      ) : (
        blocks.map((block) => (
          <div key={block.block_id} className={`glass-card block-card type-${block.type}`}>
            <div className="block-header">
              <span className="block-id">Block #{block.block_id} — {TYPE_LABELS[block.type] || block.type}</span>
              <span className="block-time">{formatDate(block.created_at)}</span>
            </div>
            <div style={{ fontSize: 14, marginBottom: 4 }}>
              Giao dịch TX-{String(block.tx_id).padStart(4, '0')}: <strong>{block.from_account}</strong> → <strong>{block.to_account}</strong>
              {' — '}
              <span className={isCredit(block) ? 'amount-positive' : 'amount-negative'}>
                {isCredit(block) ? '+' : '-'}{formatVND(block.amount)}
              </span>
            </div>
            <div className="hash-row"><span className="hash-label">Block Hash:</span>{shortHash(block.block_hash)}</div>
            <div className="hash-row"><span className="hash-label">Prev Hash:</span>{shortHash(block.prev_hash)}</div>
          </div>
        ))
      )}
    </Layout>
  );
}
