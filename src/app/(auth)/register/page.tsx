"use client";

import React, { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { registerUser } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GitBranch, Lock, Mail, User } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(registerUser, null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Derived, not stored: "signing in" is exactly "registration succeeded".
  // Keeping it as state meant setting it synchronously inside the effect,
  // which triggers an extra cascading render.
  const signingIn = !!state?.success;

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
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <div className="flex justify-center mb-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-500">
            <GitBranch className="h-6 w-6" />
          </div>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Create an account</h1>
        <p className="text-sm text-zinc-300">
          Get started with your personal productivity system
        </p>
      </div>

      {state?.success && (
        <div className="p-3 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
          {state.message} {signingIn ? "Logging you in..." : ""}
        </div>
      )}

      {state && !state.success && (
        <div className="p-3 text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg">
          {state.message}
        </div>
      )}

      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-zinc-200 text-xs">Full Name</Label>
          <div className="relative">
            <User className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="John Doe"
              className="pl-10 bg-zinc-900/50 border-zinc-800 focus:border-zinc-700 text-white placeholder-zinc-400"
              required
              disabled={isPending || state?.success}
            />
          </div>
          {state?.errors?.name && (
            <p className="text-xs text-red-500 mt-1">{state.errors.name[0]}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="username" className="text-zinc-200 text-xs">Username</Label>
          <div className="relative">
            <User className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <Input
              id="username"
              name="username"
              type="text"
              placeholder="johndoe"
              className="pl-10 bg-zinc-900/50 border-zinc-800 focus:border-zinc-700 text-white placeholder-zinc-400"
              required
              disabled={isPending || state?.success}
            />
          </div>
          {state?.errors?.username && (
            <p className="text-xs text-red-500 mt-1">{state.errors.username[0]}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-zinc-200 text-xs">Email Address</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 bg-zinc-900/50 border-zinc-800 focus:border-zinc-700 text-white placeholder-zinc-400"
              required
              disabled={isPending || state?.success}
            />
          </div>
          {state?.errors?.email && (
            <p className="text-xs text-red-500 mt-1">{state.errors.email[0]}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-zinc-200 text-xs">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 bg-zinc-900/50 border-zinc-800 focus:border-zinc-700 text-white placeholder-zinc-400"
              required
              disabled={isPending || state?.success}
            />
          </div>
          {state?.errors?.password && (
            <p className="text-xs text-red-500 mt-1">{state.errors.password[0]}</p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium"
          disabled={isPending || state?.success}
        >
          {isPending ? "Creating account..." : "Sign Up"}
        </Button>
      </form>

      <p className="text-center text-xs text-zinc-400">
        Already have an account?{" "}
        <Link href="/login" className="text-blue-500 hover:text-blue-400 font-medium">
          Login
        </Link>
      </p>
    </div>
  );
}
