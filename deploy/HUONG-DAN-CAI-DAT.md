# Hướng dẫn cài phần mềm ATG lên VPS

Toàn bộ chạy trên VPS của khách: ứng dụng, cơ sở dữ liệu PostgreSQL và sao lưu. Không dùng dịch vụ trả phí bên ngoài.

## Cấu hình VPS gợi ý (30–40 người dùng)
- 2 vCPU, 4 GB RAM, 40 GB SSD, Ubuntu 22.04/24.04
- Mở cổng 80 và 443 (nếu dùng tên miền) hoặc 3000 (nếu tạm dùng IP)

## Cài lần đầu
```bash
# 1. Cài Docker
curl -fsSL https://get.docker.com | sh

# 2. Lấy code
git clone https://github.com/<tai-khoan>/atg-software.git /opt/atg && cd /opt/atg

# 3. Tạo file cấu hình
cp .env.example .env
nano .env        # đổi DB_PASSWORD và AUTH_SECRET (openssl rand -hex 32)

# 4. Chạy
docker compose up -d --build
```
Lần chạy đầu, phần mềm tự tạo bảng và nạp dữ liệu mẫu. Đăng nhập `admin / admin123` rồi đổi mật khẩu ngay.

Bản sao phần mềm quản lý thuế (cổng 3001, tên miền riêng): `docker compose --profile thue up -d`.

## Tên miền và https (khuyên dùng)
Cài Caddy trên VPS để có https miễn phí, tự gia hạn:
```bash
sudo apt install -y caddy
sudo tee /etc/caddy/Caddyfile <<'EOF'
quanly.atg.vn {
  reverse_proxy localhost:3000
}
thue.atg.vn {
  reverse_proxy localhost:3001
}
EOF
sudo systemctl reload caddy
```
Nếu tạm thời truy cập bằng `http://IP:3000` (chưa có https), đặt `COOKIE_SECURE=0` trong `.env` rồi chạy lại `docker compose up -d`.

## Cập nhật phiên bản mới
```bash
cd /opt/atg && git pull && docker compose up -d --build
```
Cấu trúc dữ liệu tự nâng cấp khi khởi động, dữ liệu cũ giữ nguyên.

## Sao lưu và khôi phục
- Tự sao lưu lúc 02:00 hằng ngày vào `deploy/backups/atg-YYYY-MM-DD.dump`, giữ 30 ngày.
- Nên chép thư mục này sang nơi khác (Google Drive, máy khác) định kỳ.
- Khôi phục:
```bash
docker compose exec -T db pg_restore -U atg -d atg --clean < deploy/backups/atg-2026-12-01.dump
```

## Ảnh (CCCD, ảnh sản phẩm, ảnh NCC)
Ảnh được thu nhỏ và lưu ngay trong cơ sở dữ liệu, nên được sao lưu cùng dữ liệu, không cần dịch vụ lưu trữ riêng.
