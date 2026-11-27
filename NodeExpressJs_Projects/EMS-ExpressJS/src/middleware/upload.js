const multer = require('multer');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const { sniff } = require('../utils/imageType');

const make = (allowedTypes) => {
  const m = multer({ storage: multer.memoryStorage(), limits: { fileSize: env.maxUploadBytes, files: 1 } });
  return [
    m.single('file'),
    (req, res, next) => {
      if (!req.file) return next(ApiError.badRequest('A file is required in multipart field "file"', undefined, 'FILE_REQUIRED'));
      const real = sniff(req.file.buffer);
      // Validate declared MIME *and* actual content signature; they must agree.
      if (!real || !allowedTypes.includes(real) || req.file.mimetype !== real) {
        return next(ApiError.badRequest(`Unsupported or mismatched file type. Allowed: ${allowedTypes.join(', ')}`, undefined, 'INVALID_FILE_TYPE'));
      }
      req.file.detectedType = real;
      next();
    },
  ];
};
/** Like imageUpload but the file is OPTIONAL (public registration form): absent → continue, present → same type/size checks. */
const optionalImageUpload = [
  multer({ storage: multer.memoryStorage(), limits: { fileSize: env.maxUploadBytes, files: 1 } }).single('file'),
  (req, res, next) => {
    if (!req.file) return next();
    const real = sniff(req.file.buffer);
    if (!real || !['image/jpeg', 'image/png', 'image/webp'].includes(real) || req.file.mimetype !== real) {
      return next(ApiError.badRequest('Unsupported or mismatched file type. Allowed: image/jpeg, image/png, image/webp', undefined, 'INVALID_FILE_TYPE'));
    }
    req.file.detectedType = real;
    next();
  },
];
module.exports = { optionalImageUpload, imageUpload: make(['image/jpeg', 'image/png', 'image/webp']), documentUpload: make(['image/jpeg', 'image/png', 'application/pdf']) };
