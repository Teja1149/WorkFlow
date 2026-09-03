import app from './app.js'
import { startScheduler } from './jobs/scheduler.js'

const PORT = Number(process.env.PORT || 5000)

async function startServer() {
  try {
    app.listen(PORT, () => {
      console.log(`EWM API running on http://localhost:${PORT}`)
      startScheduler()
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

startServer()
