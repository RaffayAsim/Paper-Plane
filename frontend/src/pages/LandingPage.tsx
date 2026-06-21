import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowRight, Bot, Check, ChevronDown, Database,
  Mail, TrendingUp, Users, Send, Sparkles, Layers, X,
  Shield, BarChart3, Star, Play, CheckCircle2
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

gsap.registerPlugin(ScrollTrigger);

// ─── Animated Counter ──────────────────────────────────────────────────────
function AnimatedCounter({ to, suffix = "", prefix = "" }: { to: number; suffix?: string; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obj = { val: 0 };
    ScrollTrigger.create({
      trigger: el, start: "top 85%", once: true,
      onEnter: () => {
        gsap.to(obj, {
          val: to, duration: 2.2, ease: "power2.out",
          onUpdate: () => { el.textContent = prefix + Math.round(obj.val).toLocaleString() + suffix; },
        });
      },
    });
  }, [to, suffix, prefix]);
  return <span ref={ref}>{prefix}0{suffix}</span>;
}

// ─── Accordion ─────────────────────────────────────────────────────────────
function AccordionItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!bodyRef.current) return;
    if (open) {
      gsap.fromTo(bodyRef.current, { height: 0, opacity: 0 }, { height: "auto", opacity: 1, duration: 0.32, ease: "power2.out" });
    } else {
      gsap.to(bodyRef.current, { height: 0, opacity: 0, duration: 0.22, ease: "power2.in" });
    }
  }, [open]);
  return (
    <div className="border-b border-orange-100 last:border-0">
      <button onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-5 text-left text-sm font-semibold text-gray-800 hover:text-orange-500 transition-colors gap-4">
        <span>{q}</span>
        <ChevronDown className={`shrink-0 h-4 w-4 text-orange-500 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>
      <div ref={bodyRef} style={{ height: 0, overflow: "hidden", opacity: 0 }}>
        <p className="pb-5 text-sm leading-relaxed text-gray-500">{a}</p>
      </div>
    </div>
  );
}

// ─── Data ──────────────────────────────────────────────────────────────────
const capabilities = [
  { icon: Mail, title: "Precision Email Dispatching", desc: "Craft and execute targeted B2B sequences that land directly in primary inboxes using our advanced pacing protocols.", color: "orange" },
  { icon: Layers, title: "Visual HTML/CSS Designer", desc: "Build rich, highly engaging HTML templates or clean plain-text sequences inside our live visual customizer.", color: "amber" },
  { icon: Database, title: "Unified B2B Contact CRM", desc: "No more disconnected CSV sheets. Clean, track, tag, and organize all of your accounts and prospects in a single home.", color: "orange" },
  { icon: TrendingUp, title: "Anti-Spam Pacing Delays", desc: "Protect your domain reputation. Outbound campaigns automatically implement smart pacing intervals between dispatches.", color: "amber" },
  { icon: Bot, title: "RAG AI Personalization", desc: "Reference recipient business context, specific products, and custom fields to draft messages that read like 1:1 outreach.", color: "orange" },
  { icon: Users, title: "Round-Robin Load Balancer", desc: "Scale campaigns seamlessly by routing sent messages across multiple linked sender domains and SMTP accounts automatically.", color: "amber" },
];

const workflowSteps = [
  { num: "01", icon: Database, title: "Import & Organize Contacts", desc: "Upload CSV sheets, tag targets, and define merge fields inside a single clean B2B contact manager. Segmentation is instant." },
  { num: "02", icon: Mail, title: "Design Your Campaigns", desc: "Compose campaigns utilizing our visual customizer. Personalize variables and test rendering on the fly with live preview." },
  { num: "03", icon: Shield, title: "Configure Anti-Spam Protection", desc: "Link domains and set pacing rules. Paper Plan balances dispatches and spaces them out to guarantee organic deliverability." },
  { num: "04", icon: BarChart3, title: "Track & Optimize", desc: "Monitor open rates, click-throughs, and replies in real-time. Make data-driven decisions that increase conversions." },
];

const faqs = [
  { q: "What is Paper Plan?", a: "Paper Plan is a dedicated email marketing and automated outreach sequencer. It integrates campaign setup, a visual drag-and-drop template designer, domain-safety pacing, and a unified CRM to manage leads and replies in one single dashboard." },
  { q: "Can I connect my own SMTP and sending domains?", a: "Yes. Paper Plan is designed with open delivery architecture. You can connect any business SMTP server, Google Workspace, Microsoft 365, or specialized deliverability infrastructure, and set up round-robin sending rules." },
  { q: "How does the anti-spam sequence pacing work?", a: "To protect your sender domain reputation, Paper Plan spaces out consecutive email dispatches by a configurable interval (typically 5 to 10 seconds). This keeps your outbound sequences looking completely organic to email providers." },
  { q: "Do you support custom templates and HTML design?", a: "Absolutely. Paper Plan comes with a live visual HTML customizer. You can write simple plain-text emails or build complex responsive custom designs, complete with live previews and dynamic data tags." },
  { q: "Are there cold outbound constraints?", a: "Traditional newsletter tools immediately suspend accounts that import cold contact lists. Paper Plan is built with safety guards that allow you to upload and contact verified business leads, using our built-in pacing to protect your senders." }
];

const testimonials = [
  { name: "Marcus T.", role: "Head of Growth, SaaSify", text: "Paper Plan completely replaced our outbound stack. Our inbox placement went from 60% to 98% in the first week.", rating: 5 },
  { name: "Sofia R.", role: "Agency Founder, DigitalEdge", text: "We run campaigns for 12 clients simultaneously. The round-robin load balancing is a game-changer for our operations.", rating: 5 },
  { name: "James K.", role: "Sales Director, Nexalpha", text: "The visual HTML designer saves us hours every campaign cycle. Our email CTR doubled since switching to Paper Plan.", rating: 5 },
];

export default function LandingPage() {
  const { user } = useAuth();
  const heroRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);

  // Hero entrance animation
  useEffect(() => {
    if (!heroRef.current) return;
    const els = heroRef.current.querySelectorAll(".hero-anim");
    gsap.fromTo(els,
      { opacity: 0, y: 40, filter: "blur(6px)" },
      { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.85, ease: "power3.out", stagger: 0.1, delay: 0.1 }
    );
  }, []);

  // Nav scroll
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Global reveal-up
  useEffect(() => {
    const els = gsap.utils.toArray<HTMLElement>(".reveal-up");
    els.forEach((el, i) => {
      gsap.fromTo(el,
        { opacity: 0, y: 36 },
        {
          opacity: 1, y: 0, duration: 0.7, ease: "power3.out",
          delay: (i % 3) * 0.05,
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
        }
      );
    });
    return () => { ScrollTrigger.getAll().forEach((t) => t.kill()); };
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased overflow-x-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── NAV ─────────────────────────────────────────────────────── */}
      <nav ref={navRef}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-white/95 backdrop-blur-xl shadow-sm border-b border-gray-100" : "bg-transparent"}`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "linear-gradient(135deg, #f97316, #fb923c)" }}>
              <Send className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-gray-900">Paper Plan</span>
          </div>

          {/* Nav Links */}
          <div className="hidden items-center gap-8 md:flex">
            {[["Features", "#features"], ["How It Works", "#how-it-works"], ["Pricing", "#pricing"], ["Why Us", "#comparison"], ["FAQ", "#faq"]].map(([label, href]) => (
              <a key={label} href={href} className="text-sm font-medium text-gray-600 transition-colors hover:text-orange-500">{label}</a>
            ))}
          </div>

          {/* CTA */}
          <div className="flex items-center gap-3">
            <Link to={user ? "/dashboard" : "/auth"}>
              <button className="text-sm font-medium text-gray-600 hover:text-orange-500 transition-colors px-3 py-2">
                {user ? "Dashboard" : "Log in"}
              </button>
            </Link>
            <Link to={user ? "/dashboard" : "/auth?tab=signup"}>
              <button className="group flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 shadow-lg"
                style={{ background: "linear-gradient(135deg, #f97316, #ea580c)", boxShadow: "0 4px 14px rgba(249,115,22,0.35)" }}>
                Start Free <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────── */}
      <section className="relative pt-28 pb-20 overflow-hidden" style={{ background: "linear-gradient(160deg, #fff7ed 0%, #ffffff 50%, #fff7ed 100%)" }}>
        {/* Decorative orbs */}
        <div className="absolute top-[-100px] right-[-150px] w-[600px] h-[600px] rounded-full opacity-30 pointer-events-none" style={{ background: "radial-gradient(circle, #fed7aa, transparent 70%)" }} />
        <div className="absolute bottom-[-80px] left-[-120px] w-[400px] h-[400px] rounded-full opacity-20 pointer-events-none" style={{ background: "radial-gradient(circle, #fdba74, transparent 70%)" }} />

        <div ref={heroRef} className="relative mx-auto max-w-7xl px-6">
          {/* Top badge */}
          <div className="hero-anim flex justify-center mb-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.25em] text-orange-600">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
              Premium B2B Email Outreach Platform
            </span>
          </div>

          {/* Headline */}
          <div className="hero-anim text-center">
            <h1 className="text-5xl font-extrabold leading-[1.08] tracking-tight text-gray-900 sm:text-6xl md:text-7xl lg:text-[80px]">
              Send smarter emails.
              <br />
              <span className="relative inline-block" style={{ backgroundImage: "linear-gradient(135deg, #f97316, #ea580c)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                Close more deals.
              </span>
            </h1>
          </div>

          {/* Subheading */}
          <div className="hero-anim text-center mt-6">
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-gray-500 sm:text-xl">
              Paper Plan unifies your visual email designer, B2B CRM, anti-spam pacing engine, and AI personalization into one powerful outreach dashboard.
            </p>
          </div>

          {/* CTAs */}
          <div className="hero-anim flex flex-wrap items-center justify-center gap-4 mt-10">
            <Link to={user ? "/dashboard" : "/auth?tab=signup"}>
              <button className="group flex items-center gap-2 rounded-xl px-8 py-4 text-base font-bold text-white transition-all hover:opacity-90 hover:scale-[1.02]"
                style={{ background: "linear-gradient(135deg, #f97316, #ea580c)", boxShadow: "0 8px 28px rgba(249,115,22,0.35)" }}>
                Start for Free – No Card Needed
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
            </Link>
            <a href="#how-it-works">
              <button className="flex items-center gap-2 rounded-xl border-2 border-gray-200 bg-white px-8 py-4 text-base font-semibold text-gray-700 transition-all hover:border-orange-300 hover:text-orange-500">
                <Play className="h-4 w-4 text-orange-500" />
                See How It Works
              </button>
            </a>
          </div>

          {/* Social proof strip */}
          <div className="hero-anim flex flex-wrap items-center justify-center gap-6 mt-10 text-sm text-gray-500">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Free trial, instant access</span>
            <span className="text-gray-200">|</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> SMTP &amp; IMAP compatible</span>
            <span className="text-gray-200">|</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> 99.8% inbox placement</span>
          </div>
        </div>

        {/* Dashboard mockup card */}
        <div className="hero-anim relative mx-auto mt-16 max-w-5xl px-6">
          <div className="relative rounded-2xl bg-white border border-gray-100 shadow-2xl overflow-hidden" style={{ boxShadow: "0 40px 100px rgba(249,115,22,0.08), 0 20px 40px rgba(0,0,0,0.08)" }}>
            {/* Browser bar */}
            <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-5 py-3">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-red-400" />
                <div className="h-3 w-3 rounded-full bg-amber-400" />
                <div className="h-3 w-3 rounded-full bg-emerald-400" />
              </div>
              <div className="flex-1 mx-4 rounded-md bg-white border border-gray-200 px-3 py-1.5 text-xs text-gray-400 font-mono">
                app.paperplan.io/dashboard
              </div>
            </div>

            {/* Mock dashboard content */}
            <div className="grid grid-cols-[220px_1fr] min-h-[360px]">
              {/* Sidebar mock */}
              <div className="border-r border-gray-100 bg-gray-50/50 p-4">
                <div className="flex items-center gap-2 mb-6 px-2">
                  <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}>
                    <Send className="h-3.5 w-3.5 text-white" />
                  </div>
                  <span className="text-sm font-bold text-gray-800">Paper Plan</span>
                </div>
                <div className="space-y-1">
                  {[
                    { icon: BarChart3, label: "Overview", active: true },
                    { icon: Mail, label: "Campaigns" },
                    { icon: Database, label: "CRM Leads" },
                    { icon: Layers, label: "Templates" },
                    { icon: TrendingUp, label: "Analytics" },
                    { icon: Bot, label: "AI Outreach" },
                  ].map(({ icon: Icon, label, active }) => (
                    <div key={label} className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${active ? "text-orange-600 bg-orange-50 border border-orange-100" : "text-gray-500 hover:bg-gray-100"}`}>
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Main content mock */}
              <div className="p-6">
                {/* Stats row */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  {[
                    { label: "Emails Sent", value: "12,847", trend: "+24%", color: "orange" },
                    { label: "Open Rate", value: "68.4%", trend: "+8%", color: "emerald" },
                    { label: "Replies", value: "1,203", trend: "+31%", color: "blue" },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{stat.label}</p>
                      <p className="mt-1 text-xl font-black text-gray-800">{stat.value}</p>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${stat.color === "orange" ? "text-orange-500" : stat.color === "emerald" ? "text-emerald-500" : "text-blue-500"}`}>
                        <TrendingUp className="h-2.5 w-2.5" />{stat.trend} this week
                      </span>
                    </div>
                  ))}
                </div>

                {/* Campaign list mock */}
                <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                    <span className="text-xs font-bold text-gray-700">Active Campaigns</span>
                    <span className="text-[10px] text-orange-500 font-semibold cursor-pointer">View All →</span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {[
                      { name: "Q3 SaaS Outreach", status: "Running", rate: "72%", color: "emerald" },
                      { name: "Agency Cold Sequence", status: "Running", rate: "64%", color: "emerald" },
                      { name: "Follow-up Wave 2", status: "Paused", rate: "58%", color: "amber" },
                    ].map((camp) => (
                      <div key={camp.name} className="flex items-center justify-between px-4 py-2.5">
                        <div>
                          <p className="text-xs font-semibold text-gray-700">{camp.name}</p>
                          <span className={`text-[9px] font-bold uppercase tracking-wider ${camp.color === "emerald" ? "text-emerald-500" : "text-amber-500"}`}>{camp.status}</span>
                        </div>
                        <span className="text-xs font-black text-gray-800">{camp.rate}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS STRIP ─────────────────────────────────────────────── */}
      <section className="border-y border-orange-100 bg-orange-50 py-10">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4 text-center">
            {[
              { value: 99.8, suffix: "%", label: "Avg. Inbox Placement" },
              { value: 1200, suffix: "+", label: "Active B2B Teams" },
              { value: 68, suffix: "%", label: "Average Open Rate" },
              { value: 10, suffix: "s", prefix: "5-", label: "Smart Dispatch Interval" },
            ].map((stat) => (
              <div key={stat.label} className="reveal-up">
                <p className="text-4xl font-black text-orange-500 sm:text-5xl">
                  <AnimatedCounter to={stat.value} suffix={stat.suffix} prefix={stat.prefix || ""} />
                </p>
                <p className="mt-2 text-sm font-medium text-gray-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES GRID ───────────────────────────────────────────── */}
      <section id="features" className="py-24 bg-white">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 text-center reveal-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-orange-600 mb-5">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
              Core Capabilities
            </span>
            <h2 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
              Everything you need to run<br />
              <span style={{ backgroundImage: "linear-gradient(135deg, #f97316, #ea580c)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                high-converting campaigns
              </span>
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-gray-500">
              Paper Plan handles delivery pacing, template design, AI personalization, and lead management — all natively, in one dashboard.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {capabilities.map((cap, i) => (
              <div key={cap.title}
                className="reveal-up group flex flex-col rounded-2xl border border-gray-100 bg-white p-7 transition-all duration-300 hover:border-orange-200 hover:shadow-lg cursor-default"
                style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl transition-all group-hover:scale-110"
                  style={{ background: i % 2 === 0 ? "linear-gradient(135deg, #fff7ed, #fed7aa)" : "linear-gradient(135deg, #fef3c7, #fde68a)", border: "1px solid #fed7aa" }}>
                  <cap.icon className="h-5 w-5 text-orange-500" />
                </div>
                <h3 className="font-bold text-gray-800 text-base mb-2">{cap.title}</h3>
                <p className="flex-1 text-sm leading-relaxed text-gray-500">{cap.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-24" style={{ background: "linear-gradient(160deg, #fff7ed 0%, #ffffff 100%)" }}>
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 text-center reveal-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-orange-600 mb-5">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
              How It Works
            </span>
            <h2 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
              Pristine delivery.{" "}
              <span style={{ backgroundImage: "linear-gradient(135deg, #f97316, #ea580c)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                Step by step.
              </span>
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-gray-500">
              Four simple steps from raw contact list to replied-to emails.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {workflowSteps.map((step, i) => (
              <div key={step.num} className="reveal-up relative">
                {/* Connector line */}
                {i < workflowSteps.length - 1 && (
                  <div className="hidden lg:block absolute top-10 left-[calc(100%-0px)] w-full h-px border-t-2 border-dashed border-orange-200 z-0" style={{ width: "calc(100% - 80px)", left: "80px", top: "40px" }} />
                )}
                <div className="relative z-10 flex flex-col rounded-2xl border border-gray-100 bg-white p-6 h-full transition-all duration-300 hover:border-orange-200 hover:shadow-md"
                  style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl text-white font-black text-sm"
                      style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}>
                      {step.num}
                    </div>
                    <step.icon className="h-5 w-5 text-orange-400" />
                  </div>
                  <h3 className="text-base font-bold text-gray-800 mb-2">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-gray-500 flex-1">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ────────────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 text-center reveal-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-orange-600 mb-5">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
              Customer Stories
            </span>
            <h2 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
              Teams that{" "}
              <span style={{ backgroundImage: "linear-gradient(135deg, #f97316, #ea580c)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                love Paper Plan
              </span>
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {testimonials.map((t) => (
              <div key={t.name} className="reveal-up rounded-2xl border border-gray-100 bg-white p-7 transition-all duration-300 hover:border-orange-200 hover:shadow-md"
                style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 text-orange-400 fill-orange-400" />
                  ))}
                </div>
                <p className="text-sm leading-relaxed text-gray-600 mb-5 italic">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}>
                    {t.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800">{t.name}</p>
                    <p className="text-xs text-gray-400">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMPARISON ──────────────────────────────────────────────── */}
      <section id="comparison" className="py-24 border-y border-orange-100" style={{ background: "linear-gradient(160deg, #fff7ed 0%, #ffffff 100%)" }}>
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-16 text-center reveal-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-orange-600 mb-5">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
              Why Paper Plan
            </span>
            <h2 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
              Built for sequence delivery,{" "}
              <span style={{ backgroundImage: "linear-gradient(135deg, #f97316, #ea580c)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                not newsletter blasters
              </span>
            </h2>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            {/* Traditional Tools */}
            <div className="reveal-up rounded-2xl border border-gray-200 bg-white/60 p-8 opacity-80">
              <h3 className="text-lg font-black text-gray-700 mb-2 flex items-center gap-2">
                <span className="text-gray-400 text-sm font-bold bg-gray-100 px-2 py-0.5 rounded">VS</span> Traditional Builders
              </h3>
              <p className="text-xs text-gray-400 mb-6">e.g. HubSpot, Mailchimp</p>
              <ul className="space-y-4">
                {[
                  "Block your domain when importing cold B2B prospecting lists",
                  "Force you to use shared IP pools with damaged sender scores",
                  "Charge per contact with no simple flat-rate pricing option",
                ].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-sm">
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                    <span className="text-gray-500">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Paper Plan */}
            <div className="reveal-up rounded-2xl border-2 border-orange-400 bg-white p-8 shadow-lg relative"
              style={{ boxShadow: "0 8px 32px rgba(249,115,22,0.12)" }}>
              <div className="absolute -top-3.5 right-6">
                <span className="text-[10px] font-black uppercase tracking-widest text-white px-3 py-1 rounded-full"
                  style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}>
                  The Better Choice
                </span>
              </div>
              <h3 className="text-lg font-black text-gray-900 mb-2 flex items-center gap-2">
                <span className="text-orange-500 text-sm font-bold bg-orange-50 px-2 py-0.5 rounded border border-orange-100">✓</span> Paper Plan
              </h3>
              <p className="text-xs text-orange-400 mb-6">Open architecture, safety-first delivery</p>
              <ul className="space-y-4">
                {[
                  "Real built-in B2B CRM to track history, tags, and pipeline status",
                  "Visual drag-and-drop HTML template designer with live preview",
                  "Connect any SMTP — Google, Outlook, or custom infrastructure",
                ].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-sm">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    <span className="text-gray-700 font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING ─────────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 bg-white">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 text-center reveal-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-orange-600 mb-5">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
              Plans &amp; Pricing
            </span>
            <h2 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
              Simple,{" "}
              <span style={{ backgroundImage: "linear-gradient(135deg, #f97316, #ea580c)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                transparent plans
              </span>
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-gray-500">
              Start completely free on our trial. Test our pacing engine and upgrade when you're ready to scale.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 max-w-4xl mx-auto items-start">
            {/* Free Trial */}
            <div className="reveal-up flex flex-col rounded-2xl border border-gray-200 bg-white p-8 transition-all duration-300 hover:border-orange-200 hover:shadow-md"
              style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xl font-bold text-gray-800">Free Trial</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">Current</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed mb-6">
                Test deliverability and experience the custom HTML builder with zero obligation.
              </p>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-5xl font-black text-gray-900">$0</span>
                <span className="text-sm text-gray-400">lifetime limit</span>
              </div>
              <div className="border-t border-gray-100 pt-6 mb-8">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">What's included:</p>
                <ul className="space-y-3 text-sm">
                  {[
                    { text: "20 Lifetime Email Sends", bold: true },
                    { text: "Connect Custom Mailboxes (SMTP/IMAP)" },
                    { text: "Unified B2B Contact CRM" },
                    { text: "Live HTML visual template customizer" },
                    { text: "No credit card required" },
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                      <span className={item.bold ? "font-bold text-gray-700" : "text-gray-500"}>{item.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Link to={user ? "/dashboard" : "/auth?tab=signup"}>
                <button className="w-full rounded-xl border-2 border-gray-200 bg-white hover:border-orange-300 hover:text-orange-500 text-gray-700 py-3.5 text-sm font-bold transition-all">
                  {user ? "Open Dashboard" : "Start Free Setup"}
                </button>
              </Link>
            </div>

            {/* Pro Plan */}
            <div className="reveal-up flex flex-col rounded-2xl border-2 border-orange-400 bg-white p-8 relative"
              style={{ boxShadow: "0 12px 40px rgba(249,115,22,0.15)" }}>
              <div className="absolute -top-3.5 right-6">
                <span className="text-[10px] font-black uppercase tracking-widest text-white px-3 py-1 rounded-full shadow"
                  style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}>
                  Most Popular
                </span>
              </div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xl font-bold text-gray-800">Pro Plan</h3>
                <Sparkles className="h-5 w-5 text-orange-500" />
              </div>
              <p className="text-xs text-gray-500 leading-relaxed mb-6">
                Our fully-unleashed outreach package designed for rapid prospecting and complete AI campaigns.
              </p>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-5xl font-black text-gray-900">$499</span>
                <span className="text-sm text-gray-400">/month</span>
              </div>
              <div className="border-t border-orange-100 pt-6 mb-8">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">Unlimited Emails + Everything in Trial, plus:</p>
                <ul className="space-y-3 text-sm">
                  {[
                    { text: "Unlimited Email Sends", bold: true, pulse: true },
                    { text: "AI-driven follow-ups & auto-responders", bold: true },
                    { text: "Multi-mailbox round-robin load balancing", bold: true },
                    { text: "30,000 Lead Credits /mo" },
                    { text: "3,000 AI Phone Calls /mo" },
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <Check className={`mt-0.5 h-4 w-4 shrink-0 text-orange-500 ${item.pulse ? "animate-pulse" : ""}`} />
                      <span className={item.bold ? "font-bold text-gray-800" : "text-gray-500"}>{item.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Link to={user ? "/dashboard" : "/auth?tab=signup"}>
                <button className="w-full rounded-xl py-3.5 text-sm font-bold text-white transition-all hover:opacity-90 hover:scale-[1.01]"
                  style={{ background: "linear-gradient(135deg, #f97316, #ea580c)", boxShadow: "0 8px 24px rgba(249,115,22,0.35)" }}>
                  {user ? "Upgrade to Pro" : "Get Started Now"}
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────── */}
      <section id="faq" className="py-24" style={{ background: "linear-gradient(160deg, #fff7ed 0%, #ffffff 100%)" }}>
        <div className="mx-auto max-w-3xl px-6">
          <div className="mb-16 text-center reveal-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-orange-600 mb-5">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
              FAQ
            </span>
            <h2 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">Frequently asked questions</h2>
          </div>
          <div className="reveal-up rounded-2xl border border-gray-100 bg-white px-8 py-4 shadow-sm">
            {faqs.map(({ q, a }) => <AccordionItem key={q} q={q} a={a} />)}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ───────────────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="mx-auto max-w-5xl px-6">
          <div className="reveal-up relative overflow-hidden rounded-3xl px-8 py-20 text-center"
            style={{ background: "linear-gradient(135deg, #f97316 0%, #ea580c 50%, #c2410c 100%)" }}>
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10 pointer-events-none"
              style={{ background: "radial-gradient(circle, white, transparent 70%)" }} />
            <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full opacity-10 pointer-events-none"
              style={{ background: "radial-gradient(circle, white, transparent 70%)" }} />

            <div className="relative">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-white mb-6">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                Start Today
              </span>
              <h2 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl md:text-6xl mb-6">
                Take control of your sequences
              </h2>
              <p className="mx-auto max-w-2xl text-orange-100 text-lg mb-10">
                Connect your SMTP accounts, design premium HTML layouts, and start sending paced campaigns that hit the primary inbox.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Link to={user ? "/dashboard" : "/auth?tab=signup"}>
                  <button className="group flex items-center gap-2 rounded-xl bg-white px-10 py-4 text-base font-bold text-orange-600 transition-all hover:scale-[1.02] hover:shadow-2xl">
                    {user ? "Open Dashboard" : "Get Started — It's Free"}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </button>
                </Link>
              </div>
              <p className="mt-5 text-sm text-orange-200">No credit card required. Free trial, instant setup.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 bg-gray-50 py-12">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg"
                style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}>
                <Send className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="font-bold text-gray-800">Paper Plan</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-400">
              <a href="#features" className="hover:text-orange-500 transition-colors">Features</a>
              <a href="#how-it-works" className="hover:text-orange-500 transition-colors">How It Works</a>
              <a href="#pricing" className="hover:text-orange-500 transition-colors">Pricing</a>
              <a href="#comparison" className="hover:text-orange-500 transition-colors">Why Us</a>
              <a href="#faq" className="hover:text-orange-500 transition-colors">FAQ</a>
            </div>
            <p className="text-sm text-gray-400">© {new Date().getFullYear()} Paper Plan. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
