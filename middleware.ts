import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const user = process.env.DASHBOARD_USER;
  const pass = process.env.DASHBOARD_PASSWORD;

  if (!user || !pass) {
    return NextResponse.next();
  }

  const authHeader = req.headers.get('authorization');
  if (authHeader) {
    const encoded = authHeader.split(' ')[1] || '';
    const decoded = Buffer.from(encoded, 'base64').toString();
    const [reqUser, reqPass] = decoded.split(':');
    if (reqUser === user && reqPass === pass) {
      return NextResponse.next();
    }
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="indonesia-masterboard"' },
  });
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
};
