'use client';

import {useState, useTransition} from 'react';
import {Dialog, DialogHeader} from '@astryxdesign/core/Dialog';
import {Layout, LayoutContent, LayoutFooter} from '@astryxdesign/core/Layout';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Button} from '@astryxdesign/core/Button';
import {Banner} from '@astryxdesign/core/Banner';
import {TextArea} from '@astryxdesign/core/TextArea';
import {Text} from '@astryxdesign/core/Text';
import {useToast} from '@astryxdesign/core/Toast';
import {cancelDocAction} from '@/server/actions-stock';

type Props = {
  doc: {id: number; code: string};
  onClose: () => void;
  onCancelled: () => void;
};

/** Asks for the required reason, then cancels a posted voucher (stock and debt are reversed by the server). */
export function CancelDocDialog({doc, onClose, onCancelled}: Props) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    if (!reason.trim()) {
      setError('Vui lòng nhập lý do hủy phiếu.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await cancelDocAction(doc.id, reason.trim());
      if (result.ok) {
        toast({body: result.message});
        onCancelled();
      } else {
        setError(result.message);
        toast({body: result.message, type: 'error'});
      }
    });
  };

  return (
    <Dialog isOpen onOpenChange={open => !open && onClose()} purpose="form" width={520}>
      <Layout
        header={<DialogHeader title={`Hủy phiếu ${doc.code}?`} subtitle="Tồn kho và công nợ sẽ được hoàn lại. Phiếu vẫn được lưu để tra cứu." onOpenChange={() => onClose()} />}
        content={
          <LayoutContent>
            <VStack gap={3}>
              {error && <Banner status="error" title={error} container="card" collapsible={false} />}
              <Text type="body" color="secondary" size="sm">
                Phiếu đã hủy không thể khôi phục. Cần tạo phiếu mới nếu muốn ghi lại giao dịch.
              </Text>
              <TextArea
                label="Lý do hủy"
                isRequired
                value={reason}
                onChange={setReason}
                rows={3}
                placeholder="VD: nhập sai số lượng"
              />
            </VStack>
          </LayoutContent>
        }
        footer={
          <LayoutFooter>
            <HStack gap={2} hAlign="end">
              <Button label="Đóng" variant="secondary" onClick={onClose} />
              <Button label="Hủy phiếu" variant="destructive" isLoading={isPending} onClick={submit} />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
}
