// Core APIs work without SMTP. This is the single seam where an SMTP transport
// (e.g. nodemailer) could be plugged in; by default it only logs that a mail would be sent.
const logger = require('./logger');
async function sendMail({ to, subject }) {
  logger.info('mail.skipped (no SMTP transport configured)', { to, subject });
}
module.exports = { sendMail };
