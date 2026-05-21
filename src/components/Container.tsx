import type { HTMLAttributes, ReactNode } from 'react';

type Props = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  narrow?: boolean;
};

export function Container({ children, narrow, className = '', ...rest }: Props) {
  const max = narrow ? 'max-w-[var(--container-narrow)]' : 'max-w-[var(--container-default)]';
  return (
    <div className={`mx-auto w-full px-6 ${max} ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}
