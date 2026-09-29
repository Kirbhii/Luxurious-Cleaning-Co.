// ─── Validation Utilities ────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ─── Email Validation ─────────────────────────────────────────────────────────

/**
 * Validate email format using RFC 5322 standard
 */
export function validateEmail(email: string): ValidationResult {
  const errors: string[] = [];
  
  if (!email || email.trim() === '') {
    errors.push('Email is required');
    return { valid: false, errors };
  }

  const trimmedEmail = email.trim();

  // Basic format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    errors.push('Invalid email format');
    return { valid: false, errors };
  }

  // Length check
  if (trimmedEmail.length > 254) {
    errors.push('Email is too long (maximum 254 characters)');
  }

  // Check for valid characters
  const validEmailRegex = /^[a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!validEmailRegex.test(trimmedEmail)) {
    errors.push('Email contains invalid characters');
  }

  // Check for consecutive dots
  if (trimmedEmail.includes('..')) {
    errors.push('Email cannot contain consecutive dots');
  }

  // Check for starting/ending dots in local part
  const [localPart] = trimmedEmail.split('@');
  if (localPart.startsWith('.') || localPart.endsWith('.')) {
    errors.push('Email local part cannot start or end with a dot');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ─── Phone Number Validation ──────────────────────────────────────────────────

/**
 * Validate phone number - supports multiple formats
 * Examples: 0919 002 4136, +63 919 002 4136, (02) 8556-0100
 */
export function validatePhone(phone: string, required = false): ValidationResult {
  const errors: string[] = [];

  if (!phone || phone.trim() === '') {
    if (required) {
      errors.push('Phone number is required');
    }
    return { valid: !required, errors };
  }

  const trimmedPhone = phone.trim();

  // Remove common formatting characters
  const digitsOnly = trimmedPhone.replace(/[\s\-\.\(\)\+]/g, '');

  // Check if it contains only digits (and possibly leading +)
  if (!/^\+?\d+$/.test(digitsOnly)) {
    errors.push('Phone number can only contain digits and formatting characters (+, -, ., (), spaces)');
  }

  // Length check (10-15 digits is standard for international numbers)
  const numDigits = digitsOnly.replace('+', '').length;
  if (numDigits < 10) {
    errors.push('Phone number is too short (minimum 10 digits)');
  }
  if (numDigits > 15) {
    errors.push('Phone number is too long (maximum 15 digits)');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Format phone number to standard format: 0919 002 4136 or +63 919 002 4136
 */
export function formatPhone(phone: string): string {
  const digitsOnly = phone.replace(/\D/g, '');
  
  // Philippine mobile format (11 digits starting with 09): 0919 002 4136
  if (digitsOnly.length === 11 && digitsOnly.startsWith('09')) {
    return `${digitsOnly.slice(0, 4)} ${digitsOnly.slice(4, 7)} ${digitsOnly.slice(7)}`;
  }

  // Philippine international format (12 digits starting with 63): +63 919 002 4136
  if (digitsOnly.length === 12 && digitsOnly.startsWith('63')) {
    return `+${digitsOnly.slice(0, 2)} ${digitsOnly.slice(2, 5)} ${digitsOnly.slice(5, 8)} ${digitsOnly.slice(8)}`;
  }

  // North American format (10 digits)
  if (digitsOnly.length === 10) {
    return `+1 ${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
  }
  
  // International with country code (11+ digits)
  if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    return `+${digitsOnly.slice(0, 1)} ${digitsOnly.slice(1, 4)}-${digitsOnly.slice(4, 7)}-${digitsOnly.slice(7)}`;
  }

  // Return as-is if format is unknown
  return phone;
}

// ─── Name Validation ──────────────────────────────────────────────────────────

/**
 * Validate full name
 */
export function validateName(name: string, fieldName = 'Name'): ValidationResult {
  const errors: string[] = [];

  if (!name || name.trim() === '') {
    errors.push(`${fieldName} is required`);
    return { valid: false, errors };
  }

  const trimmedName = name.trim();

  // Length check
  if (trimmedName.length < 2) {
    errors.push(`${fieldName} must be at least 2 characters`);
  }
  if (trimmedName.length > 100) {
    errors.push(`${fieldName} is too long (maximum 100 characters)`);
  }

  // Check for valid characters (letters, spaces, hyphens, apostrophes)
  const nameRegex = /^[a-zA-Z\s\-'\.]+$/;
  if (!nameRegex.test(trimmedName)) {
    errors.push(`${fieldName} can only contain letters, spaces, hyphens, apostrophes, and periods`);
  }

  // Check for at least one letter
  if (!/[a-zA-Z]/.test(trimmedName)) {
    errors.push(`${fieldName} must contain at least one letter`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ─── Password Validation ──────────────────────────────────────────────────────

/**
 * Validate password strength
 */
export function validatePassword(password: string): ValidationResult {
  const errors: string[] = [];

  if (!password) {
    errors.push('Password is required');
    return { valid: false, errors };
  }

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/~`]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ─── PIN Validation ───────────────────────────────────────────────────────────

/**
 * Validate PIN (4-6 digits)
 */
export function validatePin(pin: string): ValidationResult {
  const errors: string[] = [];

  if (!pin) {
    errors.push('PIN is required');
    return { valid: false, errors };
  }

  if (!/^\d+$/.test(pin)) {
    errors.push('PIN must contain only digits');
  }

  if (pin.length < 4 || pin.length > 6) {
    errors.push('PIN must be 4-6 digits');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ─── URL Validation ───────────────────────────────────────────────────────────

/**
 * Validate URL format
 */
export function validateUrl(url: string, required = false): ValidationResult {
  const errors: string[] = [];

  if (!url || url.trim() === '') {
    if (required) {
      errors.push('URL is required');
    }
    return { valid: !required, errors };
  }

  try {
    const urlObj = new URL(url);
    
    // Check for valid protocol
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      errors.push('URL must use http or https protocol');
    }
  } catch {
    errors.push('Invalid URL format');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ─── Number Validation ────────────────────────────────────────────────────────

/**
 * Validate numeric input
 */
export function validateNumber(
  value: string | number,
  options: {
    fieldName?: string;
    required?: boolean;
    min?: number;
    max?: number;
    integer?: boolean;
  } = {}
): ValidationResult {
  const {
    fieldName = 'Value',
    required = false,
    min,
    max,
    integer = false,
  } = options;

  const errors: string[] = [];

  if (value === '' || value === null || value === undefined) {
    if (required) {
      errors.push(`${fieldName} is required`);
    }
    return { valid: !required, errors };
  }

  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(numValue)) {
    errors.push(`${fieldName} must be a valid number`);
    return { valid: false, errors };
  }

  if (integer && !Number.isInteger(numValue)) {
    errors.push(`${fieldName} must be a whole number`);
  }

  if (min !== undefined && numValue < min) {
    errors.push(`${fieldName} must be at least ${min}`);
  }

  if (max !== undefined && numValue > max) {
    errors.push(`${fieldName} must be at most ${max}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ─── Date Validation ──────────────────────────────────────────────────────────

/**
 * Validate date input
 */
export function validateDate(
  dateStr: string,
  options: {
    fieldName?: string;
    required?: boolean;
    minDate?: Date;
    maxDate?: Date;
    futureOnly?: boolean;
    pastOnly?: boolean;
  } = {}
): ValidationResult {
  const {
    fieldName = 'Date',
    required = false,
    minDate,
    maxDate,
    futureOnly = false,
    pastOnly = false,
  } = options;

  const errors: string[] = [];

  if (!dateStr || dateStr.trim() === '') {
    if (required) {
      errors.push(`${fieldName} is required`);
    }
    return { valid: !required, errors };
  }

  const date = new Date(dateStr);

  if (isNaN(date.getTime())) {
    errors.push(`${fieldName} is not a valid date`);
    return { valid: false, errors };
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (futureOnly && date < now) {
    errors.push(`${fieldName} must be in the future`);
  }

  if (pastOnly && date > now) {
    errors.push(`${fieldName} must be in the past`);
  }

  if (minDate && date < minDate) {
    errors.push(`${fieldName} must be on or after ${minDate.toLocaleDateString()}`);
  }

  if (maxDate && date > maxDate) {
    errors.push(`${fieldName} must be on or before ${maxDate.toLocaleDateString()}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ─── Address Validation ───────────────────────────────────────────────────────

/**
 * Validate address field
 */
export function validateAddress(address: string, required = true): ValidationResult {
  const errors: string[] = [];

  if (!address || address.trim() === '') {
    if (required) {
      errors.push('Address is required');
    }
    return { valid: !required, errors };
  }

  const trimmedAddress = address.trim();

  if (trimmedAddress.length < 5) {
    errors.push('Address is too short (minimum 5 characters)');
  }

  if (trimmedAddress.length > 200) {
    errors.push('Address is too long (maximum 200 characters)');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ─── Postal / ZIP Code Validation (Philippines) ───────────────────────────────────────

/**
 * Validate Philippine ZIP code
 * Format: 4 digits (e.g. 1500 for San Juan City)
 */
export function validatePostalCode(postalCode: string, required = false): ValidationResult {
  const errors: string[] = [];

  if (!postalCode || postalCode.trim() === '') {
    if (required) {
      errors.push('ZIP code is required');
    }
    return { valid: !required, errors };
  }

  const trimmed = postalCode.trim();
  const zipRegex = /^\d{4}$/;

  if (!zipRegex.test(trimmed)) {
    errors.push('Invalid ZIP code format (expected: 4 digits, e.g. 1500)');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Format ZIP code to standard format: 1500
 */
export function formatPostalCode(postalCode: string): string {
  const cleaned = postalCode.replace(/\D/g, '');
  if (cleaned.length === 4) {
    return cleaned;
  }
  return postalCode;
}

// ─── Multiple Field Validation ────────────────────────────────────────────────

/**
 * Validate multiple fields at once
 */
export function validateFields(
  validations: Array<{ validate: () => ValidationResult; fieldName: string }>
): { valid: boolean; errors: Record<string, string[]> } {
  const errors: Record<string, string[]> = {};
  let allValid = true;

  for (const { validate, fieldName } of validations) {
    const result = validate();
    if (!result.valid) {
      errors[fieldName] = result.errors;
      allValid = false;
    }
  }

  return {
    valid: allValid,
    errors,
  };
}
