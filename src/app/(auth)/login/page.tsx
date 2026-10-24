"use client";

import React, { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, Lock, Mail } from "lucide-react";
import {
  AuthAlert,
  AuthDivider,
  AuthField,
  AuthHeader,
  OAuthButtons,
  authPrimaryButtonClass,
} from "@/components/auth/auth-ui";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="py-10 text-center text-xs text-zinc-400">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/today";
  // Set when someone has just scheduled their account for deletion and been
  // signed out, so the page explains why they are suddenly here.
  const deletionScheduled = searchParams.get("deletion") === "scheduled";

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await signIn("credentials", {
        email: identifier,
        password,
        redirect: false,
        callbackUrl,
      });

      if (res?.error) {
        setError("That username/email and password don't match.");
        setLoading(false);
      } else {
        router.refresh();
        router.push(callbackUrl);
      }
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-7">
      <AuthHeader title="Welcome back" subtitle="Sign in to pick up where you left off." />

      {deletionScheduled && (
        <AuthAlert tone="warning">
          <p className="font-semibold">Your account is scheduled for deletion.</p>
          <p className="mt-1 opacity-80">
            It will be permanently erased in 24 hours, and a copy of your data is on its way to your email. Sign in any
            time before then to cancel it.
          </p>
        </AuthAlert>
      )}

      <OAuthButtons callbackUrl={callbackUrl} disabled={loading} />

      <AuthDivider>or sign in with email</AuthDivider>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <AuthAlert tone="error">{error}</AuthAlert>}

        <AuthField
          id="identifier"
          label="Email or username"
          icon={Mail}
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="you@example.com"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
          disabled={loading}
        />

        <AuthField
          id="password"
          label="Password"
          icon={Lock}
          type="password"
          autoComplete="current-password"
          placeholder="Your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading}
          trailing={
            <Link href="/forgot-password" className="text-[13px] font-medium text-blue-400 hover:text-blue-300">
              Forgot password?
            </Link>
          }
        />

        <button type="submit" className={authPrimaryButtonClass} disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="text-center text-sm text-zinc-400">
        New to DailyOS?{" "}
        <Link href="/register" className="font-medium text-blue-400 hover:text-blue-300">
          Create an account
        </Link>
      </p>
    </div>
  );
}
