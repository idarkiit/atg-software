'use client';

import {useState, useTransition} from 'react';
import {Dialog, DialogHeader} from '@astryxdesign/core/Dialog';
import {Layout, LayoutContent, LayoutFooter} from '@astryxdesign/core/Layout';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Grid} from '@astryxdesign/core/Grid';
import {Button} from '@astryxdesign/core/Button';
import {Banner} from '@astryxdesign/core/Banner';
import {Selector} from '@astryxdesign/core/Selector';
import {NumberInput} from '@astryxdesign/core/NumberInput';
import {TextArea} from '@astryxdesign/core/TextArea';
import {Text} from '@astryxdesign/core/Text';
import {createProposalAction} from '@/server/actions-pricing';
import {vnd} from './format';

export type ProposalProduct = {
  id: number;
  code: string;
  name: string;
  price1: number;
  price2: number;
  price3: number;
};

/** Staff propose a new sale price; a manager approves it on "Tính lãi giá bán". */
export function ProposalDialog({
  products,
  initialProductId,
  onClose,
  onSaved,
}: {
  products: ProposalProduct[];
  initialProductId: number | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [productId, setProductId] = useState<number | null>(initialProductId);
  const [price1, setPrice1] = useState<number | null>(null);
  const [price2, setPrice2] = useState<number | null>(null);
  const [price3, setPrice3] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const product = products.find(p => p.id === productId) ?? null;

  const submit = () => {
    if (!productId) return setMessage('Vui lòng chọn sản phẩm.');
    if (!price1 || price1 <= 0) return setMessage('Vui lòng nhập giá bán 1 đề xuất.');
    setMessage(null);
    startTransition(async () => {
      const result = await createProposalAction({productId, price1, price2, price3, reason});
      if (result.ok) onSaved(result.message);
      else setMessage(result.message);
    });
  };

  return (
    <Dialog isOpen onOpenChange={open => !open && onClose()} purpose="form" width={640}>
      <Layout
        header={
          <DialogHeader
            title="Đề xuất giá bán"
            subtitle="Giá chỉ thay đổi sau khi người có quyền duyệt ở Tính lãi giá bán."
            onOpenChange={() => onClose()}
          />
        }
        content={
          <LayoutContent>
            <VStack gap={4}>
              {message && <Banner status="error" title={message} container="card" collapsible={false} />}
              <Selector
                label="Sản phẩm"
                isRequired
                hasSearch
                options={products.map(p => ({value: String(p.id), label: `${p.code} · ${p.name}`}))}
                value={productId ? String(productId) : undefined}
                placeholder="Chọn sản phẩm"
                onChange={(v: string) => setProductId(v ? Number(v) : null)}
              />
              {product && (
                <VStack gap={1}>
                  <Text type="label">Giá bán hiện tại</Text>
                  <Text type="body" color="secondary">
                    {`${product.code} · ${product.name}: Giá 1 ${vnd(product.price1)} · Giá 2 ${vnd(product.price2)} · Giá 3 ${vnd(product.price3)}`}
                  </Text>
                </VStack>
              )}
              <Grid columns={{minWidth: 160, max: 3}} gap={3}>
                <NumberInput label="Giá bán 1 đề xuất" isRequired value={price1} onChange={setPrice1} min={0} step={1000} hasClear placeholder="VNĐ" />
                <NumberInput label="Giá bán 2 đề xuất" isOptional value={price2} onChange={setPrice2} min={0} step={1000} hasClear placeholder="VNĐ" />
                <NumberInput label="Giá bán 3 đề xuất" isOptional value={price3} onChange={setPrice3} min={0} step={1000} hasClear placeholder="VNĐ" />
              </Grid>
              <TextArea label="Lý do đề xuất" value={reason} onChange={setReason} placeholder="VD: đối thủ giảm giá, giá nhập tăng…" />
            </VStack>
          </LayoutContent>
        }
        footer={
          <LayoutFooter>
            <HStack gap={2} hAlign="end">
              <Button label="Hủy" variant="secondary" onClick={onClose} />
              <Button label="Gửi đề xuất" variant="primary" isLoading={isPending} onClick={submit} />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
}
