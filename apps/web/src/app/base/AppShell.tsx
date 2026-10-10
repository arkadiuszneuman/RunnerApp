'use client';

import { ReactNode, useLayoutEffect, useRef, useState } from 'react';
import DirectionsRunRoundedIcon from '@mui/icons-material/DirectionsRunRounded';
import InstallMobileRoundedIcon from '@mui/icons-material/InstallMobileRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import { useAtomValue } from 'jotai';
import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { forgetCachedUserData, installPromptAtom, promptInstall } from '../offline/serviceWorker';
import SyncIndicator from '../offline/SyncIndicator';
import { displayFont, glass, tokens } from '../theme';
import { NAV_ITEMS } from './navItems';
import NativeDevicePickerDialog from './NativeDevicePickerDialog';

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
  // Only set while Chromium offers installation (not once installed, not on iOS).
  const installPrompt = useAtomValue(installPromptAtom);
  const label = session?.user?.name ?? session?.user?.email ?? '';

  const handleInstall = () => {
    setAnchor(null);
    void promptInstall();
  };

  const handleSignOut = async () => {
    setAnchor(null);
    // Before signOut: nothing of this account should stay readable offline.
    await forgetCachedUserData();
    await signOut({ callbackUrl: '/login' });
  };

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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SyncIndicator />
          <IconButton
            onClick={(e) => setAnchor(e.currentTarget)}
            aria-label="Account"
            sx={{ p: 0.5 }}
          >
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
        </Box>
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
          {installPrompt && (
            <MenuItem onClick={handleInstall}>
              <ListItemIcon>
                <InstallMobileRoundedIcon fontSize="small" />
              </ListItemIcon>
              Install app
            </MenuItem>
          )}
          <MenuItem component={Link} href="/settings" onClick={() => setAnchor(null)}>
            <ListItemIcon>
              <SettingsRoundedIcon fontSize="small" />
            </ListItemIcon>
            Settings
          </MenuItem>
          <MenuItem onClick={handleSignOut}>
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

// Slingshot: the pill is first drawn back a little away from the target, then released — it
// leaves at full speed and decelerates into the target without overshooting it. The pull-back
// stays within the nav's 8px padding, so the outer tabs' pill doesn't poke past its edge.
const PULL_BACK = 7; // % of the pill's own width
const PULL_MS = 170;
const FLIGHT_MS = 380; // plus FLIGHT_MS_PER_TAB for every tab travelled
const FLIGHT_MS_PER_TAB = 50;

/** The pill's rendered translateX as % of its width, including a running animation. */
function currentOffset(el: HTMLElement): number {
  const { m41 } = new DOMMatrixReadOnly(getComputedStyle(el).transform);
  return el.offsetWidth ? (m41 / el.offsetWidth) * 100 : 0;
}

function BottomNav({ pathname }: Readonly<{ pathname: string }>) {
  // A tapped tab is selected right away rather than once its route has rendered (which takes a
  // beat), so the pill launches the moment the finger lands. Dropped as soon as the path changes.
  const [tapped, setTapped] = useState<{ index: number; from: string } | null>(null);
  const activeIndex =
    tapped?.from === pathname ? tapped.index : NAV_ITEMS.findIndex((item) => item.match(pathname));
  const pillRef = useRef<HTMLDivElement>(null);
  const prevIndexRef = useRef(activeIndex);

  useLayoutEffect(() => {
    const pill = pillRef.current;
    const prevIndex = prevIndexRef.current;
    prevIndexRef.current = activeIndex;
    if (!pill || prevIndex === activeIndex || prevIndex < 0 || activeIndex < 0) return;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || typeof pill.animate !== 'function') return;

    // The style already holds the new position; mid-flight, start from where the animation has
    // got to instead, so a quick second tap re-aims the pill smoothly.
    const running = pill.getAnimations();
    const from = running.length ? currentOffset(pill) : prevIndex * 100;
    running.forEach((animation) => animation.cancel());
    const to = activeIndex * 100;
    const flightMs = FLIGHT_MS + FLIGHT_MS_PER_TAB * Math.abs(activeIndex - prevIndex);
    const release = 'cubic-bezier(0.16, 1, 0.3, 1)';
    if (running.length) {
      // Already flying — no second pull-back, just re-aim.
      pill.animate(
        [
          { transform: `translateX(${from}%)`, easing: release },
          { transform: `translateX(${to}%)` },
        ],
        { duration: flightMs }
      );
      return;
    }
    const pulled = from - Math.sign(to - from) * PULL_BACK;
    pill.animate(
      [
        { transform: `translateX(${from}%)`, easing: 'cubic-bezier(0.45, 0, 0.55, 1)' },
        {
          transform: `translateX(${pulled}%)`,
          offset: PULL_MS / (PULL_MS + flightMs),
          easing: release,
        },
        { transform: `translateX(${to}%)` },
      ],
      { duration: PULL_MS + flightMs }
    );
  }, [activeIndex]);

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
        ref={pillRef}
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
          // The slide itself is the slingshot animation above; this only fades it in/out on
          // routes outside the nav.
          transition: 'opacity 200ms ease',
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
            onClick={() => {
              if (!active) setTapped({ index: i, from: pathname });
            }}
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
      <NativeDevicePickerDialog />
    </>
  );
}
