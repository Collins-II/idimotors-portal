"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { CarFront, Loader2, LockKeyhole } from "lucide-react";
import { PreferenceSwitchers } from "@/components/dealer/shell";
import { usePreferences } from "@/lib/client/preferences";

/** Only allow same-site relative callback paths to avoid open redirects. */
function safeCallback(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/login") ? value : "/";
}

export function LoginForm() {
  const { t } = usePreferences();
  const params = useSearchParams();
  const callbackUrl = safeCallback(params.get("callbackUrl"));
  const [error, setError] = useState(params.get("error") ? t("login.invalid") : "");
  const [working, setWorking] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setWorking(true);
    setError("");
    const result = await signIn("credentials", { email: form.get("email"), password: form.get("password"), redirect: false }).catch(() => null);
    if (result?.ok && !result.error) {
      window.location.assign(callbackUrl);
      return;
    }
    setWorking(false);
    setError(!result ? t("common.offline") : result.error === "CredentialsSignin" ? t("login.invalid") : result.error ?? t("login.invalid"));
  }

  return (
    <main className="login-page">
      <div className="login-card">
        <div className="login-brand"><span className="brand-mark"><CarFront size={25} strokeWidth={1.7} /></span><span>IDI Motors<span className="brand-dot">.</span><small>DEALER PORTAL</small></span></div>
        <h1>{t("login.title")}</h1>
        <p>{t("login.subtitle")}</p>
        <form onSubmit={submit}>
          <label className="form-field"><span>{t("login.email")}</span><input name="email" type="email" autoComplete="username" required autoFocus /></label>
          <label className="form-field"><span>{t("login.password")}</span><input name="password" type="password" autoComplete="current-password" required /></label>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="primary-button" disabled={working}>{working ? <Loader2 size={16} className="spin" /> : <LockKeyhole size={16} />}{working ? t("login.working") : t("login.submit")}</button>
        </form>
        <small className="login-help">{t("login.help")}</small>
        <PreferenceSwitchers />
      </div>
    </main>
  );
}
