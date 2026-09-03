import { useState } from 'react'
import {
  Settings as SettingsIcon,
  Clock,
  Layers3,
} from 'lucide-react'

import OrganizationSettings from './OrganizationSettings'
import WorkTypes from './WorkTypes'

type SettingsTab = 'general' | 'work-types'

export default function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-slate-100 p-3">
              <SettingsIcon className="h-6 w-6 text-slate-700" />
            </div>

            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                Settings
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Manage company work configuration and work types.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('general')}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition cursor-pointer ${
                activeTab === 'general'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Clock className="h-4 w-4" />
              General
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('work-types')}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition cursor-pointer ${
                activeTab === 'work-types'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Layers3 className="h-4 w-4" />
              Work Types
            </button>
          </div>
        </div>

        {activeTab === 'general' && <OrganizationSettings />}

        {activeTab === 'work-types' && <WorkTypes />}
      </div>
    </div>
  )
}
