import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  onClick,
  hoverable = false,
}) => {
  return (
    <div
      onClick={onClick}
      className={`bg-white border border-[#E5E5E5] rounded-md p-4 transition-colors ${
        hoverable ? 'hover:bg-[#FAFAFA] cursor-pointer' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
};
