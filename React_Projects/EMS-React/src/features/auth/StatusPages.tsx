import { Button, Stack, Typography } from '@mui/material';
import {
  Link as RouterLink,
  isRouteErrorResponse,
  useLocation,
  useNavigate,
  useRouteError,
} from 'react-router-dom';
import { AuthShell } from './AuthShell';
import { isApiError } from '@/api/errors';

export function UnauthorizedPage() {
  const location = useLocation();
  const attempted = (location.state as { attempted?: string } | null)?.attempted;
  return (
    <Stack alignItems="center" spacing={2} sx={{ py: 8, textAlign: 'center' }}>
      <Typography variant="h2" component="p">
        403
      </Typography>
      <Typography variant="h5" component="h1">
        You don't have access to this page
      </Typography>
      <Typography color="text.secondary">
        {attempted ? (
          <>
            Your role cannot open <code>{attempted}</code>.
          </>
        ) : (
          'Your role cannot open this page.'
        )}
      </Typography>
      <Button component={RouterLink} to="/dashboard" variant="contained">
        Back to dashboard
      </Button>
    </Stack>
  );
}

/** Wildcard route (`*`). */
export function NotFoundPage() {
  return (
    <AuthShell title="Page not found" subtitle="The page you were looking for doesn't exist.">
      <Button component={RouterLink} to="/dashboard" variant="contained">
        Go to dashboard
      </Button>
    </AuthShell>
  );
}

/** Route-level `errorElement`: renders loader failures (404 employee, 403…) and unexpected render errors inside the layout. */
export function RouteError() {
  const error = useRouteError();
  const navigate = useNavigate();
  let title = 'Something went wrong';
  let detail = 'An unexpected error occurred.';
  if (isRouteErrorResponse(error)) {
    title = `${error.status} ${error.statusText}`;
    detail = typeof error.data === 'string' ? error.data : detail;
  } else if (
    isApiError(error) ||
    (typeof error === 'object' && error !== null && 'status' in error && 'message' in error)
  ) {
    const e = error as { status: number; message: string };
    title = e.status === 404 ? 'Not found' : e.status === 403 ? 'Access denied' : 'Request failed';
    detail = e.message;
  } else if (error instanceof Error) detail = error.message;
  return (
    <Stack alignItems="center" spacing={2} sx={{ py: 8, textAlign: 'center' }} role="alert">
      <Typography variant="h4" component="h1">
        {title}
      </Typography>
      <Typography color="text.secondary">{detail}</Typography>
      <Stack direction="row" spacing={1}>
        <Button onClick={() => navigate(-1)}>Go back</Button>
        <Button variant="contained" component={RouterLink} to="/dashboard">
          Dashboard
        </Button>
      </Stack>
    </Stack>
  );
}
