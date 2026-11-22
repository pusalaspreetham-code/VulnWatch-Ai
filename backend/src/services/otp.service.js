const crypto = require('crypto');
const bcrypt = require('bcrypt');
const otpRepository = require('../repositories/otp.repository');

const OTP_EXPIRY_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_ATTEMPTS = 5;

class OtpService {
  // Generate a cryptographically secure 6-digit numeric OTP
  generateOtpCode() {
    return crypto.randomInt(100000, 1000000).toString();
  }

  // Check if user is within the 60-second cooldown window
  async checkCooldown({ email, purpose }) {
    const lastCreatedAt = await otpRepository.getLastOtpCreationTime({ email, purpose });
    if (!lastCreatedAt) return { allowed: true };

    const elapsedSeconds = Math.floor((Date.now() - lastCreatedAt.getTime()) / 1000);
    if (elapsedSeconds < RESEND_COOLDOWN_SECONDS) {
      const remainingSeconds = RESEND_COOLDOWN_SECONDS - elapsedSeconds;
      return {
        allowed: false,
        remainingSeconds,
      };
    }

    return { allowed: true };
  }

  // Invalidate old OTPs, generate new OTP, hash it with bcrypt, and save
  async generateAndSaveOtp({ email, purpose }) {
    // 1. Check resend cooldown
    const cooldown = await this.checkCooldown({ email, purpose });
    if (!cooldown.allowed) {
      const error = new Error(`Please wait ${cooldown.remainingSeconds} seconds before requesting a new code.`);
      error.statusCode = 429;
      throw error;
    }

    // 2. Invalidate any existing unused OTPs for this email and purpose
    await otpRepository.invalidatePreviousOtps({ email, purpose });

    // 3. Generate 6-digit plain OTP
    const plainOtp = this.generateOtpCode();

    // 4. Hash the OTP with bcrypt (salt rounds = 10)
    const otpHash = await bcrypt.hash(plainOtp, 10);

    // 5. Expiry timestamp
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // 6. Save in DB
    await otpRepository.createOtp({
      email,
      otpHash,
      purpose,
      expiresAt,
      maxAttempts: MAX_ATTEMPTS,
    });

    return plainOtp;
  }

  // Verify submitted OTP
  async verifyOtp({ email, purpose, plainOtp }) {
    if (!plainOtp || !/^\d{6}$/.test(plainOtp.trim())) {
      const error = new Error('Verification code must be exactly 6 digits.');
      error.statusCode = 400;
      throw error;
    }

    const activeOtp = await otpRepository.findLatestActiveOtp({ email, purpose });

    if (!activeOtp) {
      const error = new Error('Invalid or expired verification code. Please request a new one.');
      error.statusCode = 400;
      throw error;
    }

    // Check if max attempts reached
    if (activeOtp.attempts_count >= activeOtp.max_attempts) {
      await otpRepository.markUsed(activeOtp.id); // Invalidate completely
      const error = new Error('Too many invalid attempts. This code is no longer valid. Please request a new code.');
      error.statusCode = 429;
      throw error;
    }

    // Compare with bcrypt
    const isMatch = await bcrypt.compare(plainOtp.trim(), activeOtp.otp_hash);

    if (!isMatch) {
      const updated = await otpRepository.incrementAttempts(activeOtp.id);
      const remaining = activeOtp.max_attempts - updated.attempts_count;

      if (remaining <= 0) {
        await otpRepository.markUsed(activeOtp.id);
        const error = new Error('Too many invalid attempts. This code is no longer valid. Please request a new code.');
        error.statusCode = 429;
        throw error;
      }

      const error = new Error(`Invalid code. You have ${remaining} attempt(s) remaining.`);
      error.statusCode = 400;
      throw error;
    }

    // Mark as consumed
    await otpRepository.markUsed(activeOtp.id);
    return { success: true };
  }
}

module.exports = new OtpService();

