const pool = require('../db');

class OtpRepository {
  async createOtp({ email, otpHash, purpose, expiresAt, maxAttempts = 5 }) {
    const query = `
      INSERT INTO email_otps (email, otp_hash, purpose, expires_at, max_attempts)
      VALUES (LOWER($1), $2, $3, $4, $5)
      RETURNING id, email, purpose, expires_at, attempts_count, max_attempts, is_used, created_at;
    `;
    const result = await pool.query(query, [
      email.trim(),
      otpHash,
      purpose,
      expiresAt,
      maxAttempts,
    ]);
    return result.rows[0];
  }

  async findLatestActiveOtp({ email, purpose }) {
    const query = `
      SELECT id, email, otp_hash, purpose, expires_at, attempts_count, max_attempts, is_used, created_at
      FROM email_otps
      WHERE LOWER(email) = LOWER($1)
        AND purpose = $2
        AND is_used = FALSE
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1;
    `;
    const result = await pool.query(query, [email.trim(), purpose]);
    return result.rows[0] || null;
  }

  async getLastOtpCreationTime({ email, purpose }) {
    const query = `
      SELECT created_at
      FROM email_otps
      WHERE LOWER(email) = LOWER($1)
        AND purpose = $2
      ORDER BY created_at DESC
      LIMIT 1;
    `;
    const result = await pool.query(query, [email.trim(), purpose]);
    return result.rows[0] ? new Date(result.rows[0].created_at) : null;
  }

  async incrementAttempts(otpId) {
    const query = `
      UPDATE email_otps
      SET attempts_count = attempts_count + 1
      WHERE id = $1
      RETURNING attempts_count, max_attempts;
    `;
    const result = await pool.query(query, [otpId]);
    return result.rows[0];
  }

  async markUsed(otpId) {
    const query = `
      UPDATE email_otps
      SET is_used = TRUE
      WHERE id = $1;
    `;
    await pool.query(query, [otpId]);
  }

  async invalidatePreviousOtps({ email, purpose }) {
    const query = `
      UPDATE email_otps
      SET is_used = TRUE
      WHERE LOWER(email) = LOWER($1)
        AND purpose = $2
        AND is_used = FALSE;
    `;
    await pool.query(query, [email.trim(), purpose]);
  }
}

module.exports = new OtpRepository();

