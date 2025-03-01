'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '~/components/auth-provider';
import { LoginButton } from '~/components/login-button';
import { ClientForm } from './components/client-form';
import { ReportGenerator } from './components/report-generator';
import { ClientList } from './components/client-list';
import { TemplateList } from './components/template-list';
import Link from 'next/link';
import { Moon, Sun } from 'lucide-react';

export function ClientPage() {
  const [activeView, setActiveView] = useState('clients'); // 'clients', 'templates', 'generate'
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  
  const { isAuthenticated, isLoading: authLoading, user, logout } = useAuth();
  
  // Set up dark mode with system preference as default
  useEffect(() => {
    // Check if user preference is stored
    const savedMode = localStorage.getItem('darkMode');
    
    if (savedMode !== null) {
      // Use saved preference if available
      setDarkMode(savedMode === 'true');
    } else {
      // Otherwise check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setDarkMode(prefersDark);
    }
  }, []);
  
  // Apply dark mode class to html element
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    // Save preference to localStorage
    localStorage.setItem('darkMode', darkMode.toString());
  }, [darkMode]);

  return (
    <div className="mx-auto mt-10 max-w-screen-lg">
      <div className="mb-6 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Client Reports</h1>
        </div>
        <div className="flex items-center gap-4">
          {/* Dark mode toggle */}
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          
          {isAuthenticated && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {user?.name || user?.username || 'Signed in'}
              </span>
              <button
                onClick={logout}
                className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-sm"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
      
      {!isAuthenticated ? (
        <div className="bg-blue-50 dark:bg-blue-950 p-8 rounded-lg text-center">
          <h2 className="text-xl font-semibold mb-4 dark:text-white">Sign in to generate client reports</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            This feature requires you to authenticate with Microsoft to access your emails.
            Your data remains private and is only stored on your local device.
          </p>
          <div className="flex flex-col gap-4 items-center">
            <LoginButton />
          </div>
        </div>
      ) : (
        <>
          {/* Navigation tabs */}
          <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
            <nav className="flex space-x-4">
              <button
                onClick={() => setActiveView('clients')}
                className={`py-2 px-3 text-sm font-medium border-b-2 ${
                  activeView === 'clients'
                    ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                    : 'border-transparent text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                Clients
              </button>
              <button
                onClick={() => setActiveView('templates')}
                className={`py-2 px-3 text-sm font-medium border-b-2 ${
                  activeView === 'templates'
                    ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                    : 'border-transparent text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                Templates
              </button>
              <button
                onClick={() => setActiveView('generate')}
                className={`py-2 px-3 text-sm font-medium border-b-2 ${
                  activeView === 'generate'
                    ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                    : 'border-transparent text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                Generate Report
              </button>
            </nav>
          </div>
          
          {/* Main content area */}
          <div className="min-h-[500px]">
            {activeView === 'clients' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1">
                  <ClientForm 
                    onClientAdded={() => {
                      // Refresh the list when a client is added
                      const clientListEl = document.getElementById('client-list');
                      if (clientListEl && typeof (clientListEl as any).refreshClients === 'function') {
                        (clientListEl as any).refreshClients();
                      }
                    }} 
                  />
                </div>
                <div className="md:col-span-2">
                  <ClientList 
                    id="client-list"
                    onSelectClient={(clientId) => {
                      setSelectedClientId(clientId);
                      setActiveView('generate');
                    }} 
                  />
                </div>
              </div>
            )}
            
            {activeView === 'templates' && (
              <div className="grid grid-cols-1 gap-6">
                <TemplateList
                  onSelectTemplate={(templateId) => {
                    // Handle template selection
                    setActiveView('generate');
                  }}
                />
              </div>
            )}
            
            {activeView === 'generate' && (
              <ReportGenerator 
                initialClientId={selectedClientId}
                onReportGenerated={() => {
                  // Handle report generation success
                }}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}