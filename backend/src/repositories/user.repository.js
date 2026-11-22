const pool = require('../db');

class UserRepository {
  async findByEmail(email) {
    const query = `
      SELECT id, email, password_hash, is_verified, created_at, updated_at
      FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1;
    `;
    const result = await pool.query(query, [email.trim()]);
    return result.rows[0] || null;
  }

  async findById(id) {
    const query = `
      SELECT id, email, password_hash, is_verified, created_at, updated_at
      FROM users
      WHERE id = $1
      LIMIT 1;
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  async createUser({ email, passwordHash, isVerified = false }) {
    const query = `
      INSERT INTO users (email, password_hash, is_verified)
      VALUES ($1, $2, $3)
      RETURNING id, email, is_verified, created_at, updated_at;
    `;
    const result = await pool.query(query, [email.trim().toLowerCase(), passwordHash, isVerified]);
    return result.rows[0];
  }

  async updatePassword(userId, passwordHash) {
    const query = `
      UPDATE users
      SET password_hash = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, email, is_verified, updated_at;
    `;
    const result = await pool.query(query, [passwordHash, userId]);
    return result.rows[0];
  }

  async updateVerifiedStatus(userId, isVerified = true) {
    const query = `
      UPDATE users
      SET is_verified = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, email, is_verified, updated_at;
    `;
    const result = await pool.query(query, [isVerified, userId]);
    return result.rows[0];
  }

  async upsertUnverifiedUser({ email, passwordHash }) {
    const existing = await this.findByEmail(email);
    if (existing) {
      if (existing.is_verified) {
        return { user: existing, alreadyVerified: true };
      }
      // Update password hash for existing unverified user
      const query = `
        UPDATE users
        SET password_hash = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id, email, is_verified, created_at, updated_at;
      `;
      const result = await pool.query(query, [passwordHash, existing.id]);
      return { user: result.rows[0], alreadyVerified: false };
    }

    const newUser = await this.createUser({ email, passwordHash, isVerified: false });
    return { user: newUser, alreadyVerified: false };
  }
}

module.exports = new UserRepository();

