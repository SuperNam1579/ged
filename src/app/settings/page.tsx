"use client";

import { useEffect, useState } from "react";
import { Settings, User, RefreshCw, Check } from "lucide-react";
import MainLayout from "@/components/layout/MainLayout";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Spinner from "@/components/ui/Spinner";
import { useAuth } from "@/lib/hooks/useAuth";

interface Preferences {
  targetExamDate: string;
}

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [regenSuccess, setRegenSuccess] = useState(false);
  const [regenError, setRegenError] = useState("");
  const [csrfToken, setCsrfToken] = useState("");

  // Display-name editing. null = not edited yet → falls back to the loaded name.
  const [nameOverride, setNameOverride] = useState<string | null>(null);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameSuccess, setNameSuccess] = useState(false);
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
    setSaveSuccess(false);
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
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
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
    setNameSuccess(false);
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
        setNameSuccess(true);
        setTimeout(() => setNameSuccess(false), 3000);
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
    setRegenSuccess(false);
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
        setRegenSuccess(true);
        setTimeout(() => setRegenSuccess(false), 5000);
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

        {/* Profile */}
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
              {nameSuccess && (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 font-medium">
                  <Check className="w-3.5 h-3.5" /> Name updated!
                </p>
              )}
              {nameError && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{nameError}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
              <div className="px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm text-muted-foreground">
                {user?.email}
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Study preferences */}
        {prefs && (
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
                {saveSuccess && (
                  <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 text-sm font-medium">
                    <Check className="w-4 h-4" />
                    Preferences saved!
                  </div>
                )}
                {saveError && <p className="text-red-600 dark:text-red-400 text-sm">{saveError}</p>}
                <div className="ml-auto">
                  <Button onClick={handleSave} loading={saving}>
                    Save Preferences
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Study Plan regeneration */}
        <Card className="border-orange-200 dark:border-orange-500/30">
          <CardHeader className="border-orange-100 dark:border-orange-500/25">
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
            {regenSuccess && (
              <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 text-sm font-medium mb-4">
                <Check className="w-4 h-4" />
                New study plan generated! Visit your schedule to see it.
              </div>
            )}
            {regenError && <p className="text-red-600 dark:text-red-400 text-sm mb-4">{regenError}</p>}
            <Button
              variant="secondary"
              onClick={handleRegenerate}
              loading={regenerating}
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Regenerate My Study Plan
            </Button>
          </CardBody>
        </Card>
      </div>
    </MainLayout>
  );
}
