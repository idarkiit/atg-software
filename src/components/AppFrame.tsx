'use client';

// Frame from the Astryx "AppShellTopNavWithSideNav" block: top bar + side nav.
import {useTransition} from 'react';
import {usePathname, useRouter} from 'next/navigation';
import {AppShell} from '@astryxdesign/core/AppShell';
import {TopNav, TopNavHeading} from '@astryxdesign/core/TopNav';
import {NavIcon} from '@astryxdesign/core/NavIcon';
import {Icon} from '@astryxdesign/core/Icon';
import {SideNav, SideNavItem, SideNavSection} from '@astryxdesign/core/SideNav';
import {HStack} from '@astryxdesign/core/Stack';
import {Selector} from '@astryxdesign/core/Selector';
import {DropdownMenu} from '@astryxdesign/core/DropdownMenu';
import {Banner} from '@astryxdesign/core/Banner';
import {
  CubeIcon,
  HomeIcon,
  Cog6ToothIcon,
  UsersIcon,
  ArchiveBoxIcon,
  ExclamationTriangleIcon,
  TagIcon,
  CurrencyDollarIcon,
  GlobeAltIcon,
  TruckIcon,
  ArrowsRightLeftIcon,
  ClipboardDocumentCheckIcon,
  BuildingStorefrontIcon,
  ShieldCheckIcon,
  WrenchScrewdriverIcon,
  BanknotesIcon,
  ChartBarIcon,
  WalletIcon,
  CreditCardIcon,
  ComputerDesktopIcon,
} from '@heroicons/react/24/outline';
import type {ModuleIcon} from '@/lib/features';
import {logoutAction, switchBranchAction} from '@/server/actions';
import {NotificationBell, type NotificationItem} from './NotificationBell';

const MODULE_ICONS: Record<ModuleIcon, typeof CubeIcon> = {
  system: Cog6ToothIcon,
  people: UsersIcon,
  product: ArchiveBoxIcon,
  warning: ExclamationTriangleIcon,
  label: TagIcon,
  price: CurrencyDollarIcon,
  import: GlobeAltIcon,
  truck: TruckIcon,
  inout: ArrowsRightLeftIcon,
  check: ClipboardDocumentCheckIcon,
  branch: BuildingStorefrontIcon,
  warranty: ShieldCheckIcon,
  supplierWarranty: WrenchScrewdriverIcon,
  salary: BanknotesIcon,
  report: ChartBarIcon,
  cash: WalletIcon,
  loan: CreditCardIcon,
  asset: ComputerDesktopIcon,
};

export type NavModule = {
  key: string;
  title: string;
  icon: ModuleIcon;
  functions: {key: string; title: string; href: string; isReady: boolean}[];
};

export type FrameProps = {
  children: React.ReactNode;
  modules: NavModule[];
  user: {fullName: string; roleName: string | null};
  branches: {value: string; label: string}[];
  branchId: number | null;
  canSwitchBranch: boolean;
  notifications: NotificationItem[];
  pendingApprovals: number;
  isDemo: boolean;
  isTaxMode: boolean;
};

export function AppFrame({
  children,
  modules,
  user,
  branches,
  branchId,
  canSwitchBranch,
  notifications,
  pendingApprovals,
  isDemo,
  isTaxMode,
}: FrameProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [, startTransition] = useTransition();

  const branchLabel = branches.find(b => b.value === String(branchId))?.label ?? 'Chưa gán chi nhánh';

  return (
    <AppShell
      contentPadding={0}
      banner={
        isDemo ? (
          <Banner
            status="warning"
            title="Bản dùng thử: chưa gắn cơ sở dữ liệu, dữ liệu sẽ tự làm mới khi máy chủ khởi động lại."
            collapsible={false}
          />
        ) : undefined
      }
      topNav={
        <TopNav
          label="Thanh điều hướng chính"
          heading={
            <TopNavHeading
              heading={isTaxMode ? 'ATG – Quản lý thuế' : 'ATG'}
              subheading="Phần mềm quản lý"
              headingHref="/"
              logo={<NavIcon icon={<Icon icon={CubeIcon} size="sm" />} />}
            />
          }
          endContent={
            <HStack gap={2} vAlign="center">
              {canSwitchBranch ? (
                <Selector
                  label="Chi nhánh"
                  isLabelHidden
                  variant="secondary"
                  options={branches}
                  value={branchId ? String(branchId) : undefined}
                  onChange={v =>
                    startTransition(async () => {
                      await switchBranchAction(Number(v));
                      router.refresh();
                    })
                  }
                />
              ) : (
                <DropdownMenu
                  button={{label: branchLabel, variant: 'ghost'}}
                  hasChevron={false}
                  items={[{label: 'Chi nhánh làm việc của bạn', isDisabled: true}]}
                />
              )}
              <NotificationBell items={notifications} pendingApprovals={pendingApprovals} />
              <DropdownMenu
                button={{label: user.fullName, variant: 'ghost'}}
                alignment="end"
                items={[
                  {label: user.roleName ?? 'Chưa gán nhóm quyền', isDisabled: true},
                  {type: 'divider'},
                  {label: 'Đổi mật khẩu', href: '/tai-khoan-cua-toi'},
                  {
                    label: 'Đăng xuất',
                    onClick: () => startTransition(() => logoutAction()),
                  },
                ]}
              />
            </HStack>
          }
        />
      }
      sideNav={
        <SideNav
          collapsible
          resizable={{defaultWidth: 272, minWidth: 220, maxWidth: 400, autoSaveId: 'atg-sidenav'}}>
          <SideNavSection title="Chung" isHeaderHidden>
            <SideNavItem label="Tổng quan" icon={HomeIcon} href="/" isSelected={pathname === '/'} />
          </SideNavSection>
          <SideNavSection title="Phân hệ">
            {modules.map(mod => {
              const isActive = pathname.startsWith(`/${mod.key}/`);
              return (
                <SideNavItem
                  key={mod.key}
                  label={mod.title}
                  icon={MODULE_ICONS[mod.icon]}
                  collapsible={{defaultIsCollapsed: !isActive}}>
                  {mod.functions.map(fn => (
                    <SideNavItem
                      key={fn.key}
                      label={fn.isReady ? fn.title : `${fn.title} · sắp có`}
                      href={fn.href}
                      size="sm"
                      isSelected={pathname === fn.href}
                    />
                  ))}
                </SideNavItem>
              );
            })}
          </SideNavSection>
        </SideNav>
      }>
      {children}
    </AppShell>
  );
}
