"use client";

import React, { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { verifyOtp, resendOtp } from "@/features/auth/actions";
import { Loader2 } from "lucide-react";
import { AuthAlert, AuthHeader, authInputClass, authPrimaryButtonClass } from "@/components/auth/auth-ui";

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
    <div className="space-y-7">
      <AuthHeader
        title="Check your email"
        subtitle={
          <>
            We sent a 6-digit code to <span className="font-semibold text-zinc-200 break-all">{email}</span>. It can take a
            minute, and sometimes lands in spam.
          </>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        {message && <AuthAlert tone={message.type}>{message.text}</AuthAlert>}

        <div className="space-y-1.5">
          <label htmlFor="otp" className="text-[13px] font-medium text-zinc-200">
            Verification code
          </label>
          <input
            id="otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="••••••"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            className={`${authInputClass} pl-3 text-center font-mono text-2xl sm:text-2xl tracking-[0.6em] h-14`}
            required
            disabled={loading}
          />
        </div>

        <button type="submit" className={authPrimaryButtonClass} disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Verifying…" : "Verify"}
        </button>
      </form>

      <div className="space-y-3 text-center text-sm">
        <p>
          <span className="text-zinc-400">Didn&apos;t get it? </span>
          <button
            onClick={handleResend}
            disabled={resending || countdown > 0}
            className="font-medium text-blue-400 hover:text-blue-300 disabled:text-zinc-500"
          >
            {countdown > 0 ? `Resend in ${countdown}s` : resending ? "Sending…" : "Send a new code"}
          </button>
        </p>
        <button onClick={() => router.push("/today")} className="text-[13px] text-zinc-500 hover:text-zinc-300">
          Skip for now
        </button>
      </div>
    </div>
  );
}
