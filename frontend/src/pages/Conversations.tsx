import React, { useEffect, useState } from 'react'
import { Search, Send, User, Hash, MessageSquare, AlertCircle, Plus, X, Check } from 'lucide-react'
import { useAuth } from '../features/auth/AuthContext'
import {
  getConversations,
  createConversation,
  getMessages,
  sendMessage,
  getConversationPeople,
  markConversationRead,
  type Conversation,
  type ConversationMessage,
} from '../features/work-activity/conversation.service'
import { supabase } from '../lib/supabase'
import type { UserProfile } from '../features/auth/auth.types'
import { playNotificationSound } from '../features/notifications/notification.sound'

export default function Conversations() {
  const { accessToken, profile } = useAuth()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConv, setActiveConv] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [employees, setEmployees] = useState<UserProfile[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // New Conversation Modal State
  const [modalOpen, setModalOpen] = useState(false)
  const [convType, setConvType] = useState<'DIRECT' | 'TEAM'>('DIRECT')
  const [teamName, setTeamName] = useState('')
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  const [inputText, setInputText] = useState('')

  async function loadData() {
    if (!accessToken) return
    setLoading(true)
    setError('')
    try {
      const [convList, peopleList] = await Promise.all([
        getConversations(accessToken).catch(() => []),
        getConversationPeople(accessToken).catch(() => []),
      ])

      setConversations(convList)
      setEmployees(peopleList)

      if (convList.length > 0 && !activeConv) {
        setActiveConv(convList[0])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load conversations.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [accessToken])

  // Load messages when active conversation changes
  useEffect(() => {
    if (!accessToken || !activeConv) return

    async function loadConvMessages() {
      try {
        const msgs = await getMessages(accessToken!, activeConv!.id)
        setMessages(msgs)
        void markConversationRead(accessToken!, activeConv!.id)
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConv!.id
              ? {
                  ...c,
                  members: c.members?.map((m) =>
                    m.user_id === profile?.id
                      ? { ...m, last_read_at: new Date().toISOString() }
                      : m,
                  ),
                }
              : c,
          ),
        )
      } catch {
        setMessages([])
      }
    }

    loadConvMessages()

    // Step 11: Realtime subscription for conversation messages
    const channel = supabase
      .channel(`room:${activeConv.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_messages',
          filter: `conversation_id=eq.${activeConv.id}`,
        },
        async (payload) => {
          const newMsg = payload.new as ConversationMessage
          if (newMsg.sender_id !== profile?.id) {
            playNotificationSound()
            void markConversationRead(accessToken!, activeConv!.id)
          }
          // Fetch sender details or find from employees
          const senderObj = employees.find((e) => e.id === newMsg.sender_id) || (newMsg.sender_id === profile?.id ? profile : undefined)
          setMessages((prev) => [...prev, { ...newMsg, sender: senderObj as UserProfile }])
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [accessToken, activeConv?.id, employees, profile])

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!accessToken || !activeConv || !inputText.trim()) return

    const textToSend = inputText.trim()
    setInputText('')

    try {
      const sent = await sendMessage(accessToken, activeConv.id, textToSend)
      // Check if message is already in list (from realtime subscription)
      setMessages((prev) => {
        if (prev.some((m) => m.id === sent.id)) return prev
        return [...prev, sent]
      })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to send message.')
    }
  }

  async function handleCreateConversation(e: React.FormEvent) {
    e.preventDefault()
    if (!accessToken || selectedMemberIds.length === 0) return
    setSubmitting(true)

    try {
      const created = await createConversation(accessToken, {
        type: convType,
        name: convType === 'TEAM' ? teamName.trim() || 'Team Conversation' : null,
        memberIds: selectedMemberIds,
      })

      setModalOpen(false)
      setTeamName('')
      setSelectedMemberIds([])
      await loadData()
      setActiveConv(created)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create conversation.')
    } finally {
      setSubmitting(false)
    }
  }

  function toggleMemberSelect(empId: string) {
    if (convType === 'DIRECT') {
      setSelectedMemberIds([empId])
    } else {
      setSelectedMemberIds((prev) =>
        prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId],
      )
    }
  }

  const filteredConversations = conversations.filter((c) => {
    const displayName = c.type === 'TEAM'
      ? c.name
      : c.members?.find((m) => m.user_id !== profile?.id)?.user?.first_name || 'Direct Chat'
    return displayName?.toLowerCase().includes(search.trim().toLowerCase())
  })

  function getConversationTitle(conv: Conversation) {
    if (conv.type === 'TEAM') return conv.name || 'Team Conversation'
    const other = conv.members?.find((m) => m.user_id !== profile?.id)?.user
    return other ? `${other.first_name} ${other.last_name || ''}` : 'Direct Conversation'
  }

  return (
    <div className="h-[calc(100vh-6.5rem)] flex flex-col w-full min-w-0 space-y-4">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Conversations</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Realtime direct messaging and team collaboration.
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 bg-[#801424] hover:bg-[#9f1239] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
        >
          <Plus size={16} />
          <span>New Conversation</span>
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-3 text-xs shrink-0">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="flex-1 flex w-full bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden min-h-0">
        {/* Left Conversations List */}
        <div className="w-72 sm:w-80 md:w-96 border-r border-slate-200/80 flex flex-col bg-slate-50/50 shrink-0 min-h-0">
          <div className="p-3.5 border-b border-slate-200/80 bg-white shrink-0">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search chats..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs outline-none focus:border-zinc-800 bg-slate-50"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 min-h-0">
            {loading ? (
              <div className="p-6 text-center text-xs text-slate-400">Loading conversations...</div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">No conversations yet.</div>
            ) : (
              filteredConversations.map((c) => {
                const isActive = activeConv?.id === c.id
                const title = getConversationTitle(c)
                const myMember = c.members?.find((m) => m.user_id === profile?.id)
                const isUnread = !isActive && Boolean(
                  c.updated_at && (!myMember?.last_read_at || new Date(c.updated_at).getTime() > new Date(myMember.last_read_at).getTime())
                )

                return (
                  <div
                    key={c.id}
                    onClick={() => setActiveConv(c)}
                    className={`p-3.5 transition cursor-pointer flex items-center justify-between gap-3 ${
                      isActive ? 'bg-white shadow-2xs border-l-4 border-l-slate-900' : 'hover:bg-slate-100/60'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                          c.type === 'TEAM' ? 'bg-slate-100 text-slate-800' : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {c.type === 'TEAM' ? <Hash size={17} /> : <User size={17} />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-xs text-slate-900 truncate">{title}</div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">
                          {c.type === 'TEAM' ? `${c.members?.length || 0} members` : 'Direct Message'}
                        </div>
                      </div>
                    </div>

                    {isUnread && (
                      <span className="min-w-5 h-5 px-1.5 rounded-full bg-[#801424] text-white text-[10px] font-bold flex items-center justify-center shrink-0 shadow-xs">
                        •
                      </span>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right Active Chat Feed */}
        <div className="flex-1 flex flex-col bg-white min-w-0 min-h-0">
          {activeConv ? (
            <>
              {/* Active Header */}
              <div className="p-4 border-b border-slate-200/80 flex items-center justify-between bg-white">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                      activeConv.type === 'TEAM' ? 'bg-slate-100 text-slate-800' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {activeConv.type === 'TEAM' ? <Hash size={18} /> : <User size={18} />}
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900 text-sm">{getConversationTitle(activeConv)}</h2>
                    <p className="text-[11px] text-slate-400">
                      {activeConv.type === 'TEAM'
                        ? `${activeConv.members?.length || 0} members`
                        : 'Direct message'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Message Feed */}
              <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-50/30">
                {messages.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 text-xs space-y-2">
                    <MessageSquare size={24} className="mx-auto text-slate-300" />
                    <p>Send a message to start the conversation.</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isSelf = msg.sender_id === profile?.id
                    const senderName = isSelf
                      ? 'You'
                      : msg.sender
                      ? `${msg.sender.first_name} ${msg.sender.last_name || ''}`
                      : 'Team Member'

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}
                      >
                        <div className="flex items-center gap-2 mb-1 text-[11px] text-slate-400">
                          <span className="font-semibold text-slate-700">{senderName}</span>
                          <span>• {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>

                        <div
                          className={`max-w-md px-4 py-2.5 rounded-2xl text-xs leading-relaxed ${
                            isSelf
                              ? 'bg-[#801424] text-white rounded-tr-none shadow-xs'
                              : 'bg-white border border-slate-200/80 text-slate-900 font-medium rounded-tl-none shadow-2xs'
                          }`}
                        >
                          {msg.message}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Message Composer */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-200/80 bg-white flex gap-3">
                <input
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-xs outline-none focus:border-[#801424] bg-slate-50 focus:bg-white transition text-slate-900 font-semibold"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#801424] hover:bg-[#9f1239] text-white font-bold text-xs rounded-xl transition disabled:opacity-50 shadow-xs cursor-pointer"
                >
                  <Send size={15} />
                  Send
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-12 text-center text-slate-400 text-xs">
              Select or create a conversation to start chatting.
            </div>
          )}
        </div>
      </div>

      {/* New Conversation Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 relative">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X size={20} />
            </button>

            <h2 className="text-xl font-bold text-slate-900 mb-1">New Conversation</h2>
            <p className="text-xs text-slate-500 mb-4">Start a 1-to-1 direct chat or create a team group.</p>

            <div className="flex gap-2 mb-4 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setConvType('DIRECT')
                  setSelectedMemberIds([])
                }}
                className={`flex-1 py-2 rounded-lg transition ${
                  convType === 'DIRECT' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                Direct (1-to-1)
              </button>
              <button
                type="button"
                onClick={() => {
                  setConvType('TEAM')
                  setSelectedMemberIds([])
                }}
                className={`flex-1 py-2 rounded-lg transition ${
                  convType === 'TEAM' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                Team Channel
              </button>
            </div>

            <form onSubmit={handleCreateConversation} className="space-y-4 text-xs">
              {convType === 'TEAM' && (
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Team Channel Name *</label>
                  <input
                    required
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="e.g. Frontend Engineers"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-zinc-800"
                  />
                </div>
              )}

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  {convType === 'DIRECT' ? 'Select Member' : 'Select Team Members'}
                </label>
                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                  {employees
                    .filter((e) => e.id !== profile?.id)
                    .map((emp) => {
                      const isSelected = selectedMemberIds.includes(emp.id)

                      return (
                        <div
                          key={emp.id}
                          onClick={() => toggleMemberSelect(emp.id)}
                          className={`p-2.5 flex items-center justify-between cursor-pointer transition ${
                            isSelected ? 'bg-slate-100 font-semibold' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div>
                            <div className="font-semibold text-slate-900">
                              {emp.first_name} {emp.last_name || ''}
                            </div>
                            <div className="text-[10px] text-slate-400">{emp.designation || emp.role}</div>
                          </div>

                          {isSelected && <Check size={16} className="text-slate-900" />}
                        </div>
                      )
                    })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || selectedMemberIds.length === 0}
                  className="px-5 py-2 bg-[#801424] hover:bg-[#9f1239] text-white font-bold rounded-xl disabled:opacity-50 cursor-pointer"
                >
                  Start Conversation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
