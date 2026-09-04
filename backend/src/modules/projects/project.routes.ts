import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { requireRoles } from '../../middleware/roles.js'
import {
  listProjects,
  addProject,
  patchProject,
  removeProject,
  listProjectMembers,
  addMemberToProject,
  removeMemberFromProject,
} from './project.controller.js'

const router = Router()

router.get(
  '/',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE'),
  listProjects,
)

router.post(
  '/',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  addProject,
)

router.patch(
  '/:id',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  patchProject,
)

router.delete(
  '/:id',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'ADMIN'),
  removeProject,
)

router.get(
  '/:id/members',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE'),
  listProjectMembers,
)

router.post(
  '/:id/members',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  addMemberToProject,
)

router.delete(
  '/:id/members/:userId',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  removeMemberFromProject,
)

export default router
