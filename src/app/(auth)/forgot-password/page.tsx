"use client";

import React, { useState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GitBranch, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const res = await requestPasswordReset(email);

    if (res.success) {
      setMessage({ type: "success", text: res.message });
      setEmail("");
    } else {
      setMessage({ type: "error", text: res.message });
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <div className="flex justify-center mb-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-500">
            <GitBranch className="h-6 w-6" />
          </div>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Reset your password</h1>
        <p className="text-sm text-zinc-400">
          Enter your email address and we will send you a link to reset your password
        </p>
      </div>

      {message && (
        <div
          className={`p-3 text-xs font-medium border rounded-lg ${
            message.type === "success"
              ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
              : "text-red-400 bg-red-500/10 border-red-500/20"
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-zinc-300 text-xs">Email Address</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 bg-zinc-900/50 border-zinc-800 focus:border-zinc-700 text-white placeholder-zinc-500"
              required
              disabled={loading}
            />
          </div>
        </div>

        <Button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium"
          disabled={loading}
        >
          {loading ? "Sending link..." : "Send Reset Link"}
        </Button>
      </form>

      <p className="text-center text-xs text-zinc-500">
        Remembered your password?{" "}
        <Link href="/login" className="text-blue-500 hover:text-blue-400 font-medium">
          Login
        </Link>
      </p>
    </div>
  );
}
