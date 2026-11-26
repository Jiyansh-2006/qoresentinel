import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import { Navbar } from "./Navbar.js";
import { Sidebar } from "./Sidebar.js";

export const Layout: React.FC = () => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-[#070b14]">
      <Navbar mobileNavOpen={mobileNavOpen} onToggleMobileNav={() => setMobileNavOpen((open) => !open)} />
      <div className="flex-1 flex flex-col md:flex-row min-w-0">
        <Sidebar mobileNavOpen={mobileNavOpen} onNavigate={() => setMobileNavOpen(false)} />
        <main className="flex-1 min-w-0 p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
