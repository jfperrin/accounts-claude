import client from './client';

export const setupTotp        = ()                 => client.post('/auth/mfa/totp/setup');
export const enableTotp       = (code)             => client.post('/auth/mfa/totp/enable', { code });
export const disableTotp      = (password, code)   => client.post('/auth/mfa/totp/disable', { password, code });

export const setupEmailMfa    = ()                 => client.post('/auth/mfa/email/setup');
export const enableEmailMfa   = (code)             => client.post('/auth/mfa/email/enable', { code });
export const disableEmailMfa  = (password, code)   => client.post('/auth/mfa/email/disable', { password, code });
export const sendDisableEmail = ()                 => client.post('/auth/mfa/email/disable/send');

export const regenerateRecovery = (password, code) => client.post('/auth/mfa/recovery/regenerate', { password, code });

export const sendChallengeEmail = ()               => client.post('/auth/mfa/challenge/send-email');
export const verifyChallenge    = (method, code)   => client.post('/auth/mfa/challenge/verify', { method, code });
export const cancelChallenge    = ()               => client.post('/auth/mfa/challenge/cancel');
