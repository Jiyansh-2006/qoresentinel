import React from "react";
import { Outlet } from "react-router-dom";
import { Navbar } from "./Navbar.js";
import { Sidebar } from "./Sidebar.js";

export const Layout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-[#070b14]">
      <Navbar />
      <div className="flex-1 flex">
        <Sidebar />
        <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
