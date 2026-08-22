import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { requireRoles } from '../../middleware/roles.js'
import {
  listProjects,
  addProject,
  removeProject,
  listProjectMembers,
  addMemberToProject,
  removeMemberFromProject,
} from './project.controller.js'

const router = Router()

router.get(
  '/',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'MANAGER', 'EMPLOYEE'),
  listProjects,
)

router.post(
  '/',
  requireAuth,
  requireRoles('SUPER_ADMIN'),
  addProject,
)

router.delete(
  '/:id',
  requireAuth,
  requireRoles('SUPER_ADMIN'),
  removeProject,
)

router.get(
  '/:id/members',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'MANAGER', 'EMPLOYEE'),
  listProjectMembers,
)

router.post(
  '/:id/members',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'MANAGER'),
  addMemberToProject,
)

router.delete(
  '/:id/members/:userId',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'MANAGER'),
  removeMemberFromProject,
)

export default router
