'use client';

import {useState, useTransition} from 'react';
import {Layout, LayoutHeader, LayoutContent} from '@astryxdesign/core/Layout';
import {VStack} from '@astryxdesign/core/Stack';
import {Grid} from '@astryxdesign/core/Grid';
import {Card} from '@astryxdesign/core/Card';
import {Text, Heading} from '@astryxdesign/core/Text';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Button} from '@astryxdesign/core/Button';
import {Banner} from '@astryxdesign/core/Banner';
import {MetadataList, MetadataListItem} from '@astryxdesign/core/MetadataList';
import {useToast} from '@astryxdesign/core/Toast';
import {changePasswordAction} from '@/server/actions';

type Props = {fullName: string; username: string; roleName: string; branchName: string};

export function AccountPage({fullName, username, roleName, branchName}: Props) {
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    if (!current || !next) return setError('Vui lòng nhập mật khẩu hiện tại và mật khẩu mới.');
    if (next !== confirm) return setError('Mật khẩu xác nhận không khớp.');
    setError(null);
    startTransition(async () => {
      const result = await changePasswordAction(current, next);
      if (result.ok) {
        toast({body: result.message});
        setCurrent('');
        setNext('');
        setConfirm('');
      } else {
        setError(result.message);
      }
    });
  };

  return (
    <Layout
      header={
        <LayoutHeader hasDivider>
          <VStack gap={1}>
            <Heading level={2}>Tài khoản của tôi</Heading>
            <Text type="body" color="secondary" size="sm">Thông tin đăng nhập và đổi mật khẩu.</Text>
          </VStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent>
          <Grid columns={{minWidth: 320, max: 2}} gap={4}>
            <Card>
              <VStack gap={3}>
                <Text type="label">Thông tin</Text>
                <MetadataList>
                  <MetadataListItem label="Họ tên">{fullName}</MetadataListItem>
                  <MetadataListItem label="Tên đăng nhập">{username}</MetadataListItem>
                  <MetadataListItem label="Nhóm quyền">{roleName}</MetadataListItem>
                  <MetadataListItem label="Chi nhánh">{branchName}</MetadataListItem>
                </MetadataList>
              </VStack>
            </Card>
            <Card>
              <VStack gap={3}>
                <Text type="label">Đổi mật khẩu</Text>
                {error && <Banner status="error" title={error} container="card" collapsible={false} />}
                <TextInput label="Mật khẩu hiện tại" type="password" value={current} onChange={setCurrent} isRequired />
                <TextInput label="Mật khẩu mới" description="Tối thiểu 6 ký tự" type="password" value={next} onChange={setNext} isRequired />
                <TextInput label="Nhập lại mật khẩu mới" type="password" value={confirm} onChange={setConfirm} isRequired />
                <VStack hAlign="start">
                  <Button label="Đổi mật khẩu" variant="primary" isLoading={isPending} onClick={submit} />
                </VStack>
              </VStack>
            </Card>
          </Grid>
        </LayoutContent>
      }
    />
  );
}
