import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { adminApi } from '../../api/admin.api';
import { extractErrorMessage } from '../../api/client';

export function AdminNotificationBell() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const hasShownError = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const loadNotifications = async () => {
      try {
        const { data } = await adminApi.listNotifications();
        if (cancelled) return;
        setNotifications(data.data.items);
        setUnreadCount(data.data.unreadCount);
        hasShownError.current = false;
      } catch (error) {
        if (cancelled) return;
        if (!hasShownError.current) {
          toast.error(extractErrorMessage(error));
          hasShownError.current = true;
        }
      }
    };

    loadNotifications();
    const intervalId = window.setInterval(loadNotifications, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const openNotification = async (notification) => {
    if (!notification.isRead) {
      try {
        await adminApi.markNotificationRead(notification._id);
        setNotifications((items) =>
          items.map((item) => (item._id === notification._id ? { ...item, isRead: true } : item))
        );
        setUnreadCount((count) => Math.max(0, count - 1));
      } catch (error) {
        toast.error(extractErrorMessage(error));
      }
    }

    setIsOpen(false);
    navigate('/admin/job-roles');
  };

  return (
    <div className="relative">
      <button
        type="button"
        className="focus-ring relative rounded-xl border border-[var(--color-border)] p-2 text-[var(--color-text-muted)] transition-all hover:border-brand-300 hover:bg-[var(--color-surface-alt)] hover:text-brand-600"
        aria-label={`Admin notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 00-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="gi-scale-in absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl sm:w-96">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
            <h2 className="text-sm font-semibold text-[var(--color-text)]">Admin notifications</h2>
            {unreadCount > 0 && <span className="text-xs font-medium text-brand-600">{unreadCount} new</span>}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-[var(--color-text-muted)]">No role notifications yet.</p>
            ) : (
              notifications.map((notification) => (
                <button
                  type="button"
                  key={notification._id}
                  onClick={() => openNotification(notification)}
                  className={`w-full border-b border-[var(--color-border)] px-4 py-3 text-left transition-colors last:border-0 hover:bg-[var(--color-surface-alt)] ${
                    notification.isRead ? '' : 'bg-brand-500/5'
                  }`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="text-sm font-semibold text-[var(--color-text)]">{notification.title}</span>
                    {!notification.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-[var(--color-text-muted)]">{notification.message}</span>
                  <span className="mt-1.5 block text-[11px] text-[var(--color-text-muted)]">
                    {new Date(notification.createdAt).toLocaleString()}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
