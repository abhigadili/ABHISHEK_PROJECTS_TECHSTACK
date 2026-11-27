/** Where a notification should take the user (derived from the backend's `refType` / `refId`). */
export function notificationTarget(refType: string | null, refId: number | null): string | null {
  if (!refType || refId == null) return null;
  switch (refType) {
    case 'leave_request':
      return `/leaves/${refId}`;
    case 'employee':
      return `/employees/${refId}`;
    case 'attendance':
      return `/attendance/${refId}`;
    default:
      return null;
  }
}
