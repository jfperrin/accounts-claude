const request = require('supertest');
const { generateSync: totpGenerate } = require('otplib');
const { setup, teardown, clearDB, createVerifiedUser } = require('./helpers');

// Compatibilité interface v12 pour le code de test
const authenticator = {
  generate: (secret) => totpGenerate({ secret }),
};

let app;
beforeAll(async () => { app = await setup(); });
afterAll(teardown);
beforeEach(clearDB);

const ALICE = { email: 'alice@test.com', password: 'pass1234' };

async function loginAlice(agent) {
  return agent.post('/api/auth/login').send(ALICE);
}

async function setupTotp(agent, password = ALICE.password) {
  const res = await agent.post('/api/auth/mfa/totp/setup').send({ password });
  return res.body;
}

describe('MFA setup', () => {
  it('TOTP setup → enable → enabled=true et recovery codes renvoyés', async () => {
    await createVerifiedUser(app, ALICE.email, ALICE.password);
    const agent = request.agent(app);
    await loginAlice(agent);

    const { secret } = await setupTotp(agent);
    const code = authenticator.generate(secret);
    const en = await agent.post('/api/auth/mfa/totp/enable').send({ code });
    expect(en.status).toBe(200);
    expect(en.body.recoveryCodes).toHaveLength(10);
    en.body.recoveryCodes.forEach((c) => expect(c).toMatch(/^[a-z0-9]{10}$/));

    const me = await agent.get('/api/auth/me');
    expect(me.body.totpEnabled).toBe(true);
    expect(me.body.recoveryCodesRemaining).toBe(10);
  });

  it('TOTP enable rejette un code invalide', async () => {
    await createVerifiedUser(app, ALICE.email, ALICE.password);
    const agent = request.agent(app);
    await loginAlice(agent);
    await setupTotp(agent);
    const en = await agent.post('/api/auth/mfa/totp/enable').send({ code: '000000' });
    expect(en.status).toBe(401);
  });

  it('email enable rejette un code invalide', async () => {
    await createVerifiedUser(app, ALICE.email, ALICE.password);
    const agent = request.agent(app);
    await loginAlice(agent);
    const setupRes = await agent.post('/api/auth/mfa/email/setup').send();
    expect(setupRes.status).toBe(200);
    const bad = await agent.post('/api/auth/mfa/email/enable').send({ code: '000000' });
    expect(bad.status).toBe(401);
  });

  it('compte avec googleId + passwordHash → /totp/setup rejeté en 400', async () => {
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('pwd', 4);
    await app.locals.db.users.create({
      email: 'g2@test.com', passwordHash: hash, googleId: 'g2', emailVerified: true,
    });
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: 'g2@test.com', password: 'pwd' });
    const res = await agent.post('/api/auth/mfa/totp/setup').send({ password: 'pwd' });
    expect(res.status).toBe(400);
  });

  it('/totp/setup rejette si mot de passe absent ou incorrect', async () => {
    await createVerifiedUser(app, ALICE.email, ALICE.password);
    const agent = request.agent(app);
    await loginAlice(agent);

    const noPwd = await agent.post('/api/auth/mfa/totp/setup').send({});
    expect(noPwd.status).toBe(400);

    const wrongPwd = await agent.post('/api/auth/mfa/totp/setup').send({ password: 'nope' });
    expect(wrongPwd.status).toBe(401);
  });
});

