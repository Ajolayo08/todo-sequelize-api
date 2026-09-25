function info(message, meta) {
    if (meta !== undefined) {
        console.log(`[INFO] ${message}`, meta);
        return;
    }
    console.log(`[INFO] ${message}`);
}

function error(message, meta) {
    if (meta !== undefined) {
        console.error(`[ERROR] ${message}`, meta);
        return;
    }
    console.error(`[ERROR] ${message}`);
}

module.exports = {
    info,
    error
};
