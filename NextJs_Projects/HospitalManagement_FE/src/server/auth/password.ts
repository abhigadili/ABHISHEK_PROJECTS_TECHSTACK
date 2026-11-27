import 'server-only';
import bcrypt from 'bcryptjs';

/** bcrypt (cost 12) - passwords are never stored or logged in plain text. */
export const hashPassword = (plain: string) => bcrypt.hash(plain, 12);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);
/** Constant-time-ish dummy compare so "unknown e-mail" and "wrong password" take similar time. */
export const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEeO5pmM.sdsU1FHYdhlYSY.xXWL9B3g1Le';
