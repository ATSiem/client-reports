'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ThemeToggle, useTheme } from '~/components/theme-provider';
import { useAuth } from '~/components/auth-provider';
import { LoginButton } from '~/components/login-button';

interface FeedbackItem {
  id: string;
  reportId: string;
  clientId: string | null;
  clientName: string | null;
  rating: number | null;
  feedbackText: string | null;
  actionsTaken: string[];
  startDate: string;
  endDate: string;
  vectorSearchUsed: boolean;
  searchQuery: string | null;
  emailCount: number;
  copiedToClipboard: boolean;
  generationTimeMs: number | null;
  createdAt: string;
  userAgent: string | null;
}

interface FeedbackStats {
  totalReports: number;
  averageRating: number;
  vectorSearchPercentage: number;
  averageGenerationTime: number;
  clipboardCopyRate: number;
  feedbackSubmissionRate: number;
  mostCommonActions: {action: string, count: number}[];
}

export default function FeedbackAnalyticsPage() {
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { darkMode } = useTheme();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  
  // Debug user details
  useEffect(() => {
    if (user) {
      console.log('Auth user details:', {
        name: user.name,
        username: user.username,
        authenticated: isAuthenticated
      });
    } else {
      console.log('No user details available');
    }
  }, [user, isAuthenticated]);
  
  // Function to check if user is admin via API
  useEffect(() => {
    async function checkAdminStatus() {
      if (!user || !user.username) {
        console.log('No user or username available');
        setIsAdmin(false);
        return;
      }
      
      try {
        console.log('Checking admin status for:', user.username);
        const token = sessionStorage.getItem('msGraphToken');
        
        // First, check the admin test endpoint for diagnostics
        console.log('Calling admin-test endpoint for diagnostics...');
        const diagResponse = await fetch('/api/admin-test', {
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'x-user-email': user.username.toLowerCase() || '',
          }
        });
        
        if (diagResponse.ok) {
          const diagData = await diagResponse.json();
          console.log('Admin test diagnostics:', diagData);
        } else {
          console.error('Admin test diagnostics failed:', diagResponse.status);
        }
        
        // Use fetch with AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        console.log('Calling admin check API with email:', user.username.toLowerCase());
        const response = await fetch('/api/admin/check', {
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        console.log('Admin check response status:', response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log('Admin check result:', data);
          
          // Set admin status based on the API response
          setIsAdmin(data.isAdmin);
          
          // Special override for known admin user - TEMPORARY FIX
          if (user.username.toLowerCase() === 'asiemiginowski@defactoglobal.com') {
            console.log('Admin user detected, overriding admin status');
            setIsAdmin(true);
          }
        } else {
          console.error('Admin check failed:', response.status);
          setIsAdmin(false);
        }
      } catch (err) {
        console.error('Error checking admin status:', err);
        setIsAdmin(false);
      }
    }
    
    if (isAuthenticated && user) {
      checkAdminStatus();
    }
  }, [isAuthenticated, user]);
  
  // Function to download CSV with authentication
  const downloadCSV = async () => {
    try {
      const token = sessionStorage.getItem('msGraphToken');
      if (!token || !user?.username) {
        alert('Authentication required. Please sign in again.');
        return;
      }
      
      console.log('Downloading CSV with token and email:', !!token, user.username);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch('/api/admin/feedback/csv', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        if (response.status === 403) {
          alert('Access denied. You do not have permission to access this resource.');
          return;
        }
        throw new Error('Failed to download CSV');
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'feedback_export.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading CSV:', err);
      if (err.name === 'AbortError') {
        alert('Request timed out. Please try again.');
      } else {
        alert('Failed to download CSV data');
      }
    }
  };
  
  useEffect(() => {
    async function fetchFeedback() {
      try {
        // Get the auth token from sessionStorage
        const token = sessionStorage.getItem('msGraphToken');
        if (!token) {
          console.error('No authentication token available');
          setError('Authentication required. Please sign in again.');
          setLoading(false);
          return;
        }
        
        console.log('Fetching feedback with token:', !!token);
        console.log('User email for headers:', user?.username);
        
        if (!user?.username) {
          console.error('No user email available for API request');
          setError('User email not available. Please sign in again.');
          setLoading(false);
          return;
        }
        
        // Use fetch with AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch('/api/admin/feedback', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        console.log('Feedback API response status:', response.status);
        
        if (!response.ok) {
          if (response.status === 403) {
            setError('Access denied. You do not have permission to access this resource.');
          } else {
            const errorData = await response.json().catch(() => ({}));
            console.error('Server error:', response.status, errorData);
            throw new Error(errorData.message || 'Failed to fetch feedback data');
          }
          setLoading(false);
          return;
        }
        
        const data = await response.json();
        console.log('Feedback data received:', !!data);
        
        setFeedback(data.feedback || []);
        setStats(data.stats || null);
      } catch (err) {
        if (err.name === 'AbortError') {
          console.error('Feedback request timed out');
          setError('Request timed out. Please try again.');
        } else {
          console.error('Error fetching feedback:', err);
          setError(err instanceof Error ? err.message : 'Failed to load feedback data');
        }
      } finally {
        setLoading(false);
      }
    }
    
    if (isAuthenticated && isAdmin) {
      console.log('User is authenticated and admin, fetching feedback');
      fetchFeedback();
    } else {
      setLoading(false);
      console.log('Not fetching feedback. Auth:', isAuthenticated, 'Admin:', isAdmin);
    }
  }, [isAuthenticated, user, isAdmin]);
  
  if (authLoading) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Feedback Analytics</h1>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500 dark:text-gray-400">Loading authentication...</p>
        </div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Feedback Analytics</h1>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-gray-500 dark:text-gray-400">Please sign in to access this page</p>
          <LoginButton />
        </div>
      </div>
    );
  }
  
  if (!isAdmin) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Feedback Analytics</h1>
        <div className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 p-4 rounded-md">
          <p>Access denied. You must be an administrator to view this page.</p>
        </div>
        <div className="mt-4">
          <Link href="/reports" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
            Back to Reports
          </Link>
        </div>
      </div>
    );
  }
  
  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Feedback Analytics</h1>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500 dark:text-gray-400">Loading feedback data...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Feedback Analytics</h1>
        <div className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 p-4 rounded-md">
          <p>{error}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Feedback Analytics</h1>
          <ThemeToggle />
        </div>
        <div className="flex gap-2">
          <button 
            onClick={downloadCSV}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Export to CSV
          </button>
          <Link href="/reports" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
            Back to Reports
          </Link>
        </div>
      </div>
      
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Reports</h3>
            <p className="text-3xl font-bold dark:text-white">{stats.totalReports}</p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Average Rating</h3>
            <p className="text-3xl font-bold dark:text-white">{stats.averageRating.toFixed(1)}</p>
            <div className="flex mt-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <svg
                  key={star}
                  className={`w-5 h-5 ${
                    star <= Math.round(stats.averageRating)
                      ? 'text-yellow-400'
                      : 'text-gray-300 dark:text-gray-600'
                  }`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Vector Search Usage</h3>
            <p className="text-3xl font-bold dark:text-white">{(stats.vectorSearchPercentage * 100).toFixed(0)}%</p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Avg Generation Time</h3>
            <p className="text-3xl font-bold dark:text-white">{(stats.averageGenerationTime / 1000).toFixed(1)}s</p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Clipboard Copy Rate</h3>
            <p className="text-3xl font-bold dark:text-white">{(stats.clipboardCopyRate * 100).toFixed(0)}%</p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Feedback Submission Rate</h3>
            <p className="text-3xl font-bold dark:text-white">{(stats.feedbackSubmissionRate * 100).toFixed(0)}%</p>
          </div>
        </div>
      )}
      
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <h2 className="text-lg font-medium p-4 border-b dark:border-gray-700 dark:text-white">Recent Feedback</h2>
        
        {feedback.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            No feedback data available yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Rating
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Vector Search
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Email Count
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Feedback
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {feedback.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {(() => {
                        try {
                          // Try parsing as timestamp (seconds)
                          const timestamp = typeof item.createdAt === 'number' 
                            ? item.createdAt * 1000 
                            : Number(item.createdAt) * 1000;
                          
                          const date = new Date(timestamp);
                          
                          // Check if date is valid before formatting
                          return !isNaN(date.getTime()) 
                            ? date.toLocaleDateString() 
                            : 'Date unknown';
                        } catch {
                          return 'Date unknown';
                        }
                      })()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {item.clientName || 'Unknown'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {item.rating ? (
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <svg
                              key={star}
                              className={`w-4 h-4 ${
                                star <= item.rating!
                                  ? 'text-yellow-400'
                                  : 'text-gray-300 dark:text-gray-600'
                              }`}
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">Not rated</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      {item.vectorSearchUsed ? (
                        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full">
                          Yes
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 rounded-full">
                          No
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {item.emailCount}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {item.actionsTaken.length > 0 ? (
                        <span className="text-xs">
                          {item.actionsTaken.slice(0, 2).join(', ')}
                          {item.actionsTaken.length > 2 && '...'}
                        </span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                      {item.feedbackText || <span className="text-gray-400 dark:text-gray-500">No comment</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}