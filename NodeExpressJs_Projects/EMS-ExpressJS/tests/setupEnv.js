process.env.NODE_ENV = 'test';
process.env.EXPOSE_RESET_TOKEN = 'true';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-secret-test-secret-test-secret';
process.env.MAX_UPLOAD_BYTES = '65536';
