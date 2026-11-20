'use client';

// Thu nợ khách / Trả nợ NCC dialog, from the Astryx "DialogFormDialog" layout.
import {useEffect, useState, useTransition} from 'react';
import {Dialog, DialogHeader} from '@astryxdesign/core/Dialog';
import {Layout, LayoutContent, LayoutFooter} from '@astryxdesign/core/Layout';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Button} from '@astryxdesign/core/Button';
import {Banner} from '@astryxdesign/core/Banner';
import {Selector} from '@astryxdesign/core/Selector';
import {NumberInput} from '@astryxdesign/core/NumberInput';
import {DateInput} from '@astryxdesign/core/DateInput';
import {TextArea} from '@astryxdesign/core/TextArea';
import {recordPaymentAction} from '@/server/actions-stock';
import {openDocsAction} from '@/server/actions-reports';
import type {OpenDoc} from '@/server/reports';
import {dateVN, money, type ISODate} from './format';

export type PaymentTarget = {
  party: 'customer' | 'supplier';
  partyId: number;
  partyName: string;
  /** Preselected voucher (nợ quá hạn). */
  docId?: number | null;
  /** Suggested amount. */
  amount?: number;
};

export function PaymentDialog({
  target,
  today,
  onClose,
  onSaved,
}: {
  target: PaymentTarget;
  today: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const isCustomer = target.party === 'customer';
  const [docs, setDocs] = useState<OpenDoc[]>([]);
  const [docId, setDocId] = useState<string | null>(target.docId ? String(target.docId) : null);
  const [amount, setAmount] = useState<number | null>(target.amount ?? null);
  const [date, setDate] = useState<string>(today);
  const [method, setMethod] = useState<string>('cash');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  useEffect(() => {
    let alive = true;
    openDocsAction({party: target.party, partyId: target.partyId}).then(r => alive && setDocs(r));
    return () => {
      alive = false;
    };
  }, [target.party, target.partyId]);

  const selected = docs.find(d => String(d.docId) === docId);
  const title = isCustomer ? 'Thu nợ khách hàng' : 'Trả nợ nhà cung cấp';

  const submit = () => {
    setError(null);
    if (!amount || amount <= 0) return setError('Nhập số tiền lớn hơn 0.');
    if (!date) return setError('Chọn ngày.');
    startSaving(async () => {
      const result = await recordPaymentAction({
        party: target.party,
        partyId: target.partyId,
        docId: docId ? Number(docId) : null,
        amount,
        payDate: date,
        method: method === 'bank' ? 'bank' : 'cash',
        note: note.trim() || undefined,
      });
      if (result.ok) onSaved(result.message);
      else setError(result.message);
    });
  };

  return (
    <Dialog isOpen onOpenChange={open => !open && onClose()} purpose="form" width={560}>
      <Layout
        header={<DialogHeader title={title} subtitle={target.partyName} onOpenChange={() => onClose()} />}
        content={
          <LayoutContent>
            <VStack gap={3}>
              {error && <Banner status="error" title={error} container="card" collapsible={false} />}
              <Selector
                label="Phiếu thanh toán (không bắt buộc)"
                description="Bỏ trống để trừ vào các phiếu cũ nhất."
                placeholder="Không chọn phiếu, trừ phiếu cũ nhất"
                hasClear
                value={docId}
                onChange={(v: string | null) => {
                  setDocId(v);
                  const d = docs.find(x => String(x.docId) === v);
                  if (d) setAmount(d.remaining);
                }}
                options={docs.map(d => ({
                  value: String(d.docId),
                  label: `${d.code} · ${dateVN(d.date)}`,
                  description: `Còn nợ ${money(d.remaining)}${d.dueDate ? ` · hạn ${dateVN(d.dueDate)}` : ''}`,
                }))}
              />
              <HStack gap={3} wrap="wrap">
                <NumberInput
                  label="Số tiền"
                  value={amount}
                  onChange={v => setAmount(v)}
                  min={0}
                  step={1000}
                  placeholder="VNĐ"
                  description={selected ? `Còn nợ trên phiếu: ${money(selected.remaining)}` : undefined}
                  isRequired
                />
                <DateInput label="Ngày" value={date as ISODate} onChange={v => v && setDate(v)} format="system_date" isRequired />
              </HStack>
              <Selector
                label="Hình thức"
                value={method}
                onChange={(v: string) => setMethod(v || 'cash')}
                options={[
                  {value: 'cash', label: 'Tiền mặt'},
                  {value: 'bank', label: 'Chuyển khoản'},
                ]}
              />
              <TextArea label="Ghi chú" value={note} onChange={v => setNote(v)} isOptional />
            </VStack>
          </LayoutContent>
        }
        footer={
          <LayoutFooter>
            <HStack gap={2} hAlign="end">
              <Button label="Hủy" variant="ghost" onClick={onClose} />
              <Button label={isCustomer ? 'Ghi nhận thu nợ' : 'Ghi nhận trả nợ'} variant="primary" isLoading={saving} onClick={submit} />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
}
