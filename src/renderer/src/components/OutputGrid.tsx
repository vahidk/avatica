import { useState } from 'react'
import FilePreview from './FilePreview'
import Thumbnail from './Thumbnail'

interface GeneratedFile {
  filePath: string
  fileName: string
  mimeType: string
}

interface OutputGridProps {
  outputs: GeneratedFile[]
  pendingCount: number
}

export default function OutputGrid({ outputs, pendingCount }: OutputGridProps): React.JSX.Element {
  const [previewFile, setPreviewFile] = useState<GeneratedFile | null>(null)

  const previewableFiles = outputs
  const previewIdx = previewFile ? previewableFiles.indexOf(previewFile) : -1

  return (
    <div className="hw-panel output-grid-panel">
      {outputs.length === 0 && pendingCount === 0 ? (
        <div className="output-grid__empty">
          <i className="fa-solid fa-layer-group output-grid__empty-icon" />
        </div>
      ) : (
        <div className="output-grid__tiles">
          {Array.from({ length: pendingCount }).map((_, i) => (
            <div key={`skeleton-${i}`} className="output-tile output-tile--skeleton">
              <div className="output-tile__placeholder">
                <i className="fa-solid fa-spinner fa-spin" />
              </div>
            </div>
          ))}
          {outputs.map((file, i) => (
            <div key={i} className="output-tile" onClick={() => setPreviewFile(file)}>
              <Thumbnail name={file.fileName} mimeType={file.mimeType} isDirectory={false} path="" />
            </div>
          ))}
        </div>
      )}
      {previewFile && (
        <FilePreview
          name={previewFile.fileName}
          mimeType={previewFile.mimeType}
          size={0}
          onClose={() => setPreviewFile(null)}
          onPrev={previewIdx > 0 ? () => setPreviewFile(previewableFiles[previewIdx - 1]) : undefined}
          onNext={previewIdx < previewableFiles.length - 1 ? () => setPreviewFile(previewableFiles[previewIdx + 1]) : undefined}
        />
      )}
    </div>
  )
}
