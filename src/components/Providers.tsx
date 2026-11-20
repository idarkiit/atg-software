'use client';

import NextLink from 'next/link';
import {Theme} from '@astryxdesign/core/theme';
import {LinkProvider} from '@astryxdesign/core/Link';
import {InternationalizationProvider} from '@astryxdesign/core/i18n';
import viVN from '@astryxdesign/core/locales/vi-VN.generated.js';
import {themes, defaultThemeSlug} from '@/astryx-themes';

export function Providers({children}: {children: React.ReactNode}) {
  return (
    <InternationalizationProvider locale="vi-VN" messages={{'vi-VN': viVN}}>
      <Theme theme={themes[defaultThemeSlug]}>
        <LinkProvider component={NextLink}>{children}</LinkProvider>
      </Theme>
    </InternationalizationProvider>
  );
}
