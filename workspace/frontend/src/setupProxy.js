const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/transcribe',
    createProxyMiddleware({
      target: 'http://localhost:5000',
      changeOrigin: true,
      // Increase the limit to 100mb
      onProxyReq: (proxyReq, req, res) => {
        proxyReq.setHeader('Content-Length', req.headers['content-length'] || '');
      },
      // This is the key part:
      limit: '100mb',
    })
  );
};
