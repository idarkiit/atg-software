/**
 * The ATG function tree (18 modules, from "CÂY CHỨC NĂNG CHỐT" clarified 13/11/2026).
 *
 * Every function has a stable `key` used for permissions, on/off toggles and
 * notifications, and lives at /{module}/{function}. `phase` is the delivery
 * batch it is built in; pages of later phases show a "coming soon" screen.
 */
export type FeatureFn = {
  key: string;
  title: string;
  phase: number;
  /** Whether this function has a propose → approve flow (shows the Approve permission). */
  approvable?: boolean;
};

export type FeatureModule = {
  key: string;
  title: string;
  icon: ModuleIcon;
  functions: FeatureFn[];
};

export type ModuleIcon =
  | 'system'
  | 'people'
  | 'product'
  | 'warning'
  | 'label'
  | 'price'
  | 'import'
  | 'truck'
  | 'inout'
  | 'check'
  | 'branch'
  | 'warranty'
  | 'supplierWarranty'
  | 'salary'
  | 'report'
  | 'cash'
  | 'loan'
  | 'asset';

/** Phase currently delivered. Functions with phase <= this are live. */
export const CURRENT_PHASE = 2;

export const MODULES: FeatureModule[] = [
  {
    key: 'he-thong',
    title: 'Hệ thống',
    icon: 'system',
    functions: [
      {key: 'don-vi', title: 'Đơn vị', phase: 1},
      {key: 'chi-nhanh', title: 'Chi nhánh', phase: 1},
      {key: 'nhom-quyen', title: 'Nhóm quyền', phase: 1},
      {key: 'phan-quyen', title: 'Phân quyền', phase: 1},
      {key: 'tai-khoan', title: 'Tài khoản', phase: 1},
      {key: 'cai-dat', title: 'Cài đặt', phase: 1},
      {key: 'mau-in', title: 'Mẫu in', phase: 1},
    ],
  },
  {
    key: 'doi-tuong',
    title: 'Đối tượng',
    icon: 'people',
    functions: [
      {key: 'loai-ncc', title: 'Loại nhà cung cấp', phase: 1},
      {key: 'loai-kh', title: 'Loại khách hàng', phase: 1},
      {key: 'nha-cung-cap', title: 'Nhà cung cấp', phase: 1, approvable: true},
      {key: 'khach-hang', title: 'Khách hàng', phase: 1, approvable: true},
      {key: 'phong-ban', title: 'Phòng ban', phase: 1},
      {key: 'khai-bao-nhan-vien', title: 'Khởi tạo thông tin nhân viên', phase: 1, approvable: true},
      {key: 'nhan-vien', title: 'Nhân viên', phase: 1, approvable: true},
      {key: 'don-vi-van-chuyen', title: 'Đơn vị vận chuyển', phase: 1},
    ],
  },
  {
    key: 'san-pham',
    title: 'Sản phẩm',
    icon: 'product',
    functions: [
      {key: 'kho-hang', title: 'Kho hàng', phase: 1},
      {key: 'loai-san-pham', title: 'Loại sản phẩm', phase: 1},
      {key: 'nhom-san-pham', title: 'Nhóm sản phẩm', phase: 1},
      {key: 'san-pham', title: 'Sản phẩm', phase: 1},
      {key: 'anh-san-pham', title: 'Hình ảnh sản phẩm', phase: 1},
      {key: 'anh-nha-cung-cap', title: 'Hình ảnh nhà cung cấp', phase: 1},
    ],
  },
  {
    key: 'canh-bao',
    title: 'Cảnh báo',
    icon: 'warning',
    functions: [
      {key: 'ghi-chu', title: 'Tạo ghi chú', phase: 2},
      {key: 'san-pham-loi', title: 'Cảnh báo sản phẩm', phase: 2},
      {key: 'duyet-de-xuat', title: 'Duyệt đề xuất', phase: 1},
      {key: 'thong-bao', title: 'Thông báo chức năng', phase: 1},
    ],
  },
  {
    key: 'tem-nhan',
    title: 'Quản lý tem nhãn',
    icon: 'label',
    functions: [
      {key: 'thiet-ke-ma-vach', title: 'Thiết kế tem mã vạch', phase: 4},
      {key: 'thiet-ke-rfid', title: 'Thiết kế tem RFID', phase: 4},
      {key: 'in-ma-vach', title: 'In mã vạch theo đơn', phase: 4},
      {key: 'in-rfid', title: 'In tem RFID theo đơn', phase: 4},
      {key: 'nhap-rfid', title: 'Nhập mã RFID', phase: 4},
      {key: 'thong-ke-rfid', title: 'Thống kê sản phẩm RFID', phase: 4},
    ],
  },
  {
    key: 'bang-gia',
    title: 'Quản lý bảng giá',
    icon: 'price',
    functions: [
      {key: 'gia-ban', title: 'Bảng giá bán', phase: 2},
      {key: 'gia-ncc', title: 'Bảng giá NCC', phase: 2},
      {key: 'so-sanh-gia-ncc', title: 'Thống kê giá các NCC', phase: 2},
      {key: 'gia-trung-binh', title: 'Bảng giá trung bình', phase: 2},
      {key: 'tinh-lai', title: 'Tính lãi giá bán', phase: 2, approvable: true},
      {key: 'de-xuat-gia', title: 'Đề xuất giá bán', phase: 2, approvable: true},
    ],
  },
  {
    key: 'nhap-khau',
    title: 'Quản lý nhập khẩu',
    icon: 'import',
    functions: [
      {key: 'trang-thai', title: 'Trạng thái nhập khẩu', phase: 3},
      {key: 'don-nhap-khau', title: 'Đơn hàng nhập khẩu', phase: 3},
      {key: 'thong-ke-don', title: 'Thống kê đơn nhập khẩu', phase: 3},
      {key: 'theo-doi', title: 'Theo dõi nhập khẩu', phase: 3},
      {key: 'de-xuat-nhap-khau', title: 'Đề xuất nhập khẩu', phase: 3, approvable: true},
      {key: 'cong-no-ncc-nuoc-ngoai', title: 'Công nợ NCC nước ngoài', phase: 3},
      {key: 'phan-tich-dat-hang', title: 'Phân tích đặt hàng', phase: 3},
    ],
  },
  {
    key: 'van-chuyen',
    title: 'Vận chuyển',
    icon: 'truck',
    functions: [
      {key: 'dia-diem-kho', title: 'Địa điểm kho', phase: 3},
      {key: 'quoc-te', title: 'Vận chuyển quốc tế', phase: 3},
      {key: 'trong-nuoc', title: 'Vận chuyển trong nước', phase: 3},
      {key: 'bao-hanh', title: 'Vận chuyển bảo hành', phase: 3},
      {key: 'loai-xuat-nhap', title: 'Loại xuất nhập', phase: 2},
    ],
  },
  {
    key: 'xuat-nhap',
    title: 'Quản lý xuất nhập',
    icon: 'inout',
    functions: [
      {key: 'phieu-xuat-ban', title: 'Phiếu xuất bán', phase: 2},
      {key: 'thong-ke-phieu-xuat', title: 'Thống kê phiếu xuất', phase: 2},
      {key: 'xuat-vat', title: 'Phiếu xuất thuế (VAT)', phase: 2},
      {key: 'khach-tra-hang', title: 'Nhập lại hàng xuất bán', phase: 2},
      {key: 'no-qua-han', title: 'Theo dõi nợ quá hạn', phase: 2},
      {key: 'cong-no-kh', title: 'Công nợ khách hàng', phase: 2},
      {key: 'cong-no-ncc', title: 'Công nợ NCC trong nước', phase: 2},
      {key: 'lich-su-gia', title: 'Lịch sử giá bán', phase: 2},
      {key: 'giao-dich-kh', title: 'Giao dịch khách hàng', phase: 2},
      {key: 'phieu-nhap', title: 'Phiếu nhập', phase: 2},
      {key: 'thong-ke-nhap', title: 'Thống kê nhập hàng', phase: 2},
      {key: 'tra-hang-ncc', title: 'Trả lại hàng nhập', phase: 2},
      {key: 'chuyen-doi-ton', title: 'Chuyển đổi tồn', phase: 2},
      {key: 'xuat-huy', title: 'Phiếu xuất hủy', phase: 2},
      {key: 'xuat-noi-bo', title: 'Phiếu xuất nội bộ', phase: 2},
      {key: 'chuyen-kho', title: 'Phiếu chuyển kho', phase: 2},
      {key: 'ton-kho', title: 'Thống kê tồn kho', phase: 2},
    ],
  },
  {
    key: 'kiem-ke',
    title: 'Kiểm kê',
    icon: 'check',
    functions: [
      {key: 'theo-phieu-xuat', title: 'Kiểm kê theo phiếu xuất', phase: 4},
      {key: 'theo-phieu-nhap', title: 'Kiểm kê theo phiếu nhập', phase: 4},
      {key: 'phieu-kiem-kho', title: 'Phiếu kiểm kho', phase: 4},
    ],
  },
  {
    key: 'chi-nhanh',
    title: 'Liên kết chi nhánh',
    icon: 'branch',
    functions: [
      {key: 'de-xuat-chuyen-hang', title: 'Đề xuất chuyển hàng', phase: 3, approvable: true},
      {key: 'kiem-soat-chuyen-hang', title: 'Kiểm soát chuyển hàng', phase: 3},
    ],
  },
  {
    key: 'bao-hanh-kh',
    title: 'Bảo hành khách hàng',
    icon: 'warranty',
    functions: [
      {key: 'tra-cuu', title: 'Tra cứu bảo hành', phase: 6},
      {key: 'phieu-nhan', title: 'Phiếu nhận bảo hành', phase: 6},
      {key: 'phieu-tra', title: 'Phiếu trả bảo hành', phase: 6},
      {key: 'mua-lai', title: 'Phiếu mua lại bảo hành', phase: 6},
      {key: 'thong-ke', title: 'Thống kê bảo hành', phase: 6},
    ],
  },
  {
    key: 'bao-hanh-ncc',
    title: 'Bảo hành nhà cung cấp',
    icon: 'supplierWarranty',
    functions: [
      {key: 'phieu-soan', title: 'Phiếu soạn bảo hành', phase: 6},
      {key: 'phieu-gui', title: 'Phiếu gửi bảo hành', phase: 6},
      {key: 'thong-ke', title: 'Thống kê bảo hành NCC', phase: 6},
    ],
  },
  {
    key: 'luong',
    title: 'Quản lý lương',
    icon: 'salary',
    functions: [
      {key: 'khung-luong', title: 'Khung lương nhân viên', phase: 6},
      {key: 'bang-luong', title: 'Bảng lương theo tháng', phase: 6},
      {key: 'thuong-phat', title: 'Phiếu thưởng phạt', phase: 6},
      {key: 'kpi', title: 'Thống kê KPI', phase: 6},
      {key: 'xin-phep', title: 'Phiếu xin phép', phase: 6, approvable: true},
      {key: 'chuyen-can', title: 'Thống kê chuyên cần', phase: 6},
    ],
  },
  {
    key: 'bao-cao',
    title: 'Thống kê báo cáo',
    icon: 'report',
    functions: [
      {key: 'doanh-so-nhap', title: 'Doanh số nhập', phase: 5},
      {key: 'doanh-so-xuat', title: 'Doanh số xuất', phase: 5},
      {key: 'danh-gia-xuat-nhap', title: 'Đánh giá xuất và nhập', phase: 5},
      {key: 'doanh-thu-nhan-vien', title: 'Doanh thu nhân viên', phase: 5},
      {key: 'loi-nhuan', title: 'Thống kê lợi nhuận', phase: 5},
      {key: 'ton-von', title: 'Thống kê tồn vốn', phase: 5},
      {key: 'thu-chi-tong', title: 'Thu chi tổng', phase: 5},
      {key: 'tong-hop', title: 'Thống kê tổng hợp', phase: 5},
    ],
  },
  {
    key: 'thu-chi',
    title: 'Quản lý thu chi',
    icon: 'cash',
    functions: [
      {key: 'loai-thu-chi', title: 'Loại thu chi', phase: 5},
      {key: 'tai-khoan-ngan-hang', title: 'Tài khoản ngân hàng', phase: 5},
      {key: 'phieu-thu-chi', title: 'Phiếu thu chi', phase: 5},
      {key: 'theo-doi-thu-tien', title: 'Theo dõi thu tiền', phase: 5},
      {key: 'thong-ke-thu-chi', title: 'Thống kê thu chi', phase: 5},
      {key: 'ton-quy', title: 'Thống kê tồn quỹ', phase: 5},
      {key: 'thu-chi-theo-loai', title: 'Thu chi theo loại', phase: 5},
      {key: 'giao-nhan-quy', title: 'Phiếu giao nhận quỹ', phase: 5},
    ],
  },
  {
    key: 'khoan-vay',
    title: 'Quản lý khoản vay',
    icon: 'loan',
    functions: [
      {key: 'phieu-vay', title: 'Phiếu vay tiền', phase: 5},
      {key: 'phieu-tra', title: 'Phiếu trả tiền', phase: 5},
      {key: 'thong-ke', title: 'Thống kê vay trả', phase: 5},
    ],
  },
  {
    key: 'tai-san',
    title: 'Quản lý tài sản',
    icon: 'asset',
    functions: [
      {key: 'danh-muc', title: 'Tài sản', phase: 6},
      {key: 'ban-giao', title: 'Phiếu bàn giao tài sản', phase: 6},
      {key: 'thong-ke', title: 'Thống kê tài sản', phase: 6},
    ],
  },
];

/** Permission/toggle key for a function, e.g. "doi-tuong/khach-hang". */
export function featureKey(moduleKey: string, fnKey: string) {
  return `${moduleKey}/${fnKey}`;
}

export function featureHref(moduleKey: string, fnKey: string) {
  return `/${moduleKey}/${fnKey}`;
}

export function findFeature(moduleKey: string, fnKey: string) {
  const mod = MODULES.find(m => m.key === moduleKey);
  const fn = mod?.functions.find(f => f.key === fnKey);
  return mod && fn ? {mod, fn} : null;
}

export function allFeatures() {
  return MODULES.flatMap(m =>
    m.functions.map(f => ({...f, module: m, feature: featureKey(m.key, f.key)})),
  );
}
