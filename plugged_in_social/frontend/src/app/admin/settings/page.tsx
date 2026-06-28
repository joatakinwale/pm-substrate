"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Users,
  ChevronRight,
  Building2,
  Palette,
  Target,
  Loader2,
  Save,
  AlertCircle,
  CheckCircle2,
  Calendar,
  BarChart3,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  apiFetch,
  type OrganizationSettings,
} from "@/lib/api";
import { joinUrlPath, normalizeAbsoluteUrl } from "@/lib/url";
import ImageUpload from "@/components/ImageUpload";

type Msg = { type: "success" | "error"; text: string } | null;

const COMPOUND_PHASES = ["protect", "deepen", "amplify"] as const;
type Phase = (typeof COMPOUND_PHASES)[number];

const PHASE_COLORS: Record<Phase, string> = {
  protect: "bg-sky-50 text-sky-700 border-sky-200",
  deepen: "bg-purple-50 text-purple-700 border-purple-200",
  amplify: "bg-lime-50 text-lime-700 border-lime-200",
};

// Read helpers: Organization.settings is schema-less JSONB, so we defensively
// coerce unknown values into the shape the form expects.
function readString(obj: Record<string, unknown> | undefined, key: string): string {
  const v = obj?.[key];
  return typeof v === "string" ? v : "";
}

