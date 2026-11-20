'use client';

import {Link} from '@astryxdesign/core/Link';
import {Text} from '@astryxdesign/core/Text';
import {DOC_KINDS, type DocKind} from '@/lib/stock/kinds';

/** Voucher code that links to the voucher detail page /{feature of the kind}/{id}. */
export function DocLink({kind, id, code}: {kind: DocKind | 'payment'; id: number | null; code: string}) {
  if (kind === 'payment' || !id) {
    return (
      <Text type="body" weight="semibold">
        {code}
      </Text>
    );
  }
  return <Link href={`/${DOC_KINDS[kind].feature}/${id}`}>{code}</Link>;
}
