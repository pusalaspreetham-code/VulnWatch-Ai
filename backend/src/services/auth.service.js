const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const userRepository = require('../repositories/user.repository');
const otpService = require('./otp.service');
const emailService = require('./email.service');
const authValidator = require('../validators/auth.validator');

const BCRYPT_SALT_ROUNDS = 12;

class AuthService {
  generateToken(user) {
    return jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
  }

  async register({ email, password }) {
    // 1. Validate inputs
    const emailValidation = authValidator.validateEmail(email);
    if (!emailValidation.valid) {
      const err = new Error(emailValidation.message);
      err.statusCode = 400;
      throw err;
    }

    const passwordValidation = authValidator.validatePassword(password);
    if (!passwordValidation.valid) {
      const err = new Error(passwordValidation.message);
      err.statusCode = 400;
      throw err;
    }

    const normalizedEmail = emailValidation.value;

    // 2. Hash password
    const passwordHash = await bcrypt.hash(passwordValidation.value, BCRYPT_SALT_ROUNDS);

    // 3. Check existing user & upsert unverified
    const { user, alreadyVerified } = await userRepository.upsertUnverifiedUser({
      email: normalizedEmail,
      passwordHash,
    });

    if (alreadyVerified) {
      const err = new Error('An account with this email is already registered. Please log in.');
      err.statusCode = 409;
      throw err;
    }

    // 4. Generate and email OTP
    const otp = await otpService.generateAndSaveOtp({
      email: normalizedEmail,
      purpose: 'REGISTER',
    });

    await emailService.sendOtpEmail({
      to: normalizedEmail,
      otp,
      purpose: 'REGISTER',
    });

    return {
      message: 'Registration initiated. Please check your email for the verification code.',
      email: normalizedEmail,
    };
  }

  async verifyRegistration({ email, otp }) {
    const emailValidation = authValidator.validateEmail(email);
    if (!emailValidation.valid) {
      const err = new Error(emailValidation.message);
      err.statusCode = 400;
      throw err;
    }

    const otpValidation = authValidator.validateOtp(otp);
    if (!otpValidation.valid) {
      const err = new Error(otpValidation.message);
      err.statusCode = 400;
      throw err;
    }

    const normalizedEmail = emailValidation.value;
    const user = await userRepository.findByEmail(normalizedEmail);

    if (!user) {
      const err = new Error('Registration record not found. Please register again.');
      err.statusCode = 404;
      throw err;
    }

    if (user.is_verified) {
      const err = new Error('Email is already verified. Please log in.');
      err.statusCode = 400;
      throw err;
    }

    // Verify OTP
    await otpService.verifyOtp({
      email: normalizedEmail,
      purpose: 'REGISTER',
      plainOtp: otpValidation.value,
    });

    // Mark user as verified
    await userRepository.updateVerifiedStatus(user.id, true);

    const token = this.generateToken(user);

    return {
      message: 'Email verified successfully. Welcome to VulnWatch AI!',
      user: { id: user.id, email: user.email },
      token,
    };
  }

  async login({ email, password }) {
    const emailValidation = authValidator.validateEmail(email);
    if (!emailValidation.valid) {
      const err = new Error('Invalid email or password.');
      err.statusCode = 401;
      throw err;
    }

    if (!password) {
      const err = new Error('Invalid email or password.');
      err.statusCode = 401;
      throw err;
    }

    const normalizedEmail = emailValidation.value;
    const user = await userRepository.findByEmail(normalizedEmail);

    // Generic error to prevent enumeration
    if (!user) {
      const err = new Error('Invalid email or password.');
      err.statusCode = 401;
      throw err;
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      const err = new Error('Invalid email or password.');
      err.statusCode = 401;
      throw err;
    }

    if (!user.is_verified) {
      const err = new Error('Please verify your email before logging in.');
      err.statusCode = 403;
      err.requiresVerification = true;
      err.email = user.email;
      throw err;
    }

    const token = this.generateToken(user);

    return {
      message: 'Login successful.',
      user: { id: user.id, email: user.email },
      token,
    };
  }

  async requestForgotPasswordOtp({ email }) {
    const emailValidation = authValidator.validateEmail(email);
    // Generic message response always to prevent user enumeration
    const genericResponse = {
      message: 'If an account exists with this email, a verification code has been sent.',
    };

    if (!emailValidation.valid) {
      return genericResponse;
    }

    const normalizedEmail = emailValidation.value;
    const user = await userRepository.findByEmail(normalizedEmail);

    if (!user || !user.is_verified) {
      return genericResponse;
    }

    try {
      const otp = await otpService.generateAndSaveOtp({
        email: normalizedEmail,
        purpose: 'FORGOT_PASSWORD',
      });

      await emailService.sendOtpEmail({
        to: normalizedEmail,
        otp,
        purpose: 'FORGOT_PASSWORD',
      });
    } catch (err) {
      if (err.statusCode === 429) {
        throw err; // Forward cooldown limits
      }
      console.error('[AUTH FORGOT PASSWORD ERROR]:', err);
    }

    return genericResponse;
  }

