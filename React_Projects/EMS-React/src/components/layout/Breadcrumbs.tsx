import { Breadcrumbs as MuiBreadcrumbs, Link, Typography } from '@mui/material';
import { Link as RouterLink, useMatches, type UIMatch } from 'react-router-dom';

export interface RouteHandle {
  crumb?: string | ((match: UIMatch) => string);
}

/** Breadcrumbs derived from the matched routes: each route declares `handle: { crumb }` — no hard-coded path parsing. */
export function Breadcrumbs() {
  const matches = useMatches() as UIMatch<unknown, RouteHandle | undefined>[];
  const crumbs = matches
    .filter((m) => m.handle?.crumb)
    .map((m) => ({
      to: m.pathname,
      label: typeof m.handle!.crumb === 'function' ? m.handle!.crumb(m) : m.handle!.crumb!,
    }));
  if (crumbs.length < 2) return null;
  return (
    <MuiBreadcrumbs aria-label="Breadcrumb" sx={{ mb: 2 }}>
      <Link component={RouterLink} underline="hover" color="inherit" to="/dashboard">
        Home
      </Link>
      {crumbs.map((c, i) =>
        i === crumbs.length - 1 ? (
          <Typography key={c.to} color="text.primary" aria-current="page">
            {c.label}
          </Typography>
        ) : (
          <Link key={c.to} component={RouterLink} underline="hover" color="inherit" to={c.to}>
            {c.label}
          </Link>
        ),
      )}
    </MuiBreadcrumbs>
  );
}
