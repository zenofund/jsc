import React, { useState, useEffect, useRef } from 'react';
import { Bell, BellOff, X, Check, CheckCheck, Trash2, ExternalLink } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import type { Notification as AppNotification } from '../types/entities';
import { notificationAPI } from '../lib/api-client'; // ✅ Changed from notificationAPI import
import { useAuth } from '../contexts/AuthContext';

interface NotificationDropdownProps {
  onNavigate?: (link: string) => void;
}

export function NotificationDropdown({ onNavigate }: NotificationDropdownProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [pushSupported, setPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Check push support
  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setPushSupported(true);
      navigator.serviceWorker.ready.then(registration => {
        registration.pushManager.getSubscription().then(subscription => {
          setPushEnabled(!!subscription);
        });
      });
    }
  }, []);

  // Fetch notifications
  const fetchNotifications = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const allNotifications = await notificationAPI.getUserNotifications(user.id, user.role);
      console.log('Fetched notifications:', allNotifications);
      setNotifications(allNotifications);
      
      // Get count from API, but fallback to local count if API returns 0 but we have unread items
      let count = 0;
      try {
        count = await notificationAPI.getUnreadCount(user.id, user.role);
      } catch (e) {
        console.warn('Failed to fetch unread count, calculating from list', e);
      }
      
      const localUnreadCount = allNotifications.filter(n => !n.is_read).length;
      
      // Use the larger of the two to ensure we don't miss notifications
      // (API might know about more notifications than the limit of 100 returned in list)
      // But if API returns 0 and we have unread items, definitely use local.
      const finalCount = count > 0 ? count : localUnreadCount;
      
      console.log('Unread count - API:', count, 'Local:', localUnreadCount, 'Final:', finalCount);
      setUnreadCount(finalCount);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    
    // Poll for new notifications every 30 seconds as backup
    const interval = setInterval(fetchNotifications, 30000);

    // Initialize socket connection
    let socket: Socket | null = null;
    
    if (user) {
      // Base URL for socket (remove /api/v1 from API URL if present, or default to localhost:3000)
      const socketUrl = 'http://localhost:3000'; 
      
      socket = io(`${socketUrl}/notifications`, {
        auth: {
          token: `Bearer ${localStorage.getItem('jsc_auth_token')}`,
        },
        transports: ['websocket'],
      });

      socket.on('connect', () => {
        console.log('Connected to notifications socket');
      });

      socket.on('notification', (newNotification: AppNotification) => {
        console.log('New notification received:', newNotification);
        setNotifications((prev) => {
          // Avoid duplicates if polling also picked it up
          if (prev.some(n => n.id === newNotification.id)) return prev;
          return [newNotification, ...prev];
        });
        setUnreadCount((prev) => prev + 1);
        toast(newNotification.message, {
            icon: '🔔',
            duration: 5000,
        });
      });

      socket.on('disconnect', () => {
        console.log('Disconnected from notifications socket');
      });
    }

    return () => {
      clearInterval(interval);
      if (socket) socket.disconnect();
    };
  }, [user]);

  const enablePushNotifications = async () => {
    if (!pushSupported) return;

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast.error('Permission denied for push notifications');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      
      if (!vapidKey) {
        console.warn('VITE_VAPID_PUBLIC_KEY not set');
        toast.error('Push notification configuration missing');
        return;
      }

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey)
        });
      }

      // Format subscription for backend
      const subJson = subscription.toJSON();
      const subscriptionDto = {
        endpoint: subJson.endpoint,
        p256dh: subJson.keys?.p256dh,
        auth: subJson.keys?.auth
      };

      await notificationAPI.subscribe(subscriptionDto);
      setPushEnabled(true);
      toast.success('Push notifications enabled!');
    } catch (error) {
      console.error('Failed to enable push:', error);
      toast.error('Failed to enable push notifications');
    }
  };

  const disablePushNotifications = async () => {
    if (!pushSupported) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await notificationAPI.unsubscribe({ endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      } else {
        await notificationAPI.unsubscribe({});
      }
      setPushEnabled(false);
      toast.success('Push notifications disabled');
    } catch (error) {
      console.error('Failed to disable push:', error);
      toast.error('Failed to disable push notifications');
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Mark notification as read
  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await notificationAPI.markAsRead(notificationId);
      await fetchNotifications();
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    if (!user) return;
    
    try {
      await notificationAPI.markAllAsRead(user.id, user.role);
      await fetchNotifications();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  // Delete notification
  const handleDelete = async (notificationId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    try {
      await notificationAPI.deleteNotification(notificationId);
      await fetchNotifications();
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  // Handle notification click
  const handleNotificationClick = async (notification: AppNotification) => {
    if (!notification.is_read) {
      await handleMarkAsRead(notification.id);
    }
    
    if (notification.link && onNavigate) {
      onNavigate(notification.link);
      setIsOpen(false);
    } else if (notification.action_link && onNavigate) {
      onNavigate(notification.action_link);
      setIsOpen(false);
    }
  };

  // Get icon color by category
  const getCategoryColor = (category: AppNotification['category']) => {
    switch (category) {
      case 'success':
        return 'text-green-600 dark:text-green-400';
      case 'error':
        return 'text-red-600 dark:text-red-400';
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'action_required':
        return 'text-blue-600 dark:text-blue-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  // Get priority badge
  const getPriorityBadge = (priority: AppNotification['priority']) => {
    if (priority === 'urgent' || priority === 'high') {
      return (
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          priority === 'urgent' 
            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
        }`}>
          {priority.charAt(0).toUpperCase() + priority.slice(1)}
        </span>
      );
    }
    return null;
  };

  // Format time ago
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  // Filter notifications
  const filteredNotifications = filter === 'unread' 
    ? notifications.filter(n => !n.is_read)
    : notifications;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 hover:bg-accent rounded-lg relative flex-shrink-0 transition-colors"
        title="Notifications"
      >
        <Bell className="w-5 h-5 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border-2 border-background"></span>
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <>
          {/* Mobile Overlay */}
          <div 
            className="fixed inset-0 bg-black/20 z-40 sm:hidden"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown Content */}
          <div className="fixed sm:absolute left-0 sm:left-auto right-0 top-[60px] sm:top-full sm:mt-2 w-full sm:w-96 bg-card border border-border sm:rounded-lg shadow-lg z-50 max-h-[calc(100vh-70px)] sm:max-h-[600px] flex flex-col">
            {/* Header */}
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-card-foreground">Notifications</h3>
                  {pushSupported && !pushEnabled && (
                    <button
                      onClick={enablePushNotifications}
                      className="p-1 hover:bg-accent rounded-full text-primary"
                      title="Enable Push Notifications"
                    >
                      <Bell className="w-4 h-4" />
                    </button>
                  )}
                  {pushSupported && pushEnabled && (
                    <button
                      onClick={disablePushNotifications}
                      className="p-1 hover:bg-accent rounded-full text-muted-foreground"
                      title="Disable Push Notifications"
                    >
                      <BellOff className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-accent rounded transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              {/* Filter Tabs */}
              <div className="flex gap-2">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-3 py-1 text-sm rounded transition-colors ${
                    filter === 'all'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent'
                  }`}
                >
                  All ({notifications.length})
                </button>
                <button
                  onClick={() => setFilter('unread')}
                  className={`px-3 py-1 text-sm rounded transition-colors ${
                    filter === 'unread'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent'
                  }`}
                >
                  Unread ({unreadCount})
                </button>
              </div>

              {/* Actions */}
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="mt-2 text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <CheckCheck className="w-3 h-3" />
                  Mark all as read
                </button>
              )}
            </div>

            {/* Notification List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-muted-foreground">
                  Loading notifications...
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Bell className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">
                    {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`p-4 transition-colors cursor-pointer ${
                        notification.is_read
                          ? 'bg-card hover:bg-accent/50'
                          : 'bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-100/50 dark:hover:bg-blue-950/30'
                      }`}
                    >
                      <div className="flex gap-3">
                        {/* Unread Indicator */}
                        {!notification.is_read && (
                          <div className="flex-shrink-0 mt-1">
                            <div className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400" />
                          </div>
                        )}

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h4 className={`text-sm font-medium ${getCategoryColor(notification.category)}`}>
                              {notification.title}
                            </h4>
                            {getPriorityBadge(notification.priority)}
                          </div>
                          
                          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                            {notification.message}
                          </p>

                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-muted-foreground">
                              {formatTimeAgo(notification.created_at)}
                            </span>

                            <div className="flex items-center gap-2">
                              {notification.action_label && (
                                <span className="text-xs text-primary flex items-center gap-1">
                                  {notification.action_label}
                                  <ExternalLink className="w-3 h-3" />
                                </span>
                              )}
                              
                              {!notification.is_read && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMarkAsRead(notification.id);
                                  }}
                                  className="p-1 hover:bg-accent rounded transition-colors"
                                  title="Mark as read"
                                >
                                  <Check className="w-3 h-3 text-muted-foreground" />
                                </button>
                              )}
                              
                              <button
                                onClick={(e) => handleDelete(notification.id, e)}
                                className="p-1 hover:bg-accent rounded transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-3 h-3 text-muted-foreground" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {filteredNotifications.length > 0 && (
              <div className="px-4 py-3 border-t border-border text-center">
                <button
                  onClick={async () => {
                    if (!user) return;
                    await notificationAPI.deleteReadNotifications(user.id, user.role);
                    await fetchNotifications();
                  }}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  Clear read notifications
                </button>
              </div>
            )}

            {/* View All Link */}
            <div className="px-4 py-3 border-t border-border text-center">
              <button
                onClick={() => {
                  if (onNavigate) {
                    onNavigate('/notifications');
                  }
                  setIsOpen(false);
                }}
                className="text-sm text-primary hover:underline font-medium"
              >
                View All Notifications
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
