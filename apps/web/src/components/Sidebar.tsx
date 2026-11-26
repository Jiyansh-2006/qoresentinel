import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Layers,
  FileText,
  Bot,
  ShieldCheck,
  Receipt,
  History,
  Home,
  MessageCircle,
  LogIn,
  UserPlus,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.js";

interface SidebarProps {
  mobileNavOpen: boolean;
  onNavigate: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileNavOpen, onNavigate }) => {
  const { user } = useAuth();
  const navItems = [
    { to: "/", label: "Landing Overview", icon: Home, exact: true },
    ...(user ? [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard }] : []),
    { to: "/pools", label: "Grant Pools", icon: Layers },
    ...(user ? [{ to: "/applications", label: "Applications", icon: FileText }] : []),
    ...(user ? [{ to: "/transactions", label: "Transactions", icon: Receipt }] : []),
    ...(user?.role === "ADMIN" ? [
      { to: "/agents", label: "AI Agent Centre", icon: Bot },
      { to: "/security", label: "Security & PQC", icon: ShieldCheck },
      { to: "/audit", label: "Audit Trail", icon: History },
    ] : []),
    { to: "/assistant", label: "Help Assistant", icon: MessageCircle },
    ...(!user ? [
      { to: "/login", label: "Sign in", icon: LogIn },
      { to: "/register/student", label: "Create account", icon: UserPlus },
    ] : []),
  ];

  return (
    <aside id="mobile-navigation" className={`${mobileNavOpen ? "flex" : "hidden"} w-full md:flex md:w-64 md:shrink-0 border-b md:border-b-0 md:border-r border-slate-800 bg-[#070b14] md:flex-col md:justify-between p-2 md:p-4 md:min-h-[calc(100vh-4rem)]`}>
      <div className="flex min-w-0 flex-1 flex-col gap-1 md:block md:space-y-1">
        <div className="hidden md:block px-3 py-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
          Platform Menu
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-2 md:gap-3 px-3 py-2 md:py-2.5 rounded-lg text-xs md:text-sm font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-sm shadow-cyan-500/10"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                }`
              }
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>

      {/* PQC Security Footer Indicator */}
      <div className="hidden md:block p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400 font-medium">Post-Quantum</span>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-800">
            ARMORED
          </span>
        </div>
        <p className="text-[11px] text-slate-500 font-mono leading-tight">
          NIST FIPS 204 ML-DSA-87 Level 5 Lattice Signatures Active
        </p>
      </div>
    </aside>
  );
};
