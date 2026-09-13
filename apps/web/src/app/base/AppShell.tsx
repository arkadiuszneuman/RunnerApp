'use client';

import { ReactNode, useState } from 'react';
import DirectionsRunRoundedIcon from '@mui/icons-material/DirectionsRunRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import ViewAgendaRoundedIcon from '@mui/icons-material/ViewAgendaRounded';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { displayFont, glass, tokens } from '../theme';

const NAV_ITEMS = [
  { href: '/', label: 'Home', icon: HomeRoundedIcon, match: (p: string) => p === '/' },
  {
    href: '/programs',
    label: 'Programs',
    icon: ViewAgendaRoundedIcon,
    match: (p: string) => p.startsWith('/programs') || p.startsWith('/add-program'),
  },
  { href: '/runs', label: 'History', icon: HistoryRoundedIcon, match: (p: string) => p.startsWith('/runs') },
];

/** Routes with their own full-screen action bar — the floating nav would compete with it. */
const IMMERSIVE_ROUTES = ['/running', '/add-program'];
const PUBLIC_ROUTES = ['/login', '/register'];

export function BrandMark({ size = 34 }: Readonly<{ size?: number }>) {
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: `${size * 0.32}px`,
        display: 'grid',
        placeItems: 'center',
        color: '#0b1200',
        background: `linear-gradient(135deg, ${tokens.volt} 0%, ${tokens.cyan} 100%)`,
        boxShadow: `0 8px 24px -8px ${tokens.volt}`,
        flexShrink: 0,
      }}
    >
      <DirectionsRunRoundedIcon sx={{ fontSize: size * 0.62 }} />
    </Box>
  );
}

function TopBar() {
  const { data: session } = useSession();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const label = session?.user?.name ?? session?.user?.email ?? '';

  return (
    <Box
      component="header"
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        px: 2,
        pt: 'env(safe-area-inset-top)',
        background: 'linear-gradient(to bottom, rgba(5,7,12,0.9) 30%, rgba(5,7,12,0))',
      }}
    >
      <Box
        sx={{
          height: 60,
          maxWidth: 900,
          mx: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box component={Link} href="/" sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <BrandMark size={32} />
          <Typography
            sx={{
              fontFamily: displayFont,
              fontWeight: 800,
              fontSize: '1.4rem',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            Runner
          </Typography>
        </Box>
        <IconButton onClick={(e) => setAnchor(e.currentTarget)} aria-label="Account" sx={{ p: 0.5 }}>
          <Avatar
            src={session?.user?.image ?? undefined}
            sx={{
              width: 34,
              height: 34,
              fontSize: '0.95rem',
              fontWeight: 700,
              color: tokens.text,
              background: `linear-gradient(135deg, ${tokens.violet}, ${tokens.heart})`,
              border: `2px solid ${tokens.borderStrong}`,
            }}
          >
            {label.charAt(0).toUpperCase()}
          </Avatar>
        </IconButton>
        <Menu
          anchorEl={anchor}
          open={!!anchor}
          onClose={() => setAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <Box sx={{ px: 2, py: 1, maxWidth: 260 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
              {session?.user?.name ?? 'Signed in'}
            </Typography>
            {session?.user?.email && (
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                {session.user.email}
              </Typography>
            )}
          </Box>
          <MenuItem onClick={() => signOut({ callbackUrl: '/login' })}>
            <ListItemIcon>
              <LogoutRoundedIcon fontSize="small" />
            </ListItemIcon>
            Sign out
          </MenuItem>
        </Menu>
      </Box>
    </Box>
  );
}

function BottomNav({ pathname }: Readonly<{ pathname: string }>) {
  const activeIndex = NAV_ITEMS.findIndex((item) => item.match(pathname));

  return (
    <Box
      component="nav"
      sx={{
        position: 'fixed',
        zIndex: 10,
        left: '50%',
        bottom: 'calc(14px + env(safe-area-inset-bottom))',
        width: 'min(420px, calc(100% - 32px))',
        height: 'var(--nav-height)',
        transform: 'translateX(-50%)',
        borderRadius: 999,
        ...glass,
        background: 'rgba(14, 19, 29, 0.72)',
        boxShadow: '0 20px 50px -12px rgba(0,0,0,0.75)',
        p: 1,
        display: 'grid',
        gridTemplateColumns: `repeat(${NAV_ITEMS.length}, 1fr)`,
      }}
    >
      {/* Sliding active pill */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          top: 8,
          bottom: 8,
          left: 8,
          width: `calc((100% - 16px) / ${NAV_ITEMS.length})`,
          borderRadius: 999,
          background: `linear-gradient(135deg, rgba(198,255,61,0.2), rgba(56,225,255,0.12))`,
          border: `1px solid rgba(198,255,61,0.25)`,
          transform: `translateX(${Math.max(activeIndex, 0) * 100}%)`,
          opacity: activeIndex < 0 ? 0 : 1,
          transition: 'transform 520ms var(--ease-spring), opacity 200ms ease',
        }}
      />
      {NAV_ITEMS.map((item, i) => {
        const active = i === activeIndex;
        const Icon = item.icon;
        return (
          <Box
            key={item.href}
            component={Link}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            sx={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.25,
              borderRadius: 999,
              color: active ? tokens.volt : tokens.textMuted,
              transition: 'color 300ms ease',
              '&:active': { transform: 'scale(0.94)' },
            }}
          >
            <Icon
              sx={{
                fontSize: 22,
                transform: active ? 'translateY(-1px) scale(1.08)' : 'none',
                transition: 'transform 400ms var(--ease-spring)',
              }}
            />
            <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.02em' }}>
              {item.label}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

export default function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();

  const isPublic = PUBLIC_ROUTES.some((r) => pathname.startsWith(r));
  // Deliberately not gated on useSession()'s status: that starts as 'loading'
  // on every mount (including after a hard refresh) until /api/auth/session
  // resolves, which delayed the header/nav by a beat. The route alone is
  // enough — proxy.ts already redirects unauthenticated requests away from
  // every non-public route before this component ever renders. TopBar's own
  // account menu fills in once the session arrives; see BrandMark/Avatar there.
  const showChrome = !isPublic;
  const showBottomNav = showChrome && !IMMERSIVE_ROUTES.some((r) => pathname.startsWith(r));
  // The run dashboard is fully immersive: every pixel goes to the live metrics.
  const showTopBar = showChrome && !pathname.startsWith('/running');

  return (
    <>
      {showTopBar && <TopBar />}
      <Box
        component="main"
        sx={{
          px: 2,
          pt: showTopBar ? 0.5 : 'calc(12px + env(safe-area-inset-top))',
          pb: showBottomNav
            ? 'calc(var(--nav-height) + 40px + env(safe-area-inset-bottom))'
            : 'calc(24px + env(safe-area-inset-bottom))',
        }}
      >
        {children}
      </Box>
      {showBottomNav && <BottomNav pathname={pathname} />}
    </>
  );
}
