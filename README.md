# ATG – Phần mềm quản lý

Phần mềm quản lý bán hàng, kho, nhập khẩu, công nợ, thu chi cho ATG (18 phân hệ theo cây chức năng chốt 13/11/2026).

## Công nghệ
- Next.js 16 (App Router, TypeScript), giao diện Astryx (theme neutral, tiếng Việt)
- PostgreSQL (Neon trên Vercel) qua Drizzle ORM
- Đăng nhập bằng tài khoản/mật khẩu, phân quyền theo nhóm quyền × chức năng × (xem, thêm, sửa, xóa, đề xuất, duyệt)

## Chạy thử trên máy
```bash
npm install
npm run dev          # không có DATABASE_URL: chạy cơ sở dữ liệu tạm trong bộ nhớ, có sẵn dữ liệu mẫu
```
Đăng nhập: `admin / admin123`, hoặc `ketoan`, `kho`, `banhang`, `hr` với mật khẩu `123456`.

## Deploy lên Vercel
1. Import repo này vào Vercel (Add New → Project → Deploy).
2. Storage → Create Database → Neon (Free, Singapore). Vercel tự thêm `DATABASE_URL`.
3. (Nên có) Settings → Environment Variables: thêm `AUTH_SECRET` là một chuỗi ngẫu nhiên dài.
4. Redeploy. Lần chạy đầu phần mềm tự tạo bảng và nạp dữ liệu mẫu.

Bản sao phần mềm quản lý thuế: tạo thêm một project Vercel từ cùng repo, đặt `TAX_MODE=1` và tên miền riêng.

## Cấu trúc
- `src/lib/features.ts` – cây 18 phân hệ, mã chức năng, đợt triển khai
- `src/lib/resources/definitions.ts` – khai báo các màn danh mục (trường, bắt buộc, lọc, chế độ đề xuất/nháp)
- `src/db/schema.ts` – bảng dữ liệu; `drizzle/` – migration (tự chạy khi khởi động)
- `src/server/` – nghiệp vụ phía máy chủ (danh mục, đề xuất – duyệt, thông báo)
- `docs/AGENT_BRIEF.md` – quy ước cho các trợ lý AI cùng phát triển
