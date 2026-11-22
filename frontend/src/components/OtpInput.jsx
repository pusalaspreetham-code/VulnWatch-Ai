import React, { useRef, useState, useEffect } from 'react';
import { authApi } from '../api/auth';
import { RefreshCw } from 'lucide-react';

export default function OtpInput({ email, purpose, onOtpComplete, error }) {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [cooldown, setCooldown] = useState(60);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [resendError, setResendError] = useState('');
  const inputsRef = useRef([]);

  // Countdown timer for 60s cooldown
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleChange = (index, value) => {
    // Only accept numeric digit
    if (value && !/^\d+$/.test(value)) return;

    const newDigits = [...digits];
    // Handle paste of whole 6-digit code
    if (value.length > 1) {
      const pasted = value.replace(/\D/g, '').slice(0, 6).split('');
      pasted.forEach((char, i) => {
        newDigits[i] = char;
      });
      setDigits(newDigits);
      const nextIndex = Math.min(pasted.length, 5);
      inputsRef.current[nextIndex]?.focus();
      if (pasted.length === 6) {
        onOtpComplete(newDigits.join(''));
      }
      return;
    }

    newDigits[index] = value;
    setDigits(newDigits);

    // Auto advance to next box
    if (value && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }

    if (newDigits.every((d) => d !== '')) {
      onOtpComplete(newDigits.join(''));
    }
  };

  const handleKeyDown = (index, e) => {
    // Backspace auto-focuses previous input
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setResendMessage('');
    setResendError('');
    try {
      const res = await authApi.resendOtp(email, purpose);
      setResendMessage(res.message || 'New verification code sent!');
      setCooldown(60);
    } catch (err) {
      setResendError(err.message || 'Failed to resend code.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div>
      <div className="otp-inputs-row">
        {digits.map((digit, idx) => (
          <input
            key={idx}
            ref={(el) => (inputsRef.current[idx] = el)}
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={digit}
            onChange={(e) => handleChange(idx, e.target.value)}
            onKeyDown={(e) => handleKeyDown(idx, e)}
            className="otp-box"
            autoFocus={idx === 0}
          />
        ))}
      </div>

      {resendMessage && <div className="alert alert-success" style={{ marginTop: 12 }}>{resendMessage}</div>}
      {resendError && <div className="alert alert-error" style={{ marginTop: 12 }}>{resendError}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
        <span style={{ fontSize: '0.825rem', color: '#64748b' }}>
          {cooldown > 0 ? `Resend code in ${cooldown}s` : "Didn't receive the code?"}
        </span>
        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown > 0 || resending}
          className="btn-secondary"
        >
          <RefreshCw size={13} className={resending ? 'animate-spin-fast' : ''} />
          Resend
        </button>
      </div>
    </div>
  );
}
