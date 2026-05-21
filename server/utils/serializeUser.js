// Sérialisation user pour les réponses JSON. Deux variantes :
// - serializeSelf : ce que l'utilisateur voit de lui-même (profil complet, MFA).
// - serializeAdminUser : ce qu'un admin voit dans la console de gestion
//   (date de création, provenance Google, pas d'avatar ni d'acceptation CGU).
// Champs communs : _id, email, emailVerified, role, firstName, lastName,
// nickname, totpEnabled, emailMfaEnabled.

function base(u) {
  return {
    _id:             u._id ?? u.id,
    email:           u.email ?? null,
    emailVerified:   u.emailVerified ?? false,
    role:            u.role ?? 'user',
    firstName:       u.firstName ?? null,
    lastName:        u.lastName ?? null,
    nickname:        u.nickname ?? null,
    totpEnabled:     !!u.totpEnabled,
    emailMfaEnabled: !!u.emailMfaEnabled,
  };
}

function serializeSelf(u) {
  return {
    ...base(u),
    title:                  u.title ?? null,
    avatarUrl:              u.avatarUrl ?? null,
    acceptedToSAt:          u.acceptedToSAt ?? null,
    recoveryCodesRemaining: (u.recoveryCodes || []).length,
  };
}

function serializeAdminUser(u) {
  return {
    ...base(u),
    createdAt: u.createdAt ?? null,
    isGoogle:  !!u.googleId,
  };
}

module.exports = { serializeSelf, serializeAdminUser };
