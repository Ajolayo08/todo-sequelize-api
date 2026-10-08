function errorHandler(err, req, res, next) {
    console.error('[Error Log]:', err.stack);

    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    return res.status(statusCode).json({
        success: false,
        error: message,
    });
}

module.exports = errorHandler;