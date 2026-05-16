import { useState, useRef, useEffect } from 'react'
import Markdown from 'react-markdown'
import { useAppSelector, useAppDispatch } from '../store'
import { toggleChat, bumpFileRefresh } from '../store/uiSlice'
import TitleBar from './ui/TitleBar'
import './chat-panel.css'

interface ChatMessage {
  role: string
  content: string
  toolCalls?: { name: string; args: any; result?: string }[]
}

export default function ChatPanel(): React.JSX.Element {
  const dispatch = useAppDispatch()
  const { currentProject } = useAppSelector((s) => s.ui)
  const projectId = currentProject?.id || ''
  const projectName = currentProject?.name || ''

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Load saved conversation on mount / project change
  useEffect(() => {
    if (!projectId) return
    setLoaded(false)
    window.avatica.chat.getMessages(projectId).then((saved) => {
      setMessages(saved as ChatMessage[])
      setLoaded(true)
    })
  }, [projectId])

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Focus input on mount (desktop only, always wide enough)
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  async function handleSubmit(): Promise<void> {
    const text = input.trim()
    if (!text || streaming || !projectId) return

    const userMessage: ChatMessage = { role: 'user', content: text }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setStreaming(true)

    let assistantContent = ''
    let toolCalls: ChatMessage['toolCalls'] = []
    let needsNewMessage = true

    const updateCurrentMessage = (): void => {
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: assistantContent, toolCalls }
        return updated
      })
    }

    const startNewMessage = (): void => {
      assistantContent = ''
      toolCalls = []
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }])
      needsNewMessage = false
    }

    startNewMessage()

    // Listen for streaming events from main process
    const unsubscribe = window.avatica.chat.onEvent((event) => {
      if (event.type === 'text') {
        if (needsNewMessage) startNewMessage()
        assistantContent += event.content
        updateCurrentMessage()
      } else if (event.type === 'tool_call') {
        toolCalls = [...(toolCalls || []), { name: event.name ?? '', args: event.args ?? {} }]
        updateCurrentMessage()
      } else if (event.type === 'tool_result') {
        if (toolCalls && toolCalls.length > 0) {
          toolCalls = toolCalls.map((tc, i) =>
            i === toolCalls!.length - 1 ? { ...tc, result: event.result } : tc
          )
          updateCurrentMessage()
        }
        needsNewMessage = true
      } else if (event.type === 'files_generated') {
        dispatch(bumpFileRefresh())
      } else if (event.type === 'done') {
        // Clean up empty trailing message
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          return last?.role === 'assistant' && !last.content && !last.toolCalls?.length
            ? prev.slice(0, -1)
            : prev
        })
        setStreaming(false)
        unsubscribe()
      } else if (event.type === 'error') {
        setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${event.message}` }])
        setStreaming(false)
        unsubscribe()
      }
    })

    // Send message via IPC — streaming events come back through onEvent
    window.avatica.chat.send(projectId, projectName, text).catch(() => {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Error: Chat failed' }])
      setStreaming(false)
      unsubscribe()
    })
  }

  function handleClear(): void {
    setMessages([])
    window.avatica.chat.clear(projectId)
  }

  return (
    <div className="chat-panel hw-panel">
      <TitleBar title="Assistant" onClose={() => dispatch(toggleChat())}>
        <button
          className="chat-panel__clear"
          onClick={handleClear}
          title="Clear conversation"
          disabled={messages.length === 0 || streaming}
        >
          <i className="fa-solid fa-trash" />
        </button>
      </TitleBar>

      {/* Messages */}
      <div ref={scrollRef} className="chat-panel__messages">
        {loaded && messages.length === 0 && (
          <div className="chat-panel__empty">
            Ask me anything about your project
          </div>
        )}
        {messages.map((msg, i) => {
          if (!msg.content && !msg.toolCalls?.length) return null
          return (
            <div key={i} className={`chat-panel__message chat-panel__message--${msg.role}`}>
              <div className="chat-panel__message-content">
                {msg.role === 'assistant' && msg.content ? <Markdown>{msg.content}</Markdown> : msg.content}
                {msg.toolCalls?.map((tc, j) => {
                  const displayName = tc.name.replace(/__/g, ' / ').replace(/-/g, ' ')
                  return (
                    <div key={j} className="chat-panel__tool-call">
                      <span className="chat-panel__tool-name">{displayName}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
        {streaming && (
          <div className="chat-panel__message chat-panel__message--assistant">
            <div className="chat-panel__message-content">
              <div className="chat-panel__typing-dots">
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="chat-panel__input-area">
        <div className="chat-panel__input-pit">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit()
              }
            }}
            placeholder="Message..."
            className="chat-panel__input"
            rows={1}
            disabled={streaming}
          />
        </div>
      </div>
    </div>
  )
}
