'use client';

import {useState, useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {useMediaQuery} from '@astryxdesign/core/hooks';
import {Layout, LayoutHeader, LayoutContent, LayoutPanel} from '@astryxdesign/core/Layout';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Grid} from '@astryxdesign/core/Grid';
import {List, ListItem} from '@astryxdesign/core/List';
import {TabList, Tab} from '@astryxdesign/core/TabList';
import {Text, Heading} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {Divider} from '@astryxdesign/core/Divider';
import {Switch} from '@astryxdesign/core/Switch';
import {Selector} from '@astryxdesign/core/Selector';
import {NumberInput} from '@astryxdesign/core/NumberInput';
import {Banner} from '@astryxdesign/core/Banner';
import {useToast} from '@astryxdesign/core/Toast';
import {saveSettingsAction, saveTogglesAction} from '@/server/actions';

type Props = {
  settings: Record<string, unknown>;
  toggles: Record<string, boolean>;
  modules: {key: string; title: string; functions: {key: string; title: string}[]}[];
  isAdmin: boolean;
  canEdit: boolean;
};

type Section = 'general' | 'toggles';
const SECTIONS: {value: Section; label: string}[] = [
  {value: 'general', label: 'Tham số chung'},
  {value: 'toggles', label: 'Bật/tắt chức năng'},
];

const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
const num = (v: unknown, d: number) => (typeof v === 'number' ? v : d);

