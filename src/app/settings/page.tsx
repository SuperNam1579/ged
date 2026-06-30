"use client";

import { useEffect, useState } from "react";
import { Settings, User, RefreshCw, Check } from "lucide-react";
import MainLayout from "@/components/layout/MainLayout";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Spinner from "@/components/ui/Spinner";
import { useAuth } from "@/lib/hooks/useAuth";

const GOALS = [
  { value: "PASS", label: "Pass", score: 145, desc: "Minimum passing score" },
  { value: "COLLEGE_READY", label: "College Ready", score: 165, desc: "College-level work" },
  { value: "COLLEGE_READY_CREDIT", label: "CR + Credit", score: 175, desc: "Earn college credits" },
];

interface Preferences {
  targetExamDate: string;
  targetScore: number;
  studyGoal: string;
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
          const p = data.preferences;
          setPrefs({
            targetExamDate: p.targetExamDate?.split("T")[0] ?? "",
            targetScore: p.targetScore,
            studyGoal: p.studyGoal,
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
        body: JSON.stringify({
          targetExamDate: prefs.targetExamDate,
          targetScore: prefs.targetScore,
          studyGoal: prefs.studyGoal,
        }),
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
            <Settings className="w-6 h-6 text-gray-400" />
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          </div>
          <p className="text-gray-500">Manage your account and study preferences.</p>
        </div>

        {/* Profile */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-gray-400" />
              <h2 className="font-semibold text-gray-900">Profile</h2>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
              <div className="px-3.5 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-600">
                {user?.name}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <div className="px-3.5 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-600">
                {user?.email}
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Study preferences */}
        {prefs && (
          <Card className="mb-6">
            <CardHeader>
              <h2 className="font-semibold text-gray-900">Study Preferences</h2>
            </CardHeader>
            <CardBody className="space-y-6">
              {/* Exam date */}
              <Input
                label="Target Exam Date"
                type="date"
                value={prefs.targetExamDate}
                onChange={(e) => setPrefs({ ...prefs, targetExamDate: e.target.value })}
              />

              {/* Study goal */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Study Goal</label>
                <div className="grid grid-cols-3 gap-2">
                  {GOALS.map((goal) => (
                    <button
                      key={goal.value}
                      onClick={() => setPrefs({ ...prefs, studyGoal: goal.value, targetScore: goal.score })}
                      className={`p-3 rounded-lg border-2 text-left transition-all ${
                        prefs.studyGoal === goal.value
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 bg-white hover:border-blue-200"
                      }`}
                    >
                      <p className="text-xs font-bold text-gray-800">{goal.label}</p>
                      <p className="text-xs text-blue-600 font-semibold">{goal.score}/200</p>
                      <p className="text-xs text-gray-400 mt-0.5">{goal.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                {saveSuccess && (
                  <div className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
                    <Check className="w-4 h-4" />
                    Preferences saved!
                  </div>
                )}
                {saveError && (
                  <p className="text-red-600 text-sm">{saveError}</p>
                )}
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
        <Card className="border-orange-200">
          <CardHeader className="border-orange-100">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-orange-500" />
              <h2 className="font-semibold text-gray-900">Study Plan</h2>
            </div>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-gray-600 mb-4">
              Request a completely new study plan generated by the Genetic Algorithm. This will deactivate
              your current plan and create a new one based on your latest proficiency scores and preferences.
            </p>
            {regenSuccess && (
              <div className="flex items-center gap-1.5 text-green-600 text-sm font-medium mb-4">
                <Check className="w-4 h-4" />
                New study plan generated! Visit your dashboard to see it.
              </div>
            )}
            {regenError && (
              <p className="text-red-600 text-sm mb-4">{regenError}</p>
            )}
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
