import express from 'express'
import cors from 'cors'

import authRoutes from './modules/auth/auth.routes.js'
import employeeRoutes from './modules/employees/employee.routes.js'
import projectRoutes from './modules/projects/project.routes.js'
import workItemRoutes from './modules/work-items/work-item.routes.js'
import notificationRoutes from './modules/notifications/notification.routes.js'
import dashboardRoutes from './modules/dashboard/dashboard.routes.js'
import conversationRoutes from './modules/conversations/conversations.routes.js'
import projectUpdateRoutes from './modules/project-updates/project-update.routes.js'
import sprintRoutes from './modules/sprints/sprint.routes.js'
import workTypeRoutes from './modules/work-types/work-type.routes.js'
import projectModuleRoutes from './modules/project-modules/project-module.routes.js'
import projectMilestoneRoutes from './modules/project-milestones/project-milestone.routes.js'
import workExecutionRoutes from './modules/work-execution/work-execution.routes.js'
import organizationSettingRoutes from './modules/organization-settings/organization-setting.routes.js'
import workDependencyRoutes from './modules/work-dependencies/work-dependency.routes.js'
import workAnalyticsRoutes from './modules/work-analytics/work-analytics.routes.js'

const app = express()

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
)

app.use(express.json())

app.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    service: 'employee-work-management-api',
    status: 'healthy',
    timestamp: new Date().toISOString(),
  })
})

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    success: true,
    service: 'employee-work-management-api',
    status: 'healthy',
    timestamp: new Date().toISOString(),
  })
})

import recurringWorkRoutes from './modules/recurring-work/recurring-work.routes.js'
import companyOperationsRoutes from './modules/company-operations/company-operations.routes.js'
import searchRoutes from './modules/search/search.routes.js'
import dailyTargetRoutes from './modules/daily-targets/daily-target.routes.js'
import projectTargetRoutes from './modules/project-targets/project-target.routes.js'
import { errorHandler } from './middleware/error-handler.js'

app.use('/api/auth', authRoutes)
app.use('/api/employees', employeeRoutes)
app.use('/api/projects', projectRoutes)
app.use('/api/work-types', workTypeRoutes)
app.use('/api/work-items', workItemRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/conversations', conversationRoutes)
app.use('/api/work-execution', workExecutionRoutes)
app.use('/api/organization-settings', organizationSettingRoutes)
app.use('/api/recurring-work', recurringWorkRoutes)
app.use('/api', workDependencyRoutes)
app.use('/api', projectUpdateRoutes)
app.use('/api', sprintRoutes)
app.use('/api', projectModuleRoutes)
app.use('/api', projectMilestoneRoutes)
app.use('/api/work-analytics', workAnalyticsRoutes)
app.use('/api/company-operations', companyOperationsRoutes)
app.use('/api', searchRoutes)
app.use('/api/daily-targets', dailyTargetRoutes)
app.use('/api/project-targets', projectTargetRoutes)

app.use(errorHandler)

export default app
