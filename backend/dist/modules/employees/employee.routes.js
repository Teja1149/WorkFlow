import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireRoles } from '../../middleware/roles.js';
import { listEmployees, addEmployee, editEmployee, } from './employee.controller.js';
const router = Router();
router.get('/', requireAuth, requireRoles('SUPER_ADMIN', 'MANAGER'), listEmployees);
router.post('/', requireAuth, requireRoles('SUPER_ADMIN'), addEmployee);
router.patch('/:id', requireAuth, requireRoles('SUPER_ADMIN'), editEmployee);
export default router;
