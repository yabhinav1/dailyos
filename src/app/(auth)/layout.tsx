import React from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-black text-foreground">
      <div className="absolute -top-[40%] left-[20%] h-[600px] w-[600px] rounded-full bg-blue-500/10 blur-[120px]" />
      <div className="absolute -bottom-[40%] right-[20%] h-[600px] w-[600px] rounded-full bg-indigo-500/10 blur-[120px]" />

      <div className="relative z-10 w-full max-w-md px-4 py-8">
        <div className="rounded-2xl border border-white/[0.06] bg-black/80 backdrop-blur-xl p-8 shadow-2xl shadow-black/60">
          {children}
        </div>
      </div>
    </div>
  );
}
