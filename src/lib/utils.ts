import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { execSync } from "child_process"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generates a version identifier with commit hash and EST timestamp
 * Format: commit XXXXXX - YYYY-MM-DD HH:MM
 */
export function generateVersionToken(): string {
  try {
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
  } catch (error) {
    // Fallback in case git command fails or we're not in a git repo
    return `build ${new Date().toISOString().split('T')[0]}`;
  }
}
