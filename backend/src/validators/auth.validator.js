class AuthValidator {
  validateEmail(email) {
    if (!email || typeof email !== 'string') {
      return { valid: false, message: 'Email is required.' };
    }
    const trimmed = email.trim();
    // Standard RFC 5322 regex approximation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed) || trimmed.length > 255) {
      return { valid: false, message: 'Please provide a valid email address.' };
    }
    return { valid: true, value: trimmed.toLowerCase() };
  }

  validatePassword(password) {
    if (!password || typeof password !== 'string') {
      return { valid: false, message: 'Password is required.' };
    }
    if (password.length < 8) {
      return { valid: false, message: 'Password must be at least 8 characters long.' };
    }
    if (password.length > 128) {
      return { valid: false, message: 'Password must not exceed 128 characters.' };
    }
    // Must contain uppercase, lowercase, number, and special character
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasDigit = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);

    if (!hasUpper || !hasLower || !hasDigit || !hasSpecial) {
      return {
        valid: false,
        message: 'Password must include at least one uppercase letter, one lowercase letter, one number, and one special character.',
      };
    }
    return { valid: true, value: password };
  }

  validateOtp(otp) {
    if (!otp || typeof otp !== 'string' || !/^\d{6}$/.test(otp.trim())) {
      return { valid: false, message: 'Verification code must be a 6-digit number.' };
    }
    return { valid: true, value: otp.trim() };
  }
}

module.exports = new AuthValidator();

