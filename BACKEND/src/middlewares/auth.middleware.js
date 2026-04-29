const jwt = require("jsonwebtoken");

function getToken(req) {
    return req.cookies?.token || req.headers?.authorization?.split(' ')[1] || req.body?.token;
}

function unauthorized(res) {
    return res.status(401).json({ message: "Unauthorized" });
}

function forbidden(res) {
    return res.status(403).json({ message: "You don't have access" });
}

async function authArtist(req, res, next) {
    const token = getToken(req);

    if (!token) {
        return unauthorized(res);
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded.role !== "artist") {
            return forbidden(res);
        }

        req.user = decoded;
        return next();
    } catch (err) {
        console.error(err);
        return unauthorized(res);
    }
}

async function authUser(req, res, next) {
    const token = getToken(req);

    if (!token) {
        return unauthorized(res);
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        return next();
    } catch (err) {
        console.error(err);
        return unauthorized(res);
    }
}

module.exports = { authArtist, authUser }