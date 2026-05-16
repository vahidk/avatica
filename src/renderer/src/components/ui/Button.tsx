import { forwardRef } from 'react';

type Variant = 'ghost' | 'filled' | 'accent' | 'danger';
type Shape = 'rect' | 'pill' | 'round';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  shape?: Shape;
  /** Fixed width/height for icon-only buttons */
  size?: number;
  /** Render as <a> when href is provided */
  href?: string;
}

const variantClass: Record<Variant, string> = {
  ghost: '',
  filled: 'btn--filled',
  accent: 'btn--accent',
  danger: 'btn--danger',
};

const shapeClass: Record<Shape, string> = {
  rect: '',
  pill: 'btn--pill',
  round: 'btn--round',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'ghost', shape = 'rect', size, className, style, href, children, ...rest },
  ref,
) {
  const cls = [
    'btn',
    variantClass[variant],
    shapeClass[shape],
    size != null && 'btn--icon',
    className,
  ].filter(Boolean).join(' ');

  const s: React.CSSProperties = {
    ...(size != null ? { width: size, height: size } : {}),
    ...style,
  };

  if (href) {
    return (
      <a href={href} className={cls} style={s}>
        {children}
      </a>
    );
  }

  return (
    <button ref={ref} className={cls} style={s} {...rest}>
      {children}
    </button>
  );
});

export default Button;
