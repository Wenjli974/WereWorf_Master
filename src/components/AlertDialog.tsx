import React from 'react';

interface AlertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export const AlertDialog: React.FC<AlertDialogProps> = ({
  isOpen,
  onClose,
  title,
  children,
  actions
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black bg-opacity-25" onClick={onClose} />
        <div className="relative bg-white rounded-lg max-w-md w-full p-6">
          <h3 className="text-lg font-medium mb-4">{title}</h3>
          <div className="mb-4">{children}</div>
          <div className="flex justify-end space-x-2">
            {actions}
          </div>
        </div>
      </div>
    </div>
  );
};

export const AlertDialogAction: React.FC<{
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
}> = ({ onClick, children, variant = 'primary' }) => {
  const baseStyles = 'px-4 py-2 rounded font-medium';
  const variantStyles = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300'
  };

  return (
    <button
      onClick={onClick}
      className={`${baseStyles} ${variantStyles[variant]}`}
    >
      {children}
    </button>
  );
};
