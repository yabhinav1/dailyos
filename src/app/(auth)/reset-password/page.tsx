"use client";
import React, { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { resetPassword } from "@/features/auth/actions";
import { ArrowLeft, Loader2, Lock } from "lucide-react";
import { AuthAlert, AuthField, AuthHeader, authPrimaryButtonClass } from "@/components/auth/auth-ui";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="py-10 text-center text-xs text-zinc-400">Loading...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  // Derived during render rather than pushed into state from an effect —
  // a missing token is a property of the URL, not an event.
  const missingToken = token
    ? null
    : { type: "error" as const, text: "No password reset token was provided. Please request a new link." };
  const banner = message ?? missingToken;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setMessage({ type: "error", text: "Invalid or missing token" });
      return;
    }

    if (password.length < 8) {
      setMessage({ type: "error", text: "Password must be at least 8 characters long" });
      return;
    }

    if (password !== confirmPassword) {
      setMessage({ type: "error", text: "Passwords do not match" });
      return;
    }

    setLoading(true);
    setMessage(null);

    const res = await resetPassword(token, password);

    if (res.success) {
      setMessage({ type: "success", text: res.message });
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } else {
      setMessage({ type: "error", text: res.message });
      setLoading(false);
    }
  };

  return (
    <div className="space-y-7">
      <AuthHeader title="Choose a new password" subtitle="Pick something at least 8 characters long." />

      {banner && <AuthAlert tone={banner.type}>{banner.text}</AuthAlert>}

      {token && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <AuthField
            id="password"
            label="New password"
            icon={Lock}
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
          />
          <AuthField
            id="confirmPassword"
            label="Confirm new password"
            icon={Lock}
            type="password"
            autoComplete="new-password"
            placeholder="Type it again"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={loading}
          />
          <button type="submit" className={authPrimaryButtonClass} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Saving…" : "Save new password"}
          </button>
        </form>
      )}

      <Link href="/login" className="flex items-center justify-center gap-1.5 text-sm font-medium text-zinc-400 hover:text-zinc-200">
        <ArrowLeft className="h-4 w-4" /> Back to sign in
      </Link>
    </div>
  );
}
