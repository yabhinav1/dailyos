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
import { useRouter } from "next/navigation";
import {
  Save,
  Shuffle,
  Upload,
  Lock,
  Link2,
  Unlink,
  KeyRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SkeletonCards } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { getErrorMessage } from "@/lib/utils";
import {
  GithubMark,
  InlineBanner,
  PasswordInput,
  PROVIDER_LABEL,
  SETTINGS_TABS,
  SettingsSection,
  type Banner,
  type SettingsTab,
} from "@/features/settings/components/settings-ui";
import DataSettings from "@/features/settings/components/data-settings";
import PushSettings from "@/features/settings/components/push-settings";

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
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const router = useRouter();
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
        // Refresh only: the jwt callback re-reads the avatar from the
        // database. Passing the image here would put a data URL in the
        // session cookie, which is what used to sign people out.
        await updateSession({});
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
        // Refresh only: the jwt callback re-reads the avatar from the
        // database. Passing the image here would put a data URL in the
        // session cookie, which is what used to sign people out.
        await updateSession({});
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

  // Settings is a route so it stays linkable and refreshable, but it presents
  // as a dialog over the workspace. Closing returns to where you came from,
  // falling back to /today when this was opened directly.
  const close = () => {
    if (window.history.length > 1) router.back();
    else router.push("/today");
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="flex h-[100dvh] max-h-[100dvh] w-full max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-auto sm:min-h-[26rem] sm:max-h-[85vh] sm:w-[calc(100%-2rem)] sm:max-w-3xl sm:flex-row sm:rounded-xl"
      >
        <DialogTitle className="sr-only">Settings</DialogTitle>

        {/* Category rail — a scrollable strip on phones, a column from sm up */}
        <nav
          aria-label="Settings sections"
          className="flex shrink-0 gap-1 overflow-x-auto border-b border-zinc-850 p-2 sm:w-52 sm:flex-col sm:overflow-x-visible sm:overflow-y-auto sm:border-b-0 sm:border-r sm:p-3"
        >
          <p className="hidden px-2 pt-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-400 sm:block">
            Settings
          </p>
          {SETTINGS_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.key === activeTab;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                aria-current={isActive ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-300 hover:bg-zinc-900/70 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Panel */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-850 px-5 py-3.5">
            <h2 className="text-sm font-bold text-white">
              {SETTINGS_TABS.find((t) => t.key === activeTab)?.label}
            </h2>
            <button
              type="button"
              onClick={close}
              aria-label="Close settings"
              className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            <div className="max-w-lg">
      {loading ? (
        <SkeletonCards cards={3} />
      ) : (
        <div className="space-y-4">
          <InlineBanner banner={banner} onDismiss={() => setBanner(null)} />

          {/* Profile Card */}
          <SettingsSection active={activeTab} name="profile">
          <Card className="rounded-none bg-transparent p-0 ring-0">
            <CardContent className="p-0 space-y-4">
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
                  <p className="w-full text-[11px] text-zinc-400">PNG/JPG, up to 2MB — or reroll for a random robot.</p>
                </div>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-zinc-400 text-[11px] uppercase font-bold tracking-wider">Full Name</Label>
                  <Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    className="bg-zinc-900/50 border-zinc-800 text-white text-xs h-9" required disabled={saving} />
                </div>
                <div className="space-y-1">
                  <Label className="text-zinc-400 text-[11px] uppercase font-bold tracking-wider">Username</Label>
                  <Input value={profile.username} onChange={(e) => setProfile({ ...profile, username: e.target.value })}
                    className="bg-zinc-900/50 border-zinc-800 text-white text-xs h-9" required disabled={saving} />
                </div>
                <Button type="submit" size="sm" className="bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700/60 text-xs gap-1.5 h-8 font-medium shadow-sm transition-all" disabled={saving}>
                  <Save className="h-3.5 w-3.5" /> Save Profile
                </Button>
              </form>
            </CardContent>
          </Card>
          </SettingsSection>

          {/* Email Card */}
          <SettingsSection active={activeTab} name="account">
          <Card className="rounded-none bg-transparent p-0 ring-0">
            <CardContent className="p-0 space-y-4">
              <div className="space-y-1">
                <Label className="text-zinc-400 text-[11px] uppercase font-bold tracking-wider">Current Email</Label>
                <Input value={profile.email} className="bg-zinc-900/30 border-zinc-850 text-zinc-300 text-xs h-9 cursor-not-allowed" disabled />
              </div>

              {pendingEmail ? (
                <form onSubmit={handleVerifyEmailChange} className="space-y-3 border-t border-zinc-900 pt-4">
                  <p className="text-xs text-zinc-300">
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
                  <div className="flex gap-3 text-[11px] text-zinc-400">
                    <button type="button" onClick={handleResendEmailOtp} disabled={emailBusy} className="text-blue-500 hover:text-blue-400 font-medium">
                      Resend code
                    </button>
                    <button type="button" onClick={handleCancelEmailChange} disabled={emailBusy} className="hover:text-zinc-200">
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleRequestEmailChange} className="space-y-2 border-t border-zinc-900 pt-4">
                  <Label className="text-zinc-400 text-[11px] uppercase font-bold tracking-wider">Change Email</Label>
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
                  <p className="text-[11px] text-zinc-400">We&apos;ll send a verification code to your new address before switching over.</p>
                </form>
              )}
            </CardContent>
          </Card>
          </SettingsSection>

          {/* Security / Password Card */}
          <SettingsSection active={activeTab} name="security">
          <Card className="rounded-none bg-transparent p-0 ring-0">
            <CardContent className="p-0 space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" /> {hasPassword ? "Change Password" : "Set a Password"}
              </h2>
              <p className="text-xs text-zinc-400 -mt-2">
                {hasPassword
                  ? "Update the password used to sign in with your email."
                  : "You currently sign in with a linked account only. Set a password to also enable email + password login."}
              </p>
              <form onSubmit={handleChangePassword} className="space-y-3">
                {hasPassword && (
                  <div className="space-y-1">
                    <Label className="text-zinc-400 text-[11px] uppercase font-bold tracking-wider">Current Password</Label>
                    <PasswordInput
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      disabled={passwordBusy}
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-zinc-400 text-[11px] uppercase font-bold tracking-wider">New Password</Label>
                  <PasswordInput
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={6}
                    disabled={passwordBusy}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-zinc-400 text-[11px] uppercase font-bold tracking-wider">Confirm New Password</Label>
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
          </SettingsSection>

          {/* Linked Accounts Card */}
          <SettingsSection active={activeTab} name="security">
          <Card className="rounded-none bg-transparent p-0 ring-0">
            <CardContent className="p-0 space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5" /> Linked Accounts
              </h2>
              <div className="flex items-center justify-between rounded-lg border border-zinc-900 bg-zinc-950/40 px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <GithubMark className="h-4 w-4 text-zinc-200" />
                  <div>
                    <p className="text-xs font-medium text-zinc-200">GitHub</p>
                    <p className="text-[11px] text-zinc-400">{isGithubLinked ? "Connected" : "Not connected"}</p>
                  </div>
                </div>
                {isGithubLinked ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleUnlink("github")}
                    disabled={linkedBusy === "github"}
                    className="bg-zinc-900/50 hover:bg-red-950/40 hover:text-red-400 hover:border-red-900 border-zinc-800 text-zinc-200 text-xs gap-1.5 h-8"
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
              <p className="text-[11px] text-zinc-400">
                {hasPassword
                  ? "You have a password set, so you can safely disconnect linked accounts."
                  : "Set a password above before disconnecting your only sign-in method."}
              </p>
            </CardContent>
          </Card>
          </SettingsSection>

          {/* Preferences Card (Auto-saves on change) */}
          <SettingsSection active={activeTab} name="preferences">
          <Card className="rounded-none bg-transparent p-0 ring-0">
            <CardContent className="p-0 space-y-4">
              <p className="text-xs text-zinc-400">Auto-saves on change</p>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs text-zinc-200">Theme Mode</Label>
                    <p className="text-[11px] text-zinc-400">Select application visual theme</p>
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
                    <p className="text-[11px] text-zinc-400">A morning email and notification with what&apos;s due, overdue and on your calendar</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={reminders}
                    onChange={(e) => handleRemindersChange(e.target.checked)}
                    className="h-4 w-4 bg-zinc-900 border-zinc-800 text-blue-500 rounded focus:ring-0 focus:ring-offset-0 cursor-pointer"
                  />
                </div>

                <PushSettings />
              </div>
            </CardContent>
          </Card>
          </SettingsSection>

          <SettingsSection active={activeTab} name="data">
            <DataSettings email={profile.email} showBanner={showBanner} />
          </SettingsSection>
        </div>
      )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

