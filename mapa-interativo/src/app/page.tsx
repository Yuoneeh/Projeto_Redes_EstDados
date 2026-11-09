import React from "react";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Footer from "@/components/Footer";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1724] text-[#e5edf6] selection:bg-[#0096c7] selection:text-white">
      <Navbar />
      <main className="flex-1 w-full flex flex-col">
        <Hero />
      </main>
      <Footer />
    </div>
  );
}
