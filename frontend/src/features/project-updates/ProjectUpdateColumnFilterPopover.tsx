import React, { useState, useEffect } from 'react'
import { Filter, X, Check } from 'lucide-react'
import type { UpdateFieldType } from './project-update.types'

export type FilterOperator =
  | 'contains'
  | 'equals'
  | 'starts_with'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'before'
  | 'after'
  | 'is_true'
  | 'is_false'

export interface ColumnFilterRule {
  columnId: string
  columnName: string
  fieldType: UpdateFieldType | 'BUILTIN_DATE' | 'BUILTIN_TEXT' | 'BUILTIN_NUMBER'
  operator: FilterOperator
  value: string
  value2?: string
}

interface Props {
  columnId: string
  columnName: string
  fieldType: UpdateFieldType | 'BUILTIN_DATE' | 'BUILTIN_TEXT' | 'BUILTIN_NUMBER'
  activeFilter?: ColumnFilterRule
  availableValues?: string[]
  onApply: (rule: ColumnFilterRule) => void
  onClear: (columnId: string) => void
  onClose: () => void
}

export default function ProjectUpdateColumnFilterPopover({
  columnId,
  columnName,
  fieldType,
  activeFilter,
  availableValues,
  onApply,
  onClear,
  onClose,
}: Props) {
  // Determine default operator based on fieldType
  const defaultOperator: FilterOperator =
    fieldType === 'NUMBER' || fieldType === 'BUILTIN_NUMBER'
      ? activeFilter?.operator || 'gt'
      : fieldType === 'DATE' || fieldType === 'BUILTIN_DATE'
        ? activeFilter?.operator || 'between'
        : fieldType === 'BOOLEAN'
          ? activeFilter?.operator || 'is_true'
          : activeFilter?.operator || 'contains'

  const [operator, setOperator] = useState<FilterOperator>(defaultOperator)
  const [val1, setVal1] = useState<string>(activeFilter?.value || '')
  const [val2, setVal2] = useState<string>(activeFilter?.value2 || '')

  const isNumberType = fieldType === 'NUMBER' || fieldType === 'BUILTIN_NUMBER'
  const isDateType = fieldType === 'DATE' || fieldType === 'BUILTIN_DATE'
  const isBooleanType = fieldType === 'BOOLEAN'
  const isTextType = !isNumberType && !isDateType && !isBooleanType

  // Close on Escape key press
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  function handleApply(e: React.FormEvent) {
    e.preventDefault()
    if (isBooleanType) {
      onApply({
        columnId,
        columnName,
        fieldType,
        operator,
        value: operator === 'is_true' ? 'true' : 'false',
      })
      onClose()
      return
    }

    if (!val1 && operator !== 'between') {
      onClear(columnId)
      onClose()
      return
    }

    onApply({
      columnId,
      columnName,
      fieldType,
      operator,
      value: val1,
      value2: operator === 'between' ? val2 : undefined,
    })
    onClose()
  }

  function handleClear() {
    onClear(columnId)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 text-xs space-y-4 text-slate-800 animate-in fade-in zoom-in-95 duration-150 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Popover Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
            <div className="w-7 h-7 rounded-lg bg-[#801424]/10 text-[#801424] flex items-center justify-center border border-[#801424]/20">
              <Filter size={14} />
            </div>
            <span>Filter: {columnName}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleApply} className="space-y-3.5">
          {/* Operator Select */}
          {!isBooleanType && (
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Condition
              </label>
              <select
                value={operator}
                onChange={(e) => setOperator(e.target.value as FilterOperator)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-zinc-800 font-semibold text-slate-900"
              >
                {isTextType && (
                  <>
                    <option value="contains">Contains</option>
                    <option value="equals">Equals</option>
                    <option value="starts_with">Starts with</option>
                  </>
                )}
                {isNumberType && (
                  <>
                    <option value="gt">Greater than (&gt;)</option>
                    <option value="gte">Greater or equal (&gt;=)</option>
                    <option value="lt">Less than (&lt;)</option>
                    <option value="lte">Less or equal (&lt;=)</option>
                    <option value="equals">Equals (=)</option>
                    <option value="between">Between</option>
                  </>
                )}
                {isDateType && (
                  <>
                    <option value="between">Between</option>
                    <option value="equals">Equals (=)</option>
                    <option value="before">Before (&lt;)</option>
                    <option value="after">After (&gt;)</option>
                  </>
                )}
              </select>
            </div>
          )}

          {/* Boolean Selection */}
          {isBooleanType && (
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Select State
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOperator('is_true')}
                  className={`flex-1 py-2.5 rounded-xl font-bold border transition ${
                    operator === 'is_true'
                      ? 'bg-[#801424] text-white border-[#801424] shadow-xs'
                      : 'bg-slate-50 text-slate-900 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  True
                </button>
                <button
                  type="button"
                  onClick={() => setOperator('is_false')}
                  className={`flex-1 py-2.5 rounded-xl font-bold border transition ${
                    operator === 'is_false'
                      ? 'bg-[#801424] text-white border-[#801424] shadow-xs'
                      : 'bg-slate-50 text-slate-900 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  False
                </button>
              </div>
            </div>
          )}

          {/* Dynamic Inputs based on type & operator */}
          {!isBooleanType && (
            <div>
              {fieldType === 'DROPDOWN' && availableValues && availableValues.length > 0 ? (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Value
                  </label>
                  <select
                    value={val1}
                    onChange={(e) => setVal1(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#801424] font-semibold text-slate-900"
                  >
                    <option value="">-- Select value --</option>
                    {availableValues.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              ) : operator === 'between' ? (
                <div className="space-y-2">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">
                      {isDateType ? 'From Date' : 'Min Value'}
                    </label>
                    <input
                      type={isDateType ? 'date' : 'number'}
                      value={val1}
                      onChange={(e) => setVal1(e.target.value)}
                      placeholder={isNumberType ? 'e.g. 10' : ''}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#801424] font-semibold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">
                      {isDateType ? 'To Date' : 'Max Value'}
                    </label>
                    <input
                      type={isDateType ? 'date' : 'number'}
                      value={val2}
                      onChange={(e) => setVal2(e.target.value)}
                      placeholder={isNumberType ? 'e.g. 500' : ''}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#801424] font-semibold text-slate-900"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Value
                  </label>
                  <input
                    type={isDateType ? 'date' : isNumberType ? 'number' : 'text'}
                    value={val1}
                    onChange={(e) => setVal1(e.target.value)}
                    placeholder={
                      isNumberType
                        ? 'Enter number e.g. 50'
                        : isTextType
                          ? 'Enter text...'
                          : ''
                    }
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#801424] font-semibold text-slate-900"
                  />
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            {activeFilter && (
              <button
                type="button"
                onClick={handleClear}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 font-bold rounded-xl transition cursor-pointer"
              >
                Clear
              </button>
            )}
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 bg-[#801424] hover:bg-[#9f1239] text-white font-bold rounded-xl transition shadow-xs cursor-pointer"
            >
              <Check size={14} />
              Apply
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
