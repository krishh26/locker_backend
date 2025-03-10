export const trimMiddleware = (req, res, next) => {

    Object.keys(req.body).forEach((key) => {
        if (typeof req.body[key] === 'string') {
            req.body[key] = req.body[key].trim();

            if (key === 'email') {
                req.body[key] = req.body[key].toLowerCase();
            }
        }
    });

    next();
};
