import { supabase, supabaseAdmin, } from '../lib/supabase.js';
export async function requireAuth(req, res, next) {
    try {
        const header = req.headers.authorization;
        if (!header?.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required.',
            });
        }
        const token = header.substring(7);
        const { data, error, } = await supabase.auth.getUser(token);
        if (error || !data.user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired session.',
            });
        }
        const { data: profile, error: profileError, } = await supabaseAdmin
            .from('profiles')
            .select('id, role, status, organization_id')
            .eq('id', data.user.id)
            .single();
        if (profileError ||
            !profile) {
            return res.status(401).json({
                success: false,
                message: 'Employee profile not found.',
            });
        }
        if (profile.status !== 'ACTIVE') {
            return res.status(403).json({
                success: false,
                message: 'Account is not active.',
            });
        }
        req.userId = data.user.id;
        req.profile = profile;
        next();
    }
    catch {
        return res.status(401).json({
            success: false,
            message: 'Authentication failed.',
        });
    }
}
