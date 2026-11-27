/** Cookie names owned by the Next.js server (HttpOnly; the browser never reads the tokens). */
export const AT_COOKIE = 'ttb_at';
export const RT_COOKIE = 'ttb_rt';
export const ROLE_COOKIE = 'ttb_role'; // non-sensitive hint used only by proxy.ts for coarse routing; real checks are server-side
export const THEME_COOKIE = 'ttb_theme';
/** Cache tags for on-demand revalidation (revalidateTag / updateTag). */
export const TAGS = { stations: 'stations', trains: 'trains', train: (id: number | string) => `train-${id}`, rules: 'cancellation-rules' } as const;
export const REVALIDATE = { stations: 3600, trains: 300, train: 300 } as const;
export const SITE_NAME = 'TrainTicket';
export const ADMIN_ROLES = ['ADMIN', 'BOOKING_STAFF', 'TRAIN_OPERATOR'] as const;
