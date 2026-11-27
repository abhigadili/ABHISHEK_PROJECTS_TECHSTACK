// Dev-server proxy: /api -> Java API gateway. The Origin header is dropped because the gateway's CORS filter rejects origins it was not configured for.
const target = process.env.HR_GATEWAY_URL || 'http://localhost:9080';
module.exports = {
  '/api': {
    target, changeOrigin: true, secure: false,
    configure: (proxy) => { proxy.on('proxyReq', (req) => req.removeHeader('origin')); },
  },
};
