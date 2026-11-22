const authService = require('../services/auth.service');
const userRepository = require('../repositories/user.repository');

const COOKIE_NAME = 'token';
const getCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
});

class AuthController {
  async register(req, res, next) {
    try {
      const { email, password } = req.body;
      const result = await authService.register({ email, password });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  async verifyRegistration(req, res, next) {
    try {
      const { email, otp } = req.body;
      const result = await authService.verifyRegistration({ email, otp });
      res.cookie(COOKIE_NAME, result.token, getCookieOptions());
      res.status(200).json({
        message: result.message,
        user: result.user,
        token: result.token,
      });
    } catch (err) {
      next(err);
    }
  }

  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const result = await authService.login({ email, password });
      res.cookie(COOKIE_NAME, result.token, getCookieOptions());
      res.status(200).json({
        message: result.message,
        user: result.user,
        token: result.token,
      });
    } catch (err) {
      next(err);
    }
  }

  async logout(req, res) {
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
    res.status(200).json({ message: 'Logged out successfully.' });
  }

  async me(req, res, next) {
    try {
      const user = await userRepository.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found.' });
      }
      res.status(200).json({
        user: {
          id: user.id,
          email: user.email,
          is_verified: user.is_verified,
          created_at: user.created_at,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  async requestForgotPasswordOtp(req, res, next) {
    try {
      const { email } = req.body;
      const result = await authService.requestForgotPasswordOtp({ email });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async resetPassword(req, res, next) {
    try {
      const { email, otp, newPassword } = req.body;
      const result = await authService.resetPassword({ email, otp, newPassword });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async requestChangePasswordOtp(req, res, next) {
    try {
      const result = await authService.requestChangePasswordOtp({ userId: req.user.id });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword, otp } = req.body;
      const result = await authService.changePassword({
        userId: req.user.id,
        currentPassword,
        newPassword,
        otp,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async resendOtp(req, res, next) {
    try {
      const { email, purpose } = req.body;
      const userId = req.user ? req.user.id : null;
      const result = await authService.resendOtp({ email, purpose, userId });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AuthController();

