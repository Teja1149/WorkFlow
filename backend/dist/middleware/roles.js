export function requireRoles(...allowedRoles) {
    return (req, res, next) => {
        if (!req.profile) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required.',
            });
        }
        if (!allowedRoles.includes(req.profile.role)) {
            return res.status(403).json({
                success: false,
                message: 'Permission denied.',
            });
        }
        next();
    };
}
