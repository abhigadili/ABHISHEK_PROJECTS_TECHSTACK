const multer = require('multer');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

const notFound = (req, res, next) => next(ApiError.notFound(`Route ${req.method} ${req.path} not found`));

function normalize(err) {
  if (err instanceof ApiError) return err;
  if (err instanceof multer.MulterError) {
    return err.code === 'LIMIT_FILE_SIZE'
      ? new ApiError(413, 'FILE_TOO_LARGE', 'Uploaded file exceeds the size limit')
      : ApiError.badRequest('Invalid upload', undefined, 'UPLOAD_ERROR');
  }
  if (err.type === 'entity.parse.failed') return ApiError.badRequest('Malformed JSON body', undefined, 'MALFORMED_JSON');
  if (err.type === 'entity.too.large') return new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request body too large');
  switch (err.code) {
    case 'ER_DUP_ENTRY': return ApiError.conflict('A record with the same unique value already exists', 'DUPLICATE');
    case 'ER_NO_REFERENCED_ROW_2': return ApiError.badRequest('A referenced record does not exist', undefined, 'INVALID_REFERENCE');
    case 'ER_ROW_IS_REFERENCED_2': return ApiError.conflict('Record is still referenced by other data', 'IN_USE');
    case 'ER_CHECK_CONSTRAINT_VIOLATED': return ApiError.unprocessable('A data constraint was violated', undefined, 'CONSTRAINT_VIOLATION');
    case 'ER_LOCK_DEADLOCK': return new ApiError(503, 'RETRY', 'Temporary conflict, please retry');
    default: return null;
  }
}

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const known = normalize(err);
  if (known) {
    return res.status(known.status).json({
      success: false,
      error: { code: known.code, message: known.message, ...(known.details ? { details: known.details } : {}), requestId: req.id },
    });
  }
  logger.error('unhandled error', { requestId: req.id, path: req.path, error: err.message, stack: err.stack });
  return res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', requestId: req.id },
  });
};

module.exports = { notFound, errorHandler };
