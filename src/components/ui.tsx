import Link from 'next/link';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const baseButton =
  'inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors duration-200 ease-apple active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

const sizeClass: Record<Size, string> = {
  sm: 'px-4 py-2 text-sm min-h-[40px]',
  md: 'px-6 py-3 text-base min-h-[44px]',
  lg: 'px-8 py-4 text-lg min-h-[52px]',
};

const variantClass: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-hover',
  secondary: 'bg-ink text-white hover:opacity-90',
  outline: 'bg-surface text-ink border border-line hover:bg-page',
  ghost: 'bg-transparent text-accent hover:underline px-2',
  danger: 'bg-danger text-white hover:opacity-90',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button className={`${baseButton} ${sizeClass[size]} ${variantClass[variant]} ${className}`} {...props} />;
}

export function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...rest
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
  prefetch?: boolean;
  target?: string;
  rel?: string;
  'data-testid'?: string;
}) {
  return (
    <Link href={href} className={`${baseButton} ${sizeClass[size]} ${variantClass[variant]} ${className}`} {...rest}>
      {children}
    </Link>
  );
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`bg-surface rounded-card shadow-card ${className}`}>{children}</div>;
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <label className="block" htmlFor={htmlFor}>
      <span className="block text-sm font-medium text-ink mb-1.5">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-muted mt-1.5">{hint}</span> : null}
    </label>
  );
}

const controlClass =
  'w-full bg-page rounded-control text-ink placeholder:text-muted px-4 py-3 focus:outline-none focus:ring-2 focus:ring-accent transition-all duration-200 ease-apple min-h-[44px]';

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${controlClass} ${className}`} {...props} />;
}

export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${controlClass} ${className}`} {...props} />;
}

export function Select({ className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${controlClass} ${className}`} {...props}>
      {children}
    </select>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'success' | 'danger' | 'warn';
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-page text-body border border-line',
    accent: 'bg-accent/10 text-accent',
    success: 'bg-[#e6f5ea] text-success',
    danger: 'bg-[#fdecec] text-danger',
    warn: 'bg-[#fff4e5] text-[#946200]',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Spinner({ label = '加载中' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border border-line border-t-accent" aria-hidden />
      {label}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="text-center py-16 px-6">
      <h3 className="text-xl font-semibold tracking-tight text-ink">{title}</h3>
      {description ? <p className="mt-2 text-body max-w-md mx-auto">{description}</p> : null}
      {action ? <div className="mt-6 flex justify-center gap-3">{action}</div> : null}
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <p className="rounded-control bg-[#fdecec] text-danger px-4 py-3 text-sm" role="alert">
      {message}
    </p>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  description,
  center = false,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  center?: boolean;
}) {
  return (
    <div className={center ? 'text-center' : ''}>
      {eyebrow ? <p className="text-sm font-medium text-accent mb-2">{eyebrow}</p> : null}
      <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-ink">{title}</h2>
      {description ? (
        <p className={`mt-3 text-body ${center ? 'max-w-2xl mx-auto' : 'max-w-2xl'}`}>{description}</p>
      ) : null}
    </div>
  );
}