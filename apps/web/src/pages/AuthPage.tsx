import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext.js";

type FieldName =
  | "fullName"
  | "email"
  | "college"
  | "studentId"
  | "department"
  | "course"
  | "academicYear"
  | "phone"
  | "organisation"
  | "organisationDetails"
  | "invitationCode"
  | "password"
  | "confirmPassword";

const studentFields: Array<{ name: FieldName; label: string; type?: string }> = [
  { name: "fullName", label: "Full name" },
  { name: "email", label: "Email address", type: "email" },
  { name: "college", label: "College / university" },
  { name: "studentId", label: "Student ID" },
  { name: "department", label: "Department" },
  { name: "course", label: "Course / degree" },
  { name: "academicYear", label: "Academic year" },
  { name: "phone", label: "Phone number", type: "tel" },
];

const adminFields: Array<{ name: FieldName; label: string; type?: string }> = [
  { name: "fullName", label: "Full name" },
  { name: "organisation", label: "Organisation" },
  { name: "email", label: "Work email", type: "email" },
  { name: "phone", label: "Phone number", type: "tel" },
  { name: "organisationDetails", label: "Organisation details", type: "textarea" },
  { name: "invitationCode", label: "Administrator invitation code", type: "password" },
];

const fieldClass = "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500";

export const AuthPage: React.FC = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { login, register, error: sessionError } = useAuth();
  const isRegister = pathname.startsWith("/register");
  const role = pathname.endsWith("/admin") ? "ADMIN" : "STUDENT";
  const [values, setValues] = useState<Partial<Record<FieldName, string>>>({});
  const [rememberMe, setRememberMe] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (name: FieldName, value: string) => setValues((current) => ({ ...current, [name]: value }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (isRegister) {
        await register(role, Object.fromEntries(
          Object.entries(values).filter((entry): entry is [string, string] => typeof entry[1] === "string")
        ));
      } else {
        await login(values.email || "", values.password || "", rememberMe);
      }
      navigate("/dashboard", { replace: true });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "The request could not be completed.");
    } finally {
      setSubmitting(false);
    }
  };

  const fields = isRegister ? (role === "ADMIN" ? adminFields : studentFields) : [
    { name: "email" as const, label: "Email address", type: "email" },
  ];

  return (
    <div className="mx-auto max-w-xl py-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{isRegister ? "Create your account" : "Sign in to QoreSentinel"}</h1>
            <p className="mt-1 text-xs text-slate-400">
              {isRegister ? "Your account is separate from your QoreX wallet." : "Use your registered email and password."}
            </p>
          </div>
        </div>

        {isRegister && (
          <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl border border-slate-800 bg-slate-950 p-1">
            <Link
              to="/register/student"
              className={`rounded-lg px-3 py-2 text-center text-xs font-medium ${role === "STUDENT" ? "bg-cyan-500/15 text-cyan-300" : "text-slate-400 hover:text-slate-200"}`}
            >
              Student account
            </Link>
            <Link
              to="/register/admin"
              className={`rounded-lg px-3 py-2 text-center text-xs font-medium ${role === "ADMIN" ? "bg-cyan-500/15 text-cyan-300" : "text-slate-400 hover:text-slate-200"}`}
            >
              Administrator
            </Link>
          </div>
        )}

        {sessionError && !error && (
          <p role="status" className="mb-4 rounded-lg border border-amber-800 bg-amber-950/30 p-3 text-xs text-amber-200">
            {sessionError}
          </p>
        )}
        {error && (
          <p role="alert" className="mb-4 rounded-lg border border-rose-800 bg-rose-950/30 p-3 text-xs text-rose-200">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((field) => (
              <label key={field.name} className={`block space-y-1.5 text-xs text-slate-300 ${field.type === "textarea" ? "sm:col-span-2" : ""}`}>
                <span>{field.label}</span>
                {field.type === "textarea" ? (
                  <textarea
                    required
                    minLength={10}
                    rows={3}
                    value={values[field.name] || ""}
                    onChange={(event) => update(field.name, event.target.value)}
                    className={fieldClass}
                  />
                ) : (
                  <input
                    required
                    type={field.type || "text"}
                    autoComplete={field.name === "email" ? "email" : field.name === "phone" ? "tel" : "off"}
                    value={values[field.name] || ""}
                    onChange={(event) => update(field.name, event.target.value)}
                    className={fieldClass}
                  />
                )}
              </label>
            ))}

            <label className="block space-y-1.5 text-xs text-slate-300">
              <span>Password</span>
              <input
                required
                minLength={isRegister ? 12 : 1}
                maxLength={72}
                type="password"
                autoComplete={isRegister ? "new-password" : "current-password"}
                value={values.password || ""}
                onChange={(event) => update("password", event.target.value)}
                className={fieldClass}
              />
              {isRegister && <span className="block text-[11px] text-slate-500">Use at least 12 characters.</span>}
            </label>

            {isRegister ? (
              <label className="block space-y-1.5 text-xs text-slate-300">
                <span>Confirm password</span>
                <input
                  required
                  minLength={12}
                  maxLength={72}
                  type="password"
                  autoComplete="new-password"
                  value={values.confirmPassword || ""}
                  onChange={(event) => update("confirmPassword", event.target.value)}
                  className={fieldClass}
                />
              </label>
            ) : (
              <label className="flex items-center gap-2 self-end pb-2 text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                  className="accent-cyan-500"
                />
                Keep me signed in for 30 days
              </label>
            )}
          </div>

          {role === "ADMIN" && isRegister && (
            <p className="rounded-lg border border-amber-800/60 bg-amber-950/20 p-3 text-xs text-amber-200">
              Administrator registration is invitation-only. Ask your platform owner for a server-issued invitation code.
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-900/20 transition hover:opacity-95 disabled:cursor-wait disabled:opacity-50"
          >
            {submitting ? "Please wait..." : isRegister ? "Create account" : "Sign in"}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-slate-400">
          {isRegister ? "Already registered?" : "Need an account?"}{" "}
          <Link to={isRegister ? "/login" : "/register/student"} className="font-medium text-cyan-300 hover:text-cyan-200">
            {isRegister ? "Sign in" : "Register"}
          </Link>
        </p>
      </div>
    </div>
  );
};
