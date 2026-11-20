'use client';

// Frame from the Astryx "form-two-column" template: Center + Section + two-column Grid (intro | form Card).
import {useState, useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {Center} from '@astryxdesign/core/Center';
import {Section} from '@astryxdesign/core/Section';
import {Grid} from '@astryxdesign/core/Grid';
import {VStack, HStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {Card} from '@astryxdesign/core/Card';
import {Button} from '@astryxdesign/core/Button';
import {Banner} from '@astryxdesign/core/Banner';
import {Divider} from '@astryxdesign/core/Divider';
import {StatusDot} from '@astryxdesign/core/StatusDot';
import {Table, proportional, pixel, type TableColumn} from '@astryxdesign/core/Table';
import {useToast} from '@astryxdesign/core/Toast';
import {FieldInput} from '@/components/resource/FieldInput';
import {getResourceDef} from '@/lib/resources/definitions';
import type {FieldDef} from '@/lib/resources/types';
import type {ProposalView} from '@/server/proposals';
import {onboardingAction} from '@/server/actions';

type Row = ProposalView & Record<string, unknown>;

const FIELD_NAMES = ['fullName', 'phone', 'email', 'birthDate', 'idNumber', 'idCardImageUrl', 'address', 'bankAccount', 'startDate'];
const REQUIRED = new Set(['fullName', 'phone', 'idNumber']);
const dateTime = new Intl.DateTimeFormat('vi-VN', {dateStyle: 'short', timeStyle: 'short'});

const empDef = getResourceDef('doi-tuong/nhan-vien')!;
const FIELDS: FieldDef[] = FIELD_NAMES.map(n => {
  const f = empDef.fields.find(x => x.name === n)!;
  return {...f, required: REQUIRED.has(n), wide: false};
});

export function OnboardingPage({submitted, defaultName}: {submitted: ProposalView[]; defaultName: string}) {
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState<Record<string, unknown>>({fullName: defaultName});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    const missing: Record<string, string> = {};
    for (const f of FIELDS) {
      if (f.required && !values[f.name]) missing[f.name] = `Vui lòng nhập ${f.label.toLowerCase()}`;
    }
    setErrors(missing);
    if (Object.keys(missing).length) {
      setMessage('Vui lòng nhập đủ các trường bắt buộc.');
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const result = await onboardingAction(values);
      if (result.ok) {
        toast({body: result.message});
        setValues({fullName: defaultName});
        router.refresh();
      } else {
        setMessage(result.message);
      }
    });
  };

  const columns: TableColumn<Row>[] = [
    {key: 'code', header: 'Mã đề xuất', width: pixel(130), renderCell: r => <Text type="body" weight="semibold">{r.code}</Text>},
    {key: 'recordLabel', header: 'Họ tên', width: proportional(2, {minWidth: 160}), renderCell: r => <Text type="body">{r.recordLabel ?? '—'}</Text>},
    {key: 'createdAt', header: 'Gửi lúc', width: pixel(150), renderCell: r => <Text type="body">{dateTime.format(new Date(r.createdAt))}</Text>},
    {
      key: 'status',
      header: 'Trạng thái',
      width: pixel(140),
      renderCell: r => {
        const v = r.status === 'approved' ? 'success' : r.status === 'rejected' ? 'error' : 'warning';
        const label = r.status === 'approved' ? 'Đã duyệt' : r.status === 'rejected' ? 'Từ chối' : 'Chờ duyệt';
        return (
          <HStack gap={1} vAlign="center">
            <StatusDot variant={v} label={label} />
            <Text type="body" size="sm">{label}</Text>
          </HStack>
        );
      },
    },
  ];

  return (
    <Center>
      <Section maxWidth={1100} width="100%" padding={10} variant="transparent">
        <VStack gap={10}>
          <Grid columns={{minWidth: 320}} gap={10}>
            <VStack gap={6}>
              <VStack gap={3}>
                <Text type="display-1" as="h1">Khởi tạo thông tin nhân viên</Text>
                <Text type="body" color="secondary">
                  Nhân viên mới tự khai báo thông tin cá nhân để phòng Nhân sự lập hồ sơ.
                </Text>
              </VStack>
              <Banner
                status="info"
                title="Hồ sơ được lưu nháp"
                description="Hồ sơ được lưu nháp. Phòng HCNS kiểm tra và duyệt mới thành hồ sơ chính thức."
                container="card"
                collapsible={false}
              />
            </VStack>

            <Card padding={8}>
              <VStack gap={4}>
                <Text type="label">Thông tin cá nhân</Text>
                {message && <Banner status="error" title={message} container="card" collapsible={false} />}
                <Grid columns={{minWidth: 220, max: 2}} gap={3}>
                  {FIELDS.map(f => (
                    <VStack key={f.name}>
                      <FieldInput
                        field={f}
                        value={values[f.name]}
                        refOptions={{}}
                        error={errors[f.name]}
                        onChange={v => setValues(prev => ({...prev, [f.name]: v}))}
                      />
                    </VStack>
                  ))}
                </Grid>
                <VStack hAlign="stretch">
                  <Button label="Gửi hồ sơ" variant="primary" isLoading={isPending} onClick={submit} />
                </VStack>
              </VStack>
            </Card>
          </Grid>

          <VStack gap={4}>
            <Divider />
            <Text type="label">Hồ sơ đã gửi của bạn</Text>
            <Table<Row> data={submitted as Row[]} columns={columns} idKey="id" density="compact" />
          </VStack>
        </VStack>
      </Section>
    </Center>
  );
}
