import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { searchController } from './search.controller.js'

const router = Router()

router.get('/search', requireAuth, searchController)

export default router
