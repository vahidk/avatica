import { useEffect, useState } from 'react'
import { useAppSelector } from '../store'
import { fileIcon, isSchemaFile, getSchemaIconForFile, getSchemaThumbnailPathForFile } from '../helpers'

interface ThumbnailProps {
  name: string
  mimeType: string | null
  isDirectory: boolean
  /** Override the current browser path — useful when the file's location is known (e.g. output grid). */
  path?: string
}

export default function Thumbnail({ name, mimeType, isDirectory, path }: ThumbnailProps): React.JSX.Element {
  // schemaIcons subscription ensures re-render when schema icon map loads
  const { currentProject, currentPath, schemaIcons: _ } = useAppSelector((s) => s.ui)
  const filePath = path ?? currentPath
  const [src, setSrc] = useState<string | null>(null)
  const schemaIcon = isSchemaFile(name) ? getSchemaIconForFile(name) : undefined

  useEffect(() => {
    if (isDirectory || !currentProject) return
    let cancelled = false

    if (schemaIcon) {
      // Schema file — load the referenced image at the dotted path declared by the schema
      // (e.g. character.v1 uses "references.front", shot.v1 uses "references.frame").
      const thumbField = getSchemaThumbnailPathForFile(name) || 'references.front'
      window.avatica.files.readText(currentProject.id, filePath, name).then((text) => {
        if (cancelled) return
        try {
          const data = JSON.parse(text)
          const refImage = thumbField.split('.').reduce<any>((acc, key) => acc?.[key], data)
          if (typeof refImage === 'string' && refImage) {
            window.avatica.files.getLocalPath(currentProject.id, filePath, refImage).then((p) => {
              if (!cancelled) setSrc(`file://${p}`)
            })
          }
        } catch { /* not JSON or no references */ }
      }).catch(() => {})
    } else if (!name.endsWith('.seq')) {
      // Regular file — OS thumbnail
      window.avatica.files.thumbnail(currentProject.id, filePath, name).then((url) => {
        if (!cancelled && url) setSrc(url)
      })
    }

    return () => { cancelled = true }
  }, [currentProject, filePath, name, isDirectory, schemaIcon])

  if (isDirectory) {
    return (
      <div className="grid-tile__thumb grid-tile__thumb--folder">
        <i className="fa-solid fa-folder" />
      </div>
    )
  }

  const isVideo = mimeType?.startsWith('video/')

  // Has thumbnail (image or schema reference image)
  if (src) {
    return (
      <div className="grid-tile__thumb">
        <img src={src} alt={name} />
        {isVideo && (
          <div className="grid-tile__video-overlay">
            <i className="fa-solid fa-play grid-tile__play-icon" />
          </div>
        )}
        {schemaIcon && (
          <div className="grid-tile__schema-badge">
            <i className={schemaIcon} />
          </div>
        )}
      </div>
    )
  }

  // Schema file without reference image — large icon
  if (schemaIcon) {
    return (
      <div className="grid-tile__thumb">
        <i className={`${schemaIcon} grid-tile__schema-icon`} />
      </div>
    )
  }

  // Default — file type icon
  return (
    <div className="grid-tile__thumb">
      <i className={fileIcon(mimeType, name)} />
    </div>
  )
}
