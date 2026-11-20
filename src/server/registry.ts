import 'server-only';
import type {PgTable} from 'drizzle-orm/pg-core';
import {schema} from '@/db';

/** Binds each catalog resource key to its database table. */
export const RESOURCE_TABLES: Record<string, PgTable> = {
  'he-thong/don-vi': schema.units,
  'he-thong/chi-nhanh': schema.branches,
  'he-thong/nhom-quyen': schema.roles,
  'he-thong/tai-khoan': schema.users,
  'he-thong/mau-in': schema.printTemplates,
  'doi-tuong/loai-ncc': schema.supplierTypes,
  'doi-tuong/loai-kh': schema.customerTypes,
  'doi-tuong/nha-cung-cap': schema.suppliers,
  'doi-tuong/khach-hang': schema.customers,
  'doi-tuong/phong-ban': schema.departments,
  'doi-tuong/nhan-vien': schema.employees,
  'doi-tuong/don-vi-van-chuyen': schema.shippingCarriers,
  'san-pham/kho-hang': schema.warehouses,
  'san-pham/loai-san-pham': schema.productTypes,
  'san-pham/nhom-san-pham': schema.productGroups,
  'san-pham/san-pham': schema.products,
  'san-pham/anh-san-pham': schema.productImages,
  'san-pham/anh-nha-cung-cap': schema.supplierImages,
};
