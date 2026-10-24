"use client";

import React, { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { registerUser } from "@/features/auth/actions";
import { AtSign, Loader2, Lock, Mail, User } from "lucide-react";
import {
  AuthAlert,
  AuthDivider,
  AuthField,
  AuthHeader,
  OAuthButtons,
  authPrimaryButtonClass,
} from "@/components/auth/auth-ui";

export default function RegisterPage() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(registerUser, null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Derived, not stored: "signing in" is exactly "registration succeeded".
  // Keeping it as state meant setting it synchronously inside the effect,
  // which triggers an extra cascading render.
  const signingIn = !!state?.success;
  const locked = isPending || signingIn;

  useEffect(() => {
    if (state?.success) {
      signIn("credentials", {
        email,
        password,
        redirect: false,
      }).finally(() => {
        const timer = setTimeout(() => {
          router.push(`/verify-otp?email=${encodeURIComponent(state.email || email)}`);
        }, 1000);
        return () => clearTimeout(timer);
      });
    }
  }, [state, router, email, password]);

  return (
    <div className="space-y-7">
      <AuthHeader title="Create your account" subtitle="Notes, tasks, habits and your calendar, together." />

      <OAuthButtons callbackUrl="/today" disabled={locked} />

      <AuthDivider>or sign up with email</AuthDivider>

      <form action={formAction} className="space-y-4">
        {state?.success && (
          <AuthAlert tone="success">
            {state.message} {signingIn ? "Signing you in…" : ""}
          </AuthAlert>
        )}
        {state && !state.success && <AuthAlert tone="error">{state.message}</AuthAlert>}

        <AuthField
          id="name"
          name="name"
          label="Full name"
          icon={User}
          type="text"
          autoComplete="name"
          placeholder="Your name"
          required
          disabled={locked}
          error={state?.errors?.name?.[0]}
        />
        <AuthField
          id="username"
          name="username"
          label="Username"
          icon={AtSign}
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="yourname"
          required
          disabled={locked}
          error={state?.errors?.username?.[0]}
        />
        <AuthField
          id="email"
          name="email"
          label="Email"
          icon={Mail}
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={locked}
          error={state?.errors?.email?.[0]}
        />
        <AuthField
          id="password"
          name="password"
          label="Password"
          icon={Lock}
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={locked}
          error={state?.errors?.password?.[0]}
        />

        <button type="submit" className={authPrimaryButtonClass} disabled={locked}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {isPending ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="text-center text-sm text-zinc-400">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-blue-400 hover:text-blue-300">
          Sign in
        </Link>
      </p>
    </div>
  );
}