  async resetPassword({ email, otp, newPassword }) {
    const emailValidation = authValidator.validateEmail(email);
    if (!emailValidation.valid) {
      const err = new Error('Invalid email address.');
      err.statusCode = 400;
      throw err;
    }

    const otpValidation = authValidator.validateOtp(otp);
    if (!otpValidation.valid) {
      const err = new Error(otpValidation.message);
      err.statusCode = 400;
      throw err;
    }

    const passwordValidation = authValidator.validatePassword(newPassword);
    if (!passwordValidation.valid) {
      const err = new Error(passwordValidation.message);
      err.statusCode = 400;
      throw err;
    }

    const normalizedEmail = emailValidation.value;
    const user = await userRepository.findByEmail(normalizedEmail);

    if (!user) {
      const err = new Error('Invalid request.');
      err.statusCode = 400;
      throw err;
    }

    // Verify OTP
    await otpService.verifyOtp({
      email: normalizedEmail,
      purpose: 'FORGOT_PASSWORD',
      plainOtp: otpValidation.value,
    });

    // Hash new password and update
    const passwordHash = await bcrypt.hash(passwordValidation.value, BCRYPT_SALT_ROUNDS);
    await userRepository.updatePassword(user.id, passwordHash);

    return {
      message: 'Password reset successful. You can now log in with your new password.',
    };
  }

  async requestChangePasswordOtp({ userId }) {
    const user = await userRepository.findById(userId);
    if (!user) {
      const err = new Error('User not found.');
      err.statusCode = 404;
      throw err;
    }

    const otp = await otpService.generateAndSaveOtp({
      email: user.email,
      purpose: 'CHANGE_PASSWORD',
    });

    await emailService.sendOtpEmail({
      to: user.email,
      otp,
      purpose: 'CHANGE_PASSWORD',
    });

    return {
      message: 'Verification code sent to your registered email address.',
    };
  }

  async changePassword({ userId, currentPassword, newPassword, otp }) {
    const user = await userRepository.findById(userId);
    if (!user) {
      const err = new Error('User not found.');
      err.statusCode = 404;
      throw err;
    }

    if (!currentPassword) {
      const err = new Error('Current password is required.');
      err.statusCode = 400;
      throw err;
    }

    const passwordMatches = await bcrypt.compare(currentPassword, user.password_hash);
    if (!passwordMatches) {
      const err = new Error('Current password is incorrect.');
      err.statusCode = 400;
      throw err;
    }

    if (currentPassword === newPassword) {
      const err = new Error('New password cannot be identical to the current password.');
      err.statusCode = 400;
      throw err;
    }

    const passwordValidation = authValidator.validatePassword(newPassword);
    if (!passwordValidation.valid) {
      const err = new Error(passwordValidation.message);
      err.statusCode = 400;
      throw err;
    }

    const otpValidation = authValidator.validateOtp(otp);
    if (!otpValidation.valid) {
      const err = new Error(otpValidation.message);
      err.statusCode = 400;
      throw err;
    }

    // Verify OTP
    await otpService.verifyOtp({
      email: user.email,
      purpose: 'CHANGE_PASSWORD',
      plainOtp: otpValidation.value,
    });

    // Hash new password and update
    const passwordHash = await bcrypt.hash(passwordValidation.value, BCRYPT_SALT_ROUNDS);
    await userRepository.updatePassword(user.id, passwordHash);

    return {
      message: 'Your password has been changed successfully.',
    };
  }

  async resendOtp({ email, purpose, userId }) {
    let targetEmail = email;

    if (purpose === 'CHANGE_PASSWORD') {
      if (!userId) {
        const err = new Error('Authentication required.');
        err.statusCode = 401;
        throw err;
      }
      const user = await userRepository.findById(userId);
      if (!user) {
        const err = new Error('User not found.');
        err.statusCode = 404;
        throw err;
      }
      targetEmail = user.email;
    } else {
      const emailValidation = authValidator.validateEmail(email);
      if (!emailValidation.valid) {
        const err = new Error('Invalid email address.');
        err.statusCode = 400;
        throw err;
      }
      targetEmail = emailValidation.value;
    }

    const validPurposes = ['REGISTER', 'FORGOT_PASSWORD', 'CHANGE_PASSWORD'];
    if (!validPurposes.includes(purpose)) {
      const err = new Error('Invalid OTP purpose.');
      err.statusCode = 400;
      throw err;
    }

    if (purpose === 'FORGOT_PASSWORD') {
      return this.requestForgotPasswordOtp({ email: targetEmail });
    }

    const otp = await otpService.generateAndSaveOtp({
      email: targetEmail,
      purpose,
    });

    await emailService.sendOtpEmail({
      to: targetEmail,
      otp,
      purpose,
    });

    return {
      message: 'A new verification code has been sent to your email.',
    };
  }
}

module.exports = new AuthService();