export function SettingsForm({settings, toggles, modules, isAdmin, canEdit}: Props) {
  const router = useRouter();
  const toast = useToast();
  const isNarrow = useMediaQuery('(max-width: 768px)');
  const [pending, startTransition] = useTransition();
  const [section, setSection] = useState<Section>('general');

  const [fifo, setFifo] = useState(bool(settings.fifo, true));
  const [allowNegativeStock, setAllowNegativeStock] = useState(bool(settings.allowNegativeStock, false));
  const [manageSerial, setManageSerial] = useState(bool(settings.manageSerial, false));
  const [manageLot, setManageLot] = useState(bool(settings.manageLot, false));
  const [currency, setCurrency] = useState(typeof settings.currency === 'string' ? settings.currency : 'VND');
  const [vatRate, setVatRate] = useState(num(settings.vatRate, 10));
  const [workDaysPerMonth, setWorkDaysPerMonth] = useState(num(settings.workDaysPerMonth, 26));
  const [debtCollectionRate, setDebtCollectionRate] = useState(num(settings.debtCollectionRate, 0));

  const [enabled, setEnabled] = useState<Record<string, boolean>>(toggles);
  const isOn = (key: string) => enabled[key] !== false;

  const run = (fn: () => Promise<{ok: boolean; message: string}>) =>
    startTransition(async () => {
      const res = await fn();
      toast({body: res.message, type: res.ok ? 'info' : 'error'});
      if (res.ok) router.refresh();
    });

  const saveGeneral = () =>
    run(() =>
      saveSettingsAction({fifo, allowNegativeStock, manageSerial, manageLot, currency, vatRate, workDaysPerMonth, debtCollectionRate}),
    );

  const saveToggles = () =>
    run(() => {
      const list: {feature: string; enabled: boolean}[] = [];
      for (const m of modules) {
        list.push({feature: m.key, enabled: isOn(m.key)});
        for (const f of m.functions) list.push({feature: f.key, enabled: isOn(f.key)});
      }
      return saveTogglesAction(list);
    });

  const general = (
    <VStack gap={6}>
      <Grid columns={{minWidth: 320}} gap={10}>
        <VStack gap={1}>
          <Heading level={3}>Tham số chung</Heading>
          <Text type="supporting" color="secondary">
            Các quy tắc tính toán và quản lý kho áp dụng cho toàn hệ thống.
          </Text>
        </VStack>
        <VStack gap={4}>
          <Banner status="info" title="ATG đang cân nhắc cố định các tham số này; tạm thời cho phép chỉnh." />
          <Switch label="Tính giá vốn nhập trước xuất trước (FIFO)" value={fifo} onChange={setFifo} isDisabled={!canEdit} />
          <Switch label="Cho phép xuất âm" value={allowNegativeStock} onChange={setAllowNegativeStock} isDisabled={!canEdit} />
          <Switch label="Quản lý theo số serial" value={manageSerial} onChange={setManageSerial} isDisabled={!canEdit} />
          <Switch label="Quản lý theo lô hạn" value={manageLot} onChange={setManageLot} isDisabled={!canEdit} />
          <Selector
            label="Đơn vị tiền tệ"
            value={currency}
            onChange={setCurrency}
            options={[
              {value: 'VND', label: 'VND'},
              {value: 'USD', label: 'USD'},
            ]}
            isDisabled={!canEdit}
          />
          <NumberInput label="Thuế VAT mặc định" units="%" min={0} max={100} value={vatRate} onChange={setVatRate} isDisabled={!canEdit} />
          <NumberInput label="Số ngày công/tháng" min={1} max={31} isIntegerOnly value={workDaysPerMonth} onChange={setWorkDaysPerMonth} isDisabled={!canEdit} />
          <NumberInput label="Tỷ lệ thu hồi nợ" units="%" min={0} max={100} value={debtCollectionRate} onChange={setDebtCollectionRate} isDisabled={!canEdit} />
          <HStack hAlign="end">
            <Button label="Lưu tham số" variant="primary" isLoading={pending} isDisabled={!canEdit} onClick={saveGeneral} />
          </HStack>
        </VStack>
      </Grid>
    </VStack>
  );

  const togglesView = (
    <Grid columns={{minWidth: 320}} gap={10}>
      <VStack gap={1}>
        <Heading level={3}>Bật/tắt chức năng</Heading>
        <Text type="supporting" color="secondary">
          Tắt chức năng sẽ ẩn khỏi menu và khóa truy cập với mọi tài khoản.
        </Text>
      </VStack>
      {!isAdmin ? (
        <Banner status="warning" title="Chỉ quản trị viên được bật/tắt chức năng" />
      ) : (
        <VStack gap={4}>
          {modules.map((m, i) => (
            <VStack key={m.key} gap={2}>
              {i > 0 && <Divider />}
              <Switch label={m.title} value={isOn(m.key)} onChange={v => setEnabled(p => ({...p, [m.key]: v}))} />
              <VStack gap={2}>
                {m.functions.map(f => (
                  <HStack key={f.key}>
                    <Switch
                      size="sm"
                      label={f.title}
                      value={isOn(f.key)}
                      isDisabled={!isOn(m.key)}
                      onChange={v => setEnabled(p => ({...p, [f.key]: v}))}
                    />
                  </HStack>
                ))}
              </VStack>
            </VStack>
          ))}
          <HStack hAlign="end">
            <Button label="Lưu bật/tắt chức năng" variant="primary" isLoading={pending} onClick={saveToggles} />
          </HStack>
        </VStack>
      )}
    </Grid>
  );

  return (
    <Layout
      height="fill"
      contentWidth={1440}
      header={
        <LayoutHeader hasDivider>
          <Heading level={1}>Cài đặt</Heading>
        </LayoutHeader>
      }
      start={
        isNarrow ? undefined : (
          <LayoutPanel hasDivider={false} width={260} padding={2}>
            <List density="balanced">
              {SECTIONS.map(s => (
                <ListItem key={s.value} label={s.label} isSelected={section === s.value} onClick={() => setSection(s.value)} />
              ))}
            </List>
          </LayoutPanel>
        )
      }
      content={
        <LayoutContent padding={4}>
          <VStack gap={4}>
            {isNarrow && (
              <VStack hAlign="center">
                <TabList value={section} onChange={v => setSection(v as Section)}>
                  {SECTIONS.map(s => (
                    <Tab key={s.value} value={s.value} label={s.label} />
                  ))}
                </TabList>
              </VStack>
            )}
            {section === 'general' ? general : togglesView}
          </VStack>
        </LayoutContent>
      }
    />
  );
}
