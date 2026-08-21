import { login, getProfile, } from './auth.service.js';
export async function loginController(req, res) {
    try {
        const { email, password, } = req.body;
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required.',
            });
        }
        const data = await login(email, password);
        return res.json({
            success: true,
            data,
        });
    }
    catch (error) {
        const message = error instanceof Error
            ? error.message
            : 'Login failed.';
        return res.status(401).json({
            success: false,
            message,
        });
    }
}
export async function meController(req, res) {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required.',
            });
        }
        const profile = await getProfile(userId);
        return res.json({
            success: true,
            data: profile,
        });
    }
    catch (error) {
        const message = error instanceof Error
            ? error.message
            : 'Unable to load profile.';
        return res.status(404).json({
            success: false,
            message,
        });
    }
}
