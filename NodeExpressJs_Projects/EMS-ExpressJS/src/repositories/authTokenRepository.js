const { query } = require('../config/database');

const insertRefresh = async ({ userId, tokenHash, familyId, expiresAt }, conn) =>
  (await query('INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at) VALUES (?, ?, ?, ?)',
    [userId, tokenHash, familyId, expiresAt], conn)).insertId;

const findRefreshByHash = async (hash, conn) =>
  (await query('SELECT * FROM refresh_tokens WHERE token_hash = ?' + (conn ? ' FOR UPDATE' : ''), [hash], conn))[0];

/** Atomic revoke; returns true only for the caller that actually revoked it. */
const revokeRefresh = async (id, replacedBy, conn) =>
  (await query('UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP(), replaced_by = ? WHERE id = ? AND revoked_at IS NULL',
    [replacedBy || null, id], conn)).affectedRows === 1;

const revokeFamily = (familyId, conn) =>
  query('UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP() WHERE family_id = ? AND revoked_at IS NULL', [familyId], conn);

const revokeAllForUser = (userId, conn) =>
  query('UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP() WHERE user_id = ? AND revoked_at IS NULL', [userId], conn);

const purgeExpiredRefresh = () =>
  query('DELETE FROM refresh_tokens WHERE expires_at < (UTC_TIMESTAMP() - INTERVAL 7 DAY)');

const insertReset = ({ userId, tokenHash, expiresAt }, conn) =>
  query('INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)', [userId, tokenHash, expiresAt], conn);

const invalidateResets = (userId, conn) =>
  query('UPDATE password_reset_tokens SET used_at = UTC_TIMESTAMP() WHERE user_id = ? AND used_at IS NULL', [userId], conn);

/** Single-use claim: succeeds for exactly one caller while token is unexpired and unused. */
async function claimReset(tokenHash, conn) {
  const row = (await query(
    'SELECT id, user_id FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > UTC_TIMESTAMP() FOR UPDATE',
    [tokenHash], conn))[0];
  if (!row) return null;
  await query('UPDATE password_reset_tokens SET used_at = UTC_TIMESTAMP() WHERE id = ?', [row.id], conn);
  return row;
}

const purgeExpiredResets = () => query('DELETE FROM password_reset_tokens WHERE expires_at < (UTC_TIMESTAMP() - INTERVAL 1 DAY)');

module.exports = {
  insertRefresh, findRefreshByHash, revokeRefresh, revokeFamily, revokeAllForUser, purgeExpiredRefresh,
  insertReset, invalidateResets, claimReset, purgeExpiredResets,
};
