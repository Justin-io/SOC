import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  children,
  className = '',
  disabled,
  ...props
}) => {
  const base =
    'inline-flex items-center justify-center font-medium rounded-md transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed border whitespace-nowrap';

  const sizeStyles = {
    sm: 'px-2.5 py-1 text-xs',
    md: 'px-3.5 py-1.5 text-xs',
    lg: 'px-4 py-2 text-sm',
  };

  const variants = {
    primary: 'bg-[#111111] text-white border-[#111111] hover:bg-[#222222]',
    secondary: 'bg-[#F4F4F5] text-[#111111] border-[#E5E5E5] hover:bg-[#E5E5E5]',
    outline: 'bg-transparent text-[#111111] border-[#E5E5E5] hover:bg-[#FAFAFA]',
    danger: 'bg-red-600 text-white border-red-600 hover:bg-red-700',
    ghost: 'bg-transparent text-[#525252] border-transparent hover:bg-[#F5F5F5] hover:text-[#111111]',
  };

  return (
    <button
      className={`${base} ${sizeStyles[size]} ${variants[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};
