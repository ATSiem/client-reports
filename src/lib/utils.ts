import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// Conditional import for child_process to make it work in browser and Node.js
let execSync: Function | null = null;
try {
  if (typeof window === 'undefined') {
    // Only import in server context
    const childProcess = require('child_process');
    execSync = childProcess.execSync;
  }
} catch (error) {
  // Module not available or error importing
  console.warn('child_process module not available');
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generates a version identifier with commit hash and EST timestamp
 * Format: commit XXXXXX - YYYY-MM-DD HH:MM
 */
export function generateVersionToken(): string {
  try {
    // Only attempt git operations if execSync is available
    if (execSync) {
      // Get the git commit hash (short version)
      const commitHash = execSync('git rev-parse --short HEAD').toString().trim();
      
      // Get current date in EST timezone
      const now = new Date();
      const estOptions: Intl.DateTimeFormatOptions = {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      };
      
      const estFormatter = new Intl.DateTimeFormat('en-US', estOptions);
      const formattedDate = estFormatter.format(now)
        .replace(',', '')
        .replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$1-$2');
      
      return `commit ${commitHash} - ${formattedDate}`;
    }
    throw new Error('execSync not available');
  } catch (error) {
    // Fallback in case git command fails or we're not in a git repo
    const now = new Date();
    const estOptions: Intl.DateTimeFormatOptions = {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    };
    
    const estFormatter = new Intl.DateTimeFormat('en-US', estOptions);
    const formattedDate = estFormatter.format(now)
      .replace(',', '')
      .replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$1-$2');
    
    return `build ${formattedDate}`;
  }
}
