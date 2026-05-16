import { useRef, useEffect } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, highlightActiveLine } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language'
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { json } from '@codemirror/lang-json'
import { html } from '@codemirror/lang-html'
import { javascript } from '@codemirror/lang-javascript'
import { oneDark } from '@codemirror/theme-one-dark'
import { useAppSelector } from '../store'
import './code-editor.css'

export type EditorLanguage = 'json' | 'html' | 'javascript'

interface CodeEditorProps {
  value: string
  language: EditorLanguage
  onChange?: (value: string) => void
  readOnly?: boolean
}

function getLanguageExtension(lang: EditorLanguage) {
  switch (lang) {
    case 'json': return json()
    case 'html': return html()
    case 'javascript': return javascript()
  }
}

export default function CodeEditor({ value, language, onChange, readOnly }: CodeEditorProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const valueRef = useRef(value)
  const theme = useAppSelector((s) => s.ui.theme)

  useEffect(() => { onChangeRef.current = onChange }, [onChange])
  useEffect(() => { valueRef.current = value }, [value])

  // Create/recreate editor when language, readOnly, or theme changes
  useEffect(() => {
    if (!containerRef.current) return

    viewRef.current?.destroy()

    const extensions = [
      highlightActiveLine(),
      history(),
      bracketMatching(),
      closeBrackets(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      ...(theme === 'dark' ? [oneDark] : []),
      getLanguageExtension(language),
      keymap.of([...defaultKeymap, ...historyKeymap, ...closeBracketsKeymap]),
      EditorView.theme({
        '&': {
          height: '100%',
          fontSize: '13px',
          fontFamily: 'var(--hw-font, "JetBrains Mono", monospace)',
          backgroundColor: 'var(--hw-panel-bg)',
        },
        '.cm-gutters': { backgroundColor: 'var(--hw-panel-bg)', border: 'none' },
        '.cm-scroller': { overflow: 'auto' },
        '.cm-content': { padding: '8px 0' },
      }),
    ]

    if (readOnly) {
      extensions.push(EditorState.readOnly.of(true))
    } else {
      extensions.push(
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current?.(update.state.doc.toString())
          }
        })
      )
    }

    const state = EditorState.create({ doc: valueRef.current, extensions })
    viewRef.current = new EditorView({ state, parent: containerRef.current })

    return () => { viewRef.current?.destroy() }
  }, [language, readOnly, theme])

  // Update content when value changes externally
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const currentContent = view.state.doc.toString()
    if (currentContent !== value) {
      view.dispatch({
        changes: { from: 0, to: currentContent.length, insert: value },
      })
    }
  }, [value])

  return <div ref={containerRef} className="code-editor" />
}
