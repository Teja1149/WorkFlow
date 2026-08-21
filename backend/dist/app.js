import express from 'express';
import cors from 'cors';
import authRoutes from './modules/auth/auth.routes.js';
import employeeRoutes from './modules/employees/employee.routes.js';
import projectRoutes from './modules/projects/project.routes.js';
import workItemRoutes from './modules/work-items/work-item.routes.js';
import workCommunicationRoutes from './modules/work-activity/work-communication.routes.js';
import notificationRoutes from './modules/notifications/notification.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';
import conversationRoutes from './modules/conversations/conversations.routes.js';
import projectUpdateRoutes from './modules/project-updates/project-update.routes.js';
const app = express();
app.use(cors({
    origin: true,
    credentials: true,
}));
app.use(express.json());
app.get('/health', (_req, res) => {
    res.status(200).json({
        success: true,
        service: 'employee-work-management-api',
        status: 'healthy',
        timestamp: new Date().toISOString(),
    });
});
app.get('/api/health', (_req, res) => {
    res.status(200).json({
        success: true,
        service: 'employee-work-management-api',
        status: 'healthy',
        timestamp: new Date().toISOString(),
    });
});
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/work-items', workItemRoutes);
app.use('/api/work-items', workCommunicationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api', projectUpdateRoutes);
export default app;
