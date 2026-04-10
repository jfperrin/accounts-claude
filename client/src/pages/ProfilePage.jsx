import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/store/AuthContext';
import * as profileApi from '@/api/profile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const TITLES = ['M.', 'Mme', 'Dr', 'Pr'];

export default function ProfilePage() {
  const { user, updateUser, logout } = useAuth();
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

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target?.value ?? e }));

  const onSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await profileApi.updateProfile({
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
      const updated = await profileApi.updateEmail(email);
      updateUser(updated);
      toast.success('Adresse email mise à jour');
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

  const onAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const updated = await profileApi.uploadAvatar(file);
      updateUser(updated);
      toast.success('Avatar mis à jour');
    } catch (err) {
      toast.error(err.message || "Erreur lors de l'upload");
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
  const displayName = user?.nickname || fullName || user?.email;
  const initials = displayName?.slice(0, 2).toUpperCase() ?? '??';
  const avatarSrc = user?.avatarUrl ?? undefined;

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <h1 className="text-xl font-extrabold text-foreground">Mon profil</h1>

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

      {/* Déconnexion */}
      <button
        type="button"
        onClick={logout}
        className="w-full rounded-xl border border-rose-200 bg-rose-50 py-2.5 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-100"
      >
        Déconnexion
      </button>
    </div>
  );
}