function readNested(
  obj: Record<string, unknown> | undefined,
  key: string,
): Record<string, unknown> {
  const v = obj?.[key];
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function readPhaseDefaults(
  buckets: Record<string, unknown>,
  phase: Phase,
): { cadence_per_week: string; kpi_target: string; content_mix: string } {
  const p = buckets[phase];
  if (!p || typeof p !== "object") {
    return { cadence_per_week: "", kpi_target: "", content_mix: "" };
  }
  const obj = p as Record<string, unknown>;
  return {
    cadence_per_week:
      typeof obj.cadence_per_week === "number"
        ? String(obj.cadence_per_week)
        : typeof obj.cadence_per_week === "string"
          ? obj.cadence_per_week
          : "",
    kpi_target:
      typeof obj.kpi_target === "number" || typeof obj.kpi_target === "string"
        ? String(obj.kpi_target)
        : "",
    content_mix:
      typeof obj.content_mix === "string" ? obj.content_mix : "",
  };
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<OrganizationSettings | null>(null);

  // Organization fields
  const [orgForm, setOrgForm] = useState({ name: "", domain: "", logo_url: "" });
  const [savingOrg, setSavingOrg] = useState(false);
  const [orgMsg, setOrgMsg] = useState<Msg>(null);

  // Branding/settings JSONB
  const [brandForm, setBrandForm] = useState({
    brand_primary_color: "",
    brand_accent_color: "",
    email_from: "",
    email_reply_to: "",
    dashboard_intro: "",
  });
  const [savingBrand, setSavingBrand] = useState(false);
  const [brandMsg, setBrandMsg] = useState<Msg>(null);

  // Cal.com config (settings.cal.{url, username, event_slug})
  const [calForm, setCalForm] = useState({
    url: "",
    username: "",
    event_slug: "",
  });
  const [savingCal, setSavingCal] = useState(false);
  const [calMsg, setCalMsg] = useState<Msg>(null);

  // Umami config (settings.umami.{website_id, api_url, api_key})
  const [umamiForm, setUmamiForm] = useState({
    website_id: "",
    api_url: "",
    api_key: "",
  });
  const [savingUmami, setSavingUmami] = useState(false);
  const [umamiMsg, setUmamiMsg] = useState<Msg>(null);
  const [testingUmami, setTestingUmami] = useState(false);

  // Compound method defaults
  const [compound, setCompound] = useState<Record<Phase, { cadence_per_week: string; kpi_target: string; content_mix: string }>>({
    protect: { cadence_per_week: "", kpi_target: "", content_mix: "" },
    deepen: { cadence_per_week: "", kpi_target: "", content_mix: "" },
    amplify: { cadence_per_week: "", kpi_target: "", content_mix: "" },
  });
  const [savingCompound, setSavingCompound] = useState(false);
  const [compoundMsg, setCompoundMsg] = useState<Msg>(null);

  // Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<Msg>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<OrganizationSettings>(`/api/settings`);
      setSnapshot(data);
      setOrgForm({
        name: data.name ?? "",
        domain: data.domain ?? "",
        logo_url: data.logo_url ?? "",
      });
      setBrandForm({
        brand_primary_color: readString(data.settings, "brand_primary_color"),
        brand_accent_color: readString(data.settings, "brand_accent_color"),
        email_from: readString(data.settings, "email_from"),
        email_reply_to: readString(data.settings, "email_reply_to"),
        dashboard_intro: readString(data.settings, "dashboard_intro"),
      });
      const calBlob = readNested(data.settings, "cal");
      setCalForm({
        url: readString(calBlob, "url"),
        username: readString(calBlob, "username"),
        event_slug: readString(calBlob, "event_slug"),
      });
      const umamiBlob = readNested(data.settings, "umami");
      setUmamiForm({
        website_id: readString(umamiBlob, "website_id"),
        api_url: readString(umamiBlob, "api_url"),
        // Mask the API key on read — backend stores it but the user
        // shouldn't see it again. They can re-enter to rotate.
        api_key: readString(umamiBlob, "api_key") ? "••••••••" : "",
      });
      setCompound({
        protect: readPhaseDefaults(data.compound_method_defaults, "protect"),
        deepen: readPhaseDefaults(data.compound_method_defaults, "deepen"),
        amplify: readPhaseDefaults(data.compound_method_defaults, "amplify"),
      });
    } catch (e) {
      setOrgMsg({
        type: "error",
        text: e instanceof Error ? e.message : "Failed to load settings",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSaveOrg = async (e: FormEvent) => {
    e.preventDefault();
    setSavingOrg(true);
    setOrgMsg(null);
    try {
      const updated = await apiFetch<OrganizationSettings>(
        `/api/settings/organization`,
        {
          method: "PATCH",
          body: JSON.stringify({
            name: orgForm.name.trim() || null,
            domain: orgForm.domain.trim() || null,
            logo_url: orgForm.logo_url.trim() || null,
          }),
        },
      );
      setSnapshot(updated);
      setOrgMsg({ type: "success", text: "Organization updated." });
    } catch (err) {
      setOrgMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to save",
      });
    } finally {
      setSavingOrg(false);
    }
  };

  const handleSaveBranding = async (e: FormEvent) => {
    e.preventDefault();
    setSavingBrand(true);
    setBrandMsg(null);
    try {
      // Send null for empty strings so the backend clears the key.
      const payload: Record<string, string | null> = {
        brand_primary_color: brandForm.brand_primary_color.trim() || null,
        brand_accent_color: brandForm.brand_accent_color.trim() || null,
        email_from: brandForm.email_from.trim() || null,
        email_reply_to: brandForm.email_reply_to.trim() || null,
        dashboard_intro: brandForm.dashboard_intro.trim() || null,
      };
      const updated = await apiFetch<OrganizationSettings>(`/api/settings`, {
        method: "PATCH",
        body: JSON.stringify({ settings: payload }),
      });
      setSnapshot(updated);
      setBrandMsg({ type: "success", text: "Branding settings saved." });
    } catch (err) {
      setBrandMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to save",
      });
    } finally {
      setSavingBrand(false);
    }
  };

  const handleSaveCal = async (e: FormEvent) => {
    e.preventDefault();
    setSavingCal(true);
    setCalMsg(null);
    try {
      // Backend's PATCH is a shallow merge — replace the whole ``cal``
      // dict. Pre-merge with the saved snapshot so any future fields we
      // didn't surface in this form survive the save.
      const existingCal = readNested(snapshot?.settings, "cal");
      const cal: Record<string, string | null> = {
        ...(existingCal as Record<string, string | null>),
        url: normalizeAbsoluteUrl(calForm.url) || null,
        username: calForm.username.trim() || null,
        event_slug: calForm.event_slug.trim() || null,
      };
      const updated = await apiFetch<OrganizationSettings>(`/api/settings`, {
        method: "PATCH",
        body: JSON.stringify({ settings: { cal } }),
      });
      setSnapshot(updated);
      setCalMsg({ type: "success", text: "Cal.com settings saved." });
    } catch (err) {
      setCalMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to save",
      });
    } finally {
      setSavingCal(false);
    }
  };

  const handleSaveUmami = async (e: FormEvent) => {
    e.preventDefault();
    setSavingUmami(true);
    setUmamiMsg(null);
    try {
      // Only re-send the api_key if the user typed something other than
      // the masked placeholder. Sending the placeholder back would
      // overwrite the real key with literal "••••••••".
      const userTypedNewKey =
        umamiForm.api_key && !umamiForm.api_key.startsWith("••");

      // The backend's settings PATCH is a SHALLOW merge — sending
      // ``{settings: {umami: {website_id, api_url}}}`` replaces the
      // whole ``umami`` dict and drops the existing ``api_key``.
      // Pre-merge with the saved snapshot so unchanged fields survive.
      const existingUmami = readNested(snapshot?.settings, "umami");
      const umami: Record<string, string | null> = {
        ...(existingUmami as Record<string, string | null>),
        website_id: umamiForm.website_id.trim() || null,
        api_url: umamiForm.api_url.trim() || null,
      };
      if (userTypedNewKey) {
        umami.api_key = umamiForm.api_key.trim() || null;
      }
      const updated = await apiFetch<OrganizationSettings>(`/api/settings`, {
        method: "PATCH",
        body: JSON.stringify({ settings: { umami } }),
      });
      setSnapshot(updated);
      setUmamiMsg({ type: "success", text: "Umami settings saved." });
      // Re-mask the field so it doesn't echo back what the user just typed.
      if (userTypedNewKey) {
        setUmamiForm({ ...umamiForm, api_key: "••••••••" });
      }
    } catch (err) {
      setUmamiMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to save",
      });
    } finally {
      setSavingUmami(false);
    }
  };

  const handleTestUmami = async () => {
    setTestingUmami(true);
    setUmamiMsg(null);
    try {
      const result = await apiFetch<{ ok: boolean; detail: string }>(
        `/api/settings/umami/test`,
      );
      setUmamiMsg({
        type: result.ok ? "success" : "error",
        text: result.detail,
      });
    } catch (err) {
      setUmamiMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Test failed",
      });
    } finally {
      setTestingUmami(false);
    }
  };

  const handleSaveCompound = async (e: FormEvent) => {
    e.preventDefault();
    setSavingCompound(true);
    setCompoundMsg(null);
    try {
      const defaults: Record<string, unknown> = {};
      for (const phase of COMPOUND_PHASES) {
        const c = compound[phase];
        const cadence = c.cadence_per_week.trim() ? Number(c.cadence_per_week) : null;
        const kpi = c.kpi_target.trim() ? Number(c.kpi_target) : null;
        defaults[phase] = {
          cadence_per_week: cadence !== null && !Number.isNaN(cadence) ? cadence : null,
          kpi_target: kpi !== null && !Number.isNaN(kpi) ? kpi : null,
          content_mix: c.content_mix.trim() || null,
        };
      }
      await apiFetch<Record<string, unknown>>(
        `/api/settings/compound-method`,
        {
          method: "PUT",
          body: JSON.stringify({ compound_method_defaults: defaults }),
        },
      );
      setCompoundMsg({ type: "success", text: "Compound-Method defaults saved." });
      loadSettings();
    } catch (err) {
      setCompoundMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to save",
      });
    } finally {
      setSavingCompound(false);
    }
  };

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault();
    setPasswordLoading(true);
    setPasswordMessage(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      setPasswordMessage({ type: "success", text: "Password updated successfully." });
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setPasswordMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update password.",
      });
    } finally {
      setPasswordLoading(false);
    }
  }

  function renderMsg(m: Msg) {
    if (!m) return null;
    const Icon = m.type === "success" ? CheckCircle2 : AlertCircle;
    return (
      <div
        className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
          m.type === "success"
            ? "bg-stevie-green/5 border border-stevie-green/20 text-stevie-green"
            : "bg-red-50 border border-red-200 text-red-700"
        }`}
      >
        <Icon className="w-4 h-4 shrink-0 mt-0.5" />
        <span>{m.text}</span>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="heading-brand text-3xl">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account and organization settings.
        </p>
        {snapshot && (
          <p className="text-xs text-muted-foreground mt-2 font-mono">
            {snapshot.slug} · plan: {snapshot.plan}
          </p>
        )}
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-border p-12 text-center text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-3" />
          Loading settings...
        </div>
      ) : (
        <>
          {/* Team section link */}
          <Link
            href="/admin/settings/team"
            className="group flex items-center justify-between bg-white rounded-2xl border border-border p-6 mb-6 hover:border-stevie-green/40 hover:bg-stevie-green/5 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-stevie-green/10 text-stevie-green flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-semibold text-lg">Team</h2>
                <p className="text-sm text-muted-foreground">
                  Invite teammates, manage roles, and deactivate access.
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-stevie-green transition-colors" />
          </Link>

          {/* Organization */}
          <section className="bg-white rounded-2xl border border-border p-6 mb-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-lg bg-stevie-green/10 text-stevie-green flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-semibold text-lg">Organization</h2>
                <p className="text-sm text-muted-foreground">
                  Public name, custom domain, and logo.
                </p>
              </div>
            </div>
            <form onSubmit={handleSaveOrg} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Name</label>
                <input
                  type="text"
                  value={orgForm.name}
                  onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stevie-green/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Custom Domain
                </label>
                <input
                  type="text"
                  value={orgForm.domain}
                  onChange={(e) => setOrgForm({ ...orgForm, domain: e.target.value })}
                  placeholder="stevie.example.com"
                  className="w-full px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stevie-green/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Logo</label>
                <ImageUpload
                  value={orgForm.logo_url}
                  onChange={(url) => setOrgForm({ ...orgForm, logo_url: url })}
                  context="logo"
                  aspect="square"
                  placeholder="https://… (or paste a URL)"
                />
              </div>
              <div className="text-xs text-muted-foreground">
                Slug (<span className="font-mono">{snapshot?.slug}</span>) is immutable — it&apos;s used in public
                URLs. Contact support to request a rename.
              </div>
              {renderMsg(orgMsg)}
              <button
                type="submit"
                disabled={savingOrg}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-stevie-green text-white text-sm font-semibold rounded-full hover:bg-stevie-green-light transition-colors disabled:opacity-60"
              >
                {savingOrg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Organization
              </button>
            </form>
          </section>

          {/* Branding + email-from */}
          <section className="bg-white rounded-2xl border border-border p-6 mb-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-lg bg-stevie-green/10 text-stevie-green flex items-center justify-center">
                <Palette className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-semibold text-lg">Branding &amp; Email</h2>
                <p className="text-sm text-muted-foreground">
                  Brand colors used across the portal and email settings for
                  outgoing campaigns.
                </p>
              </div>
            </div>
            <form onSubmit={handleSaveBranding} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Primary Color</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={brandForm.brand_primary_color || "#7ad67c"}
                      onChange={(e) =>
                        setBrandForm({ ...brandForm, brand_primary_color: e.target.value })
                      }
                      className="h-10 w-12 rounded-lg border border-border cursor-pointer"
                    />
                    <input
                      type="text"
                      value={brandForm.brand_primary_color}
                      onChange={(e) =>
                        setBrandForm({ ...brandForm, brand_primary_color: e.target.value })
                      }
                      placeholder="#7ad67c"
                      className="flex-1 px-3 py-2.5 border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-stevie-green/30"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Accent Color</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={brandForm.brand_accent_color || "#ff8f5e"}
                      onChange={(e) =>
                        setBrandForm({ ...brandForm, brand_accent_color: e.target.value })
                      }
                      className="h-10 w-12 rounded-lg border border-border cursor-pointer"
                    />
                    <input
                      type="text"
                      value={brandForm.brand_accent_color}
                      onChange={(e) =>
                        setBrandForm({ ...brandForm, brand_accent_color: e.target.value })
                      }
                      placeholder="#ff8f5e"
                      className="flex-1 px-3 py-2.5 border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-stevie-green/30"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Email From</label>
                  <input
                    type="email"
                    value={brandForm.email_from}
                    onChange={(e) => setBrandForm({ ...brandForm, email_from: e.target.value })}
                    placeholder="hello@stevie.com"
                    className="w-full px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stevie-green/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Reply-To</label>
                  <input
                    type="email"
                    value={brandForm.email_reply_to}
                    onChange={(e) => setBrandForm({ ...brandForm, email_reply_to: e.target.value })}
                    placeholder="support@stevie.com"
                    className="w-full px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stevie-green/30"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Dashboard Intro</label>
                <textarea
                  rows={3}
                  value={brandForm.dashboard_intro}
                  onChange={(e) => setBrandForm({ ...brandForm, dashboard_intro: e.target.value })}
                  placeholder="Welcome line shown at the top of the admin dashboard."
                  className="w-full px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stevie-green/30"
                />
              </div>

              {renderMsg(brandMsg)}

              <button
                type="submit"
                disabled={savingBrand}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-stevie-green text-white text-sm font-semibold rounded-full hover:bg-stevie-green-light transition-colors disabled:opacity-60"
              >
                {savingBrand ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Branding
              </button>
            </form>
          </section>

          {/* Cal.com Booking */}
          <section className="bg-white rounded-2xl border border-border p-6 mb-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-lg bg-stevie-green/10 text-stevie-green flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-semibold text-lg">Booking (Cal.com)</h2>
                <p className="text-sm text-muted-foreground">
                  Powers the public <code className="font-mono text-xs">/book</code>
                  {" "}page. Leave any field empty to fall back to the email
                  contact form.
                </p>
              </div>
            </div>
            <form onSubmit={handleSaveCal} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Cal.com URL
                </label>
                <input
                  type="text"
                  inputMode="url"
                  value={calForm.url}
                  onChange={(e) =>
                    setCalForm({ ...calForm, url: e.target.value })
                  }
                  placeholder="https://book.example.com"
                  className="w-full px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stevie-green/30"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Your Cal.com instance — Cloud (cal.com) or self-hosted.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Username
                  </label>
                  <input
                    type="text"
                    value={calForm.username}
                    onChange={(e) =>
                      setCalForm({ ...calForm, username: e.target.value })
                    }
                    placeholder="kelsie"
                    className="w-full px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stevie-green/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Event slug
                  </label>
                  <input
                    type="text"
                    value={calForm.event_slug}
                    onChange={(e) =>
                      setCalForm({ ...calForm, event_slug: e.target.value })
                    }
                    placeholder="strategy-call"
                    className="w-full px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stevie-green/30"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Final URL embedded:{" "}
                <span className="font-mono">
                  {calForm.url
                    ? joinUrlPath(calForm.url, calForm.username || "{user}", calForm.event_slug || "{event}")
                    : "{cal_url}/{user}/{event}"}
                </span>
              </p>
              {renderMsg(calMsg)}
              <button
                type="submit"
                disabled={savingCal}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-stevie-green text-white text-sm font-semibold rounded-full hover:bg-stevie-green-light transition-colors disabled:opacity-60"
              >
                {savingCal ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Booking Config
              </button>
            </form>
          </section>

          {/* Umami Analytics */}
          <section className="bg-white rounded-2xl border border-border p-6 mb-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-lg bg-stevie-green/10 text-stevie-green flex items-center justify-center">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-semibold text-lg">Umami Analytics</h2>
                <p className="text-sm text-muted-foreground">
                  Pull daily traffic metrics into the dashboard. Leave the API
                  Key blank to use the instance-wide credentials.
                </p>
              </div>
            </div>
            <form onSubmit={handleSaveUmami} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Website ID
                </label>
                <input
                  type="text"
                  value={umamiForm.website_id}
                  onChange={(e) =>
                    setUmamiForm({ ...umamiForm, website_id: e.target.value })
                  }
                  placeholder="00000000-0000-0000-0000-000000000000"
                  className="w-full px-4 py-2.5 border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-stevie-green/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Umami URL
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    — optional override
                  </span>
                </label>
                <input
                  type="url"
                  value={umamiForm.api_url}
                  onChange={(e) =>
                    setUmamiForm({ ...umamiForm, api_url: e.target.value })
                  }
                  placeholder="https://stats.example.com"
                  className="w-full px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stevie-green/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  API Key
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    — optional override
                  </span>
                </label>
                <input
                  type="password"
                  value={umamiForm.api_key}
                  onChange={(e) =>
                    setUmamiForm({ ...umamiForm, api_key: e.target.value })
                  }
                  placeholder="Leave blank to use instance default"
                  autoComplete="new-password"
                  className="w-full px-4 py-2.5 border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-stevie-green/30"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Existing keys are masked. Type a new value to replace.
                </p>
              </div>
              {renderMsg(umamiMsg)}
              <div className="flex gap-3 flex-wrap">
                <button
                  type="submit"
                  disabled={savingUmami}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-stevie-green text-white text-sm font-semibold rounded-full hover:bg-stevie-green-light transition-colors disabled:opacity-60"
                >
                  {savingUmami ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Umami Config
                </button>
                <button
                  type="button"
                  onClick={handleTestUmami}
                  disabled={testingUmami}
                  className="inline-flex items-center gap-2 px-5 py-2.5 border border-border text-sm font-semibold rounded-full hover:bg-gray-50 transition-colors disabled:opacity-60"
                >
                  {testingUmami ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <BarChart3 className="w-4 h-4" />
                  )}
                  Test Connection
                </button>
              </div>
            </form>
          </section>

          {/* Compound Method Defaults */}
          <section className="bg-white rounded-2xl border border-border p-6 mb-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-lg bg-stevie-green/10 text-stevie-green flex items-center justify-center">
                <Target className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-semibold text-lg">Compound Method Defaults</h2>
                <p className="text-sm text-muted-foreground">
                  Per-phase cadence and KPI targets for Protect / Deepen / Amplify.
                  Owner-only.
                </p>
              </div>
            </div>
            <form onSubmit={handleSaveCompound} className="space-y-5">
              {COMPOUND_PHASES.map((phase) => (
                <div key={phase} className="border border-border rounded-xl p-4">
                  <div
                    className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full border capitalize mb-3 ${PHASE_COLORS[phase]}`}
                  >
                    {phase}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Cadence (per week)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={compound[phase].cadence_per_week}
                        onChange={(e) =>
                          setCompound({
                            ...compound,
                            [phase]: { ...compound[phase], cadence_per_week: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stevie-green/30"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        KPI Target
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={compound[phase].kpi_target}
                        onChange={(e) =>
                          setCompound({
                            ...compound,
                            [phase]: { ...compound[phase], kpi_target: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stevie-green/30"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Content Mix
                      </label>
                      <input
                        type="text"
                        value={compound[phase].content_mix}
                        onChange={(e) =>
                          setCompound({
                            ...compound,
                            [phase]: { ...compound[phase], content_mix: e.target.value },
                          })
                        }
                        placeholder="e.g. 40% educational, 30% story, 30% CTA"
                        className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stevie-green/30"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {renderMsg(compoundMsg)}

              <button
                type="submit"
                disabled={savingCompound}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-stevie-green text-white text-sm font-semibold rounded-full hover:bg-stevie-green-light transition-colors disabled:opacity-60"
              >
                {savingCompound ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Compound-Method Defaults
              </button>
            </form>
          </section>

          {/* Password */}
          <section className="bg-white rounded-2xl border border-border p-6 mb-6">
            <h2 className="font-semibold text-lg mb-1">Change Password</h2>
            <p className="text-sm text-muted-foreground mb-5">
              Update your account password. You&apos;ll stay signed in after the change.
            </p>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label htmlFor="current-password" className="block text-sm font-medium mb-1.5">
                  Current Password
                </label>
                <input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stevie-green/30"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label htmlFor="new-password" className="block text-sm font-medium mb-1.5">
                  New Password
                </label>
                <input
                  id="new-password"
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stevie-green/30"
                  placeholder="••••••••"
                />
              </div>
              {renderMsg(passwordMessage)}
              <button
                type="submit"
                disabled={passwordLoading || !newPassword}
                className="px-5 py-2.5 bg-stevie-green text-white text-sm font-semibold rounded-full hover:bg-stevie-green-light transition-colors disabled:opacity-60"
              >
                {passwordLoading ? "Updating..." : "Update Password"}
              </button>
            </form>
          </section>

          {/* Danger zone */}
          <section className="bg-white rounded-2xl border border-stevie-orange/20 p-6">
            <h2 className="font-semibold text-lg mb-1 text-stevie-orange">Danger Zone</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Irreversible actions. Proceed with caution.
            </p>
            <button
              disabled
              className="px-5 py-2.5 border border-stevie-orange/30 text-stevie-orange text-sm font-medium rounded-full hover:bg-stevie-orange/5 transition-colors disabled:opacity-50"
            >
              Delete Organization (coming soon)
            </button>
          </section>
        </>
      )}
    </div>
  );
}
