import { useState, useCallback } from 'react'
import { schemaJsonToAssetType, assetTypeToSchemaJson, type AssetTypeDefinition, type AssetTypeField } from '../utils/assetTypeSchema'
import HwSelect from './hw/HwSelect'
import HwInput from './hw/HwInput'
import HwRocker from './hw/HwRocker'
import './asset-type-editor.css'

const FIELD_TYPES: { value: AssetTypeField['type']; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'text-list', label: 'Text List' },
  { value: 'file-reference', label: 'File Reference' },
  { value: 'key-value', label: 'Key-Value' },
]

const ICONS = [
  'fa-solid fa-file', 'fa-solid fa-user', 'fa-solid fa-image', 'fa-solid fa-video',
  'fa-solid fa-music', 'fa-solid fa-camera', 'fa-solid fa-palette', 'fa-solid fa-film',
  'fa-solid fa-book', 'fa-solid fa-map', 'fa-solid fa-star', 'fa-solid fa-heart',
  'fa-solid fa-bolt', 'fa-solid fa-gem', 'fa-solid fa-cube', 'fa-solid fa-globe',
  'fa-solid fa-microphone', 'fa-solid fa-paintbrush', 'fa-solid fa-wand-magic-sparkles',
  'fa-solid fa-shapes', 'fa-solid fa-layer-group', 'fa-solid fa-masks-theater',
  'fa-solid fa-shirt', 'fa-solid fa-location-dot',
]

interface AssetTypeEditorProps {
  value: string
  onChange: (value: string) => void
}

export default function AssetTypeEditor({ value, onChange }: AssetTypeEditorProps): React.JSX.Element {
  const [def, setDef] = useState<AssetTypeDefinition>(() => {
    try { return schemaJsonToAssetType(value) }
    catch { return { id: '', name: '', extension: '', icon: 'fa-solid fa-file', thumbnail: null, fields: [] } }
  })
  const [iconPickerOpen, setIconPickerOpen] = useState(false)
  const [dragIdx, setDragIdx] = useState<number | null>(null)

  const emit = useCallback((updated: AssetTypeDefinition) => {
    setDef(updated)
    onChange(assetTypeToSchemaJson(updated))
  }, [onChange])

  function updateField(index: number, patch: Partial<AssetTypeField>): void {
    const fields = def.fields.map((f, i) => i === index ? { ...f, ...patch } : f)
    emit({ ...def, fields })
  }

  function addField(): void {
    const key = `field${def.fields.length + 1}`
    emit({ ...def, fields: [...def.fields, { key, type: 'text', required: false }] })
  }

  function removeField(index: number): void {
    emit({ ...def, fields: def.fields.filter((_, i) => i !== index) })
  }

  function handleDrop(targetIdx: number): void {
    if (dragIdx === null || dragIdx === targetIdx) return
    const fields = [...def.fields]
    const [moved] = fields.splice(dragIdx, 1)
    fields.splice(targetIdx, 0, moved)
    emit({ ...def, fields })
    setDragIdx(null)
  }

  const thumbnailOptions = def.fields
    .filter((f) => f.type === 'text' || f.type === 'file-reference')
    .map((f) => f.key)

  return (
    <div className="ate">
      {/* Metadata */}
      <div className="ate__section">
        <div className="ate__row">
          <label className="ate__label">ID</label>
          <HwInput
            value={def.id}
            onChange={(val) => emit({ ...def, id: val.toLowerCase().replace(/[^a-z0-9_.]/g, '') })}
            placeholder="e.g. scene"
            className="ate__id-input"
          />
        </div>

        <div className="ate__row">
          <label className="ate__label">Name</label>
          <HwInput
            value={def.name}
            onChange={(val) => emit({ ...def, name: val })}
            placeholder="e.g. Character Sheet"
          />
        </div>

        <div className="ate__row">
          <label className="ate__label">Extension</label>
          <HwInput
            value={def.extension}
            onChange={(val) => {
              const cleaned = val.startsWith('.') ? val : `.${val}`
              const valid = '.' + cleaned.slice(1).replace(/[^a-z0-9]/g, '')
              emit({ ...def, extension: valid })
            }}
            placeholder=".char"
            className="ate__ext-input"
          />
        </div>

        <div className="ate__row">
          <label className="ate__label">Icon</label>
          <div className="ate__icon-picker">
            <button className="ate__icon-btn" onClick={() => setIconPickerOpen(!iconPickerOpen)}>
              <i className={def.icon} />
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
                      <i className={icon} />
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="ate__row">
          <label className="ate__label">Thumbnail</label>
          <HwSelect
            value={def.thumbnail || ''}
            options={[{ value: '', label: 'None' }, ...thumbnailOptions.map((key) => ({ value: key, label: key }))]}
            onChange={(val) => emit({ ...def, thumbnail: val || null })}
          />
        </div>
      </div>

      {/* Fields */}
      <div className="ate__section">
        <div className="ate__section-header">
          <span className="ate__section-title">Fields</span>
          <button className="ate__add-btn" onClick={addField}>+ Add Field</button>
        </div>

        {def.fields.length === 0 && (
          <div className="ate__empty">No fields yet</div>
        )}

        {def.fields.map((field, i) => (
          <div
            key={i}
            className={`ate__field ${dragIdx === i ? 'ate__field--dragging' : ''}`}
            draggable
            onDragStart={() => setDragIdx(i)}
            onDragEnd={() => setDragIdx(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(i)}
          >
            <span className="ate__field-handle">&#x2807;</span>
            <HwInput
              value={field.key}
              onChange={(val) => updateField(i, { key: val })}
              placeholder="fieldName"
              className="ate__field-name"
            />
            <HwSelect
              value={field.type}
              options={FIELD_TYPES}
              onChange={(val) => updateField(i, { type: val as AssetTypeField['type'] })}
            />
            <label className="ate__required">
              <HwRocker checked={field.required} onChange={(val) => updateField(i, { required: val })} />
              <span className="ate__required-label">Required</span>
            </label>
            <button className="ate__remove-btn" onClick={() => removeField(i)} title="Remove" />
          </div>
        ))}
      </div>
    </div>
  )
}
