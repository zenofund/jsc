import React, { useState, useEffect } from 'react';
import { Mail, Server, Lock, User, Send, CheckCircle, XCircle, AlertCircle, Eye, EyeOff, Activity } from 'lucide-react';
import { toast } from 'sonner';
import { emailAPI } from '../lib/api-client';
import { PageSkeleton } from '../components/PageLoader';
import { Button } from '../components/ui/button';

interface SmtpSettings {
  id: string;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  fromEmail: string;
  fromName: string;
  isActive: boolean;
  lastTestedAt?: string;
  testStatus?: string;
  testMessage?: string;
}

interface EmailStats {
  total_emails: number;
  sent_count: number;
  failed_count: number;
  pending_count: number;
  last_24h_count: number;
  last_7d_count: number;
  byTemplate: Array<{
    template_type: string;
    count: number;
    sent: number;
    failed: number;
  }>;
}

export function SmtpSettingsPage() {
  const [settings, setSettings] = useState<SmtpSettings | null>(null);
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    host: '',
    port: 587,
    secure: false,
    username: '',
    password: '',
    fromEmail: '',
    fromName: 'JSC Payroll System',
    testEmail: '',
  });

  useEffect(() => {
    loadSettings();
    loadStats();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await emailAPI.getSmtpSettings();
      
      if (response) {
        setSettings({
          id: response.id,
          host: response.host,
          port: response.port,
          secure: response.secure,
          username: response.username,
          fromEmail: response.from_email,
          fromName: response.from_name,
          isActive: response.is_active,
          lastTestedAt: response.last_tested_at,
          testStatus: response.test_status,
          testMessage: response.test_message,
        });
        setFormData({
          host: response.host || '',
          port: response.port || 587,
          secure: response.secure || false,
          username: response.username || '',
          password: '', // Never show existing password
          fromEmail: response.from_email || '',
          fromName: response.from_name || 'JSC Payroll System',
          testEmail: '',
        });
      }
    } catch (error: any) {
      console.error('Failed to load SMTP settings:', error);
      if (error.response?.status !== 404) {
        toast.error('Failed to load SMTP settings');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await emailAPI.getEmailStats();
      setStats(response);
    } catch (error) {
      console.error('Failed to load email stats:', error);
    }
  };

  const handleSave = async () => {
    if (!formData.host || !formData.username || !formData.fromEmail || !formData.fromName) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!settings && !formData.password) {
      toast.error('Password is required for new configuration');
      return;
    }

    setSaving(true);

    try {
      const payload: any = {
        host: formData.host,
        port: formData.port,
        secure: formData.secure,
        username: formData.username,
        fromEmail: formData.fromEmail,
        fromName: formData.fromName,
      };

      // Only include password if it's been changed
      if (formData.password) {
        payload.password = formData.password;
      }

      if (settings?.id) {
        // Update existing
        await emailAPI.updateSmtpSettings(settings.id, payload);
        toast.success('SMTP settings updated successfully');
      } else {
        // Create new
        payload.password = formData.password; // Required for new
        await emailAPI.createSmtpSettings(payload);
        toast.success('SMTP settings created successfully');
      }

      await loadSettings();
      setFormData(prev => ({ ...prev, password: '' }));
    } catch (error: any) {
      console.error('Failed to save SMTP settings:', error);
      toast.error(error.response?.data?.message || 'Failed to save SMTP settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!formData.host || !formData.username || (!settings && !formData.password)) {
      toast.error('Please fill in connection details');
      return;
    }

    setTesting(true);

    try {
      const response = await emailAPI.testSmtpSettings({
        host: formData.host,
        port: formData.port,
        secure: formData.secure,
        username: formData.username,
        password: formData.password || 'test', // Use existing password if not changed
        testEmail: formData.testEmail || undefined,
      });

      if (response.success) {
        toast.success('SMTP connection successful!');
        if (formData.testEmail && (response as any).testEmailSent) {
          toast.success(`Test email sent to ${formData.testEmail}`);
        }
        await loadSettings();
      } else {
        toast.error(`Connection failed: ${response.message}`);
      }
    } catch (error: any) {
      console.error('SMTP test failed:', error);
      toast.error(error.response?.data?.message || 'SMTP test failed');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <PageSkeleton mode="detail" />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
          <Mail className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="page-title">SMTP Email Settings</h1>
          <p className="text-muted-foreground text-sm">Configure email server for system notifications</p>
        </div>
      </div>

      {/* Email Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Emails</p>
                <p className="text-2xl font-bold text-foreground">{stats.total_emails}</p>
              </div>
              <Mail className="w-8 h-8 text-muted-foreground" />
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Sent Successfully</p>
                <p className="text-2xl font-bold text-green-600">{stats.sent_count}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold text-red-600">{stats.failed_count}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Last 24 Hours</p>
                <p className="text-2xl font-bold text-foreground">{stats.last_24h_count}</p>
              </div>
              <Activity className="w-8 h-8 text-muted-foreground" />
            </div>
          </div>
        </div>
      )}

      {/* SMTP Configuration Form */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-foreground mb-4">Server Configuration</h2>

        <div className="space-y-4">
          {/* Host */}
          <div>
            <label className="block text-sm mb-2 text-foreground">
              SMTP Host <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Server className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                value={formData.host}
                onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                placeholder="smtp.gmail.com"
                className="w-full pl-10 pr-4 py-2 bg-input-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-foreground"
              />
            </div>
          </div>

          {/* Port and Secure */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-2 text-foreground">
                Port <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.port}
                onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 587 })}
                className="w-full px-4 py-2 bg-input-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-foreground"
              />
              <p className="text-xs text-muted-foreground mt-1">Common: 587 (TLS), 465 (SSL), 25 (Plain)</p>
            </div>

            <div>
              <label className="block text-sm mb-2 text-foreground">Security</label>
              <div className="flex items-center gap-4 h-10">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.secure}
                    onChange={(e) => setFormData({ ...formData, secure: e.target.checked })}
                    className="w-4 h-4 text-primary border-border rounded focus:ring-primary"
                  />
                  <span className="text-sm text-foreground">Use SSL/TLS</span>
                </label>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Enable for port 465</p>
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm mb-2 text-foreground">
              Username <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="noreply@jsc.gov.ng"
                className="w-full pl-10 pr-4 py-2 bg-input-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-foreground"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm mb-2 text-foreground">
              Password {!settings && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={settings ? 'Leave blank to keep current password' : 'Enter password'}
                className="w-full pl-10 pr-12 py-2 bg-input-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-foreground"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* From Email */}
          <div>
            <label className="block text-sm mb-2 text-foreground">
              From Email <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="email"
                value={formData.fromEmail}
                onChange={(e) => setFormData({ ...formData, fromEmail: e.target.value })}
                placeholder="noreply@jsc.gov.ng"
                className="w-full pl-10 pr-4 py-2 bg-input-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-foreground"
              />
            </div>
          </div>

          {/* From Name */}
          <div>
            <label className="block text-sm mb-2 text-foreground">
              From Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.fromName}
              onChange={(e) => setFormData({ ...formData, fromName: e.target.value })}
              placeholder="JSC Payroll System"
              className="w-full px-4 py-2 bg-input-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-foreground"
            />
          </div>

          {/* Test Email */}
          <div className="border-t border-border pt-4">
            <label className="block text-sm mb-2 text-foreground">
              Test Email Address (Optional)
            </label>
            <div className="relative">
              <Send className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="email"
                value={formData.testEmail}
                onChange={(e) => setFormData({ ...formData, testEmail: e.target.value })}
                placeholder="your-email@example.com"
                className="w-full pl-10 pr-4 py-2 bg-input-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-foreground"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              A test email will be sent to this address when testing the connection
            </p>
          </div>
        </div>

        {/* Last Test Status */}
        {settings?.lastTestedAt && (
          <div className={`mt-4 p-3 rounded-lg border ${
            settings.testStatus === 'success' 
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900' 
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900'
          }`}>
            <div className="flex items-center gap-2">
              {settings.testStatus === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600" />
              )}
              <div>
                <p className="text-sm font-medium">
                  Last Test: {new Date(settings.lastTestedAt).toLocaleString()}
                </p>
                {settings.testMessage && (
                  <p className="text-xs text-muted-foreground">{settings.testMessage}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 mt-6">
          <Button
            onClick={handleTest}
            disabled={saving}
            isLoading={testing}
            variant="secondary"
          >
            <Send className="w-4 h-4 mr-2" />
            Test Connection
          </Button>

          <Button
            onClick={handleSave}
            disabled={testing}
            isLoading={saving}
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Save Settings
          </Button>
        </div>
      </div>

      {/* Email Types */}
      {stats?.byTemplate && stats.byTemplate.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-foreground mb-4">Email Types</h2>
          
          <div className="space-y-3">
            {stats.byTemplate.map((template) => (
              <div key={template.template_type} className="flex items-center justify-between p-3 bg-input-background rounded-lg">
                <div>
                  <p className="font-medium text-foreground capitalize">
                    {template.template_type.replace(/_/g, ' ')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {template.count} total • {template.sent} sent • {template.failed} failed
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-foreground">{template.count}</p>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-green-600">{Math.round((template.sent / template.count) * 100)}%</span>
                    <span className="text-muted-foreground">success rate</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
