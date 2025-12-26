/**
 * Cache Control Middleware
 * Prevents browser and proxy caching of API responses
 */
const noCacheMiddleware = (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
};

module.exports = noCacheMiddleware;
