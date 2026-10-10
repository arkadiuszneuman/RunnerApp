import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import ViewAgendaRoundedIcon from '@mui/icons-material/ViewAgendaRounded';

/** The bottom nav's tabs. `href` is the tab's root; `match` also claims its sub-pages. */
export const NAV_ITEMS = [
  { href: '/', label: 'Home', icon: HomeRoundedIcon, match: (p: string) => p === '/' },
  {
    href: '/programs',
    label: 'Programs',
    icon: ViewAgendaRoundedIcon,
    match: (p: string) => p.startsWith('/programs') || p.startsWith('/add-program'),
  },
  {
    href: '/runs',
    label: 'History',
    icon: HistoryRoundedIcon,
    match: (p: string) => p.startsWith('/runs') || p.startsWith('/activities'),
  },
  {
    href: '/stats',
    label: 'Stats',
    icon: InsightsRoundedIcon,
    match: (p: string) => p.startsWith('/stats'),
  },
];