describe('MFA login flow', () => {
  async function activateTotp(agent) {
    const { secret } = await setupTotp(agent);
    const code = authenticator.generate(secret);
    await agent.post('/api/auth/mfa/totp/enable').send({ code });
    return secret;
  }

  it('login avec TOTP actif → mfaRequired, puis verify ouvre la session', async () => {
    await createVerifiedUser(app, ALICE.email, ALICE.password);
    const agent = request.agent(app);
    await loginAlice(agent);
    const secret = await activateTotp(agent);

    await agent.post('/api/auth/logout').send();

    const login = await agent.post('/api/auth/login').send(ALICE);
    expect(login.status).toBe(200);
    expect(login.body).toEqual({ mfaRequired: true, methods: ['totp'] });

    const meBefore = await agent.get('/api/auth/me');
    expect(meBefore.status).toBe(401);

    const code = authenticator.generate(secret);
    const verify = await agent.post('/api/auth/mfa/challenge/verify').send({ method: 'totp', code });
    expect(verify.status).toBe(200);
    expect(verify.body.email).toBe(ALICE.email);
    expect(verify.body.totpEnabled).toBe(true);

    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
  });

  it('challenge verify rejette un code TOTP invalide et compte les essais', async () => {
    await createVerifiedUser(app, ALICE.email, ALICE.password);
    const agent = request.agent(app);
    await loginAlice(agent);
    await activateTotp(agent);
    await agent.post('/api/auth/logout').send();
    await agent.post('/api/auth/login').send(ALICE);

    for (let i = 0; i < 5; i++) {
      const r = await agent.post('/api/auth/mfa/challenge/verify').send({ method: 'totp', code: '000000' });
      expect(r.status).toBe(401);
    }
    const r6 = await agent.post('/api/auth/mfa/challenge/verify').send({ method: 'totp', code: '000000' });
    expect(r6.status).toBe(401);
    expect(r6.body.message).toMatch(/expir/i);
  });

  it('recovery code consommé est rejeté à la 2e utilisation', async () => {
    await createVerifiedUser(app, ALICE.email, ALICE.password);
    const agent = request.agent(app);
    await loginAlice(agent);
    const { secret } = await setupTotp(agent);
    const totp = authenticator.generate(secret);
    const en = await agent.post('/api/auth/mfa/totp/enable').send({ code: totp });
    const recovery = en.body.recoveryCodes[0];

    await agent.post('/api/auth/logout').send();
    await agent.post('/api/auth/login').send(ALICE);

    const v1 = await agent.post('/api/auth/mfa/challenge/verify').send({ method: 'recovery', code: recovery });
    expect(v1.status).toBe(200);

    await agent.post('/api/auth/logout').send();
    await agent.post('/api/auth/login').send(ALICE);
    const v2 = await agent.post('/api/auth/mfa/challenge/verify').send({ method: 'recovery', code: recovery });
    expect(v2.status).toBe(401);
  });

  it('lockout persistant après 10 échecs cumulés bloque /challenge/verify et /login', async () => {
    await createVerifiedUser(app, ALICE.email, ALICE.password);
    const agent = request.agent(app);
    await loginAlice(agent);
    await activateTotp(agent);
    await agent.post('/api/auth/logout').send();

    // 2 cycles login + 5 échecs → 10 échecs cumulés → lockout
    for (let cycle = 0; cycle < 2; cycle++) {
      await agent.post('/api/auth/login').send(ALICE);
      for (let i = 0; i < 5; i++) {
        await agent.post('/api/auth/mfa/challenge/verify').send({ method: 'totp', code: '000000' });
      }
    }

    // Le prochain login doit être verrouillé (423).
    const blocked = await agent.post('/api/auth/login').send(ALICE);
    expect(blocked.status).toBe(423);
    expect(blocked.body.lockedUntil).toBeTruthy();
  });

  it('challenge/cancel efface le challenge', async () => {
    await createVerifiedUser(app, ALICE.email, ALICE.password);
    const agent = request.agent(app);
    await loginAlice(agent);
    await activateTotp(agent);
    await agent.post('/api/auth/logout').send();
    await agent.post('/api/auth/login').send(ALICE);
    const cancel = await agent.post('/api/auth/mfa/challenge/cancel').send();
    expect(cancel.status).toBe(200);
    const r = await agent.post('/api/auth/mfa/challenge/verify').send({ method: 'totp', code: '000000' });
    expect(r.status).toBe(401);
    expect(r.body.message).toMatch(/expir/i);
  });
});

