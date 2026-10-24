"use client";

import React, { useState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/features/auth/actions";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { AuthAlert, AuthField, AuthHeader, authPrimaryButtonClass } from "@/components/auth/auth-ui";

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
    <div className="space-y-7">
      <AuthHeader title="Reset your password" subtitle="Enter your email and we'll send you a link to choose a new one." />

      <form onSubmit={handleSubmit} className="space-y-4">
        {message && <AuthAlert tone={message.type}>{message.text}</AuthAlert>}

        <AuthField
          id="email"
          label="Email"
          icon={Mail}
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
        />

        <button type="submit" className={authPrimaryButtonClass} disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Sending link…" : "Send reset link"}
        </button>
      </form>

      <Link href="/login" className="flex items-center justify-center gap-1.5 text-sm font-medium text-zinc-400 hover:text-zinc-200">
        <ArrowLeft className="h-4 w-4" /> Back to sign in
      </Link>
    </div>
  );
}
