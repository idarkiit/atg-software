import type {Metadata} from 'next';
import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';
import {Providers} from '@/components/Providers';

export const metadata: Metadata = {
  title: 'ATG – Phần mềm quản lý',
  description: 'Phần mềm quản lý bán hàng, kho, nhập khẩu, công nợ của ATG',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="vi">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
