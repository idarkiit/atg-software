import {LoginForm} from './LoginForm';
import {isDemoDatabase} from '@/db';

export default function LoginPage() {
  return <LoginForm isDemo={isDemoDatabase} />;
}
