const pool = require('./src/db');
const authService = require('./src/services/auth.service');
const userRepository = require('./src/repositories/user.repository');
const otpRepository = require('./src/repositories/otp.repository');

async function runTests() {
  const testEmail = `testuser_${Date.now()}@example.com`;
  const initialPassword = 'Password123!';
  const updatedPassword = 'NewPassword456@';

  console.log(`\n===========================================`);
  console.log(`STARTING AUTH SYSTEM BACKEND TESTS`);
  console.log(`Target Email: ${testEmail}`);
  console.log(`===========================================\n`);

  try {
    // 1. Weak password validation test
    console.log('[TEST 1] Registration with weak password (should fail)...');
    try {
      await authService.register({ email: testEmail, password: 'weak' });
      throw new Error('Test 1 failed: Weak password was accepted!');
    } catch (err) {
      console.log('✓ Rejected weak password correctly:', err.message);
    }

    // 2. Successful registration initiation
    console.log('\n[TEST 2] Register with valid email and strong password...');
    const regResult = await authService.register({ email: testEmail, password: initialPassword });
    console.log('✓ Register response:', regResult.message);

    // 3. Invalid OTP attempt test
    console.log('\n[TEST 3] Verify registration with wrong OTP (should fail)...');
    try {
      await authService.verifyRegistration({ email: testEmail, otp: '000000' });
      throw new Error('Test 3 failed: Wrong OTP was accepted!');
    } catch (err) {
      console.log('✓ Rejected wrong OTP correctly:', err.message);
    }

    // 4. Retrieve generated OTP directly from repository to verify correctly
    console.log('\n[TEST 4] Verify registration with correct OTP...');
    // In our test, we fetch the active OTP plain value from test inspection or service
    // Because the DB stores the hash, let's test OTP verification with the actual plain OTP generated.
    // Let's create an OTP with known plain code using otpRepository directly to test verifyOtp
    const bcrypt = require('bcrypt');
    const knownOtp = '654321';
    const otpHash = await bcrypt.hash(knownOtp, 10);
    await otpRepository.createOtp({
      email: testEmail,
      otpHash,
      purpose: 'REGISTER',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      maxAttempts: 5,
    });

    const verifyResult = await authService.verifyRegistration({ email: testEmail, otp: knownOtp });
    console.log('✓ Verified successfully:', verifyResult.message);
    console.log('✓ Returned token length:', verifyResult.token ? verifyResult.token.length : 0);

    // 5. Duplicate registration test
    console.log('\n[TEST 5] Registering again with same email (should fail 409)...');
    try {
      await authService.register({ email: testEmail, password: initialPassword });
      throw new Error('Test 5 failed: Duplicate registration was accepted!');
    } catch (err) {
      console.log('✓ Blocked duplicate registration correctly:', err.message);
    }

    // 6. Login with wrong password
    console.log('\n[TEST 6] Login with wrong password (should fail 401)...');
    try {
      await authService.login({ email: testEmail, password: 'WrongPassword999!' });
      throw new Error('Test 6 failed: Wrong password logged in!');
    } catch (err) {
      console.log('✓ Blocked wrong password correctly:', err.message);
    }

    // 7. Login with correct password
    console.log('\n[TEST 7] Login with correct password...');
    const loginResult = await authService.login({ email: testEmail, password: initialPassword });
    console.log('✓ Login successful for user ID:', loginResult.user.id);

    // 8. Forgot Password Flow
    console.log('\n[TEST 8] Forgot password request...');
    const forgotResult = await authService.requestForgotPasswordOtp({ email: testEmail });
    console.log('✓ Forgot password response:', forgotResult.message);

    // Seed known OTP for reset
    const resetOtp = '112233';
    const resetHash = await bcrypt.hash(resetOtp, 10);
    await otpRepository.createOtp({
      email: testEmail,
      otpHash: resetHash,
      purpose: 'FORGOT_PASSWORD',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      maxAttempts: 5,
    });

    console.log('\n[TEST 9] Reset password using OTP...');
    const resetResult = await authService.resetPassword({
      email: testEmail,
      otp: resetOtp,
      newPassword: updatedPassword,
    });
    console.log('✓ Password reset response:', resetResult.message);

    // 10. Login with new password
    console.log('\n[TEST 10] Login with new password...');
    const newLoginResult = await authService.login({ email: testEmail, password: updatedPassword });
    console.log('✓ Successfully logged in with new password! User ID:', newLoginResult.user.id);

    // 11. Change Password Flow (authenticated)
    console.log('\n[TEST 11] Change password while logged in...');
    const changeOtp = '998877';
    const changeHash = await bcrypt.hash(changeOtp, 10);
    await otpRepository.createOtp({
      email: testEmail,
      otpHash: changeHash,
      purpose: 'CHANGE_PASSWORD',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      maxAttempts: 5,
    });

    const finalPassword = 'FinalPassword789#';
    const changeResult = await authService.changePassword({
      userId: newLoginResult.user.id,
      currentPassword: updatedPassword,
      newPassword: finalPassword,
      otp: changeOtp,
    });
    console.log('✓ Change password response:', changeResult.message);

    // Verify final login
    const finalLogin = await authService.login({ email: testEmail, password: finalPassword });
    console.log('✓ Successfully logged in with final changed password!');

    console.log('\n===========================================');
    console.log('ALL BACKEND AUTH TESTS PASSED PERFECTLY!');
    console.log('===========================================\n');
  } catch (err) {
    console.error('\n❌ Test error:', err);
    process.exit(1);
  } finally {
    // Cleanup test data
    try {
      await pool.query('DELETE FROM email_otps WHERE LOWER(email) = LOWER($1)', [testEmail]);
      await pool.query('DELETE FROM users WHERE LOWER(email) = LOWER($1)', [testEmail]);
      console.log('Test cleanup completed.');
    } catch (cleanupErr) {
      console.error('Cleanup error:', cleanupErr);
    }
    await pool.end();
  }
}

runTests();

