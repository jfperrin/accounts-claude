import { useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/store/AuthContext';
import { useTheme } from '@/store/ThemeContext';
import { updateProfile, updateEmail, uploadAvatar, changePassword } from '@/api/profile';
import { resendVerification } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AvatarCropDialog from '@/components/AvatarCropDialog';
import { cn } from '@/lib/utils';

const TITLES = ['M.', 'Mme', 'Dr', 'Pr'];

// Couleurs de preview affichées dans le sélecteur. On utilise des oklch
// statiques (light + dark) plutôt que var(--primary) pour que chaque
// vignette montre sa propre couleur, même quand le thème n'est pas actif.
const THEMES = [
  {
    id: 'saffron',
    name: 'Saffron',
    subtitle: 'Ocre artisanal',
    swatchLight: 'oklch(0.66 0.13 70)',
    swatchDark: 'oklch(0.74 0.14 70)',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    subtitle: 'Lime électrique, moderne',
    swatchLight: 'oklch(0.78 0.20 130)',
    swatchDark: 'oklch(0.85 0.22 130)',
  },
  {
    id: 'verveine',
    name: 'Verveine',
    subtitle: 'Sage apaisé',
    swatchLight: 'oklch(0.52 0.08 165)',
    swatchDark: 'oklch(0.66 0.09 165)',
  },
  {
    id: 'lagon',
    name: 'Lagon',
    subtitle: 'Turquoise frais',
    swatchLight: 'oklch(0.65 0.13 195)',
    swatchDark: 'oklch(0.75 0.14 195)',
  },
  {
    id: 'indigo',
    name: 'Indigo',
    subtitle: 'Originel',
    swatchLight: 'oklch(0.511 0.262 277)',
    swatchDark: 'oklch(0.58 0.24 277)',
  },
];

export default function ProfilePage() {
  const { user, updateUser, logout } = useAuth();
  const { theme, palette, setPalette } = useTheme();
  const fileRef = useRef(null);

  const [form, setForm] = useState({
    title:     user?.title     ?? 'none',
    firstName: user?.firstName ?? '',
    lastName:  user?.lastName  ?? '',
    nickname:  user?.nickname  ?? '',
  });
  const [email, setEmail] = useState(user?.email ?? '');
  const [saving, setSaving] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [resending, setResending] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [savingPassword, setSavingPassword] = useState(false);
  const [cropFile, setCropFile] = useState(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target?.value ?? e }));

  const onSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await updateProfile({
        ...form,
        title: form.title === 'none' ? null : form.title,
      });
      updateUser(updated);
      toast.success('Profil enregistré');
    } catch (err) {
      toast.error(err.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const onSaveEmail = async (e) => {
    e.preventDefault();
    setSavingEmail(true);
    try {
      const data = await updateEmail(email);
      toast.success(data.message || 'Un lien de confirmation a été envoyé');
    } catch (err) {
      if (err.response?.status === 409) {
        toast.error('Adresse email déjà utilisée');
      } else {
        toast.error(err.message || 'Erreur');
      }
    } finally {
      setSavingEmail(false);
    }
  };

  const onResendVerification = async () => {
    setResending(true);
    try {
      await resendVerification();
      toast.success('Email de vérification envoyé');
    } catch (err) {
      toast.error(err.message || 'Erreur');
    } finally {
      setResending(false);
    }
  };

  const onChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.next !== passwordForm.confirm) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }
    if (passwordForm.next.length < 8) {
      toast.error('Le mot de passe doit faire au moins 8 caractères');
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword(passwordForm.current, passwordForm.next);
      toast.success('Mot de passe mis à jour. Un email de confirmation vous a été envoyé.');
      setPasswordForm({ current: '', next: '', confirm: '' });
    } catch (err) {
      if (err.response?.status === 401) {
        toast.error('Mot de passe actuel incorrect');
      } else {
        toast.error(err.response?.data?.message || err.message || 'Erreur');
      }
    } finally {
      setSavingPassword(false);
    }
  };

  const onAvatarChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset pour permettre de re-sélectionner le même fichier
    if (!file) return;
    setCropFile(file);
  };

  const onCropConfirm = async (cropped) => {
    setCropFile(null);
    setUploading(true);
    try {
      const updated = await uploadAvatar(cropped);
      updateUser(updated);
      toast.success('Avatar mis à jour');
    } catch (err) {
      toast.error(err.message || "Erreur lors de l'upload");
    } finally {
      setUploading(false);
    }
  };

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
  const displayName = user?.nickname || fullName || user?.email;
  const initials = displayName?.slice(0, 2).toUpperCase() ?? '??';
  const avatarSrc = user?.avatarUrl ?? undefined;

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <h1 className="text-xl font-extrabold text-foreground">Mon profil</h1>

      {/* Bannière email non-vérifié */}
      {user?.emailVerified === false && (
        <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>Votre adresse email n'est pas encore vérifiée.</span>
          <button
            type="button"
            onClick={onResendVerification}
            disabled={resending}
            className="ml-3 shrink-0 font-semibold underline hover:no-underline disabled:opacity-50"
          >
            {resending ? 'Envoi…' : 'Renvoyer'}
          </button>
        </div>
      )}

      {/* Avatar */}
      <div className="flex flex-col items-center gap-4">
        <Avatar className="h-24 w-24 text-2xl">
          {avatarSrc && <AvatarImage src={avatarSrc} alt={displayName} />}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onAvatarChange}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? 'Envoi…' : "Changer l'avatar"}
        </Button>
      </div>

      {/* Email */}
      <form onSubmit={onSaveEmail} className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-xs">
        <div className="space-y-1.5">
          <Label htmlFor="email">Adresse email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={savingEmail} className="w-full">
          {savingEmail ? 'Enregistrement…' : "Mettre à jour l'email"}
        </Button>
      </form>

      {/* Mot de passe */}
      <form onSubmit={onChangePassword} className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-xs">
        <div className="space-y-1.5">
          <Label htmlFor="currentPassword">Mot de passe actuel</Label>
          <Input
            id="currentPassword"
            type="password"
            value={passwordForm.current}
            onChange={(e) => setPasswordForm((f) => ({ ...f, current: e.target.value }))}
            autoComplete="current-password"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="newPassword">Nouveau mot de passe</Label>
          <Input
            id="newPassword"
            type="password"
            value={passwordForm.next}
            onChange={(e) => setPasswordForm((f) => ({ ...f, next: e.target.value }))}
            autoComplete="new-password"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Confirmer le nouveau mot de passe</Label>
          <Input
            id="confirmPassword"
            type="password"
            value={passwordForm.confirm}
            onChange={(e) => setPasswordForm((f) => ({ ...f, confirm: e.target.value }))}
            autoComplete="new-password"
          />
        </div>
        <Button type="submit" disabled={savingPassword} className="w-full">
          {savingPassword ? 'Enregistrement…' : 'Changer le mot de passe'}
        </Button>
      </form>

      {/* Profil */}
      <form onSubmit={onSave} className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-xs">
        <div className="space-y-1.5">
          <Label>Titre</Label>
          <Select value={form.title} onValueChange={set('title')}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {TITLES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="firstName">Prénom</Label>
            <Input id="firstName" value={form.firstName} onChange={set('firstName')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lastName">Nom</Label>
            <Input id="lastName" value={form.lastName} onChange={set('lastName')} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="nickname">Surnom (affiché en haut)</Label>
          <Input id="nickname" value={form.nickname} onChange={set('nickname')} placeholder={user?.email} />
        </div>
        <Button type="submit" disabled={saving} className="w-full">
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </form>

      {/* Apparence — thème de couleur */}
      <section className="space-y-3 rounded-xl border border-border bg-card p-6 shadow-xs">
        <div>
          <h2 className="text-base font-semibold">Apparence</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Couleur d'accent de l'interface. Le mode clair / sombre se règle dans la barre du haut.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {THEMES.map((t) => {
            const active = palette === t.id;
            const swatch = theme === 'dark' ? t.swatchDark : t.swatchLight;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setPalette(t.id)}
                aria-pressed={active}
                className={cn(
                  'group relative flex flex-col items-center gap-2 rounded-lg border p-3 text-left transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                  active
                    ? 'border-foreground/40 bg-muted/40'
                    : 'border-border hover:bg-muted/30',
                )}
              >
                <span
                  className="h-10 w-10 rounded-full ring-1 ring-border"
                  style={{ backgroundColor: swatch }}
                  aria-hidden
                />
                <div className="w-full text-center">
                  <div className="text-xs font-semibold">{t.name}</div>
                  <div className="text-[10px] text-muted-foreground leading-tight">{t.subtitle}</div>
                </div>
                {active && (
                  <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-foreground text-background">
                    <Check className="h-2.5 w-2.5" strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Déconnexion */}
      <button
        type="button"
        onClick={logout}
        className="w-full rounded-xl border border-rose-200 bg-rose-50 py-2.5 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-100"
      >
        Déconnexion
      </button>

      <AvatarCropDialog
        open={!!cropFile}
        file={cropFile}
        onConfirm={onCropConfirm}
        onCancel={() => setCropFile(null)}
      />
    </div>
  );
}
