import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function Layout({ children }) {
  const { user, account, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-icon">B</div>
          <div className="logo-text">BlockBank</div>
        </div>

        <NavLink to="/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon">🏠</span> Trang chủ
        </NavLink>
        <NavLink to="/transfer" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon">💸</span> Chuyển tiền
        </NavLink>
        <NavLink to="/ledger" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon">🔗</span> Sổ cái giao dịch
        </NavLink>
        {user?.role === 'admin' && (
          <NavLink to="/admin" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">⚙️</span> Quản trị Admin
          </NavLink>
        )}

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="name">{user?.full_name}</div>
            <div className="acc">{account?.account_no}</div>
            {user?.role === 'admin' && <span className="role-badge">ADMIN</span>}
          </div>
          <button className="nav-item" onClick={handleLogout}>
            <span className="nav-icon">🚪</span> Đăng xuất
          </button>
        </div>
      </aside>

      <main className="main-content">{children}</main>
    </div>
  );
}
