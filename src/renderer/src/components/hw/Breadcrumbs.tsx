import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight } from '@fortawesome/free-solid-svg-icons';
import './hw.css';

interface Crumb {
  label: string;
  path: string;
}

interface BreadcrumbsProps {
  crumbs: Crumb[];
  onNavigate: (path: string) => void;
}

export default function Breadcrumbs({ crumbs, onNavigate }: BreadcrumbsProps) {
  return (
    <div className="hw-breadcrumbs">
      {crumbs.map((crumb, i) => (
        <span key={crumb.path} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {i > 0 && <FontAwesomeIcon icon={faChevronRight} className="hw-breadcrumbs__separator" />}
          <span
            className={`hw-breadcrumbs__crumb ${i === crumbs.length - 1 ? 'hw-breadcrumbs__crumb--current' : 'hw-breadcrumbs__crumb--parent'}`}
            onClick={() => onNavigate(crumb.path)}
          >
            {crumb.label}
          </span>
        </span>
      ))}
    </div>
  );
}
