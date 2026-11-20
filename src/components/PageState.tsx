'use client';

import {Layout, LayoutContent} from '@astryxdesign/core/Layout';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Button} from '@astryxdesign/core/Button';

/** Full-page empty states: coming soon, switched off, no permission, not found. */
export function PageState({title, description}: {title: string; description: string}) {
  return (
    <Layout
      content={
        <LayoutContent>
          <EmptyState
            title={title}
            description={description}
            actions={<Button label="Về trang tổng quan" variant="secondary" href="/" />}
          />
        </LayoutContent>
      }
    />
  );
}
