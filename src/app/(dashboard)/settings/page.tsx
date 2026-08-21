"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  getUserSettings,
  updateUserSettings,
  updateProfile,
  regenerateAvatar,
  uploadCustomAvatar,
  requestEmailChange,
  verifyEmailChange,
  cancelEmailChange,
  resendEmailChangeOtp,
  changePassword,
  unlinkAccount,
} from "@/features/settings/actions";
import { useSession, signIn } from "next-auth/react";
import {
  Settings,
  Save,
  Moon,
  User,
  Shuffle,
  Upload,
  Mail,
  Lock,
  Link2,
  Unlink,
  KeyRound,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader } from "@/components/ui/loader";
import { getErrorMessage } from "@/lib/utils";

type Banner = { type: "success" | "error"; text: string } | null;

function InlineBanner({ banner, onDismiss }: { banner: Banner; onDismiss: () => void }) {
  if (!banner) return null;
  const isSuccess = banner.type === "success";
  return (
    <div
      className={`flex items-start gap-2 p-3 text-xs rounded-lg border ${
        isSuccess
          ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
          : "text-red-400 bg-red-500/10 border-red-500/20"
      }`}
    >
      {isSuccess ? <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" /> : <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />}
      <span className="flex-1">{banner.text}</span>
      <button onClick={onDismiss} className="text-[10px] opacity-70 hover:opacity-100">
        Dismiss
      </button>
    </div>
  );
}

function PasswordInput({
  value,
  onChange,
  placeholder,
  disabled,
  minLength,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  minLength?: number;
}) {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <div className="relative">
      <Input
        type={showPassword ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        minLength={minLength}
        className="bg-zinc-900/50 border-zinc-800 text-white text-xs h-9 pr-9 focus-visible:ring-1 focus-visible:ring-blue-500/40"
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 transition-colors p-0.5 rounded focus:outline-none"
        tabIndex={-1}
        aria-label={showPassword ? "Hide password" : "Show password"}
      >
        {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function GithubMark({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 .5C5.73.5.75 5.48.75 11.75c0 5.02 3.26 9.28 7.78 10.78.57.1.78-.25.78-.55v-1.94c-3.16.69-3.83-1.36-3.83-1.36-.52-1.31-1.26-1.66-1.26-1.66-1.03-.7.08-.69.08-.69 1.14.08 1.74 1.17 1.74 1.17 1.01 1.74 2.66 1.24 3.31.95.1-.73.4-1.24.72-1.53-2.52-.29-5.17-1.26-5.17-5.6 0-1.24.44-2.25 1.17-3.04-.12-.29-.51-1.45.11-3.02 0 0 .96-.31 3.14 1.16a10.9 10.9 0 0 1 2.86-.39c.97 0 1.94.13 2.86.39 2.18-1.47 3.14-1.16 3.14-1.16.62 1.57.23 2.73.11 3.02.73.79 1.17 1.8 1.17 3.04 0 4.35-2.65 5.31-5.18 5.59.41.35.77 1.04.77 2.11v3.13c0 .3.21.66.79.55A11.26 11.26 0 0 0 23.25 11.75C23.25 5.48 18.27.5 12 .5Z" />
    </svg>
  );
}

const PROVIDER_LABEL: Record<string, string> = {
  github: "GitHub",
  credentials: "Email & Password",
};

export default function SettingsPage() {
  const { update: updateSession } = useSession();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [profile, setProfile] = useState({ name: "", username: "", email: "" });
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [theme, setTheme] = useState("dark");
  const [reminders, setReminders] = useState(true);
  const [accounts, setAccounts] = useState<{ provider: string; providerAccountId: string }[]>([]);
  const [hasPassword, setHasPassword] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rerolling, setRerolling] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);

  // Email-change flow
  const [newEmail, setNewEmail] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);

  // Password flow
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);

  const [linkedBusy, setLinkedBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await getUserSettings();
      if (cancelled) return;
      if (res.success && res.data) {
        const { user, settings, accounts } = res.data;
        setProfile({ name: user?.name || "", username: user?.username || "", email: user?.email || "" });
        setPendingEmail(user?.pendingEmail || null);
        setAvatarUrl(user?.image || "");
        setHasPassword(!!user?.hasPassword);
        setAccounts(accounts || []);
        if (settings) {
          setTheme(settings.theme);
          setReminders(settings.remindersEnabled);
        }
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const showBanner = (type: "success" | "error", text: string) => setBanner({ type, text });

  // ---- Avatar ----
  const handleRerollAvatar = async () => {
    setRerolling(true);
    try {
      const res = await regenerateAvatar();
      if (res.success && res.image) {
        setAvatarUrl(res.image);
        await updateSession({ image: res.image });
        showBanner("success", "New avatar generated!");
      }
    } catch (err: unknown) {
      showBanner("error", getErrorMessage(err, "Failed to generate a new avatar."));
    } finally {
      setRerolling(false);
    }
  };

  const handleFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showBanner("error", "Please choose an image file.");
      return;
    }
    setUploadingAvatar(true);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await uploadCustomAvatar(dataUrl);
      if (res.success && res.image) {
        setAvatarUrl(res.image);
        await updateSession({ image: res.image });
        showBanner("success", "Profile picture updated!");
      } else {
        showBanner("error", res.message || "Failed to upload image.");
      }
    } catch {
      showBanner("error", "Failed to read that image file.");
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  };

  // ---- Profile ----
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // updateProfile throws on failure (e.g. duplicate username) rather than
      // returning an error shape, so reaching here means it succeeded.
      await updateProfile(profile.name, profile.username);
      showBanner("success", "Profile updated successfully!");
    } catch (err: unknown) {
      showBanner("error", getErrorMessage(err, "Failed to update profile."));
    } finally {
      setSaving(false);
    }
  };

  // ---- Email change ----
  const handleRequestEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail) return;
    setEmailBusy(true);
    try {
      const res = await requestEmailChange(newEmail);
      if (res.success) {
        setPendingEmail(newEmail.trim().toLowerCase());
        showBanner("success", res.message || "Verification code sent.");
      } else {
        showBanner("error", res.message || "Failed to send verification code.");
      }
    } finally {
      setEmailBusy(false);
    }
  };

  const handleVerifyEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOtp) return;
    setEmailBusy(true);
    try {
      const res = await verifyEmailChange(emailOtp);
      if (res.success) {
        setProfile((p) => ({ ...p, email: res.email || p.email }));
        setPendingEmail(null);
        setEmailOtp("");
        setNewEmail("");
        showBanner("success", "Email address updated!");
      } else {
        showBanner("error", res.message || "Incorrect or expired code.");
      }
    } finally {
      setEmailBusy(false);
    }
  };

  const handleCancelEmailChange = async () => {
    setEmailBusy(true);
    try {
      await cancelEmailChange();
      setPendingEmail(null);
      setNewEmail("");
      setEmailOtp("");
    } finally {
      setEmailBusy(false);
    }
  };

  const handleResendEmailOtp = async () => {
    setEmailBusy(true);
    try {
      const res = await resendEmailChangeOtp();
      showBanner(res.success ? "success" : "error", res.message || "");
    } finally {
      setEmailBusy(false);
    }
  };

  // ---- Password ----
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showBanner("error", "New password and confirmation don't match.");
      return;
    }
    setPasswordBusy(true);
    try {
      const res = await changePassword(currentPassword, newPassword);
      if (res.success) {
        setHasPassword(true);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        showBanner("success", res.message || "Password updated.");
      } else {
        showBanner("error", res.message || "Failed to update password.");
      }
    } finally {
      setPasswordBusy(false);
    }
  };

  // ---- Linked accounts ----
  const handleUnlink = async (provider: string) => {
    setLinkedBusy(provider);
    try {
      const res = await unlinkAccount(provider);
      if (res.success) {
        setAccounts((prev) => prev.filter((a) => a.provider !== provider));
        showBanner("success", `${PROVIDER_LABEL[provider] || provider} disconnected.`);
      } else {
        showBanner("error", res.message || "Failed to disconnect.");
      }
    } finally {
      setLinkedBusy(null);
    }
  };

  // ---- Preferences (Auto-save) ----
  const handleThemeChange = async (newTheme: string) => {
    setTheme(newTheme);
    try {
      await updateUserSettings(newTheme, reminders);
      showBanner("success", "Theme preference saved!");
    } catch (err: unknown) {
      showBanner("error", getErrorMessage(err, "Failed to save theme preference."));
    }
  };

  const handleRemindersChange = async (newReminders: boolean) => {
    setReminders(newReminders);
    try {
      await updateUserSettings(theme, newReminders);
      showBanner("success", "Reminder preference saved!");
    } catch (err: unknown) {
      showBanner("error", getErrorMessage(err, "Failed to save reminder preference."));
    }
  };

  const isGithubLinked = accounts.some((a) => a.provider === "github");

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <Settings className="h-5.5 w-5.5 text-zinc-400" /> Settings
        </h1>
        <p className="text-xs text-zinc-400 mt-1">Manage your profile, security, and account preferences.</p>
      </div>

      {loading ? (
        <div className="py-24 text-center">
          <Loader />
        </div>
      ) : (
        <div className="space-y-6">
          <InlineBanner banner={banner} onDismiss={() => setBanner(null)} />

          {/* Profile Card */}
          <Card className="border-zinc-850 bg-[#0C0C0E]/40">
            <CardContent className="p-5 space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> Profile
              </h2>

              <div className="flex items-center gap-4">
                <Avatar size="lg" className="h-16 w-16 border border-zinc-800">
                  <AvatarImage src={avatarUrl} alt={profile.name} />
                  <AvatarFallback className="bg-blue-600/10 text-blue-500 text-sm font-semibold">
                    {(profile.name || profile.username || "US").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleRerollAvatar}
                    disabled={rerolling || uploadingAvatar}
                    className="bg-zinc-900/50 hover:bg-zinc-800 border-zinc-800 hover:border-zinc-700 text-white text-xs gap-1.5 h-8"
                  >
                    <Shuffle className="h-3.5 w-3.5" /> {rerolling ? "Generating..." : "Random robot avatar"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={rerolling || uploadingAvatar}
                    className="bg-zinc-900/50 hover:bg-zinc-800 border-zinc-800 hover:border-zinc-700 text-white text-xs gap-1.5 h-8"
                  >
                    <Upload className="h-3.5 w-3.5" /> {uploadingAvatar ? "Uploading..." : "Upload photo"}
                  </Button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChosen} />
                  <p className="w-full text-[10px] text-zinc-500">PNG/JPG, up to 2MB — or reroll for a random robot.</p>
                </div>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Full Name</Label>
                  <Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    className="bg-zinc-900/50 border-zinc-800 text-white text-xs h-9" required disabled={saving} />
                </div>
                <div className="space-y-1">
                  <Label className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Username</Label>
                  <Input value={profile.username} onChange={(e) => setProfile({ ...profile, username: e.target.value })}
                    className="bg-zinc-900/50 border-zinc-800 text-white text-xs h-9" required disabled={saving} />
                </div>
                <Button type="submit" size="sm" className="bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700/60 text-xs gap-1.5 h-8 font-medium shadow-sm transition-all" disabled={saving}>
                  <Save className="h-3.5 w-3.5" /> Save Profile
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Email Card */}
          <Card className="border-zinc-850 bg-[#0C0C0E]/40">
            <CardContent className="p-5 space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> Email Address
              </h2>

              <div className="space-y-1">
                <Label className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Current Email</Label>
                <Input value={profile.email} className="bg-zinc-900/30 border-zinc-850 text-zinc-400 text-xs h-9 cursor-not-allowed" disabled />
              </div>

              {pendingEmail ? (
                <form onSubmit={handleVerifyEmailChange} className="space-y-3 border-t border-zinc-900 pt-4">
                  <p className="text-[11px] text-zinc-400">
                    We sent a 6-digit code to <span className="text-zinc-200 font-medium">{pendingEmail}</span>. Enter it below to confirm the change.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={emailOtp}
                      onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="6-digit code"
                      className="bg-zinc-900/50 border-zinc-800 text-white text-xs h-9 tracking-widest"
                      maxLength={6}
                      disabled={emailBusy}
                    />
                    <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-500 text-white text-xs h-9 shrink-0" disabled={emailBusy || emailOtp.length !== 6}>
                      Verify
                    </Button>
                  </div>
                  <div className="flex gap-3 text-[10px] text-zinc-500">
                    <button type="button" onClick={handleResendEmailOtp} disabled={emailBusy} className="text-blue-500 hover:text-blue-400 font-medium">
                      Resend code
                    </button>
                    <button type="button" onClick={handleCancelEmailChange} disabled={emailBusy} className="hover:text-zinc-300">
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleRequestEmailChange} className="space-y-2 border-t border-zinc-900 pt-4">
                  <Label className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Change Email</Label>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="new-email@example.com"
                      className="bg-zinc-900/50 border-zinc-800 text-white text-xs h-9"
                      disabled={emailBusy}
                    />
                    <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-500 text-white text-xs h-9 shrink-0" disabled={emailBusy || !newEmail}>
                      Send code
                    </Button>
                  </div>
                  <p className="text-[10px] text-zinc-500">We&apos;ll send a verification code to your new address before switching over.</p>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Security / Password Card */}
          <Card className="border-zinc-850 bg-[#0C0C0E]/40">
            <CardContent className="p-5 space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" /> {hasPassword ? "Change Password" : "Set a Password"}
              </h2>
              <p className="text-[11px] text-zinc-500 -mt-2">
                {hasPassword
                  ? "Update the password used to sign in with your email."
                  : "You currently sign in with a linked account only. Set a password to also enable email + password login."}
              </p>
              <form onSubmit={handleChangePassword} className="space-y-3">
                {hasPassword && (
                  <div className="space-y-1">
                    <Label className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Current Password</Label>
                    <PasswordInput
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      disabled={passwordBusy}
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">New Password</Label>
                  <PasswordInput
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={6}
                    disabled={passwordBusy}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Confirm New Password</Label>
                  <PasswordInput
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={6}
                    disabled={passwordBusy}
                  />
                </div>
                <button
                  type="submit"
                  disabled={passwordBusy || !newPassword}
                  className="w-full sm:w-auto h-9 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 bg-[length:200%_100%] hover:bg-right transition-all duration-300 text-white text-xs font-medium rounded-lg shadow-md shadow-indigo-500/20 active:scale-[0.98] border border-indigo-400/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  <span>{passwordBusy ? "Updating..." : hasPassword ? "Update Password" : "Set Password"}</span>
                </button>
              </form>
            </CardContent>
          </Card>

          {/* Linked Accounts Card */}
          <Card className="border-zinc-850 bg-[#0C0C0E]/40">
            <CardContent className="p-5 space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5" /> Linked Accounts
              </h2>
              <div className="flex items-center justify-between rounded-lg border border-zinc-900 bg-zinc-950/40 px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <GithubMark className="h-4 w-4 text-zinc-300" />
                  <div>
                    <p className="text-xs font-medium text-zinc-200">GitHub</p>
                    <p className="text-[10px] text-zinc-500">{isGithubLinked ? "Connected" : "Not connected"}</p>
                  </div>
                </div>
                {isGithubLinked ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleUnlink("github")}
                    disabled={linkedBusy === "github"}
                    className="bg-zinc-900/50 hover:bg-red-950/40 hover:text-red-400 hover:border-red-900 border-zinc-800 text-zinc-300 text-xs gap-1.5 h-8"
                  >
                    <Unlink className="h-3.5 w-3.5" /> {linkedBusy === "github" ? "Removing..." : "Disconnect"}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => signIn("github", { callbackUrl: "/settings" })}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs gap-1.5 h-8"
                  >
                    Connect
                  </Button>
                )}
              </div>
              <p className="text-[10px] text-zinc-500">
                {hasPassword
                  ? "You have a password set, so you can safely disconnect linked accounts."
                  : "Set a password above before disconnecting your only sign-in method."}
              </p>
            </CardContent>
          </Card>

          {/* Preferences Card (Auto-saves on change) */}
          <Card className="border-zinc-850 bg-[#0C0C0E]/40">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Moon className="h-3.5 w-3.5" /> App Preferences
                </h2>
                <span className="text-[10px] text-zinc-500 font-medium">Auto-saves on change</span>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs text-zinc-200">Theme Mode</Label>
                    <p className="text-[10px] text-zinc-500">Select application visual theme</p>
                  </div>
                  <select
                    value={theme}
                    onChange={(e) => handleThemeChange(e.target.value)}
                    className="h-8 px-3 rounded-lg border border-zinc-800 bg-[#1f1f1f] text-xs text-white focus:outline-none focus:border-zinc-700 cursor-pointer"
                  >
                    <option value="dark">Dark Theme</option>
                    <option value="light">Light Theme</option>
                    <option value="system">System Default</option>
                  </select>
                </div>

                <div className="flex items-center justify-between border-t border-zinc-900 pt-4">
                  <div className="space-y-0.5">
                    <Label className="text-xs text-zinc-200">Reminders</Label>
                    <p className="text-[10px] text-zinc-500">Enable automated email alerts for upcoming items</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={reminders}
                    onChange={(e) => handleRemindersChange(e.target.checked)}
                    className="h-4 w-4 bg-zinc-900 border-zinc-800 text-blue-500 rounded focus:ring-0 focus:ring-offset-0 cursor-pointer"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* System Data Backup Card */}
          <Card className="border-zinc-850 bg-[#0C0C0E]/40">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Download className="h-3.5 w-3.5" /> Workspace Data Backup
                </h2>
                <span className="text-[10px] text-zinc-500 font-medium">1-Click JSON Backup</span>
              </div>
              <p className="text-xs text-zinc-400">
                Download a complete offline JSON snapshot of your current DailyOS profile and preference configuration.
              </p>
              <Button
                size="sm"
                onClick={() => {
                  const backupData = {
                    version: "1.0",
                    timestamp: new Date().toISOString(),
                    profile,
                    theme,
                    reminders,
                  };
                  const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `dailyos_backup_${Date.now()}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                  showBanner("success", "Workspace backup JSON downloaded!");
                }}
                className="text-xs font-semibold gap-1.5"
              >
                <Download className="h-3.5 w-3.5" /> Export System Backup (JSON)
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

