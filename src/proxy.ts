import {NextResponse, type NextRequest} from 'next/server';
import {SESSION_COOKIE, verifySession} from './lib/session';

/** Optimistic check only: real permission checks happen in pages and actions. */
export async function proxy(request: NextRequest) {
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  const isLogin = request.nextUrl.pathname.startsWith('/dang-nhap');
  if (!session && !isLogin) {
    return NextResponse.redirect(new URL('/dang-nhap', request.url));
  }
  if (session && isLogin) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|ico)$).*)'],
};
