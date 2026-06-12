# BlockBank — Ngân hàng số mini (Sổ cái lưu trữ giao dịch)

Hệ thống Ngân hàng số mini mô phỏng nguyên lý Blockchain trong việc lưu trữ giao dịch (Sổ cái / Ledger).

## Công nghệ sử dụng

- **Frontend**: React 18 (Vite), React Router DOM, Axios
- **Backend**: Node.js, Express.js
- **Xác thực**: JWT (jsonwebtoken) + bcryptjs
- **Cơ sở dữ liệu**: File JSON (`backend/data.json`) — đóng vai trò thay thế MySQL, dễ chạy không cần cài server riêng. Có thể thay bằng MySQL theo schema mô tả trong báo cáo (users, accounts, transactions, ledger_blocks).
- **Sổ cái Blockchain**: mỗi giao dịch tạo ra 1-2 block, mỗi block có `block_hash` = SHA-256(block_id, tx_id, from, to, amount, type, prev_hash, created_at) và `prev_hash` trỏ tới block trước → tạo thành chuỗi bất biến.

## Cấu trúc thư mục

```
blockbank/
├── backend/
│   ├── server.js          # API chính (auth, account, transactions, ledger, admin)
│   ├── db.js               # Lớp lưu trữ JSON file (mô phỏng MySQL)
│   ├── ledger.js            # Logic tạo block & xác thực chuỗi hash
│   ├── authMiddleware.js    # JWT middleware + phân quyền admin
│   └── package.json
└── frontend/
    ├── src/
    │   ├── pages/            # Login, Register, Dashboard, Transfer, Ledger, Admin
    │   ├── components/Layout.jsx
    │   ├── AuthContext.jsx
    │   ├── api.js
    │   └── App.jsx
    └── package.json
```

## Cách chạy

### 1. Backend (port 4000)
```bash
cd backend
npm install
npm start
```

### 2. Frontend (port 5173)
```bash
cd frontend
npm install
npm run dev
```

Mở trình duyệt tại `http://localhost:5173`

## Tài khoản demo

- Người dùng đăng ký **đầu tiên** trong hệ thống sẽ tự động được gán quyền **Admin**.
- Các tài khoản tiếp theo có quyền **User** thông thường.

## Các tính năng chính (theo Use Case trong báo cáo)

| Mã UC | Chức năng |
|-------|-----------|
| UC01 | Đăng ký tài khoản (mật khẩu ≥ 8 ký tự, có chữ hoa + số) |
| UC02 | Đăng nhập (JWT, hết hạn sau 24h) |
| UC03 | Xem số dư tài khoản |
| UC04 | Nạp tiền (≤ 500.000.000 VNĐ/lần) |
| UC05 | Rút tiền (kiểm tra số dư) |
| UC06 | Chuyển tiền (tự động điền tên người nhận, popup xác nhận, ghi 2 block debit/credit) |
| UC07 | Xem sổ cái cá nhân dạng Blockchain + nút xác thực chuỗi hash |
| UC08 | Admin xem sổ cái toàn hệ thống, tìm kiếm theo TK/Block/TX |
| UC09 | Admin đóng băng / kích hoạt tài khoản |
| UC10 | Admin xem thống kê tổng hợp (người dùng, tài khoản, giao dịch, tổng giá trị) |

## Lưu ý

- Đây là phiên bản demo phục vụ học thuật, chạy trên `localhost`.
- Để chuyển sang MySQL thật, thay thế `db.js` bằng kết nối `mysql2` theo schema 4 bảng đã mô tả trong báo cáo (users, accounts, transactions, ledger_blocks).
