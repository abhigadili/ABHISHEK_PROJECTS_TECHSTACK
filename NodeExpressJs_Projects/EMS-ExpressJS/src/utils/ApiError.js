class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.expose = true;
  }
  static badRequest(msg = 'Bad request', details, code = 'BAD_REQUEST') { return new ApiError(400, code, msg, details); }
  static unauthorized(msg = 'Authentication required', code = 'UNAUTHORIZED') { return new ApiError(401, code, msg); }
  static forbidden(msg = 'You do not have permission to perform this action') { return new ApiError(403, 'FORBIDDEN', msg); }
  static notFound(msg = 'Resource not found') { return new ApiError(404, 'NOT_FOUND', msg); }
  static conflict(msg = 'Conflict', code = 'CONFLICT') { return new ApiError(409, code, msg); }
  static unprocessable(msg, details, code = 'UNPROCESSABLE') { return new ApiError(422, code, msg, details); }
}
module.exports = ApiError;
