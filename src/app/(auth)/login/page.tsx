"use client";

import React, { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GitBranch, Lock, Mail } from "lucide-react";

const GithubIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

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
  const callbackUrl = searchParams.get("callbackUrl") || "/notes";
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
        setError("Invalid username/email or password");
        setLoading(false);
      } else {
        router.refresh();
        router.push(callbackUrl);
      }
    } catch (err) {
      console.error(err);
      setError("An error occurred. Please try again.");
      setLoading(false);
    }
  };

  const handleOAuthLogin = async (provider: "github") => {
    setLoading(true);
    await signIn(provider, { callbackUrl });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <div className="flex justify-center mb-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-500">
            <GitBranch className="h-6 w-6" />
          </div>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Welcome back</h1>
        <p className="text-sm text-zinc-300">
          Login to manage your tasks, coding projects & studies
        </p>
      </div>

      {deletionScheduled && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">
          <p className="font-semibold">Your account is scheduled for deletion.</p>
          <p className="mt-1 text-amber-200/80">
            It will be permanently erased in 24 hours, and a copy of your data
            is on its way to your email. Sign in any time before then to cancel
            it.
          </p>
        </div>
      )}

      {error && (
        <div className="p-3 text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="identifier" className="text-zinc-200 text-xs">Username or Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <Input
              id="identifier"
              type="text"
              placeholder="username or name@example.com"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="pl-10 bg-zinc-900/50 border-zinc-800 focus:border-zinc-700 text-white placeholder-zinc-400"
              required
              disabled={loading}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-zinc-200 text-xs">Password</Label>
            <Link href="/forgot-password" className="text-xs text-blue-500 hover:text-blue-400 font-medium">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 bg-zinc-900/50 border-zinc-800 focus:border-zinc-700 text-white placeholder-zinc-400"
              required
              disabled={loading}
            />
          </div>
        </div>

        <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium" disabled={loading}>
          {loading ? "Logging in..." : "Login with Email"}
        </Button>
      </form>

      <div className="relative flex py-2 items-center">
        <div className="flex-grow border-t border-zinc-800"></div>
        <span className="flex-shrink mx-4 text-zinc-400 text-xs uppercase tracking-wider">or continue with</span>
        <div className="flex-grow border-t border-zinc-800"></div>
      </div>

      <Button type="button" variant="outline" onClick={() => handleOAuthLogin("github")} className="w-full bg-zinc-900/50 hover:bg-zinc-800 border-zinc-800 hover:border-zinc-700 text-white" disabled={loading}>
        <GithubIcon className="mr-2 h-4 w-4 text-zinc-200" />
        GitHub
      </Button>

      <p className="text-center text-xs text-zinc-400">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-blue-500 hover:text-blue-400 font-medium">
          Sign up
        </Link>
      </p>
    </div>
  );
}
