import { useState, useCallback } from 'react'
import { manifestJsonToDefinition, manifestDefinitionToJson, MENU_CATEGORIES, type ManifestDefinition, type ManifestParam } from '../utils/manifestSchema'
import HwSelect from './hw/HwSelect'
import HwInput from './hw/HwInput'
import HwRocker from './hw/HwRocker'
import './manifest-editor.css'

const PARAM_TYPES: { value: ManifestParam['type']; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'text-list', label: 'Text List' },
]

const ICONS = [
  'file', 'image', 'video', 'music', 'microphone', 'users',
  'camera', 'palette', 'film', 'paintbrush', 'wand-magic-sparkles',
  'shapes', 'layer-group', 'cube', 'bolt', 'star',
  'gem', 'globe', 'masks-theater', 'shirt',
]

interface ManifestEditorProps {
  value: string
  onChange: (value: string) => void
}

export default function ManifestEditor({ value, onChange }: ManifestEditorProps): React.JSX.Element {
  const [def, setDef] = useState<ManifestDefinition>(() => {
    try { return manifestJsonToDefinition(value) }
    catch { return { id: '', name: '', menu: ['Custom'], icon: 'file', description: '', params: [] } }
  })
  const [iconPickerOpen, setIconPickerOpen] = useState(false)

  const emit = useCallback((updated: ManifestDefinition) => {
    setDef(updated)
    onChange(manifestDefinitionToJson(updated))
  }, [onChange])

  function updateParam(index: number, patch: Partial<ManifestParam>): void {
    const params = def.params.map((p, i) => i === index ? { ...p, ...patch } : p)
    emit({ ...def, params })
  }

  function addParam(): void {
    const key = `param${def.params.length + 1}`
    emit({ ...def, params: [...def.params, { key, type: 'text', required: false, description: '' }] })
  }

  function removeParam(index: number): void {
    emit({ ...def, params: def.params.filter((_, i) => i !== index) })
  }

  return (
    <div className="mfe">
      {/* Metadata */}
      <div className="mfe__section">
        <div className="mfe__row">
          <label className="mfe__label">ID</label>
          <HwInput
            value={def.id}
            onChange={(val) => emit({ ...def, id: val.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
            placeholder="e.g. image-gen"
          />
        </div>

        <div className="mfe__row">
          <label className="mfe__label">Name</label>
          <HwInput
            value={def.name}
            onChange={(val) => emit({ ...def, name: val })}
            placeholder="e.g. Image Generation"
          />
        </div>

        <div className="mfe__row">
          <label className="mfe__label">Category</label>
          <HwSelect
            value={def.menu[0] || 'Custom'}
            options={MENU_CATEGORIES.map((cat) => ({ value: cat, label: cat }))}
            onChange={(val) => emit({ ...def, menu: [val] })}
          />
        </div>

        <div className="mfe__row">
          <label className="mfe__label">Icon</label>
          <div className="ate__icon-picker">
            <button className="ate__icon-btn" onClick={() => setIconPickerOpen(!iconPickerOpen)}>
              <i className={`fa-solid fa-${def.icon}`} />
            </button>
            {iconPickerOpen && (
              <>
                <div className="ate__icon-backdrop" onClick={() => setIconPickerOpen(false)} />
                <div className="ate__icon-grid">
                  {ICONS.map((icon) => (
                    <button
                      key={icon}
                      className={`ate__icon-option ${icon === def.icon ? 'ate__icon-option--active' : ''}`}
                      onClick={() => { emit({ ...def, icon }); setIconPickerOpen(false) }}
                    >
                      <i className={`fa-solid fa-${icon}`} />
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mfe__row">
          <label className="mfe__label">Description</label>
          <HwInput
            value={def.description}
            onChange={(val) => emit({ ...def, description: val })}
            placeholder="What does this app do?"
          />
        </div>
      </div>

      {/* Parameters */}
      <div className="mfe__section">
        <div className="ate__section-header">
          <span className="ate__section-title">Parameters</span>
          <button className="ate__add-btn" onClick={addParam}>+ Add</button>
        </div>

        {def.params.length === 0 && (
          <div className="ate__empty">No parameters yet</div>
        )}

        {def.params.map((param, pi) => (
          <div key={pi} className="ate__field">
            <HwInput
              value={param.key}
              onChange={(val) => updateParam(pi, { key: val })}
              placeholder="paramName"
              className="ate__field-name"
            />
            <HwSelect
              value={param.type}
              options={PARAM_TYPES}
              onChange={(val) => updateParam(pi, { type: val as ManifestParam['type'] })}
            />
            <label className="ate__required">
              <HwRocker checked={param.required} onChange={(val) => updateParam(pi, { required: val })} />
              <span className="ate__required-label">Required</span>
            </label>
            <button className="ate__remove-btn" onClick={() => removeParam(pi)} title="Remove" />
          </div>
        ))}
      </div>
    </div>
  )
}
