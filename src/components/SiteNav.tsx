'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CameraIcon, MapIcon, UserIcon, CompassIcon } from './icons';
import { useSession } from './useSession';

const LINKS = [
  { href: '/studio', label: '工作台' },
  { href: '/explore', label: '发现机位' },
  { href: '/publish', label: '发布机位' },
];

export function SiteNav() {
  const pathname = usePathname();
  const { user, loading } = useSession();

  return (
    <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur border-b border-line">
      <nav className="max-w-[980px] mx-auto px-4 md:px-8 h-14 flex items-center justify-between gap-2" aria-label="主导航">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-ink text-lg shrink-0">
          <CameraIcon className="text-accent" />
          <span className="hidden sm:inline">PhotoMaster</span>
        </Link>
        <div className="flex items-center gap-0.5 sm:gap-1 md:gap-2 text-xs sm:text-sm">
          {LINKS.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-2 py-2 rounded-control whitespace-nowrap transition-colors duration-200 ease-apple hover:bg-page ${
                  active ? 'text-ink font-medium' : 'text-body'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                {link.label}
              </Link>
            );
          })}
          {loading ? (
            <span className="w-16" aria-hidden />
          ) : user ? (
            <Link
              href="/me"
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-control text-body hover:bg-page transition-colors duration-200 ease-apple"
              data-testid="nav-me"
            >
              <UserIcon />
              <span className="max-w-[6rem] truncate">{user.nickname}</span>
            </Link>
          ) : (
            <>
<Link
                href="/login"
                className="px-2 py-2 rounded-control whitespace-nowrap text-body hover:bg-page transition-colors duration-200 ease-apple"
              >
                登录
              </Link>
              <Link
                href="/register"
                className="px-3 sm:px-4 py-2 rounded-full whitespace-nowrap bg-accent text-white font-medium hover:bg-accent-hover transition-colors duration-200 ease-apple"
              >
                注册
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

export function NavIcon(props: { name: 'studio' | 'map' | 'me' }) {
  if (props.name === 'map') return <MapIcon />;
  if (props.name === 'me') return <UserIcon />;
  if (props.name === 'studio') return <CompassIcon />;
  return null;
}