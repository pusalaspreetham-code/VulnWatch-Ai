const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

// Rate limiter for authentication actions: max 30 requests per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { message: 'Too many authentication attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limiter for OTP requesting/resending: max 10 requests per 15 minutes per IP
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many code requests. Please wait 15 minutes before requesting more codes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public authentication routes
router.post('/register', authLimiter, (req, res, next) => authController.register(req, res, next));
router.post('/verify-registration-otp', authLimiter, (req, res, next) => authController.verifyRegistration(req, res, next));
router.post('/login', authLimiter, (req, res, next) => authController.login(req, res, next));
router.post('/forgot-password/request-otp', otpLimiter, (req, res, next) => authController.requestForgotPasswordOtp(req, res, next));
router.post('/forgot-password/reset', authLimiter, (req, res, next) => authController.resetPassword(req, res, next));
router.post('/resend-otp', otpLimiter, (req, res, next) => authController.resendOtp(req, res, next));

// Authenticated routes
router.post('/logout', authMiddleware, (req, res) => authController.logout(req, res));
router.get('/me', authMiddleware, (req, res, next) => authController.me(req, res, next));
router.post('/change-password/request-otp', authMiddleware, otpLimiter, (req, res, next) => authController.requestChangePasswordOtp(req, res, next));
router.post('/change-password/verify', authMiddleware, authLimiter, (req, res, next) => authController.changePassword(req, res, next));

module.exports = router;

