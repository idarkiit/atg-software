import {LoginForm} from './LoginForm';
import {isDemoDatabase} from '@/db';

/**
 * Demo accounts are listed only on the in-memory demo database, or when
 * SHOW_DEMO_ACCOUNTS=1 is set (e.g. a preview link for ATG to click through).
 */
export default function LoginPage() {
  const showAccounts = isDemoDatabase || process.env.SHOW_DEMO_ACCOUNTS === '1';
  return <LoginForm isDemo={isDemoDatabase} showAccounts={showAccounts} />;
}
