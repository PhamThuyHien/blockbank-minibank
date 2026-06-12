import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';

export default function Register() {
  const [form, setForm] = useState({ username: '', password: '', full_name: '', phone: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await api.post('/auth/register', form);
      setSuccess(`Đăng ký thành công! Tài khoản: ${res.data.account.account_no}. Đang chuyển đến trang đăng nhập...`);
      setTimeout(() => navigate('/login'), 1800);
    } catch (err) {
      setError(err.response?.data?.error || 'Đăng ký thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="center-screen">
      <div className="glass-card auth-card">
        <div className="logo">
          <div className="logo-icon">B</div>
          <div className="logo-text">BlockBank</div>
        </div>
        <div className="subtitle">Ngân hàng số mini — Đăng ký tài khoản</div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field-group">
            <label className="field-label">Họ và tên</label>
            <input
              className="field-input"
              type="text"
              placeholder="Nguyễn Văn A"
              value={form.full_name}
              onChange={(e) => update('full_name', e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="field-group">
            <label className="field-label">Tên đăng nhập</label>
            <input
              className="field-input"
              type="text"
              placeholder="Chọn tên đăng nhập"
              value={form.username}
              onChange={(e) => update('username', e.target.value)}
              required
            />
          </div>
          <div className="field-group">
            <label className="field-label">Số điện thoại</label>
            <input
              className="field-input"
              type="tel"
              placeholder="09xxxxxxxx"
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
            />
          </div>
          <div className="field-group">
            <label className="field-label">Mật khẩu</label>
            <input
              className="field-input"
              type="password"
              placeholder="Tối thiểu 8 ký tự, có chữ hoa và số"
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
              required
            />
            <div className="hint-text">Mật khẩu cần tối thiểu 8 ký tự, bao gồm chữ hoa và số.</div>
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Đang đăng ký...' : 'Đăng ký'}
          </button>
        </form>

        <div className="link-text">
          Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
        </div>
      </div>
    </div>
  );
}
