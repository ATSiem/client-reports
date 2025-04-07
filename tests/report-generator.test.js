/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ReportGenerator } from '../src/app/reports/components/report-generator';
import { getUserAccessToken } from '../src/lib/auth/microsoft';
import { AuthProvider } from '../src/components/auth-provider';

// Mock user access token
jest.mock('../src/lib/auth/microsoft', () => ({
  getUserAccessToken: jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn();

describe('ReportGenerator Component', () => {
  beforeEach(() => {
    // Setup mocks
    getUserAccessToken.mockReturnValue('mock-token');
    
    // Mock successful API responses
    global.fetch.mockImplementation((url) => {
      if (url.includes('/api/clients')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            clients: [
              { id: 'client1', name: 'Test Client', emails: ['test@example.com'] }
            ]
          })
        });
      }
      
      if (url.includes('/api/templates')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            templates: [
              { id: 'template1', name: 'Custom Template', format: '# Test Format' }
            ]
          })
        });
      }
      
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      });
    });
  });
  
  afterEach(() => {
    jest.resetAllMocks();
  });
  
  test('Default template should be treated as a valid selection', async () => {
    // Render the component wrapped in AuthProvider
    render(
      <AuthProvider>
        <ReportGenerator />
      </AuthProvider>
    );
    
    // Wait for component to load
    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });
    
    // Select a client
    const clientSelect = screen.getByLabelText(/Client/i);
    fireEvent.change(clientSelect, { target: { value: 'client1' } });
    
    // Default template should already be selected (empty value)
    const templateSelect = screen.getByLabelText(/Template/i);
    expect(templateSelect.value).toBe('');
    
    // Set date range
    const startDateInput = screen.getByLabelText(/Start Date/i);
    const endDateInput = screen.getByLabelText(/End Date/i);
    
    fireEvent.change(startDateInput, { target: { value: '2023-01-01' } });
    fireEvent.change(endDateInput, { target: { value: '2023-01-31' } });
    
    // Submit the form
    const submitButton = screen.getByText(/Process Emails & Generate Report|Generate Report/i);
    fireEvent.click(submitButton);
    
    // Verify no error about template selection is shown
    await waitFor(() => {
      const errorMessages = screen.queryByText('Please select a template');
      expect(errorMessages).not.toBeInTheDocument();
    });
    
    // Check that the API was called with the correct parameters
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/system/process-emails'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('client1')
      })
    );
  });
}); 