import React, { useEffect, useState } from 'react';

export interface NotificationData {
  id: number;
  message: string;
  type: 'success' | 'error';
}

interface NotificationProps {
  notification: NotificationData;
  onDismiss: (id: number) => void;
}

const Notification: React.FC<NotificationProps> = ({ notification, onDismiss }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss(notification.id), 500);
    }, 3000);

    return () => clearTimeout(timer);
  }, [notification, onDismiss]);

  const baseClasses = 'font-semibold text-white px-6 py-4 rounded-xl shadow-lg transition-all duration-500 ease-[cubic-bezier(0.68,-0.55,0.27,1.55)] max-w-xs text-center';
  const typeClasses = notification.type === 'success' ? 'bg-success' : 'bg-danger';
  const visibilityClasses = visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full';

  return (
    <div className={`${baseClasses} ${typeClasses} ${visibilityClasses}`}>
      {notification.message}
    </div>
  );
};

export default Notification;