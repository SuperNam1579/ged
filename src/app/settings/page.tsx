"use client";

import { useEffect, useState } from "react";
import { Settings, User, RefreshCw } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import MainLayout from "@/components/layout/MainLayout";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Spinner from "@/components/ui/Spinner";
import Toast from "@/components/ui/Toast";
import { cn } from "@/lib/utils/cn";
import { useAuth } from "@/lib/hooks/useAuth";

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

function FormError({ message }: { message: string }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.p
          initial={{ opacity: 0, y: -6, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -6, height: 0 }}
          transition={{ duration: 0.2 }}
          className="text-red-600 text-sm overflow-hidden"
        >
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

interface Preferences {
  targetExamDate: string;
}

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [regenError, setRegenError] = useState("");
  const [csrfToken, setCsrfToken] = useState("");

  // Success confirmations for all three forms on this page funnel through one
  // shared toast instead of three separately-styled inline messages.
  const [toastMsg, setToastMsg] = useState("");
  const flashToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  };

  // Display-name editing. null = not edited yet → falls back to the loaded name.
  const [nameOverride, setNameOverride] = useState<string | null>(null);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState("");
  const name = nameOverride ?? user?.name ?? "";
  const nameChanged = name.trim() !== (user?.name ?? "") && name.trim().length >= 2;

  useEffect(() => {
    fetch("/api/csrf")
      .then((r) => r.json())
      .then((d: { csrfToken?: string }) => setCsrfToken(d.csrfToken ?? ""))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (authLoading) return;
    fetch("/api/user/preferences")
      .then((r) => r.json())
      .then((data) => {
        if (data.preferences) {
          setPrefs({
            targetExamDate: data.preferences.targetExamDate?.split("T")[0] ?? "",
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [authLoading]);

  const handleSave = async () => {
    if (!prefs) return;
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/user/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({ targetExamDate: prefs.targetExamDate }),
      });
      if (!res.ok) {
        const d = await res.json();
        setSaveError(d.error ?? "Failed to save preferences.");
      } else {
        flashToast("Preferences saved!");
      }
    } catch {
      setSaveError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveName = async () => {
    if (!nameChanged) return;
    setNameSaving(true);
    setNameError("");
    try {
      const res = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        setNameError((await res.json()).error ?? "Failed to update name.");
      } else {
        flashToast("Name updated!");
        // Reflect the saved name immediately without a full reload.
        setNameOverride(name.trim());
      }
    } catch {
      setNameError("Network error. Please try again.");
    } finally {
      setNameSaving(false);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    setRegenError("");
    try {
      const res = await fetch("/api/ga/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({ triggerReason: "MANUAL_REQUEST" }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setRegenError(d.error ?? "Failed to regenerate study plan. Please try again.");
      } else {
        flashToast("New study plan generated! Visit your schedule to see it.");
      }
    } catch {
      setRegenError("Network error. Please try again.");
    } finally {
      setRegenerating(false);
    }
  };

  if (authLoading || loading) {
    return (
      <MainLayout userName={user?.name}>
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout userName={user?.name}>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 lg:py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Settings className="w-6 h-6 text-muted-foreground" />
            <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          </div>
          <p className="text-muted-foreground">Manage your account and study preferences.</p>
        </div>

        <motion.div initial="hidden" animate="visible" transition={{ staggerChildren: 0.1 }}>
          {/* Profile */}
          <motion.div variants={fadeUp}>
            <Card className="mb-6">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <h2 className="font-semibold text-foreground">Profile</h2>
                </div>
              </CardHeader>
              <CardBody className="space-y-4">
                <div>
                  <label htmlFor="displayName" className="block text-sm font-medium text-foreground mb-1.5">Display name</label>
                  <div className="flex items-center gap-2">
                    <input
                      id="displayName"
                      type="text"
                      value={name}
                      maxLength={100}
                      onChange={(e) => { setNameOverride(e.target.value); setNameError(""); }}
                      placeholder="Your name"
                      className="flex-1 px-3.5 py-2.5 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                    />
                    <Button onClick={handleSaveName} loading={nameSaving} disabled={!nameChanged || nameSaving} size="sm">
                      Save
                    </Button>
                  </div>
                  <FormError message={nameError} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
                  <div className="px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm text-muted-foreground">
                    {user?.email}
                  </div>
                </div>
              </CardBody>
            </Card>
          </motion.div>

          {/* Study preferences */}
          {prefs && (
            <motion.div variants={fadeUp}>
              <Card className="mb-6">
                <CardHeader>
                  <h2 className="font-semibold text-foreground">Study Preferences</h2>
                </CardHeader>
                <CardBody className="space-y-6">
                  <Input
                    label="Target Exam Date"
                    type="date"
                    value={prefs.targetExamDate}
                    onChange={(e) => setPrefs({ ...prefs, targetExamDate: e.target.value })}
                  />
                  <div className="flex items-center justify-between">
                    <FormError message={saveError} />
                    <div className="ml-auto">
                      <Button onClick={handleSave} loading={saving}>
                        Save Preferences
                      </Button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          )}

          {/* Study Plan regeneration */}
          <motion.div variants={fadeUp}>
            <Card className="border-orange-200">
              <CardHeader className="border-orange-100">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-orange-500" />
                  <h2 className="font-semibold text-foreground">Study Plan</h2>
                </div>
              </CardHeader>
              <CardBody>
                <p className="text-sm text-muted-foreground mb-4">
                  Request a completely new study plan generated by the Genetic Algorithm. This will
                  deactivate your current plan and create a new one based on your latest proficiency
                  scores and schedule.
                </p>
                <div className="mb-4"><FormError message={regenError} /></div>
                <Button
                  variant="secondary"
                  onClick={handleRegenerate}
                  loading={regenerating}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className={cn("w-4 h-4", regenerating && "animate-spin")} />
                  Regenerate My Study Plan
                </Button>
              </CardBody>
            </Card>
          </motion.div>
        </motion.div>
      </div>

      <Toast message={toastMsg} show={!!toastMsg} />
    </MainLayout>
  );
}
