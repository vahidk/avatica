import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Button from './Button';

interface ContextMenuItemProps {
  icon: IconProp;
  label: string;
  danger?: boolean;
  onClick: () => void;
}

export default function ContextMenuItem({ icon, label, danger, onClick }: ContextMenuItemProps) {
  return (
    <Button
      variant={danger ? 'danger' : 'ghost'}
      onClick={onClick}
      style={{
        width: '100%',
        justifyContent: 'flex-start',
        padding: '6px var(--space-3)',
        fontSize: 'var(--text-xs)',
        gap: 'var(--space-2)',
      }}
    >
      <FontAwesomeIcon icon={icon} style={{ fontSize: 11, width: 14 }} />
      {label}
    </Button>
  );
}
