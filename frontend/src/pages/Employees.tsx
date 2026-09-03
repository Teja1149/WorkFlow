import React, { useEffect, useMemo, useState } from 'react'
import { Plus, Search, UserCheck, AlertCircle, X, Trash2 } from 'lucide-react'
import { useAuth } from '../features/auth/AuthContext'
import { getEmployees, createEmployee, updateEmployee, deleteEmployee } from '../features/employees/employee.service'
import type { UserProfile } from '../features/auth/auth.types'

interface FormData {
  first_name: string
  last_name: string
  employee_id: string
  email: string
  password: string
  phone: string
  designation: string
  role: 'MANAGER' | 'EMPLOYEE'
  manager_id: string
  joining_date: string
}

const emptyForm: FormData = {
  first_name: '',
  last_name: '',
  employee_id: '',
  email: '',
  password: '',
  phone: '',
  designation: '',
  role: 'EMPLOYEE',
  manager_id: '',
  joining_date: '',
}

export default function Employees() {
  const { accessToken, profile: currentUser } = useAuth()

  const [employees, setEmployees] = useState<UserProfile[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Edit modal state
  const [editingEmployee, setEditingEmployee] = useState<UserProfile | null>(null)
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    designation: '',
    manager_id: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE' | 'SUSPENDED',
  })
  const [updating, setUpdating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function loadEmployees() {
    if (!accessToken) return
    try {
      setLoading(true)
      const data = await getEmployees(accessToken)
      setEmployees(data)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load employees.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEmployees()
  }, [accessToken])

  const managers = useMemo(() => {
    return employees.filter((e) => e.role === 'MANAGER' || e.role === 'SUPER_ADMIN')
  }, [employees])

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return employees

    return employees.filter(
      (emp) =>
        `${emp.first_name} ${emp.last_name || ''}`.toLowerCase().includes(q) ||
        emp.email?.toLowerCase().includes(q) ||
        emp.employee_id?.toLowerCase().includes(q) ||
        emp.designation?.toLowerCase().includes(q),
    )
  }, [employees, search])

  const canManageAccounts =
    currentUser?.role === 'SUPER_ADMIN' ||
    currentUser?.role === 'ADMIN' ||
    currentUser?.role === 'MANAGER'

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!accessToken) return
    setSaving(true)
    setError('')

    try {
      await createEmployee(accessToken, {
        ...form,
        employee_id: form.employee_id.trim() || undefined,
        role: currentUser?.role === 'MANAGER' ? 'EMPLOYEE' : form.role,
        manager_id: form.manager_id || (currentUser?.role === 'MANAGER' ? currentUser.id : null),
        joining_date: form.joining_date || undefined,
      })

      setModalOpen(false)
      setForm(emptyForm)
      await loadEmployees()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create employee.')
    } finally {
      setSaving(false)
    }
  }

  function handleOpenEdit(emp: UserProfile) {
    setEditingEmployee(emp)
    setEditForm({
      first_name: emp.first_name || '',
      last_name: emp.last_name || '',
      phone: emp.phone || '',
      designation: emp.designation || '',
      manager_id: emp.manager_id || '',
      status: emp.status || 'ACTIVE',
    })
  }

  async function handleUpdateSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!accessToken || !editingEmployee) return
    setUpdating(true)
    setError('')

    try {
      await updateEmployee(accessToken, editingEmployee.id, {
        first_name: editForm.first_name,
        last_name: editForm.last_name || undefined,
        phone: editForm.phone || undefined,
        designation: editForm.designation || undefined,
        manager_id: editForm.manager_id || null,
        status: editForm.status,
      })
      setEditingEmployee(null)
      await loadEmployees()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update employee.')
    } finally {
      setUpdating(false)
    }
  }

  async function handleDelete(emp: UserProfile) {
    if (!accessToken) return
    const empName = `${emp.first_name} ${emp.last_name || ''}`.trim()
    const isConfirmed = window.confirm(
      `Are you sure you want to delete ${empName} (${emp.role})? This action cannot be undone.`,
    )
    if (!isConfirmed) return

    setDeletingId(emp.id)
    setError('')

    try {
      await deleteEmployee(accessToken, emp.id)
      await loadEmployees()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete employee account.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-sm text-slate-500">Workspace</p>
          <h1 className="text-3xl font-bold mt-1">Employees</h1>
          <p className="text-slate-500 mt-2">
            Manage team members and managers across your workspace.
          </p>
        </div>

        {canManageAccounts && (
          <button
            onClick={() => {
              setForm({
                ...emptyForm,
                role: 'EMPLOYEE',
                manager_id: currentUser?.role === 'MANAGER' ? currentUser.id : '',
              })
              setModalOpen(true)
            }}
            className="flex items-center gap-2 bg-[#801424] hover:bg-[#9f1239] text-white px-4 py-2.5 rounded-xl font-bold shadow-xs transition cursor-pointer"
          >
            <Plus size={18} />
            {currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'ADMIN' ? 'Add Employee / Manager' : 'Add Employee'}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-3">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <div className="relative max-w-md">
            <Search
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employees..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-zinc-800 focus:ring-1 focus:ring-zinc-800 text-sm font-medium text-slate-900"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading employees...</div>
        ) : filteredEmployees.length === 0 ? (
          <div className="p-12 text-center text-slate-400">No employees found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-700 font-bold">
                  <th className="py-3.5 px-6">Employee</th>
                  <th className="py-3.5 px-6">ID</th>
                  <th className="py-3.5 px-6">Role</th>
                  <th className="py-3.5 px-6">Designation</th>
                  <th className="py-3.5 px-6">Status</th>
                  {canManageAccounts && (
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map((emp) => {
                  // Determine if current user can delete this specific account
                  const canDeleteThis =
                    emp.id !== currentUser?.id &&
                    emp.role !== 'SUPER_ADMIN' &&
                    (currentUser?.role === 'SUPER_ADMIN' ||
                      currentUser?.role === 'ADMIN' ||
                      (currentUser?.role === 'MANAGER' && emp.role === 'EMPLOYEE'))

                  // Determine if current user can edit this specific account
                  const canEditThis =
                    currentUser?.role === 'SUPER_ADMIN' ||
                    currentUser?.role === 'ADMIN' ||
                    (currentUser?.role === 'MANAGER' && emp.role === 'EMPLOYEE')

                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#801424] text-white flex items-center justify-center font-bold text-sm shadow-2xs">
                            {emp.first_name?.[0] || 'E'}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">
                              {emp.first_name} {emp.last_name || ''}
                            </div>
                            <div className="text-xs text-slate-500 font-medium">{emp.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-slate-700 font-mono text-xs font-semibold">
                        {emp.employee_id || '-'}
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${
                            emp.role === 'SUPER_ADMIN'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : emp.role === 'MANAGER'
                              ? 'bg-slate-100 text-slate-900 border border-slate-300'
                              : 'bg-slate-100 text-slate-800 border border-slate-200'
                          }`}
                        >
                          {emp.role}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-slate-800 font-medium">
                        {emp.designation || (emp.role === 'SUPER_ADMIN' ? 'System Administrator' : '-')}
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
                            emp.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          <UserCheck size={14} />
                          {emp.status}
                        </span>
                      </td>
                      {canManageAccounts && (
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {canEditThis && (
                              <button
                                onClick={() => handleOpenEdit(emp)}
                                className="text-xs font-bold text-slate-800 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition cursor-pointer"
                              >
                                Edit
                              </button>
                            )}
                            {canDeleteThis && (
                              <button
                                onClick={() => handleDelete(emp)}
                                disabled={deletingId === emp.id}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition disabled:opacity-30 cursor-pointer"
                                title="Delete account"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Employee Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 relative">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X size={20} />
            </button>

            <h2 className="text-xl font-bold text-slate-900 mb-1">Add New Employee</h2>
            <p className="text-xs text-slate-500 mb-5">Create an account for a new employee or manager.</p>

            <form onSubmit={handleAddSubmit} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">First Name *</label>
                  <input
                    required
                    value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-zinc-800"
                    placeholder="John"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Last Name</label>
                  <input
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-zinc-800"
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Employee ID Number</label>
                <input
                  value={form.employee_id}
                  onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-zinc-800 font-mono text-slate-800"
                  placeholder="e.g. EMP-101 (Leave blank for auto-generated ID)"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-zinc-800"
                  placeholder="john@company.com"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Password *</label>
                <input
                  type="password"
                  required
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-zinc-800"
                  placeholder="Minimum 6 characters"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Role *</label>
                  {currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'ADMIN' ? (
                    <select
                      value={form.role}
                      onChange={(e) =>
                        setForm({ ...form, role: e.target.value as 'MANAGER' | 'EMPLOYEE' })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-zinc-800 bg-white font-semibold text-slate-900"
                    >
                      <option value="EMPLOYEE">EMPLOYEE</option>
                      <option value="MANAGER">MANAGER</option>
                    </select>
                  ) : (
                    <select
                      disabled
                      value="EMPLOYEE"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-100 font-semibold text-slate-700 cursor-not-allowed"
                    >
                      <option value="EMPLOYEE">EMPLOYEE</option>
                    </select>
                  )}
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Designation</label>
                  <input
                    value={form.designation}
                    onChange={(e) => setForm({ ...form, designation: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-zinc-800"
                    placeholder="Software Engineer"
                  />
                </div>
              </div>

              {form.role === 'EMPLOYEE' && managers.length > 0 && (
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Assign Manager</label>
                  <select
                    value={form.manager_id}
                    onChange={(e) => setForm({ ...form, manager_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-zinc-800 bg-white"
                  >
                    <option value="">No Manager Assigned</option>
                    {managers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.first_name} {m.last_name || ''} ({m.designation || m.role})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl transition font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-[#801424] hover:bg-[#9f1239] text-white font-bold rounded-xl transition disabled:opacity-60 cursor-pointer"
                >
                  {saving ? 'Creating...' : 'Create Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {editingEmployee && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 relative">
            <button
              onClick={() => setEditingEmployee(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X size={20} />
            </button>

            <h2 className="text-xl font-bold text-slate-900 mb-1">Edit Employee</h2>
            <p className="text-xs text-slate-500 mb-5">
              Update details for {editingEmployee.first_name} {editingEmployee.last_name || ''}
            </p>

            <form onSubmit={handleUpdateSubmit} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">First Name *</label>
                  <input
                    required
                    value={editForm.first_name}
                    onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-zinc-800"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Last Name</label>
                  <input
                    value={editForm.last_name}
                    onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-zinc-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Designation</label>
                <input
                  value={editForm.designation}
                  onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-zinc-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        status: e.target.value as 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE' | 'SUSPENDED',
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-zinc-800 bg-white"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="ON_LEAVE">ON LEAVE</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                  </select>
                </div>
                {editingEmployee.role === 'EMPLOYEE' && (
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Manager</label>
                    <select
                      value={editForm.manager_id}
                      onChange={(e) => setEditForm({ ...editForm, manager_id: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-zinc-800 bg-white"
                    >
                      <option value="">No Manager</option>
                      {managers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.first_name} {m.last_name || ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingEmployee(null)}
                  className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl transition font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="px-5 py-2.5 bg-[#801424] hover:bg-[#9f1239] text-white font-bold rounded-xl transition disabled:opacity-60 cursor-pointer"
                >
                  {updating ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