describe('MFA trusted device', () => {
  async function activateTotp(agent) {
    const setupRes = await agent.post('/api/auth/mfa/totp/setup').send({ password: ALICE.password });
    const code = authenticator.generate(setupRes.body.secret);
    await agent.post('/api/auth/mfa/totp/enable').send({ code });
    return setupRes.body.secret;
  }

  it('après verify avec rememberDays, un login suivant saute le challenge MFA', async () => {
    await createVerifiedUser(app, ALICE.email, ALICE.password);
    const agent = request.agent(app);
    await loginAlice(agent);
    const secret = await activateTotp(agent);
    await agent.post('/api/auth/logout').send();

    await agent.post('/api/auth/login').send({ ...ALICE, rememberDays: 30 });
    const verify = await agent.post('/api/auth/mfa/challenge/verify')
      .send({ method: 'totp', code: authenticator.generate(secret) });
    expect(verify.status).toBe(200);

    await agent.post('/api/auth/logout').send();

    // 2ᵉ login : le cookie mfa_trusted_device fait sauter le challenge.
    const login2 = await agent.post('/api/auth/login').send({ ...ALICE, rememberDays: 30 });
    expect(login2.status).toBe(200);
    expect(login2.body.mfaRequired).toBeUndefined();
    expect(login2.body.email).toBe(ALICE.email);
    expect(login2.body.totpEnabled).toBe(true);

    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
  });

  it('changer le mot de passe invalide le trusted device (fingerprint)', async () => {
    await createVerifiedUser(app, ALICE.email, ALICE.password);
    const agent = request.agent(app);
    await loginAlice(agent);
    const secret = await activateTotp(agent);
    await agent.post('/api/auth/logout').send();
    await agent.post('/api/auth/login').send({ ...ALICE, rememberDays: 30 });
    await agent.post('/api/auth/mfa/challenge/verify')
      .send({ method: 'totp', code: authenticator.generate(secret) });

    // Changement du mot de passe → fingerprint modifié.
    const newPassword = 'newPass1234';
    const chg = await agent.put('/api/auth/password')
      .send({ currentPassword: ALICE.password, newPassword });
    expect(chg.status).toBe(200);
    await agent.post('/api/auth/logout').send();

    // Login avec le nouveau mdp : malgré le cookie, le fingerprint ne match plus
    // → on retombe sur le challenge MFA.
    const login2 = await agent.post('/api/auth/login')
      .send({ email: ALICE.email, password: newPassword, rememberDays: 30 });
    expect(login2.status).toBe(200);
    expect(login2.body).toEqual({ mfaRequired: true, methods: ['totp'] });
  });

  it('désactiver puis réactiver TOTP invalide le trusted device', async () => {
    await createVerifiedUser(app, ALICE.email, ALICE.password);
    const agent = request.agent(app);
    await loginAlice(agent);
    let secret = await activateTotp(agent);
    await agent.post('/api/auth/logout').send();
    await agent.post('/api/auth/login').send({ ...ALICE, rememberDays: 30 });
    await agent.post('/api/auth/mfa/challenge/verify')
      .send({ method: 'totp', code: authenticator.generate(secret) });

    // Désactivation TOTP
    const dis = await agent.post('/api/auth/mfa/totp/disable')
      .send({ password: ALICE.password, code: authenticator.generate(secret) });
    expect(dis.status).toBe(200);

    // Réactivation → nouveau totpSecret → fingerprint modifié.
    const setupRes = await agent.post('/api/auth/mfa/totp/setup').send({ password: ALICE.password });
    secret = setupRes.body.secret;
    await agent.post('/api/auth/mfa/totp/enable').send({ code: authenticator.generate(secret) });
    await agent.post('/api/auth/logout').send();

    const login2 = await agent.post('/api/auth/login').send({ ...ALICE, rememberDays: 30 });
    expect(login2.body).toEqual({ mfaRequired: true, methods: ['totp'] });
  });

  it('le cookie d\'un user ne saute pas la MFA d\'un autre user', async () => {
    await createVerifiedUser(app, ALICE.email, ALICE.password);
    await createVerifiedUser(app, 'bob@test.com', 'bobPass1234');
    const agent = request.agent(app);

    // Alice active TOTP + passe le challenge → cookie trusted_device pour Alice.
    await loginAlice(agent);
    const secret = await activateTotp(agent);
    await agent.post('/api/auth/logout').send();
    await agent.post('/api/auth/login').send({ ...ALICE, rememberDays: 30 });
    await agent.post('/api/auth/mfa/challenge/verify')
      .send({ method: 'totp', code: authenticator.generate(secret) });

    // Bob active TOTP avec le même navigateur (cookie d'Alice toujours présent).
    await agent.post('/api/auth/logout').send();
    await agent.post('/api/auth/login').send({ email: 'bob@test.com', password: 'bobPass1234' });
    const setupBob = await agent.post('/api/auth/mfa/totp/setup').send({ password: 'bobPass1234' });
    await agent.post('/api/auth/mfa/totp/enable').send({ code: authenticator.generate(setupBob.body.secret) });
    await agent.post('/api/auth/logout').send();

    // Bob se reconnecte → le cookie d'Alice ne doit pas sauter la MFA.
    const loginBob = await agent.post('/api/auth/login')
      .send({ email: 'bob@test.com', password: 'bobPass1234', rememberDays: 30 });
    expect(loginBob.body).toEqual({ mfaRequired: true, methods: ['totp'] });
  });
});

describe('MFA disable', () => {
  it('disable TOTP exige password + code', async () => {
    await createVerifiedUser(app, ALICE.email, ALICE.password);
    const agent = request.agent(app);
    await loginAlice(agent);
    const { secret } = await setupTotp(agent);
    const code = authenticator.generate(secret);
    await agent.post('/api/auth/mfa/totp/enable').send({ code });

    const noBody = await agent.post('/api/auth/mfa/totp/disable').send({});
    expect(noBody.status).toBe(400);

    const wrongPwd = await agent.post('/api/auth/mfa/totp/disable').send({ password: 'nope', code: authenticator.generate(secret) });
    expect(wrongPwd.status).toBe(401);

    const wrongCode = await agent.post('/api/auth/mfa/totp/disable').send({ password: ALICE.password, code: '000000' });
    expect(wrongCode.status).toBe(401);

    const ok = await agent.post('/api/auth/mfa/totp/disable').send({ password: ALICE.password, code: authenticator.generate(secret) });
    expect(ok.status).toBe(200);
    const me = await agent.get('/api/auth/me');
    expect(me.body.totpEnabled).toBe(false);
    expect(me.body.recoveryCodesRemaining).toBe(0);
  });
});
