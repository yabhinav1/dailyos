"use client";

import React, { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { verifyOtp, resendOtp } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GitBranch, ShieldCheck } from "lucide-react";

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={<div className="py-10 text-center text-xs text-zinc-400">Loading...</div>}>
      <VerifyOtpForm />
    </Suspense>
  );
}

function VerifyOtpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (!email) {
      router.push("/login");
    }
  }, [email, router]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setMessage({ type: "error", text: "Please enter a 6-digit code" });
      return;
    }

    setLoading(true);
    setMessage(null);

    const res = await verifyOtp(email, otp);

    if (res.success) {
      setMessage({ type: "success", text: res.message });
      setTimeout(() => {
        router.push("/today");
      }, 1500);
    } else {
      setMessage({ type: "error", text: res.message });
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setMessage(null);

    const res = await resendOtp(email);

    if (res.success) {
      setMessage({ type: "success", text: res.message });
      setCountdown(60);
    } else {
      setMessage({ type: "error", text: res.message });
    }
    setResending(false);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <div className="flex justify-center mb-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-500">
            <GitBranch className="h-6 w-6" />
          </div>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Verify your email</h1>
        <p className="text-sm text-zinc-300">
          We sent a verification code to <span className="text-zinc-200 font-semibold">{email}</span>
        </p>
        <p className="text-xs text-zinc-400">
          Don&apos;t see it? Check your spam or junk folder — it can take a minute to arrive.
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
          <Label htmlFor="otp" className="text-zinc-200 text-xs">Verification Code (6 Digits)</Label>
          <div className="relative">
            <ShieldCheck className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <Input
              id="otp"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              className="pl-10 text-center tracking-[0.5em] text-lg bg-zinc-900/50 border-zinc-800 focus:border-zinc-700 text-white placeholder-zinc-400 font-mono"
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
          {loading ? "Verifying..." : "Verify Code"}
        </Button>
      </form>

      <div className="text-center text-xs">
        <span className="text-zinc-400">Didn&apos;t receive code? </span>
        <button
          onClick={handleResend}
          disabled={resending || countdown > 0}
          className="text-blue-500 hover:text-blue-400 font-medium disabled:text-zinc-400 disabled:no-underline"
        >
          {countdown > 0 ? `Resend in ${countdown}s` : resending ? "Resending..." : "Resend code"}
        </button>
      </div>

      <div className="text-center">
        <button
          onClick={() => router.push("/today")}
          className="text-xs text-zinc-400 hover:text-zinc-200 underline underline-offset-2"
        >
          Verify later, skip for now
        </button>
      </div>
    </div>
  );
}
