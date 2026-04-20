import { NextResponse } from 'next/server';

export function middleware(req) {
  const basicAuth = req.headers.get('authorization');
  const url = req.nextUrl;

  // Verify there is an ADMIN_PASSWORD set in the environment
  const password = process.env.ADMIN_PASSWORD;
  
  if (password) {
    if (basicAuth) {
      const authValue = basicAuth.split(' ')[1];
      const [user, pwd] = atob(authValue).split(':');

      // Simple check against the single admin password
      if (pwd === password) {
        return NextResponse.next();
      }
    }
    
    // Auth failed or missing, prompt basic auth
    url.pathname = '/api/auth';
    return new NextResponse('Auth required', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Secure Area"',
      },
    });
  }

  // If no password configured, proceed (development mode / unprotected state)
  console.log(`[Middleware] Accessed ${req.nextUrl.pathname}`);
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
