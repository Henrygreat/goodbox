import { useState, useEffect } from 'react';
import { notificationsApi } from '../services/api';
import type { Notification, NotificationType } from '../types';

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    loadNotifications();
  }, [filter]);

  const loadNotifications = async () => {
    try {
      const res = await notificationsApi.getAll(filter === 'unread');
      setNotifications(res.data);
    } catch (error) {
      console.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (id: number) => {
    try {
      await notificationsApi.markRead(id);
      loadNotifications();
    } catch (error) {
      console.error('Failed to mark notification as read');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      loadNotifications();
    } catch (error) {
      console.error('Failed to mark all as read');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await notificationsApi.delete(id);
      loadNotifications();
    } catch (error) {
      console.error('Failed to delete notification');
    }
  };

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'birthday':
        return '🎂';
      case 'approval':
        return '✅';
      case 'reminder':
        return '🔔';
      default:
        return '📌';
    }
  };

  const getTypeColor = (type: NotificationType) => {
    switch (type) {
      case 'birthday':
        return 'bg-pink-100 text-pink-800';
      case 'approval':
        return 'bg-green-100 text-green-800';
      case 'reminder':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Notifications</h1>
        <div className="flex items-center gap-4">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'all' ? 'bg-white shadow' : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'unread' ? 'bg-white shadow' : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-primary-600 hover:text-primary-700 text-sm font-medium"
            >
              Mark all as read
            </button>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <div className="text-6xl mb-4">🔔</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">No notifications</h2>
          <p className="text-gray-500">
            {filter === 'unread' ? 'All notifications have been read.' : 'You have no notifications yet.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm divide-y">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`p-4 flex items-start gap-4 ${!notification.read ? 'bg-blue-50' : ''}`}
            >
              <div className="text-2xl">{getIcon(notification.type)}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium text-gray-800">{notification.title}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTypeColor(notification.type)}`}>
                    {notification.type}
                  </span>
                  {!notification.read && (
                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  )}
                </div>
                <p className="text-gray-600 text-sm">{notification.message}</p>
                <p className="text-gray-400 text-xs mt-2">
                  {new Date(notification.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                {!notification.read && (
                  <button
                    onClick={() => handleMarkRead(notification.id)}
                    className="text-sm text-primary-600 hover:text-primary-700"
                  >
                    Mark read
                  </button>
                )}
                <button
                  onClick={() => handleDelete(notification.id)}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
