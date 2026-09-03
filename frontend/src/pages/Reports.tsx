import { useState } from 'react'
import DailyResultsReport from './DailyResultsReport'
import EmployeePerformance from './EmployeePerformance'
import CompanyTargetAnalytics from './CompanyTargetAnalytics'

type ReportTab = 'overview' | 'daily' | 'employees' | 'projects'

export default function Reports() {
  const [activeTab, setActiveTab] = useState<ReportTab>('overview')

  const tabs: Array<{ id: ReportTab; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'daily', label: 'Daily' },
    { id: 'employees', label: 'Employees' },
    { id: 'projects', label: 'Projects' },
  ]

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Reports
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            View company execution, employee performance, and project results.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          <div className="flex flex-wrap gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'overview' && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Daily Results
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Review today's recorded work results.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('daily')}
                className="mt-4 text-sm font-bold text-[#801424] hover:underline cursor-pointer"
              >
                Open Daily →
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Employee Performance
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Review employee execution and performance.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('employees')}
                className="mt-4 text-sm font-bold text-[#801424] hover:underline cursor-pointer"
              >
                Open Employees →
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Project Analytics
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Review project execution and progress.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('projects')}
                className="mt-4 text-sm font-bold text-[#801424] hover:underline cursor-pointer"
              >
                Open Projects →
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Reports
              </p>
              <p className="mt-2 text-sm text-slate-600">
                All reporting tools are now available from one place.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'daily' && <DailyResultsReport />}

        {activeTab === 'employees' && <EmployeePerformance />}

        {activeTab === 'projects' && <CompanyTargetAnalytics />}
      </div>
    </div>
  )
}
