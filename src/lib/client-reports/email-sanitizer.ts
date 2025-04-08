import { getUserEmailSync } from "~/lib/auth/microsoft";

/**
 * Utility for sanitizing email content and filtering sensitive information
 */

// List of keywords that might indicate service emails
const SERVICE_EMAIL_KEYWORDS = [
  'noreply',
  'no-reply',
  'donotreply',
  'do-not-reply',
  'automated',
  'system',
  'notification',
  'support',
  'update',
  'security',
];

// List of model names that should be filtered out
const MODEL_NAMES = [
  'gpt-3.5-turbo',
  'gpt-3.5-turbo-0125',
  'gpt-3.5-turbo-0613',
  'gpt-3.5-turbo-16k',
  'gpt-3.5-turbo-16k-0613',
  'gpt-4',
  'gpt-4-0125',
  'gpt-4-0613',
  'gpt-4-32k',
  'gpt-4-turbo',
  'gpt-4o',
  'gpt-4o-mini',
  'text-embedding-3-small',
  'text-embedding-3-large',
  'claude',
  'claude-instant',
  'claude-2',
];

// Patterns for identifying technical content not relevant to clients
const TECHNICAL_SUBJECT_PATTERNS = [
  /\bupcoming\s+update\b/i,
  /\bmodel\s+chang(e|ing)\b/i,
  /\bversion\s+update\b/i,
  /\brelease\s+notes\b/i,
  /\bupgrad(e|ing)\b/i,
  /\bmigrat(e|ion|ing)\b/i,
  /\bGPT-.*turbo\b/i,
  /\bGPT-[0-9]+\b/i,
  /\bapi\s+key\b/i,
  /\bsdk\b/i,
  /\blibrary\s+update\b/i,
  /\bupdate.*(api|model|token|feature)/i,
  /\bdeprecation\s+notice\b/i,
  /\bproduct\s+announcement\b/i,
  /\bterms\s+of\s+service\b/i,
  /\bprivacy\s+policy\b/i,
  /\bsecurity\s+update\b/i,
  /\bmaintenance\s+notice\b/i,
  /\bdeveloper\b/i
];

/**
 * Check if an email is from a service or contains non-client-relevant technical content
 * @param subject The email subject
 * @param fromEmail The sender email address
 * @param body Optional email body for more thorough content analysis
 * @returns Whether this appears to be a service or technical email
 */
