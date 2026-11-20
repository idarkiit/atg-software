import {can, requireUser} from '@/lib/auth';
import {MODULES} from '@/lib/features';
import {PageState} from '@/components/PageState';
import {getSettings, getToggles} from '@/server/toggles';
import {SettingsForm} from './SettingsForm';

export default async function SettingsPage() {
  const user = await requireUser();
  if (!can(user, 'he-thong/cai-dat', 'view')) {
    return <PageState title="Bạn chưa được cấp quyền" description='Liên hệ quản trị để được cấp quyền xem "Cài đặt".' />;
  }
  const [settings, toggles] = await Promise.all([getSettings(), getToggles()]);
  return (
    <SettingsForm
      settings={settings}
      toggles={toggles}
      modules={MODULES.map(m => ({
        key: m.key,
        title: m.title,
        functions: m.functions.map(f => ({key: `${m.key}/${f.key}`, title: f.title})),
      }))}
      isAdmin={user.isAdmin}
      canEdit={can(user, 'he-thong/cai-dat', 'edit')}
    />
  );
}
