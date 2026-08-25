import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  isLoading?: boolean;
}

export function Button({ variant = 'primary', isLoading, children, className = '', ...props }: ButtonProps) {
  const baseClass = 'btn';
  const variantClass = variant === 'ghost' ? 'btn-ghost' : `btn-${variant}`;
  
  return (
    <button className={`${baseClass} ${variantClass} ${className}`} disabled={isLoading || props.disabled} {...props}>
      {isLoading ? (
        <span style={{ marginRight: '0.5rem', display: 'inline-block', animation: 'spin 1s linear infinite' }}>↻</span>
      ) : null}
      {children}
    </button>
  );
}
