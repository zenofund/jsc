import { toast } from 'sonner';

/**
 * Toast Notification Utility
 * Provides consistent, non-obtrusive feedback throughout the application
 */

export const showToast = {
  /**
   * Success toast - for successful operations
   */
  success: (message: string, description?: string) => {
    toast.success(message, {
      description,
      duration: 4000,
    });
  },

  /**
   * Error toast - for errors and failures
   */
  error: (message: string, description?: string) => {
    toast.error(message, {
      description,
      duration: 5000,
    });
  },

  /**
   * Info toast - for informational messages
   */
  info: (message: string, description?: string) => {
    toast.info(message, {
      description,
      duration: 4000,
    });
  },

  /**
   * Warning toast - for warnings
   */
  warning: (message: string, description?: string) => {
    toast.warning(message, {
      description,
      duration: 4500,
    });
  },

  /**
   * Loading toast - for ongoing operations
   */
  loading: (message: string, description?: string) => {
    return toast.loading(message, {
      description,
    });
  },

  /**
   * Promise toast - automatically handles loading/success/error states
   */
  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: any) => string);
    }
  ) => {
    return toast.promise(promise, messages);
  },

  /**
   * Confirmation toast - replaces window.confirm()
   * Returns a promise that resolves to true/false
   */
  confirm: (message: string, description?: string): Promise<boolean> => {
    return new Promise((resolve) => {
      toast(message, {
        description,
        duration: Infinity,
        action: {
          label: 'Confirm',
          onClick: () => resolve(true),
        },
        cancel: {
          label: 'Cancel',
          onClick: () => resolve(false),
        },
        onDismiss: () => resolve(false),
        onAutoClose: () => resolve(false),
      });
    });
  },

  /**
   * Dismiss a specific toast
   */
  dismiss: (toastId?: string | number) => {
    toast.dismiss(toastId);
  },

  /**
   * Dismiss all toasts
   */
  dismissAll: () => {
    toast.dismiss();
  },
};

/**
 * API Error Handler - extracts user-friendly messages from API errors
 */
export const handleApiError = (error: any, defaultMessage = 'An error occurred') => {
  const message = error?.response?.data?.message || error?.message || defaultMessage;
  showToast.error('Error', message);
};

/**
 * API Success Handler - shows success message
 */
export const handleApiSuccess = (message: string, description?: string) => {
  showToast.success(message, description);
};