export function isServiceOrTechnicalEmail(subject: string = '', fromEmail: string = '', body: string = ''): boolean {
  // 1. Check if it contains service/noreply keywords in the from address
  if (SERVICE_EMAIL_KEYWORDS.some(keyword => fromEmail.toLowerCase().includes(keyword.toLowerCase()))) {
    return true;
  }
  
  // 2. Check the subject for technical patterns
  if (TECHNICAL_SUBJECT_PATTERNS.some(pattern => pattern.test(subject))) {
    return true;
  }
  
  // 3. Check if the subject contains any model names
  if (MODEL_NAMES.some(model => 
    subject.toLowerCase().includes(model.toLowerCase()))) {
    return true;
  }
  
  // 4. If we have the body, do deeper content analysis
  if (body) {
    // Look for model name mentions with versions/dates
    const modelVersionPattern = /\bgpt-[0-9.]+-(turbo|0125|0613|16k|32k)\b/i;
    if (modelVersionPattern.test(body)) {
      return true;
    }
    
    // Look for API/technical content
    const technicalBodyPatterns = [
      /\bapi\s+key\b/i,
      /\btoken\s+limit\b/i,
      /\bcontext\s+window\b/i,
      /\bmodel\s+updat(e|ing)\b/i,
      /we('re|'ll|'ve|'d|\s+are|\s+will|\s+have|\s+would)\s+(upgrad|chang|migrat|updat|deprecat|releas)/i,
      /\baccess\s+your\s+account\b/i,
      /\blogin\s+credential\b/i,
      /\bpassword\s+(reset|change)\b/i
    ];
    
    if (technicalBodyPatterns.some(pattern => pattern.test(body))) {
      return true;
    }
    
    // Count model name mentions - if there are several, it's likely technical
    let modelMentionCount = 0;
    for (const model of MODEL_NAMES) {
      const regex = new RegExp(`\\b${model}\\b`, 'gi');
      const matches = body.match(regex);
      if (matches) {
        modelMentionCount += matches.length;
      }
    }
    
    if (modelMentionCount > 2) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if this email should be sanitized for privacy
 * @param emailData The email data to check
 * @param clientEmails Array of client email addresses
 * @param clientDomains Array of client domains
 * @returns Whether this email should be sanitized
 */
export function shouldSanitizeEmail(
  emailData: {
    from: string;
    to: string;
    cc?: string;
    subject?: string;
    body?: string;
  },
  clientEmails: string[] = [],
  clientDomains: string[] = []
): boolean {
  const { from, to, cc = '', subject = '', body = '' } = emailData;
  
  // Get current user email using the synchronous function
  const userEmail = getUserEmailSync();
  
  // Split recipients
  const toAddresses = to.split(',').map(addr => addr.trim());
  const ccAddresses = cc.split(',').map(addr => addr.trim());
  const allRecipients = [...toAddresses, ...ccAddresses];
  
  // Check if any recipients match client emails or domains
  const hasClientRecipient = allRecipients.some(addr => 
    clientEmails.includes(addr) || 
    clientDomains.some(domain => addr.endsWith(`@${domain}`))
  );
  
  // Check if the email is from a service/system
  const isTechnicalEmail = isServiceOrTechnicalEmail(subject, from, body);
  
  // Check if the email is specifically addressed to the user only
  const isAddressedToUserOnly = userEmail && 
    allRecipients.some(addr => addr === userEmail) && 
    !hasClientRecipient;
  
  // Sanitize if it's a service email or addressed only to the user (and not the client)
  return isTechnicalEmail || isAddressedToUserOnly;
}

/**
 * Sanitize email content to remove sensitive information
 * @param text Any text that may contain sensitive information
 * @returns Sanitized text with model names and sensitive info removed
 */
export function sanitizeContent(text: string): string {
  if (!text) return text;
  
  let sanitized = text;
  
  // Replace model names with [AI MODEL]
  for (const model of MODEL_NAMES) {
    // Use regex with word boundaries to avoid matching partial words
    const regex = new RegExp(`\\b${model}\\b`, 'gi');
    sanitized = sanitized.replace(regex, '[AI MODEL]');
  }
  
  // Replace model version patterns
  const modelVersionPattern = /\bgpt-[0-9.]+-(turbo|0125|0613|16k|32k)\b/gi;
  sanitized = sanitized.replace(modelVersionPattern, '[AI MODEL]');
  
  // Replace specific dates that might be in model announcements
  const datePattern = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(st|nd|rd|th)?(,?\s+\d{4})?\b/gi;
  sanitized = sanitized.replace(datePattern, match => {
    // Only replace if it looks like it might be in a technical context
    const lowerContext = sanitized.toLowerCase();
    const isInTechnicalContext = 
      lowerContext.includes('update') || 
      lowerContext.includes('model') || 
      lowerContext.includes('release') || 
      lowerContext.includes('version');
    
    return isInTechnicalContext ? '[DATE]' : match;
  });
  
  return sanitized;
}

/**
 * Sanitize a report to remove any sensitive information before sending to client
 * @param report The generated report text
 * @param clientName The client's name
 * @param clientDomains Array of client domains
 * @returns Sanitized report
 */
export function sanitizeReport(report: string, clientName?: string, clientDomains: string[] = []): string {
  if (!report) return report;
  
  let sanitized = report;
  
  // Replace model names with generic term
  for (const model of MODEL_NAMES) {
    // Use regex with word boundaries to avoid matching partial words
    const regex = new RegExp(`\\b${model}\\b`, 'gi');
    sanitized = sanitized.replace(regex, '[AI MODEL]');
  }
  
  // Remove references to specific model versions with dates
  const modelVersionPattern = /\bgpt-[0-9.]+-(turbo|0125|0613|16k|32k)\b/gi;
  sanitized = sanitized.replace(modelVersionPattern, '[AI MODEL]');
  
  // Remove mentions of specific version updates/changes
  const versionUpdatePatterns = [
    /\b(version|model).*?(chang|updat|upgrad|switch|migrat|releas|replac|deprecat|improv).*?(?:on|by|to).*?(May|Jun|Jul|August|September|October|November|December|January|February|March|April).*?\d{1,2}(st|nd|rd|th)?/gi,
    /\b(start|begin|commenc).*?(May|Jun|Jul|August|September|October|November|December|January|February|March|April).*?\d{1,2}(st|nd|rd|th)?/gi,
    /\b(test|explor|us|try).*?(?:before|prior|advance|ahead).*?(May|Jun|Jul|August|September|October|November|December|January|February|March|April).*?\d{1,2}(st|nd|rd|th)?/gi,
    /\b(after|on|by|starting).*?(May|Jun|Jul|August|September|October|November|December|January|February|March|April).*?\d{1,2}(st|nd|rd|th)?.*?(?:no longer|won't|will not|cannot).*?(?:be|accessible|available)/gi,
    // Specific phrases
    /\b(upcoming|approaching|pending|planned|scheduled|imminent).*?(?:change|update|release|migration)/gi
  ];
  
  // Apply each pattern
  for (const pattern of versionUpdatePatterns) {
    sanitized = sanitized.replace(pattern, '[UNRELATED TECHNICAL UPDATE]');
  }
  
  // Remove references to model updates and announcements
  const modelUpdatePatterns = [
    // Generic update mentions
    /\bupdate to (our|the) (latest|newest|version|model|system)/gi,
    /\b(we('ll| will)|we have|starting|beginning|effective|we are) (updated?|switching|migrating|changed?|replaced?)/gi,
    // Specific mentions of version upgrades
    /\b(current|existing|previous) (model|version).*?(point|direct|update|upgrad|chang)/gi,
    /\bhas (already)? been (deprecat|sunset|retir)/gi,
    // Transition language
    /\b(ensure|maintain|guarantee) (a )?smooth transition/gi,
    /\bto (ensure|facilitate|enable) (a )?smooth/gi,
    /\bwe encourage you to test/gi,
    /\byou may (also )?(want to|wish to) (explore|try|test)/gi,
    // Contact requests
    /\breaching out/gi,
    /\bany questions about/gi,
    /\bfeel free to (reach|contact)/gi,
  ];
  
  // Apply each pattern
  for (const pattern of modelUpdatePatterns) {
    sanitized = sanitized.replace(pattern, '[UNRELATED INFORMATION]');
  }
  
  // Remove technical jargon related to models
  const technicalTerms = [
    'context window',
    'token limit',
    'token budget',
    'tokens',
    'prompt',
    'temperature',
    'embedding',
    'vector',
    'semantic search',
    'API key',
    'rate limit',
    'throttling',
    'model endpoint',
    'inference',
    'fine-tune',
    'fine-tuning',
    'developer forum',
    'model migration'
  ];
  
  for (const term of technicalTerms) {
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    sanitized = sanitized.replace(regex, '[TECHNICAL TERM]');
  }
  
  // Remove email addresses not related to client
  if (clientDomains.length > 0) {
    // Match email-like patterns
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    sanitized = sanitized.replace(emailPattern, (match) => {
      // Keep only email addresses from client domains
      const isClientEmail = clientDomains.some(domain => 
        match.endsWith(`@${domain}`) || 
        match.includes(`@${domain}.`)
      );
      return isClientEmail ? match : '[PRIVATE EMAIL]';
    });
  }
  
  // Remove specific announcement-like bullet points
  const bulletPointPattern = /[-•*]\s*(Test|Upgrade|Update|Migrate|Use|Try|Switch|Upcoming|Release|Change|Starting|Beginning).*?(model|gpt|turbo|version).*?(\.|$)/gi;
  sanitized = sanitized.replace(bulletPointPattern, '- [UNRELATED TECHNICAL INFORMATION]');
  
  // Final check for key sensitive phrases
  sanitized = sanitized
    .replace(/May 5th/gi, '[DATE]')
    .replace(/May 5/gi, '[DATE]')
    .replace(/turbo-16k/gi, '[MODEL]')
    .replace(/\bturbo\b/gi, '[MODEL]')
    .replace(/\b\d{4}\b-\b\d{2}\b-\b\d{2}\b/g, '[DATE]')  // Date format YYYY-MM-DD
    .replace(/OpenAI Developer Forum/gi, '[TECHNICAL RESOURCE]')
    .replace(/OpenAI Team/gi, '[ORGANIZATION]');
    
  return sanitized;
} 