"use client";

import React, { useState } from "react";
import { signOut } from "next-auth/react";
import { Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { requestDataExport, requestAccountDeletion } from "@/features/settings/account-actions";
import { getErrorMessage } from "@/lib/utils";

/** Settings › Data: email a full export, or schedule account deletion. */
export default function DataSettings({
  email,
  showBanner,
}: {
  email: string;
  showBanner: (type: "success" | "error", text: string) => void;
}) {
  const profile = { email };
  const [exportEmail, setExportEmail] = useState("");
  const [exporting, setExporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleRequestExport = async () => {
    setExporting(true);
    try {
      const res = await requestDataExport(exportEmail);
      if (res.success) {
        setExportEmail("");
        showBanner("success", res.message || "Export sent.");
      } else {
        showBanner("error", res.message || "Couldn't send the export.");
      }
    } catch (err: unknown) {
      showBanner("error", getErrorMessage(err, "Couldn't send the export."));
    } finally {
      setExporting(false);
    }
  };

  const handleRequestDeletion = async () => {
    setDeleting(true);
    try {
      const res = await requestAccountDeletion();
      if (res.success && res.deletesAt) {
        // Signing out is part of deleting: staying in a workspace you just
        // asked to have erased makes no sense, and signing back in is what
        // surfaces the cancel prompt.
        await signOut({ callbackUrl: "/login?deletion=scheduled" });
        return;
      }
      showBanner("error", res.message || "Couldn't schedule the deletion.");
    } catch (err: unknown) {
      showBanner("error", getErrorMessage(err, "Couldn't schedule the deletion."));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card className="rounded-none bg-transparent p-0 ring-0">
      <CardContent className="space-y-6 p-0">
        {/* ---- Email a copy of everything ---- */}
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Request your data</h3>
            <p className="mt-1 text-xs text-zinc-300">
              We&apos;ll email a complete JSON copy of your notes, tasks,
              habits, goals, events, projects and study records.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="export-email" className="text-xs text-zinc-300">
              Send to
            </Label>
            <Input
              id="export-email"
              type="email"
              value={exportEmail}
              onChange={(e) => setExportEmail(e.target.value)}
              placeholder={profile.email || "your registered email"}
              className="h-9 text-xs"
            />
            <p className="text-[11px] text-zinc-400">
              Leave blank to use {profile.email || "your registered email"}.
              Sending it elsewhere also notifies your registered address.
            </p>
          </div>

          <Button
            size="sm"
            onClick={handleRequestExport}
            disabled={exporting}
            className="gap-1.5 text-xs font-semibold"
          >
            <Download className="h-3.5 w-3.5" />
            {exporting ? "Sending…" : "Email my data"}
          </Button>
        </div>

        <div className="border-t border-zinc-850" />

        {/* ---- Danger zone ---- */}
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-red-400">Delete account</h3>
            <p className="mt-1 text-xs text-zinc-300">
              Your account is scheduled for deletion and permanently
              removed 24 hours later. Sign in any time before then to stop
              it — you&apos;ll be asked as soon as you arrive.
            </p>
          </div>

          {confirmDelete ? (
            <div className="space-y-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
              <p className="text-xs text-zinc-200">
                Schedule this account for deletion? You&apos;ll be signed
                out, emailed a copy of your data, and everything goes
                after 24 hours unless you sign back in and cancel.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleRequestDeletion}
                  disabled={deleting}
                  className="bg-red-600 text-xs font-semibold text-white hover:bg-red-500"
                >
                  {deleting ? "Scheduling…" : "Yes, delete my account"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                  className="border-zinc-800 text-xs font-semibold"
                >
                  Keep it
                </Button>
              </div>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmDelete(true)}
              className="border-red-500/40 text-xs font-semibold text-red-400 hover:bg-red-500/10 hover:text-red-300"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete my account
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
