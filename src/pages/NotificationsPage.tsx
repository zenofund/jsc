import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Check, 
  CheckCheck, 
  Trash2, 
  Filter, 
  Search,
  X,
  Calendar,
  Tag,
  AlertCircle,
  ExternalLink,
  Archive,
  RefreshCw,
  Download
} from 'lucide-react';
import type { Notification } from '../types/entities';
import { notificationAPI } from '../lib/api-client';
import { PageSkeleton } from '../components/PageLoader';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function NotificationsPage() {
  const { user } = useAuth();
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'read' | 'unread'>('all');
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({ from: '', to: '' });
  
  // Stats
  const [stats, setStats] = useState({
    total: 0,
    unread: 0,
    urgent: 0,
    actionRequired: 0,
  });

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  // Fetch notifications
  const fetchNotifications = async (showLoader = true) => {
    if (!user) return;
    
    if (showLoader) setLoading(true);
    else setRefreshing(true);

    try {
      const allNotifications = await notificationAPI.getUserNotifications(user.id, user.role);
      setNotifications(allNotifications);
      
      // Calculate stats
      const unreadCount = await notificationAPI.getUnreadCount(user.id, user.role);
      setStats({
        total: allNotifications.length,
        unread: unreadCount,
        urgent: allNotifications.filter(n => n.priority === 'urgent').length,
        actionRequired: allNotifications.filter(n => n.category === 'action_required' && !n.is_read).length,
      });
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Apply filters
  useEffect(() => {
    let filtered = [...notifications];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(n => 
        n.title.toLowerCase().includes(query) ||
        n.message.toLowerCase().includes(query)
      );
    }

    // Type filter
    if (selectedType !== 'all') {
      filtered = filtered.filter(n => n.type === selectedType);
    }

    // Category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(n => n.category === selectedCategory);
    }

    // Priority filter
    if (selectedPriority !== 'all') {
      filtered = filtered.filter(n => n.priority === selectedPriority);
    }

    // Status filter
    if (selectedStatus === 'read') {
      filtered = filtered.filter(n => n.is_read);
    } else if (selectedStatus === 'unread') {
      filtered = filtered.filter(n => !n.is_read);
    }

    // Date range filter
    if (dateRange.from) {
      filtered = filtered.filter(n => new Date(n.created_at) >= new Date(dateRange.from));
    }
    if (dateRange.to) {
      filtered = filtered.filter(n => new Date(n.created_at) <= new Date(dateRange.to + 'T23:59:59'));
    }

    setFilteredNotifications(filtered);
  }, [notifications, searchQuery, selectedType, selectedCategory, selectedPriority, selectedStatus, dateRange]);

  // Mark as read
  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await notificationAPI.markAsRead(notificationId);
      await fetchNotifications(false);
      toast.success('Marked as read');
    } catch (error) {
      toast.error('Failed to mark as read');
    }
  };

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    if (!user) return;
    
    try {
      await notificationAPI.markAllAsRead(user.id, user.role);
      await fetchNotifications(false);
      toast.success('All notifications marked as read');
    } catch (error) {
      toast.error('Failed to mark all as read');
    }
  };

  // Delete notification
  const handleDelete = async (notificationId: string) => {
    try {
      await notificationAPI.deleteNotification(notificationId);
      await fetchNotifications(false);
      toast.success('Notification deleted');
    } catch (error) {
      toast.error('Failed to delete notification');
    }
  };

  // Delete selected
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    
    try {
      await Promise.all(
        Array.from(selectedIds).map(id => notificationAPI.deleteNotification(id))
      );
      setSelectedIds(new Set());
      await fetchNotifications(false);
      toast.success(`${selectedIds.size} notifications deleted`);
    } catch (error) {
      toast.error('Failed to delete notifications');
    }
  };

  // Mark selected as read
  const handleMarkSelectedAsRead = async () => {
    if (selectedIds.size === 0) return;
    
    try {
      await Promise.all(
        Array.from(selectedIds).map(id => notificationAPI.markAsRead(id))
      );
      setSelectedIds(new Set());
      await fetchNotifications(false);
      toast.success(`${selectedIds.size} notifications marked as read`);
    } catch (error) {
      toast.error('Failed to mark notifications as read');
    }
  };

  // Clear read notifications
  const handleClearRead = async () => {
    if (!user) return;
    
    try {
      await notificationAPI.deleteReadNotifications(user.id, user.role);
      await fetchNotifications(false);
      toast.success('Read notifications cleared');
    } catch (error) {
      toast.error('Failed to clear notifications');
    }
  };

  // Handle notification click
  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await handleMarkAsRead(notification.id);
    }
    
    if (notification.link) {
      window.location.href = notification.link;
    } else if (notification.action_link) {
      window.location.href = notification.action_link;
    }
  };

  // Toggle selection
  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  };

  // Select all visible
  const handleSelectAll = () => {
    if (selectedIds.size === filteredNotifications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredNotifications.map(n => n.id)));
    }
  };

  // Reset filters
  const resetFilters = () => {
    setSearchQuery('');
    setSelectedType('all');
    setSelectedCategory('all');
    setSelectedPriority('all');
    setSelectedStatus('all');
    setDateRange({ from: '', to: '' });
  };

  // Export notifications
  const handleExport = () => {
    const csv = [
      ['Date', 'Type', 'Category', 'Priority', 'Title', 'Message', 'Status'],
      ...filteredNotifications.map(n => [
        new Date(n.created_at).toLocaleString(),
        n.type,
        n.category,
        n.priority,
        n.title,
        n.message,
        n.is_read ? 'Read' : 'Unread'
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notifications-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Notifications exported');
  };

  // Get category color
  const getCategoryColor = (category: Notification['category']) => {
    switch (category) {
      case 'success':
        return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30';
      case 'error':
        return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30';
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/30';
      case 'action_required':
        return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30';
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-950/30';
    }
  };

  // Get priority badge
  const getPriorityBadge = (priority: Notification['priority']) => {
    const colors = {
      urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      low: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
    };

    return (
      <span className={`text-xs px-2 py-0.5 rounded-full ${colors[priority]}`}>
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </span>
    );
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

  const activeFiltersCount = [
    searchQuery,
    selectedType !== 'all',
    selectedCategory !== 'all',
    selectedPriority !== 'all',
    selectedStatus !== 'all',
    dateRange.from,
    dateRange.to,
  ].filter(Boolean).length;

  if (loading) {
    return <PageSkeleton mode="table" />;
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Bell className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="page-title font-bold">Notifications</h1>
                <p className="text-sm text-muted-foreground">
                  Manage your notifications and alerts
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchNotifications(false)}
                disabled={refreshing}
                className="p-2 hover:bg-accent rounded-lg transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`w-5 h-5 text-muted-foreground ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={handleExport}
                className="p-2 hover:bg-accent rounded-lg transition-colors"
                title="Export to CSV"
              >
                <Download className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold text-card-foreground">{stats.total}</p>
                </div>
                <Bell className="w-8 h-8 text-gray-400" />
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Unread</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.unread}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-blue-400" />
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Urgent</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.urgent}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Action Required</p>
                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.actionRequired}</p>
                </div>
                <Tag className="w-8 h-8 text-orange-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-card border border-border rounded-lg p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search notifications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                showFilters 
                  ? 'bg-primary text-primary-foreground border-primary' 
                  : 'border-border hover:bg-accent'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
              {activeFiltersCount > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>

          {/* Filter Options */}
          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t border-border">
              {/* Type Filter */}
              <div>
                <label className="block text-sm font-medium mb-2 text-card-foreground">Type</label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="all">All Types</option>
                  <option value="payroll">Payroll</option>
                  <option value="leave">Leave</option>
                  <option value="promotion">Promotion</option>
                  <option value="loan">Loan</option>
                  <option value="bank_payment">Bank Payment</option>
                  <option value="approval">Approval</option>
                  <option value="system">System</option>
                  <option value="arrears">Arrears</option>
                  <option value="document">Document</option>
                </select>
              </div>

              {/* Category Filter */}
              <div>
                <label className="block text-sm font-medium mb-2 text-card-foreground">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="all">All Categories</option>
                  <option value="info">Info</option>
                  <option value="success">Success</option>
                  <option value="warning">Warning</option>
                  <option value="error">Error</option>
                  <option value="action_required">Action Required</option>
                </select>
              </div>

              {/* Priority Filter */}
              <div>
                <label className="block text-sm font-medium mb-2 text-card-foreground">Priority</label>
                <select
                  value={selectedPriority}
                  onChange={(e) => setSelectedPriority(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="all">All Priorities</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium mb-2 text-card-foreground">Status</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value as 'all' | 'read' | 'unread')}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="all">All</option>
                  <option value="unread">Unread</option>
                  <option value="read">Read</option>
                </select>
              </div>

              {/* Date From */}
              <div>
                <label className="block text-sm font-medium mb-2 text-card-foreground">From Date</label>
                <input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Date To */}
              <div>
                <label className="block text-sm font-medium mb-2 text-card-foreground">To Date</label>
                <input
                  type="date"
                  value={dateRange.to}
                  onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Reset Filters */}
              <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
                <button
                  onClick={resetFilters}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  <X className="w-4 h-4" />
                  Reset Filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bulk Actions */}
        {(selectedIds.size > 0 || filteredNotifications.length > 0) && (
          <div className="bg-card border border-border rounded-lg p-4 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredNotifications.length && filteredNotifications.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-border"
                  />
                  <span className="text-sm text-muted-foreground">
                    {selectedIds.size > 0 
                      ? `${selectedIds.size} selected` 
                      : `Select all (${filteredNotifications.length})`
                    }
                  </span>
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {selectedIds.size > 0 && (
                  <>
                    <button
                      onClick={handleMarkSelectedAsRead}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      <Check className="w-4 h-4" />
                      Mark as Read
                    </button>
                    <button
                      onClick={handleDeleteSelected}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </>
                )}
                
                {stats.unread > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-accent transition-colors"
                  >
                    <CheckCheck className="w-4 h-4" />
                    Mark All Read
                  </button>
                )}

                <button
                  onClick={handleClearRead}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-accent transition-colors"
                >
                  <Archive className="w-4 h-4" />
                  Clear Read
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Notifications List */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {filteredNotifications.length === 0 ? (
            <div className="p-12 text-center">
              <Bell className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
              <p className="text-lg text-muted-foreground mb-2">
                {searchQuery || activeFiltersCount > 0 
                  ? 'No notifications match your filters' 
                  : 'No notifications yet'
                }
              </p>
              {(searchQuery || activeFiltersCount > 0) && (
                <button
                  onClick={resetFilters}
                  className="text-sm text-primary hover:underline mt-2"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 transition-colors ${
                    notification.is_read
                      ? 'bg-card hover:bg-accent/50'
                      : 'bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-100/50 dark:hover:bg-blue-950/30'
                  }`}
                >
                  <div className="flex gap-4">
                    {/* Checkbox */}
                    <div className="flex-shrink-0 mt-1">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(notification.id)}
                        onChange={() => toggleSelection(notification.id)}
                        className="w-4 h-4 rounded border-border"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>

                    {/* Unread Indicator */}
                    {!notification.is_read && (
                      <div className="flex-shrink-0 mt-1.5">
                        <div className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400" />
                      </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-medium text-card-foreground">
                            {notification.title}
                          </h4>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${getCategoryColor(notification.category)}`}>
                            {notification.category.replace('_', ' ')}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                            {notification.type}
                          </span>
                        </div>
                        {getPriorityBadge(notification.priority)}
                      </div>

                      <p className="text-sm text-muted-foreground mb-3">
                        {notification.message}
                      </p>

                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatTimeAgo(notification.created_at)}
                          </span>
                          <span>•</span>
                          <span>{new Date(notification.created_at).toLocaleString()}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          {notification.action_label && notification.action_link && (
                            <button
                              onClick={() => handleNotificationClick(notification)}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                            >
                              {notification.action_label}
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          )}

                          {!notification.is_read && (
                            <button
                              onClick={() => handleMarkAsRead(notification.id)}
                              className="p-2 hover:bg-accent rounded-lg transition-colors"
                              title="Mark as read"
                            >
                              <Check className="w-4 h-4 text-muted-foreground" />
                            </button>
                          )}

                          <button
                            onClick={() => handleDelete(notification.id)}
                            className="p-2 hover:bg-accent rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-muted-foreground" />
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

        {/* Results Summary */}
        {filteredNotifications.length > 0 && (
          <div className="mt-4 text-center text-sm text-muted-foreground">
            Showing {filteredNotifications.length} of {notifications.length} notifications
          </div>
        )}
      </div>
    </div>
  );
}