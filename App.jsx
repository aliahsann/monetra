import { useState, useEffect, useRef, useLayoutEffect, useMemo, useCallback, memo, createElement } from "react";
import logo from "./monetra logo 3.png";
import logo2 from "./monetra logo 2.png";
import { gsap } from "gsap";
import { GoArrowUpRight } from "react-icons/go";
import { motion, useInView, useMotionValue, useSpring } from "framer-motion";
import { SiReact, SiGooglecloud, SiTailwindcss, SiVite, SiPython, SiFastapi } from "react-icons/si";
import { FiHome, FiPlusCircle, FiAlertCircle, FiMessageSquare, FiList, FiLogOut, FiPieChart, FiUser, FiSettings, FiTrash2, FiEdit2, FiShield, FiGlobe, FiDatabase } from "react-icons/fi";
import { LuBrainCircuit } from "react-icons/lu";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

// ─── API ───────────────────────────────────────────────────────────────────────
const BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");

const api = {
  getHeaders: () => {
    const token = localStorage.getItem("token");
    return {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  },
  login: (email, password) => {
    const fd = new URLSearchParams();
    fd.append("username", email);
    fd.append("password", password);
    return fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: fd,
    }).then((r) => {
      if (!r.ok) throw new Error("Invalid credentials");
      return r.json();
    });
  },
  signup: (email, password) => {
    return fetch(`${BASE}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }).then((r) => {
      if (!r.ok) throw new Error("Signup failed");
      return r.json();
    });
  },
  googleLogin: (credential) => {
    console.log("Sending Google credential to backend:", credential.substring(0, 20) + "...");
    return fetch(`${BASE}/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential }),
    }).then(async (r) => {
      if (!r.ok) {
        const errorText = await r.text();
        console.error("Google login failed response:", r.status, errorText);
        throw new Error(`Google login failed: ${errorText || r.statusText}`);
      }
      return r.json();
    });
  },
  upload: async (file) => {
    const token = localStorage.getItem("token");
    const fd = new FormData();
    fd.append("file", file);
    return fetch(`${BASE}/upload-transactions`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}` },
      body: fd
    }).then((r) => r.json());
  },
  insights: async () => {
    const headers = api.getHeaders();
    return fetch(`${BASE}/insights?period=this_month`, { headers }).then((r) => r.json());
  },
  classify: async (limit = 100) => {
    const headers = api.getHeaders();
    return fetch(`${BASE}/classify?limit=${limit}`, { method: "POST", headers }).then((r) => r.json());
  },
  chat: async (message, history) => {
    const headers = api.getHeaders();
    return fetch(`${BASE}/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({ message, history }),
    }).then(async (r) => {
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.detail || "Chat failed");
      }
      return r.json();
    });
  },
  visuals: async () => {
    const headers = api.getHeaders();
    return fetch(`${BASE}/analytics/visuals`, { headers }).then((r) => r.json());
  },
  addTransaction: async (data) => {
    const headers = api.getHeaders();
    return fetch(`${BASE}/add-transaction`, {
      method: "POST",
      headers,
      body: JSON.stringify(data)
    }).then(async (r) => {
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.detail || "Failed to add transaction");
      }
      return r.json();
    });
  },
  getTransactions: async () => {
    const headers = api.getHeaders();
    return fetch(`${BASE}/transactions`, { headers }).then(async (r) => {
      if (!r.ok) throw new Error("Failed to fetch transactions");
      return r.json();
    });
  },
  updateEmail: (email) => {
    const headers = api.getHeaders();
    return fetch(`${BASE}/auth/update-email`, {
      method: "POST",
      headers,
      body: JSON.stringify({ email }),
    }).then((r) => {
      if (!r.ok) throw new Error("Failed to update email");
      return r.json();
    });
  },
  clearData: () => {
    const headers = api.getHeaders();
    return fetch(`${BASE}/data/clear`, {
      method: "POST",
      headers,
    }).then((r) => {
      if (!r.ok) throw new Error("Failed to clear data");
      return r.json();
    });
  }
};

// ─── MOCK DATA (used if API unreachable) ──────────────────────────────────────
const MOCK_SUMMARY = { cash_in: 165000, cash_out: 59800, net: 105200 };
const MOCK_INSIGHTS = [
  { message: "You brought in PKR 165,000 this month — strongest month on record.", severity: "positive" },
  { message: "Materials spending is up 15%. Consider buying in bulk to save.", severity: "medium" },
  { message: "You have PKR 12,400 in outstanding invoices from 4 clients.", severity: "high" },
  { message: "Marketing ROI improved by 20% compared to last quarter.", severity: "positive" },
  { message: "Fuel costs are stabilizing after last month's spike.", severity: "low" },
];

// ─── DEMO ACCOUNT DATA ────────────────────────────────────────────────────────
const DEMO_DATA = {
  user: { email: "demo@monetra.app", isDemo: true },
  summary: { cash_in: 184500, cash_out: 72300, net: 112200, balance: 412500 },
  summaryThis: { cash_in: 184500, cash_out: 72300, net: 112200, balance: 412500 },
  summaryTotal: { cash_in: 184500, cash_out: 72300, net: 112200, balance: 412500 },
  summaryLast: { cash_in: 158000, cash_out: 68400, net: 89600, balance: 300300 },
  health: { score: 88, status: "Healthy", runway_weeks: 18.5, cash_reserve: 112200 },
  insights: [
    { type: "positive", message: "Revenue is up 16.8% this month — strongest performance in 6 months. Khan Builders contract was a major driver.", severity: "positive" },
    { type: "low_margin", message: "Your net margin is 60.8% — well above the 20% safety threshold. Keep it up!", severity: "positive" },
    { type: "large_expense", message: "Large expense detected: PKR 18,000 for Heavy Machinery Rental. Verify this is within budget.", severity: "medium" },
    { type: "expense_increase", message: "Fuel & transport costs rose 22% vs last month. Consider route optimization to cut costs.", severity: "medium" },
    { type: "concentration_risk", message: "Khan Builders accounts for 38% of revenue. Diversifying your client base will reduce risk.", severity: "high" },
  ],
  topCustomers: [
    { name: "Khan Builders Ltd.", amount: 70000, percentage: 37.9 },
    { name: "Apex Constructions", amount: 52000, percentage: 28.2 },
    { name: "GreenField Developers", amount: 38500, percentage: 20.9 },
  ],
  topSuppliers: [
    { name: "Steel & Sons Supply", amount: 21400, percentage: 29.6 },
    { name: "ProFuel Network", amount: 14800, percentage: 20.5 },
    { name: "ToolMart Industrial", amount: 11200, percentage: 15.5 },
  ],
  recurringExpenses: [
    { name: "ProFuel Network", amount: 4933, frequency: "Monthly" },
    { name: "Site Security Services", amount: 3200, frequency: "Monthly" },
    { name: "Adobe Suite", amount: 599, frequency: "Monthly" },
    { name: "QuickBooks Plan", amount: 349, frequency: "Monthly" },
  ],
  advisorSummary: "• Revenue is 16.8% higher than last month — excellent momentum.\n• Your cash runway of 18.5 weeks is strong. Consider setting aside 10% as an emergency reserve.\n• Khan Builders is your top client at 38% of revenue — a great relationship, but worth finding 1–2 new clients to reduce dependency.\n• Fuel costs spiked this month. Talk to your logistics team about route bundling.",
  visuals: {
    trends: [
      { date: "Feb 01", income: 12000, expense: 4800 },
      { date: "Feb 03", income: 18500, expense: 6200 },
      { date: "Feb 05", income: 8000, expense: 5100 },
      { date: "Feb 07", income: 22000, expense: 7800 },
      { date: "Feb 09", income: 14000, expense: 4200 },
      { date: "Feb 11", income: 19500, expense: 9100 },
      { date: "Feb 13", income: 11000, expense: 3800 },
      { date: "Feb 15", income: 28000, expense: 11200 },
      { date: "Feb 17", income: 9500, expense: 4600 },
      { date: "Feb 19", income: 16000, expense: 5900 },
      { date: "Feb 21", income: 21000, expense: 7300 },
      { date: "Feb 23", income: 5000, expense: 3400 },
    ],
    distribution: [
      { name: "Materials", value: 21400 },
      { name: "Fuel & Transport", value: 14800 },
      { name: "Equipment Rental", value: 18000 },
      { name: "Labor (Contract)", value: 11200 },
      { name: "Software & Tools", value: 4200 },
      { name: "Other", value: 2700 },
    ],
  },
};

const MOCK_CHAT_RESPONSES = {
  "where is my money going?": "Most of your money this month went to Materials (PKR 24,500) and Labor (PKR 18,200). You also had a significant spike in Fuel costs early in the month.",
  "am i doing better than last month?": "Yes! Your net profit is up 12% compared to last month, mainly due to the large Khan Builders contract completion.",
  "any risks i should know about?": "The main risk is your outstanding invoices. You have PKR 12,400 unpaid, which could impact your cash flow next month if not collected soon.",
  "default": "I'm analyzing your finances now. Based on your data, you're having a strong month with PKR 105,200 in net change. Is there a specific category you'd like to dive into?"
};


// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const styles = {
  // Warm off-white, ink text, amber accent — feels like a premium notebook
  root: `
    @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #FAF8F4;
      --surface: #FFFFFF;
      --ink: #1A1814;
      --ink-muted: #7A746A;
      --amber: #E8A020;
      --amber-light: #FFF3D6;
      --green: #2D9E6B;
      --green-light: #E8F7F0;
      --red: #D94F3A;
      --red-light: #FDECEA;
      --blue: #3B74D4;
      --blue-light: #EBF1FB;
      --border: #D1CDC2;
      --shadow: 0 4px 16px rgba(26,24,20,0.08);
      --shadow-lg: 0 12px 40px rgba(26,24,20,0.12);
      --radius: 16px;
      --radius-sm: 10px;
      
      /* Responsive breakpoints */
      --mobile-max: 480px;
      --tablet-max: 768px;
      --desktop-max: 1024px;
      --wide-max: 1200px;
    }

    body {
      font-family: 'DM Sans', sans-serif;
      background: var(--bg);
      color: var(--ink);
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
      overflow-x: hidden; /* Prevent horizontal scroll */
      width: 100%;
    }

    h1, h2, h3 { font-family: 'DM Serif Display', serif; }

    .page { 
      min-height: 100vh; 
      padding: 0 16px; 
      max-width: 100%;
      overflow-x: hidden;
    }

    /* Nav */
    .nav {
      display: flex; align-items: center; justify-content: space-between;
      padding: 20px 0 16px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 32px;
      width: 100%;
      max-width: 100%;
    }
    @media (max-width: 480px) {
      .nav { 
        padding: 12px 0 8px;
        margin-bottom: 20px;
      }
      .nav-logo { font-size: 1rem; }
      .nav-btn {
        padding: 6px 12px;
        font-size: 0.75rem;
      }
    }
    .nav-logo { font-family: 'DM Serif Display', serif; font-size: 1.2rem; color: var(--ink); }
    .nav-logo span { color: var(--amber); }
    .nav-links { display: flex; gap: 8px; flex-wrap: wrap; }
    .nav-btn {
      padding: 7px 16px; border-radius: 20px; font-size: 0.85rem; font-weight: 500;
      cursor: pointer; border: none; background: transparent; color: var(--ink-muted);
      transition: all 0.15s;
    }
    .nav-btn:hover { background: var(--border); color: var(--ink); }
    .nav-btn.active { background: var(--ink); color: white; }

    /* Upload Page */
    .upload-hero {
      max-width: min(540px, 100%); margin: 0 auto; padding: 60px 0 80px;
      display: flex; flex-direction: column; gap: 32px;
    }
    @media (max-width: 768px) {
      .upload-hero {
        padding: 40px 0 60px;
        gap: 24px;
      }
    }
    @media (max-width: 480px) {
      .upload-hero {
        padding: 24px 0 36px;
        gap: 16px;
      }
      .upload-title {
        font-size: clamp(1.4rem, 6vw, 2rem);
        line-height: 1.2;
      }
      .upload-sub {
        font-size: 0.9rem;
        margin-top: 8px;
      }
    }
    .upload-badge {
      display: inline-flex; align-items: center; gap: 8px;
      background: var(--amber-light); color: #9A6800;
      padding: 6px 14px; border-radius: 20px; font-size: 0.8rem; font-weight: 600;
      letter-spacing: 0.04em; text-transform: uppercase; width: fit-content;
    }
    .upload-title { font-size: clamp(2rem, 5vw, 2.8rem); line-height: 1.15; }
    .upload-sub { font-size: 1.05rem; color: var(--ink-muted); line-height: 1.6; font-weight: 300; }

    .dropzone {
      border: 2px dashed var(--border); border-radius: var(--radius);
      padding: clamp(24px, 8vw, 48px) clamp(16px, 4vw, 32px); 
      text-align: center; cursor: pointer;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(255, 255, 255, 0.78));
      border-color: rgba(26, 24, 20, 0.16);
      box-shadow: 0 10px 28px rgba(26, 24, 20, 0.08);
      transition: all 0.2s;
      display: flex; flex-direction: column; align-items: center; gap: 12px;
      width: 100%;
      box-sizing: border-box;
    }
    .dropzone:hover {
      border-color: rgba(232, 160, 32, 0.55);
      box-shadow: 0 14px 34px rgba(26, 24, 20, 0.10);
      transform: translateY(-1px);
    }
    @media (max-width: 1024px) {
      .dropzone { padding: 36px 24px; }
      .dropzone-icon { font-size: 2.2rem; }
      .upload-title { font-size: clamp(1.8rem, 4.5vw, 2.4rem); }
    }
    @media (max-width: 768px) {
      .dropzone { padding: 28px 20px; }
      .dropzone-icon { font-size: 2rem; }
      .upload-title { font-size: clamp(1.6rem, 4vw, 2.2rem); }
    }
    @media (max-width: 480px) {
      .dropzone { padding: 20px 16px; }
      .dropzone-icon { font-size: 1.8rem; }
    }
    .dropzone-text { font-size: 0.95rem; color: var(--ink-muted); }
    .dropzone-text strong { color: var(--ink); }
    .file-selected {
      background: var(--green-light); border-color: var(--green);
      padding: 16px 24px; gap: 8px;
    }
    .file-name { font-weight: 600; color: var(--green); font-size: 0.95rem; }

    .manual-form-wrap {
      background: white;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 32px;
      box-shadow: var(--shadow-lg);
      display: flex;
      flex-direction: column;
      gap: 24px;
      text-align: left;
    }
    .mode-toggle {
      display: flex;
      background: #F0EDE8;
      padding: 4px;
      border-radius: 12px;
      margin-bottom: 8px;
    }
    .mode-btn {
      flex: 1;
      padding: 10px;
      border: none;
      background: none;
      border-radius: 9px;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 600;
      transition: all 0.2s;
      color: var(--ink-muted);
    }
    .mode-btn.active {
      background: white;
      box-shadow: 0 4px 12px rgba(0,0,0,0.06);
      color: var(--ink);
    }
    .form-field {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .form-label {
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--ink-muted);
    }
    .form-input, .form-select {
      padding: 12px 16px;
      border: 1px solid var(--border);
      border-radius: 12px;
      font-size: 0.95rem;
      font-family: inherit;
      background: var(--bg);
      outline: none;
      transition: all 0.2s;
    }
    .form-input:focus, .form-select:focus {
      border-color: var(--amber);
      background: white;
      box-shadow: 0 0 0 4px var(--amber-light);
    }
    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    @media (max-width: 540px) {
      .form-grid { grid-template-columns: 1fr; }
      .manual-form-wrap { padding: 20px; }
    }

    .btn-primary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 14px 32px;
      border-radius: 999px;
      border: none;
      background: var(--amber);
      color: var(--ink);
      font-size: 0.95rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      cursor: pointer;
      box-shadow: var(--shadow);
      transition:
        background 0.2s ease,
        color 0.2s ease,
        transform 0.15s ease,
        box-shadow 0.15s ease;
    }

    @media (max-width: 1024px) {
      .btn-primary {
        padding: 14px 28px;
        font-size: 0.95rem;
      }
    }
    @media (max-width: 768px) {
      .btn-primary {
        padding: 12px 24px;
        font-size: 0.9rem;
        width: 100%;
        max-width: 300px;
      }
    }
    @media (max-width: 480px) {
      .btn-primary {
        padding: 12px 20px;
        font-size: 0.85rem;
      }
    }
    .btn-primary:hover:not(:disabled) {
      background: #D4900E;
      color: var(--ink);
      transform: translateY(-1px);
      box-shadow: var(--shadow-lg);
    }
    .btn-primary:focus-visible {
      outline: 2px solid var(--ink);
      outline-offset: 2px;
    }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    .btn-primary.loading { background: var(--amber); color: var(--ink); }

    .error-msg {
      background: var(--red-light); color: var(--red);
      padding: 12px 16px; border-radius: var(--radius-sm); font-size: 0.9rem;
    }

    /* Dashboard */
    .dashboard { 
      max-width: min(720px, 100%); 
      margin: 0 auto; 
      padding-bottom: 60px;
      width: 100%;
      box-sizing: border-box;
    }
    @media (max-width: 768px) {
      .dashboard { padding-bottom: 40px; }
    }
    @media (max-width: 480px) {
      .dashboard { padding-bottom: 24px; }
      .dash-header { margin-bottom: 20px; }
      .dash-title {
        font-size: clamp(1.4rem, 5vw, 1.8rem);
        margin-bottom: 4px;
      }
      .dash-sub { font-size: 0.8rem; }
    }
    .dash-header { margin-bottom: 28px; }
    .dash-title { font-size: clamp(1.6rem, 4vw, 2.2rem); margin-bottom: 6px; }
    .dash-sub { color: var(--ink-muted); font-size: 0.9rem; font-weight: 300; }

    .health-grid { 
      display: grid; 
      grid-template-columns: 1fr 1fr; 
      gap: 12px; 
      margin-bottom: 24px;
      width: 100%;
    }
    @media (max-width: 640px) {
      .health-grid {
        grid-template-columns: 1fr;
      }
    }
    .health-card {
      background: var(--surface);
      border-radius: var(--radius);
      padding: 24px;
      box-shadow: var(--shadow);
      border: 1.5px solid var(--border);
    }
    @media (max-width: 480px) {
      .health-card {
        padding: 12px;
        margin-bottom: 0;
      }
      .health-score-ring {
        width: 70px;
        height: 70px;
        border-width: 3px;
      }
      .health-score-val {
        font-size: 1.2rem;
      }
      .health-score-label {
        font-size: 0.6rem;
      }
      .health-label {
        font-size: 0.75rem;
      }
    }
    @media (max-width: 1024px) {
      .health-card { padding: 20px; }
      .health-score-ring { 
        width: 90px; 
        height: 90px;
      }
      .health-score-val { font-size: 1.6rem; }
      .summary-card { padding: 18px 16px; }
      .summary-value { font-size: 1.5rem; }
    }
    @media (max-width: 768px) {
      .health-card { padding: 16px; }
      .health-score-ring { 
        width: 80px; 
        height: 80px;
        border-width: 4px;
      }
      .health-score-val { font-size: 1.4rem; }
      .summary-value { font-size: 1.3rem; }
    }
    .health-score-ring {
      width: 100px; height: 100px; border-radius: 50%;
      border: 6px solid var(--border);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      margin: 0 auto 12px; position: relative;
    }
    .health-score-val { font-family: 'DM Serif Display', serif; font-size: 1.8rem; color: var(--green); line-height: 1; }
    .health-score-label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink-muted); }
    .health-label { font-size: 0.85rem; font-weight: 600; color: var(--ink-muted); text-align: center; }
    
    .runway-meter {
      height: 8px; background: var(--border); border-radius: 4px;
      margin: 12px 0; overflow: hidden;
    }
    .runway-fill { height: 100%; background: var(--amber); border-radius: 4px; transition: width 0.5s ease; }
    .runway-stats { display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--ink-muted); }

    /* Modal */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(15,14,12,0.6);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      animation: fadeIn 0.3s ease;
    }
    .modal-content {
      background: white;
      width: 100%;
      max-width: 440px;
      border-radius: 24px;
      padding: 32px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.15);
      border: 1.5px solid var(--border);
      position: relative;
      animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    
    .modal-title { font-size: 1.25rem; font-weight: 700; color: var(--ink); margin-bottom: 12px; }
    .modal-body { font-size: 0.95rem; color: var(--ink-muted); margin-bottom: 32px; line-height: 1.6; }
    .modal-actions { display: flex; gap: 12px; justify-content: flex-end; }

    /* Magic Bento Styles */
    .magic-card {
      position: relative;
      overflow: hidden;
      --glow-x: 50%;
      --glow-y: 50%;
      --glow-intensity: 0;
      --glow-radius: 300px;
      --glow-color: 232, 160, 32; /* var(--amber) RGB */
      transition: transform 0.3s ease, box-shadow 0.3s ease;
      background: white;
      border: 1.5px solid var(--border);
    }
    .magic-card::after {
      content: '';
      position: absolute;
      inset: 0;
      padding: 4px; /* Thicker border glow */
      background: radial-gradient(
        var(--glow-radius) circle at var(--glow-x) var(--glow-y),
        rgba(var(--glow-color), calc(var(--glow-intensity) * 1)) 0%,
        rgba(var(--glow-color), calc(var(--glow-intensity) * 0.4)) 40%,
        transparent 80%
      );
      border-radius: inherit;
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.4s ease;
      z-index: 20; /* High z-index for border glow */
    }
    .magic-card:hover::after { opacity: 1; }
    .magic-card:hover { transform: translateY(-4px); box-shadow: 0 20px 40px rgba(232, 160, 32, 0.15); }
    
    .particle {
      position: absolute;
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: rgba(var(--glow-color), 1);
      box-shadow: 0 0 10px rgba(var(--glow-color), 0.8);
      pointer-events: none;
      z-index: 30; /* Particles on very top */
    }
    
    .global-spotlight {
      position: fixed;
      width: 800px;
      height: 800px;
      border-radius: 50%;
      pointer-events: none;
      background: radial-gradient(circle,
        rgba(var(--glow-color), 0.15) 0%,
        rgba(var(--glow-color), 0.08) 25%,
        rgba(var(--glow-color), 0.02) 50%,
        transparent 75%
      );
      z-index: 100;
      opacity: 0;
      transform: translate(-50%, -50%);
      mix-blend-mode: overlay; /* Changed to overlay for better visibility on light bg */
      transition: opacity 0.5s ease;
    }
    
    .magic-card-content {
      position: relative;
      z-index: 1;
    }

    .entities-grid { 
      display: grid; 
      grid-template-columns: 1fr 1fr; 
      gap: 12px; 
      margin-top: 24px;
      width: 100%;
    }
    @media (max-width: 480px) {
      .entities-grid { 
        grid-template-columns: 1fr; 
        gap: 16px;
      }
    }
    .entity-item { 
      display: flex; justify-content: space-between; align-items: center;
      padding: 10px 0; border-bottom: 1px solid var(--border);
    }
    .entity-item:last-child { border-bottom: none; }
    .entity-name { font-size: 0.85rem; font-weight: 500; color: var(--ink); }
    .entity-amount { font-size: 0.85rem; font-family: 'DM Serif Display', serif; color: var(--ink-muted); }
    .entity-pct { font-size: 0.7rem; color: var(--amber); font-weight: 600; margin-left: 4px; }

    .summary-grid { 
      display: grid; 
      grid-template-columns: repeat(2, 1fr); 
      gap: 12px; 
      margin-bottom: 24px;
      width: 100%;
    }
    @media (max-width: 640px) {
      .summary-grid {
        grid-template-columns: 1fr;
      }
    }
    @media (max-width: 480px) {
      .summary-card {
        padding: 16px 12px;
      }
      .summary-label {
        font-size: 0.7rem;
        margin-bottom: 6px;
      }
      .summary-value {
        font-size: 1.1rem;
      }
      .summary-tag {
        font-size: 0.65rem;
        margin-top: 2px;
      }
    }

    .summary-card {
      background: var(--surface); border-radius: var(--radius);
      padding: 20px 20px 18px; box-shadow: var(--shadow);
      border: 1.5px solid var(--border);
    }
    .summary-label { font-size: 0.75rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-muted); margin-bottom: 8px; }
    .summary-value { font-size: 1.65rem; font-family: 'DM Serif Display', serif; }
    .summary-value.up { color: var(--green); }
    .summary-value.down { color: var(--red); }
    .summary-value.neutral { color: var(--ink); }
    .summary-tag { font-size: 0.75rem; color: var(--ink-muted); margin-top: 4px; }

    .section-title { font-size: 1.25rem; margin-bottom: 16px; }

    .insights-list { display: flex; flex-direction: column; gap: 10px; }

    .insight-card {
      background: var(--surface); border-radius: var(--radius-sm);
      padding: 16px 20px; box-shadow: var(--shadow);
      border-left: 3px solid transparent;
      display: flex; align-items: flex-start; gap: 12px;
      border: 1.5px solid var(--border);
      transition: transform 0.15s;
    }
    .insight-card:hover { transform: translateX(3px); }
    .insight-card.positive { border-left-color: var(--green); }
    .insight-card.medium { border-left-color: var(--amber); }
    .insight-card.high { border-left-color: var(--red); }
    .insight-card.low { border-left-color: var(--blue); }
    .insight-card.anomaly {
      background: var(--red-light);
      border: 1px solid var(--red);
      animation: pulse-border 2s infinite;
    }
    @keyframes pulse-border {
      0% { border-color: var(--red); box-shadow: 0 0 0 0 rgba(217, 79, 58, 0.2); }
      70% { border-color: var(--red); box-shadow: 0 0 0 6px rgba(217, 79, 58, 0); }
      100% { border-color: var(--red); box-shadow: 0 0 0 0 rgba(217, 79, 58, 0); }
    }
    .insight-icon { font-size: 1.2rem; flex-shrink: 0; margin-top: 1px; }
    .insight-text { font-size: 0.92rem; line-height: 1.55; color: var(--ink); }

    .skeleton {
      background: linear-gradient(90deg, var(--border) 25%, #F5F1EB 50%, var(--border) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
      border-radius: 8px; height: 20px;
    }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

    /* Dashboard Layout */
    .dashboard-layout {
      display: flex;
      min-height: 100vh;
      background: var(--bg);
      width: 100vw;
    }
    .sidebar {
      width: 260px;
      padding: 24px 16px;
      background: #0F0E0C;
      color: white;
      height: 100vh;
      position: sticky;
      top: 0;
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      z-index: 100;
      border-right: 1px solid rgba(255,255,255,0.08);
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: rgba(255,255,255,0.1) transparent;
    }
    .sidebar::-webkit-scrollbar { width: 4px; }
    .sidebar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
    .sidebar-logo {
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 32px;
    }
    .sidebar-nav {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .sidebar-link {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border-radius: 12px;
      color: rgba(255,255,255,0.6);
      text-decoration: none;
      font-size: 0.92rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }
    .sidebar-link:hover {
      background: rgba(255,255,255,0.05);
      color: white;
    }
    .sidebar-link.active {
      background: var(--amber);
      color: var(--ink);
    }
    .sidebar-link-icon {
      font-size: 1.2rem;
    }
    .main-content {
      flex: 1;
      padding: 40px;
      max-width: 100%;
      overflow-y: auto;
      background: var(--bg);
    }
    @media (max-width: 768px) {
      .dashboard-layout { flex-direction: column; }
      .sidebar { 
        width: 100%; 
        height: auto; 
        position: static; 
        padding: 16px;
        flex-direction: row;
        align-items: center;
        gap: 12px;
      }
      .sidebar-logo { margin-bottom: 0; }
      .sidebar-nav { flex-direction: row; overflow-x: auto; padding-bottom: 4px; }
      .sidebar-link { padding: 8px 12px; font-size: 0.8rem; }
      .main-content { padding: 24px 16px; }
    }

    /* TrueFocus */
    .focus-container {
      position: relative;
      display: flex;
      gap: 0.5em;
      justify-content: center;
      align-items: center;
      flex-wrap: wrap;
      outline: none;
      user-select: none;
      margin: 40px 0;
    }
    .focus-word {
      position: relative;
      font-size: clamp(2rem, 6vw, 3.5rem);
      font-weight: 900;
      cursor: pointer;
      transition: filter 0.3s ease, color 0.3s ease;
      outline: none;
      user-select: none;
      font-family: 'DM Serif Display', serif;
      color: white;
    }
    .focus-word.active { filter: blur(0); color: var(--amber); }
    .focus-frame {
      position: absolute;
      top: 0;
      left: 0;
      pointer-events: none;
      box-sizing: content-box;
      border: none;
    }
    .corner {
      position: absolute;
      width: 1rem;
      height: 1rem;
      border: 3px solid var(--border-color, var(--amber));
      filter: drop-shadow(0px 0px 4px var(--border-color, var(--amber)));
      border-radius: 3px;
      transition: none;
    }
    .top-left { top: -10px; left: -10px; border-right: none; border-bottom: none; }
    .top-right { top: -10px; right: -10px; border-left: none; border-bottom: none; }
    .bottom-left { bottom: -10px; left: -10px; border-right: none; border-top: none; }
    .bottom-right { bottom: -10px; right: -10px; border-left: none; border-top: none; }
    .card-nav-container {
      position: absolute;
      top: 2em;
      left: 50%;
      transform: translateX(-50%);
      width: clamp(280px, 90%, 800px);
      z-index: 99;
      box-sizing: border-box;
    }
    @media (max-width: 768px) {
      .card-nav-container { 
        width: clamp(280px, 95%, 100%);
        top: 1.2em;
        left: 50%;
        transform: translateX(-50%);
        padding: 0 8px;
      }
    }
    @media (max-width: 480px) {
      .card-nav-container {
        width: 100%;
        padding: 0 16px;
      }
    }
    .card-nav {
      display: block;
      height: 60px;
      padding: 0;
      background-color: white;
      border: 0.5px solid rgba(255, 255, 255, 0.1);
      border-radius: 0.75rem;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      position: relative;
      overflow: hidden;
      will-change: height;
    }
    .card-nav-top {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 60px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.5rem 0.45rem 0.55rem 1.1rem;
      z-index: 2;
    }
    .hamburger-menu {
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      gap: 6px;
    }
    .hamburger-line {
      width: 30px;
      height: 2px;
      background-color: currentColor;
      transition: transform 0.25s ease, opacity 0.2s ease, margin 0.3s ease;
      transform-origin: 50% 50%;
    }
    .hamburger-menu.open .hamburger-line:first-child { transform: translateY(4px) rotate(45deg); }
    .hamburger-menu.open .hamburger-line:last-child { transform: translateY(-4px) rotate(-45deg); }
    .logo-container {
      display: flex;
      align-items: center;
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
    }
    .logo-container .nav-logo { font-size: 1.1rem; }
    .card-nav-cta-button {
      background-color: var(--ink);
      color: white;
      border: none;
      border-radius: calc(0.75rem - 0.35rem);
      padding: 0 1rem;
      height: 100%;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.3s ease;
    }
    .card-nav-cta-button:hover { background-color: var(--amber); color: var(--ink); }
    .card-nav-content {
      position: absolute;
      left: 0;
      right: 0;
      top: 60px;
      bottom: 0;
      padding: 0.5rem;
      display: flex;
      align-items: flex-end;
      gap: 12px;
      visibility: hidden;
      pointer-events: none;
      z-index: 1;
    }
    .card-nav.open .card-nav-content { visibility: visible; pointer-events: auto; }
    .nav-card {
      height: 100%;
      flex: 1 1 0;
      min-width: 0;
      border-radius: calc(0.75rem - 0.2rem);
      position: relative;
      display: flex;
      flex-direction: column;
      padding: 12px 16px;
      gap: 8px;
      user-select: none;
    }
    .nav-card-label { font-weight: 400; font-size: 22px; letter-spacing: -0.5px; font-family: 'DM Serif Display', serif; }
    .nav-card-links { margin-top: auto; display: flex; flex-direction: column; gap: 2px; }
    .nav-card-link {
      font-size: 16px;
      cursor: pointer;
      text-decoration: none;
      transition: opacity 0.3s ease;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: inherit;
    }
    .nav-card-link:hover { opacity: 0.75; }
    @media (max-width: 768px) {
      .card-nav-container { width: clamp(280px, 95%, 100%); top: 1.2em; }
      .card-nav-cta-button { display: none; }
      .card-nav-content { 
        flex-direction: column; 
        align-items: stretch; 
        gap: 8px; 
        padding: 0.5rem; 
        bottom: 0; 
        justify-content: flex-start;
        max-height: calc(100vh - 200px);
        overflow-y: auto;
      }
      .nav-card { 
        height: auto; 
        min-height: 60px; 
        flex: 1 1 auto;
        padding: 16px;
      }
      .nav-card-label { font-size: 18px; }
      .nav-card-link { font-size: 15px; }
    }
    @media (max-width: 480px) {
      .nav-card {
        padding: 12px;
      }
      .nav-card-label {
        font-size: 16px;
      }
      .nav-card-link {
        font-size: 14px;
      }
    }

    /* Chat */
    .chat-wrap { 
      max-width: min(640px, 100%); 
      margin: 0 auto; 
      padding-bottom: 40px; 
      display: flex; 
      flex-direction: column; 
      height: calc(100vh - 120px);
      width: 100%;
      box-sizing: border-box;
    }
    @media (max-width: 768px) {
      .chat-wrap { 
        height: calc(100vh - 100px);
        padding-bottom: 24px;
      }
    }
    @media (max-width: 480px) {
      .chat-wrap { 
        height: calc(100vh - 80px);
        padding-bottom: 20px;
      }
    }
    .chat-title { font-size: 1.5rem; margin-bottom: 4px; }
    .chat-sub { color: var(--ink-muted); font-size: 0.85rem; margin-bottom: 16px; }
    .chat-messages { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; padding: 8px 0; }
    .chat-bubble {
      max-width: min(80%, 280px); 
      padding: 12px 16px; 
      border-radius: 16px;
      font-size: 0.92rem; 
      line-height: 1.55;
      word-wrap: break-word;
    }
    @media (max-width: 480px) {
      .chat-bubble {
        max-width: 85%;
        font-size: 0.9rem;
      }
    }
    .chat-bubble.user { background: var(--ink); color: white; align-self: flex-end; border-radius: 16px 16px 4px 16px; }
    .chat-bubble.assistant { background: var(--surface); color: var(--ink); align-self: flex-start; border-radius: 16px 16px 16px 4px; box-shadow: var(--shadow); border: 1px solid var(--border); }
    .chat-bubble.typing { color: var(--ink-muted); font-style: italic; }

    .chat-input {
      flex: 1; padding: 12px 16px; border: 1px solid var(--border); border-radius: 12px;
      font-family: 'DM Sans', sans-serif; font-size: 0.95rem; background: var(--surface);
      outline: none; transition: border-color 0.15s;
    }
    .chat-input:focus { border-color: var(--amber); }
    .chat-send {
      background: var(--amber); color: var(--ink); border: none;
      width: 44px; height: 44px; border-radius: 12px; cursor: pointer;
      font-size: 1.1rem; transition: all 0.15s; flex-shrink: 0;
    }
    .chat-send:hover:not(:disabled) { background: #D4900E; }
    .chat-send:disabled { opacity: 0.4; cursor: not-allowed; }
    .chat-input-row { display: flex; gap: 10px; padding-top: 12px; border-top: 1px solid var(--border); }
    @media (max-width: 1024px) {
      .chat-input {
        font-size: 0.9rem;
        padding: 10px 14px;
      }
      .chat-send {
        width: 40px;
        height: 40px;
        font-size: 1rem;
      }
    }
    @media (max-width: 768px) {
      .chat-input {
        font-size: 0.85rem;
        padding: 8px 12px;
      }
      .chat-send {
        width: 36px;
        height: 36px;
        font-size: 0.9rem;
      }
    }

    .suggestions {
      display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px;
    }
    .suggestion-chip {
      background: var(--surface); border: 1px solid var(--border);
      padding: 6px 14px; border-radius: 20px; font-size: 0.82rem;
      color: var(--ink-muted); cursor: pointer; transition: all 0.2s;
      white-space: nowrap;
    }
    .suggestion-chip:hover {
      background: var(--amber-light); border-color: var(--amber);
      color: var(--ink); transform: translateY(-1px);
    }

    /* Charts */
    .visuals-grid {
      display: grid;
      grid-template-columns: 1.5fr 1fr;
      gap: 20px;
      margin-top: 32px;
    }
    @media (max-width: 900px) {
      .visuals-grid { grid-template-columns: 1fr; }
    }
    .chart-card {
      background: var(--surface);
      border-radius: var(--radius);
      padding: 24px;
      border: 1.5px solid var(--border);
      box-shadow: var(--shadow);
    }
    .chart-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .chart-title {
      font-size: 1.1rem;
      font-weight: 500;
      color: var(--ink);
    }
    .chart-tag {
      font-size: 0.75rem;
      background: var(--amber-light);
      color: #9A6800;
      padding: 4px 10px;
      border-radius: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .recharts-cartesian-axis-tick-value {
      font-size: 11px;
      fill: var(--ink-muted);
    }
    .recharts-tooltip-cursor {
      stroke: var(--border);
      stroke-width: 1;
    }
    .custom-tooltip {
      background: var(--ink) !important;
      border: none !important;
      border-radius: 8px !important;
      padding: 12px !important;
      color: white !important;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2) !important;
    }
    .custom-tooltip p { margin: 0; font-size: 0.85rem; }
    .custom-tooltip .label { font-weight: 600; margin-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px; }
    .custom-tooltip .val { display: flex; justify-content: space-between; gap: 20px; margin-top: 4px; }
    
    .chart-empty {
      height: 250px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: var(--ink-muted);
      border: 1px dashed var(--border);
      border-radius: 12px;
      font-size: 0.9rem;
    }
    
    /* Mobile-first responsive utilities */
    @media (max-width: 375px) {
      :root {
        --radius: 12px;
        --radius-sm: 8px;
      }
      
      .page { padding: 0 12px; }
      
      .upload-hero {
        padding: 20px 0 28px !important;
        gap: 14px !important;
      }
      
      .upload-title {
        font-size: 1.35rem !important;
      }
      
      .dropzone {
        padding: 16px 12px !important;
      }
      
      .dropzone-text {
        font-size: 0.8rem;
      }
      
      .manual-form-wrap {
        padding: 16px !important;
      }
      
      .form-input, .form-select {
        padding: 10px 12px;
        font-size: 0.9rem;
      }
      
      .btn-primary {
        padding: 12px 16px;
        font-size: 0.8rem;
      }
      
      .health-card {
        padding: 16px !important;
      }
      
      .summary-card {
        padding: 14px 12px !important;
      }
      
      .summary-value {
        font-size: 1.1rem !important;
      }
      
      .dash-title {
        font-size: 1.3rem !important;
      }
      
      .section-title {
        font-size: 1.1rem !important;
      }
      
      .insight-card {
        padding: 12px 14px !important;
      }
      
      .insight-text {
        font-size: 0.85rem !important;
      }
      
      .modal-content {
        padding: 24px 20px !important;
        margin: 16px !important;
        max-width: calc(100% - 32px) !important;
      }
      
      .chat-bubble {
        max-width: 90% !important;
        padding: 10px 12px !important;
        font-size: 0.85rem !important;
      }
      
      .suggestion-chip {
        font-size: 0.75rem;
        padding: 5px 10px;
      }
      
      .chart-card {
        padding: 16px !important;
      }
      
      .entity-item {
        padding: 8px 0 !important;
      }
      
      .entity-name, .entity-amount {
        font-size: 0.8rem !important;
      }
      
      /* Better touch targets for mobile */
      .sidebar-link {
        padding: 10px 12px !important;
        min-height: 44px;
      }
      
      .nav-btn {
        padding: 8px 12px;
        min-height: 36px;
      }
      
      /* Smaller sidebar for very small screens */
      .sidebar {
        padding: 12px !important;
      }
      
      .sidebar-logo img {
        height: 24px !important;
      }
      
      /* Auth page improvements */
      .auth-form-side {
        padding: 24px 16px !important;
      }
      
      .auth-title {
        font-size: 1.5rem !important;
      }
      
      .auth-row-btns {
        flex-direction: column;
        gap: 10px;
      }
      
      #google-button {
        width: 100% !important;
      }
      
      .auth-demo-pill {
        width: 100%;
        justify-content: center;
      }
    }
    
    /* Extra small screens */
    @media (max-width: 320px) {
      .landing-title {
        font-size: 1.6rem !important;
      }
      
      .landing-sub {
        font-size: 0.9rem !important;
      }
      
      .section-h2 {
        font-size: 1.3rem !important;
      }
      
      .upload-title {
        font-size: 1.2rem !important;
      }
    }
    
    /* Mobile landscape optimizations */
    @media (max-height: 500px) and (orientation: landscape) {
      .landing-hero {
        min-height: auto;
        padding: 40px 20px;
      }
      
      .sidebar {
        height: auto;
        max-height: 100vh;
      }
      
      .chat-wrap {
        height: calc(100vh - 60px);
      }
    }
    
    /* Table responsiveness for mobile */
    @media (max-width: 640px) {
      table {
        display: block;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
      }
      
      th, td {
        white-space: nowrap;
        padding: 12px 8px !important;
        font-size: 0.85rem;
      }
      
      th {
        font-size: 0.7rem !important;
      }
    }
    
    /* Better modal on mobile */
    @media (max-width: 480px) {
      .modal-overlay {
        align-items: flex-end;
        padding: 0;
      }
      
      .modal-content {
        border-radius: 24px 24px 0 0;
        max-height: 90vh;
        overflow-y: auto;
        animation: slideUpMobile 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      }
      
      @keyframes slideUpMobile {
        from { transform: translateY(100%); opacity: 1; }
        to { transform: translateY(0); opacity: 1; }
      }
      
      .modal-actions {
        flex-direction: column-reverse;
        gap: 8px;
      }
      
      .modal-actions button {
        width: 100%;
      }
    }
    
    /* Touch-friendly improvements */
    @media (pointer: coarse) {
      .sidebar-link, .nav-btn, .btn-primary, .auth-submit-btn, .chat-send {
        min-height: 44px;
      }
      
      .form-input, .form-select, .auth-input-field {
        font-size: 16px !important; /* Prevent zoom on iOS */
      }
      
      .suggestion-chip {
        padding: 8px 14px;
      }
      
      .dropzone {
        min-height: 120px;
      }
      
      .feat-pin {
        width: 36px;
        height: 36px;
      }
    }
    
    /* Sliding Sidebar Mobile Experience */
    .mobile-header {
      display: none;
    }
    
    @media (max-width: 768px) {
      .mobile-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        background: #0F0E0C;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 998;
        height: 56px;
      }
      
      .hamburger-btn {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        width: 40px;
        height: 40px;
        background: rgba(255,255,255,0.05);
        border: none;
        border-radius: 10px;
        cursor: pointer;
        padding: 8px;
        gap: 5px;
        transition: background 0.2s;
      }
      
      .hamburger-btn:hover {
        background: rgba(255,255,255,0.1);
      }
      
      .hamburger-btn span {
        display: block;
        width: 20px;
        height: 2px;
        background: white;
        border-radius: 2px;
        transition: all 0.3s ease;
      }
      
      .mobile-logo {
        height: 24px;
        filter: drop-shadow(0 2px 8px rgba(232,160,32,0.3));
      }
      
      .dashboard-layout {
        flex-direction: column;
        padding-top: 56px; /* Space for mobile header */
        min-height: calc(100vh - 56px);
        height: auto;
      }
      
      /* Mobile sidebar - hidden by default, slides in */
      .sidebar.mobile {
        position: fixed;
        top: 0;
        left: 0;
        width: 280px;
        height: 100vh;
        transform: translateX(-100%);
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        z-index: 1000;
        border-right: 1px solid rgba(255,255,255,0.08);
        border-top: none;
        padding: 0 !important;
        flex-direction: column;
        justify-content: flex-start;
      }
      
      .sidebar.mobile.open {
        transform: translateX(0);
      }
      
      .sidebar.mobile .sidebar-logo {
        display: none; /* Logo is in the mobile header section inside sidebar */
      }
      
      .sidebar.mobile .sidebar-nav {
        flex-direction: column !important;
        justify-content: flex-start;
        width: 100%;
        gap: 4px !important;
        padding: 8px 12px;
        flex: 1;
        overflow-y: auto;
      }
      
      .sidebar.mobile .sidebar-link {
        flex-direction: row;
        padding: 12px 16px !important;
        font-size: 0.9rem;
        gap: 12px !important;
        min-width: auto;
        text-align: left;
        border-radius: 12px;
      }
      
      .sidebar.mobile .sidebar-link-icon {
        font-size: 1.2rem !important;
      }
      
      .sidebar.mobile .sidebar-link span:last-child {
        font-size: 0.9rem;
        white-space: nowrap;
      }
      
      /* Show the user section and sign out */
      .sidebar.mobile > div:last-child {
        padding: 16px !important;
        border-top: 1px solid rgba(255,255,255,0.08);
      }
      
      .main-content {
        padding: 20px 16px !important;
        margin-left: 0 !important;
        flex: 1;
        min-height: 0;
        overflow-y: auto;
      }
    }
    
    /* Desktop sidebar */
    @media (min-width: 769px) {
      .sidebar {
        position: sticky;
        top: 0;
        height: 100vh;
        width: 260px;
        flex-shrink: 0;
      }
      
      .mobile-sidebar-overlay {
        display: none !important;
      }
    }
    
    /* Animation for overlay */
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    /* Chart responsiveness */
    @media (max-width: 480px) {
      .recharts-cartesian-axis-tick-value {
        font-size: 9px !important;
      }
      
      .recharts-tooltip-wrapper {
        max-width: 200px;
      }
      
      .custom-tooltip {
        padding: 8px !important;
      }
      
      .custom-tooltip p {
        font-size: 0.75rem;
      }
    }
    
    /* Safe area insets for notched phones */
    @supports (padding: max(0px)) {
      @media (max-width: 768px) {
        .mobile-header {
          padding-top: max(12px, env(safe-area-inset-top));
          padding-left: max(16px, env(safe-area-inset-left));
          padding-right: max(16px, env(safe-area-inset-right));
        }
        
        .sidebar.mobile {
          padding-top: max(0px, env(safe-area-inset-top)) !important;
        }
        
        .main-content {
          padding-left: max(16px, env(safe-area-inset-left));
          padding-right: max(16px, env(safe-area-inset-right));
          padding-bottom: max(20px, env(safe-area-inset-bottom)) !important;
        }
        
        .page {
          padding-left: max(16px, env(safe-area-inset-left));
          padding-right: max(16px, env(safe-area-inset-right));
        }
      }
    }

    /* Landing Page */
    .landing-root {
      overflow-x: hidden;
      width: 100%;
      max-width: 100%;
    }

    /* ── Sticky Navbar ── */
    .landing-nav {
      position: sticky;
      top: 0;
      z-index: 100;
      width: 100%;
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      background: rgba(250, 248, 244, 0.92);
      border-bottom: 1px solid var(--border);
      height: 64px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 clamp(20px, 4vw, 48px);
      box-sizing: border-box;
      box-shadow: 0 1px 20px rgba(26,24,20,0.06);
    }
    .nav-logo { font-family: 'DM Serif Display', serif; font-size: 1.25rem; color: var(--ink); letter-spacing: -0.02em; }
    .nav-logo span { color: var(--amber); }
    .nav-links-center {
      display: flex;
      gap: 36px;
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
    }
    .nav-link {
      text-decoration: none;
      color: var(--ink-muted);
      font-size: 0.9rem;
      font-weight: 500;
      transition: color 0.15s;
      white-space: nowrap;
    }
    .nav-link:hover { color: var(--ink); }
    @media (max-width: 768px) {
      .nav-links-center { display: none; }
      .landing-nav { padding: 0 20px; }
    }

    /* ── Hero ── */
    .landing-hero {
      padding: clamp(56px, 9vw, 96px) clamp(20px, 4vw, 40px) clamp(48px, 8vw, 80px);
      text-align: center;
      background: linear-gradient(160deg, #16130F 0%, #231F18 40%, #2E2816 75%, #3D340E 100%);
      margin-bottom: 0;
      width: 100%;
      box-sizing: border-box;
      position: relative;
      overflow: hidden;
      min-height: calc(100vh - 64px);
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .landing-hero::before {
      content: '';
      position: absolute;
      inset: 0;
      background: radial-gradient(ellipse 80% 50% at 50% -10%, rgba(232,160,32,0.18) 0%, transparent 70%);
      pointer-events: none;
    }
    .landing-hero-content {
      max-width: 860px;
      margin: 0 auto;
      position: relative;
      z-index: 1;
    }
    .landing-hero .section-tag {
      background: rgba(232, 160, 32, 0.12);
      color: var(--amber);
      border: 1px solid rgba(232, 160, 32, 0.3);
    }
    .landing-title {
      color: white;
      font-size: clamp(2.2rem, 6vw, 3.6rem);
      line-height: 1.1;
      letter-spacing: -0.03em;
    }
    .landing-sub {
      color: rgba(255, 255, 255, 0.65);
      font-size: clamp(1rem, 2.5vw, 1.15rem);
      line-height: 1.65;
      max-width: 580px;
      margin: 0 auto;
    }
    @media (max-width: 480px) {
      .landing-hero { padding: 48px 20px 40px; }
      .landing-title { font-size: clamp(1.9rem, 8vw, 2.4rem); }
      .landing-sub { font-size: 0.95rem; }
    }
    .hero-cta-row {
      display: flex;
      gap: 16px;
      justify-content: center;
      flex-wrap: wrap;
      margin-top: 24px;
    }
    .hero-cta-row .btn-primary {
      min-width: 180px;
    }
    .hero-cta-row .nav-btn {
      border-radius: 999px;
      border: 1px solid var(--border);
      background: rgba(255, 255, 255, 0.8);
      color: var(--ink-muted);
      font-weight: 500;
    }
    .hero-cta-row .nav-btn:hover {
      background: var(--amber-light);
      border-color: var(--amber);
      color: var(--ink);
    }
    @media (max-width: 480px) {
      .hero-cta-row {
        flex-direction: column;
        align-items: stretch;
      }
      .hero-cta-row .btn-primary,
      .hero-cta-row .nav-btn {
        width: 100%;
        max-width: none;
      }
    }
    @media (max-width: 480px) {
      .landing-hero {
        padding: 40px 16px 32px;
        margin-bottom: 32px;
        border-radius: 0 0 24px 24px;
      }
      .landing-title {
        font-size: clamp(1.8rem, 7vw, 2.4rem);
        margin-bottom: 16px;
      }
      .landing-sub {
        font-size: 1rem;
        margin: 0 auto 24px;
        line-height: 1.5;
      }
    }
    
    /* ── Section Layout ── */
    .landing-section {
      padding: clamp(48px, 7vw, 80px) clamp(20px, 4vw, 40px);
      width: 100%;
      box-sizing: border-box;
    }
    .landing-section-content {
      max-width: 1100px;
      margin: 0 auto;
    }
    .section-tag {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--amber-light);
      color: #9A6800;
      padding: 5px 14px;
      border-radius: 20px;
      font-size: 0.78rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      margin-bottom: 16px;
    }
    .section-h2 {
      font-size: clamp(1.8rem, 4vw, 2.6rem);
      margin-bottom: 14px;
      letter-spacing: -0.02em;
      line-height: 1.15;
    }
    .section-p {
      color: var(--ink-muted);
      font-size: 1rem;
      line-height: 1.65;
      margin-bottom: 36px;
    }
    @media (max-width: 480px) {
      .landing-section { padding: 36px 20px; }
      .section-h2 { font-size: 1.6rem; margin-bottom: 10px; }
      .section-p { font-size: 0.9rem; margin-bottom: 24px; }
    }

    .features-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      width: 100%;
    }
    @media (max-width: 900px) {
      .features-grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 560px) {
      .features-grid { grid-template-columns: 1fr; gap: 16px; }
    }

    /* ── Glassmorphism Feature Cards ── */
    .feat-card {
      border-radius: 20px;
      padding: 24px;
      position: relative;
      border: 1px solid rgba(255,255,255,0.6);
      box-shadow: 0 4px 24px rgba(26,24,20,0.07);
      transition: transform 0.22s ease, box-shadow 0.22s ease;
      display: flex;
      flex-direction: column;
      gap: 0;
      min-height: 220px;
      overflow: hidden;
    }
    .feat-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 12px 40px rgba(26,24,20,0.13);
    }
    .feat-card-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 20px;
    }
    .feat-icons {
      display: flex;
      gap: 8px;
    }
    .feat-icon-box {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: rgba(255,255,255,0.75);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.3rem;
      box-shadow: 0 2px 8px rgba(26,24,20,0.08);
      border: 1px solid rgba(255,255,255,0.5);
    }
    .feat-pin {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: rgba(255,255,255,0.6);
      backdrop-filter: blur(6px);
      border: 1px solid rgba(255,255,255,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.85rem;
      cursor: pointer;
      transition: background 0.15s;
      flex-shrink: 0;
    }
    .feat-pin:hover { background: rgba(255,255,255,0.9); }
    .feat-card-body { flex: 1; }
    .feat-h3 {
      font-family: 'DM Serif Display', serif;
      font-size: 1.25rem;
      color: var(--ink);
      margin-bottom: 8px;
      letter-spacing: -0.01em;
      line-height: 1.2;
    }
    .feat-p {
      font-size: 0.88rem;
      color: var(--ink-muted);
      line-height: 1.6;
    }
    .feat-card-footer {
      display: flex;
      justify-content: flex-end;
      margin-top: 16px;
    }
    .feat-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: rgba(255,255,255,0.65);
      backdrop-filter: blur(6px);
      border: 1px solid rgba(255,255,255,0.5);
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.72rem;
      font-weight: 600;
      color: var(--ink);
      letter-spacing: 0.02em;
    }
    .feat-badge-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }

    /* ── Benefits ── */
    .benefits-split {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: clamp(32px, 6vw, 64px);
      align-items: center;
      width: 100%;
    }
    @media (max-width: 768px) {
      .benefits-split { grid-template-columns: 1fr; gap: 32px; }
      .feature-card { padding: 22px; }
      .feature-h3 { font-size: 1.05rem; }
    }
    .benefit-item { display: flex; gap: 14px; margin-bottom: 22px; }
    .benefit-check {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: var(--green-light);
      color: var(--green);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.85rem;
      flex-shrink: 0;
      margin-top: 2px;
    }
    .benefit-h4 { font-size: 1rem; margin-bottom: 3px; font-weight: 600; }
    .benefit-p { color: var(--ink-muted); font-size: 0.88rem; line-height: 1.55; }

    /* ── Mock Dashboard (benefits visual) ── */
    .mock-dashboard {
      background: var(--ink);
      border-radius: 20px;
      padding: 24px;
      box-shadow: 0 20px 60px rgba(26,24,20,0.25);
      position: relative;
      overflow: hidden;
    }
    .mock-dashboard::before {
      content: '';
      position: absolute;
      top: -60px;
      right: -60px;
      width: 200px;
      height: 200px;
      background: radial-gradient(circle, rgba(232,160,32,0.15) 0%, transparent 70%);
      pointer-events: none;
    }
    .mock-dash-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
    }
    .mock-dash-title { color: rgba(255,255,255,0.5); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; }
    .mock-dash-badge { background: rgba(232,160,32,0.2); color: var(--amber); font-size: 0.7rem; padding: 3px 10px; border-radius: 20px; font-weight: 600; }
    .mock-stat-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 20px;
    }
    .mock-stat {
      background: rgba(255,255,255,0.06);
      border-radius: 12px;
      padding: 14px;
    }
    .mock-stat-label { color: rgba(255,255,255,0.4); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
    .mock-stat-value { font-family: 'DM Serif Display', serif; font-size: 1.4rem; }
    .mock-stat-value.up { color: var(--green); }
    .mock-stat-value.down { color: #FF6B6B; }
    .mock-bar-section { margin-bottom: 16px; }
    .mock-bar-label { display: flex; justify-content: space-between; margin-bottom: 6px; }
    .mock-bar-name { color: rgba(255,255,255,0.6); font-size: 0.75rem; }
    .mock-bar-val { color: rgba(255,255,255,0.9); font-size: 0.75rem; font-weight: 600; }
    .mock-bar-track { height: 6px; background: rgba(255,255,255,0.08); border-radius: 3px; overflow: hidden; }
    .mock-bar-fill { height: 100%; border-radius: 3px; transition: width 0.8s ease; }
    .mock-ai-chip {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(232,160,32,0.12);
      border: 1px solid rgba(232,160,32,0.25);
      border-radius: 10px;
      padding: 10px 14px;
      margin-top: 4px;
    }
    .mock-ai-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--amber); animation: pulse 2s infinite; }
    @keyframes pulse { 0%,100%{ opacity:1; } 50%{ opacity:0.4; } }
    .mock-ai-text { color: rgba(255,255,255,0.7); font-size: 0.78rem; line-height: 1.4; }

    /* ── Stats Bar ── */
    .stats-bar {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1px;
      background: var(--ink);
      color: white;
      border-radius: 20px;
      margin: clamp(32px, 6vw, 56px) auto;
      max-width: 1100px;
      width: 100%;
      box-sizing: border-box;
      overflow: hidden;
      position: relative;
    }
    .stats-bar::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(232,160,32,0.12) 0%, transparent 60%);
      pointer-events: none;
    }
    .stat-item {
      padding: clamp(28px, 5vw, 44px) clamp(20px, 3vw, 32px);
      text-align: center;
      position: relative;
    }
    .stat-item + .stat-item::before {
      content: '';
      position: absolute;
      left: 0;
      top: 20%;
      height: 60%;
      width: 1px;
      background: rgba(255,255,255,0.08);
    }
    .stat-val { font-family: 'DM Serif Display', serif; font-size: clamp(2rem, 4vw, 2.8rem); color: var(--amber); line-height: 1; }
    .stat-lbl { font-size: 0.82rem; opacity: 0.55; margin-top: 6px; letter-spacing: 0.04em; }
    @media (max-width: 768px) {
      .stats-bar { grid-template-columns: repeat(2, 1fr); }
      .stat-item:nth-child(3)::before { display: none; }
    }
    @media (max-width: 480px) {
      .stats-bar { grid-template-columns: repeat(2, 1fr); border-radius: 16px; }
      .stat-val { font-size: 1.8rem; }
    }

    /* ── CTA Box ── */
    .cta-box {
      background: var(--ink);
      padding: clamp(40px, 7vw, 72px) clamp(24px, 5vw, 56px);
      border-radius: 24px;
      text-align: center;
      margin-bottom: clamp(40px, 7vw, 64px);
      width: 100%;
      max-width: 1100px;
      margin-left: auto;
      margin-right: auto;
      box-sizing: border-box;
      position: relative;
      overflow: hidden;
    }
    .cta-box::before {
      content: '';
      position: absolute;
      top: -80px;
      left: 50%;
      transform: translateX(-50%);
      width: 500px;
      height: 300px;
      background: radial-gradient(ellipse, rgba(232,160,32,0.2) 0%, transparent 70%);
      pointer-events: none;
    }
    .cta-box .section-h2 { color: white; position: relative; z-index: 1; }
    .cta-box .section-p { color: rgba(255,255,255,0.6); position: relative; z-index: 1; }
    .cta-box .btn-primary { position: relative; z-index: 1; }
    @media (max-width: 480px) {
      .cta-box { padding: 36px 24px; border-radius: 18px; }
    }

    /* ── Footer ── */
    .footer-wrap {
      padding: clamp(48px, 7vw, 72px) clamp(20px, 4vw, 40px) 0;
      max-width: 1100px;
      margin: 0 auto;
      width: 100%;
      box-sizing: border-box;
    }
    .footer {
      border-top: 1px solid var(--border);
      padding-top: clamp(32px, 5vw, 48px);
      display: grid;
      grid-template-columns: 2fr 1fr 1fr 1fr;
      gap: 40px;
      width: 100%;
      box-sizing: border-box;
    }
    .footer-bottom-bar {
      border-top: 1px solid var(--border);
      margin-top: 40px;
      padding: 20px 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.82rem;
      color: var(--ink-muted);
    }
    @media (max-width: 768px) {
      .footer { grid-template-columns: 1fr 1fr; gap: 28px; }
      .footer-bottom-bar { flex-direction: column; gap: 8px; text-align: center; }
    }
    @media (max-width: 480px) {
      .footer { grid-template-columns: 1fr; gap: 20px; }
    }
    .footer-logo { font-family: 'DM Serif Display', serif; font-size: 1.4rem; margin-bottom: 12px; display: block; color: var(--ink); }
    .footer-logo span { color: var(--amber); }
    .footer-desc { color: var(--ink-muted); font-size: 0.88rem; line-height: 1.6; max-width: 260px; }
    .footer-h5 { font-size: 0.78rem; margin-bottom: 14px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink); font-weight: 700; }
    .footer-link { display: block; color: var(--ink-muted); text-decoration: none; margin-bottom: 8px; font-size: 0.88rem; transition: color 0.15s; }
    .footer-link:hover { color: var(--ink); }
    /* LogoLoop */
    .logoloop {
      position: relative;
      --logoloop-gap: 32px;
      --logoloop-logoHeight: 28px;
      --logoloop-fadeColorAuto: var(--bg);
      margin: 40px 0;
    }
    .logoloop__track {
      display: flex;
      width: max-content;
      will-change: transform;
      user-select: none;
      position: relative;
      z-index: 0;
    }
    .logoloop__list {
      display: flex;
      align-items: center;
      padding: 0;
      margin: 0;
      list-style: none;
    }
    .logoloop__item {
      flex: 0 0 auto;
      margin-right: var(--logoloop-gap);
      font-size: var(--logoloop-logoHeight);
      line-height: 1;
      display: flex;
      align-items: center;
      color: var(--ink-muted);
      transition: color 0.3s ease;
    }
    .logoloop__item:hover { color: var(--amber); }
    .logoloop__node {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 1.2rem;
      font-weight: 600;
      font-family: 'DM Sans', sans-serif;
    }
    .logoloop--fade::before,
    .logoloop--fade::after {
      content: '';
      position: absolute;
      top: 0;
      bottom: 0;
      width: clamp(24px, 15%, 120px);
      pointer-events: none;
      z-index: 10;
    }
    .logoloop--fade::before {
      left: 0;
      background: linear-gradient(to right, var(--logoloop-fadeColor, var(--logoloop-fadeColorAuto)) 0%, rgba(0, 0, 0, 0) 100%);
    }
    .logoloop--fade::after {
      right: 0;
      background: linear-gradient(to left, var(--logoloop-fadeColor, var(--logoloop-fadeColorAuto)) 0%, rgba(0, 0, 0, 0) 100%);
    }
    .logoloop--scale-hover .logoloop__item { transition: transform 0.3s ease; }
    .logoloop--scale-hover .logoloop__item:hover { transform: scale(1.1); }

    /* StarBorder */
    .star-border-container {
      display: block;
      position: relative;
      border-radius: var(--radius);
      overflow: hidden;
      width: 100%;
    }
    .border-gradient-bottom {
      position: absolute;
      width: 300%;
      height: 100%;
      opacity: 1;
      bottom: -20%;
      right: -250%;
      border-radius: 50%;
      animation: star-movement-bottom linear infinite alternate;
      z-index: 0;
    }
    .border-gradient-top {
      position: absolute;
      opacity: 1;
      width: 300%;
      height: 100%;
      top: -20%;
      left: -250%;
      border-radius: 50%;
      animation: star-movement-top linear infinite alternate;
      z-index: 0;
    }
    .star-inner-content {
      position: relative;
      border: 1px solid var(--border);
      background: var(--surface);
      border-radius: var(--radius);
      z-index: 1;
      height: 100%;
    }
    @keyframes star-movement-bottom {
      0% { transform: translate(0%, 0%); opacity: 1; }
      100% { transform: translate(-100%, 0%); opacity: 0; }
    }
    @keyframes star-movement-top {
      0% { transform: translate(0%, 0%); opacity: 1; }
      100% { transform: translate(100%, 0%); opacity: 0; }
    }
    .text-type {
      display: inline-block;
      white-space: pre-wrap;
    }
    .text-type__cursor {
      margin-left: 0.25rem;
      display: inline-block;
      opacity: 1;
      color: var(--amber);
      font-weight: 900;
    }
    .text-type__cursor--hidden {
      display: none;
    }
    .text-type__content {
      color: inherit;
    }
  `,
};

// ─── COMPONENTS ───────────────────────────────────────────────────────────────

// StarBorder
const StarBorder = ({
  as: Component = 'div',
  className = '',
  color = '#E8A020', // Explicit amber color for visibility
  speed = '4s',      // Faster speed for more visible motion
  thickness = 2,     // Increased thickness
  children,
  ...rest
}) => {
  return (
    <Component
      className={`star-border-container ${className}`}
      style={{
        padding: `${thickness}px`,
        background: '#EDE9E1', // Slight border-like background
        ...rest.style
      }}
      {...rest}
    >
      <div
        className="border-gradient-bottom"
        style={{
          background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
          animationDuration: speed
        }}
      ></div>
      <div
        className="border-gradient-top"
        style={{
          background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
          animationDuration: speed
        }}
      ></div>
      <div className="star-inner-content">{children}</div>
    </Component>
  );
};

// LogoLoop
const ANIMATION_CONFIG = { SMOOTH_TAU: 0.25, MIN_COPIES: 2, COPY_HEADROOM: 2 };

const toCssLength = value => (typeof value === 'number' ? `${value}px` : (value ?? undefined));

const useResizeObserver = (callback, elements, dependencies) => {
  useEffect(() => {
    if (!window.ResizeObserver) {
      const handleResize = () => callback();
      window.addEventListener('resize', handleResize);
      callback();
      return () => window.removeEventListener('resize', handleResize);
    }
    const observers = elements.map(ref => {
      if (!ref.current) return null;
      const observer = new ResizeObserver(callback);
      observer.observe(ref.current);
      return observer;
    });
    callback();
    return () => {
      observers.forEach(observer => observer?.disconnect());
    };
  }, [callback, elements, dependencies]);
};

const useAnimationLoop = (trackRef, targetVelocity, seqWidth, seqHeight, isHovered, hoverSpeed, isVertical) => {
  const rafRef = useRef(null);
  const lastTimestampRef = useRef(null);
  const offsetRef = useRef(0);
  const velocityRef = useRef(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const seqSize = isVertical ? seqHeight : seqWidth;

    if (seqSize > 0) {
      offsetRef.current = ((offsetRef.current % seqSize) + seqSize) % seqSize;
      const transformValue = isVertical
        ? `translate3d(0, ${-offsetRef.current}px, 0)`
        : `translate3d(${-offsetRef.current}px, 0, 0)`;
      track.style.transform = transformValue;
    }

    const animate = timestamp => {
      if (lastTimestampRef.current === null) {
        lastTimestampRef.current = timestamp;
      }

      const deltaTime = Math.max(0, timestamp - lastTimestampRef.current) / 1000;
      lastTimestampRef.current = timestamp;

      const target = isHovered && hoverSpeed !== undefined ? hoverSpeed : targetVelocity;

      const easingFactor = 1 - Math.exp(-deltaTime / ANIMATION_CONFIG.SMOOTH_TAU);
      velocityRef.current += (target - velocityRef.current) * easingFactor;

      if (seqSize > 0) {
        let nextOffset = offsetRef.current + velocityRef.current * deltaTime;
        nextOffset = ((nextOffset % seqSize) + seqSize) % seqSize;
        offsetRef.current = nextOffset;

        const transformValue = isVertical
          ? `translate3d(0, ${-offsetRef.current}px, 0)`
          : `translate3d(${-offsetRef.current}px, 0, 0)`;
        track.style.transform = transformValue;
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastTimestampRef.current = null;
    };
  }, [targetVelocity, seqWidth, seqHeight, isHovered, hoverSpeed, isVertical, trackRef]);
};

const LogoLoop = memo(
  ({
    logos,
    speed = 120,
    direction = 'left',
    width = '100%',
    logoHeight = 28,
    gap = 32,
    pauseOnHover,
    hoverSpeed,
    fadeOut = false,
    fadeOutColor,
    scaleOnHover = false,
    renderItem,
    ariaLabel = 'Partner logos',
    className,
    style
  }) => {
    const containerRef = useRef(null);
    const trackRef = useRef(null);
    const seqRef = useRef(null);

    const [seqWidth, setSeqWidth] = useState(0);
    const [seqHeight, setSeqHeight] = useState(0);
    const [copyCount, setCopyCount] = useState(ANIMATION_CONFIG.MIN_COPIES);
    const [isHovered, setIsHovered] = useState(false);

    const effectiveHoverSpeed = useMemo(() => {
      if (hoverSpeed !== undefined) return hoverSpeed;
      if (pauseOnHover === true) return 0;
      if (pauseOnHover === false) return undefined;
      return 0;
    }, [hoverSpeed, pauseOnHover]);

    const isVertical = direction === 'up' || direction === 'down';

    const targetVelocity = useMemo(() => {
      const magnitude = Math.abs(speed);
      let directionMultiplier;
      if (isVertical) {
        directionMultiplier = direction === 'up' ? 1 : -1;
      } else {
        directionMultiplier = direction === 'left' ? 1 : -1;
      }
      const speedMultiplier = speed < 0 ? -1 : 1;
      return magnitude * directionMultiplier * speedMultiplier;
    }, [speed, direction, isVertical]);

    const updateDimensions = useCallback(() => {
      const containerWidth = containerRef.current?.clientWidth ?? 0;
      const sequenceRect = seqRef.current?.getBoundingClientRect?.();
      const sequenceWidth = sequenceRect?.width ?? 0;
      const sequenceHeight = sequenceRect?.height ?? 0;
      if (isVertical) {
        const parentHeight = containerRef.current?.parentElement?.clientHeight ?? 0;
        if (containerRef.current && parentHeight > 0) {
          const targetHeight = Math.ceil(parentHeight);
          if (containerRef.current.style.height !== `${targetHeight}px`)
            containerRef.current.style.height = `${targetHeight}px`;
        }
        if (sequenceHeight > 0) {
          setSeqHeight(Math.ceil(sequenceHeight));
          const viewport = containerRef.current?.clientHeight ?? parentHeight ?? sequenceHeight;
          const copiesNeeded = Math.ceil(viewport / sequenceHeight) + ANIMATION_CONFIG.COPY_HEADROOM;
          setCopyCount(Math.max(ANIMATION_CONFIG.MIN_COPIES, copiesNeeded));
        }
      } else if (sequenceWidth > 0) {
        setSeqWidth(Math.ceil(sequenceWidth));
        const copiesNeeded = Math.ceil(containerWidth / sequenceWidth) + ANIMATION_CONFIG.COPY_HEADROOM;
        setCopyCount(Math.max(ANIMATION_CONFIG.MIN_COPIES, copiesNeeded));
      }
    }, [isVertical]);

    useResizeObserver(updateDimensions, [containerRef, seqRef], [logos, gap, logoHeight, isVertical]);

    useAnimationLoop(trackRef, targetVelocity, seqWidth, seqHeight, isHovered, effectiveHoverSpeed, isVertical);

    const cssVariables = useMemo(
      () => ({
        '--logoloop-gap': `${gap}px`,
        '--logoloop-logoHeight': `${logoHeight}px`,
        ...(fadeOutColor && { '--logoloop-fadeColor': fadeOutColor })
      }),
      [gap, logoHeight, fadeOutColor]
    );

    const rootClassName = useMemo(
      () =>
        [
          'logoloop',
          isVertical ? 'logoloop--vertical' : 'logoloop--horizontal',
          fadeOut && 'logoloop--fade',
          scaleOnHover && 'logoloop--scale-hover',
          className
        ]
          .filter(Boolean)
          .join(' '),
      [isVertical, fadeOut, scaleOnHover, className]
    );

    const handleMouseEnter = useCallback(() => {
      if (effectiveHoverSpeed !== undefined) setIsHovered(true);
    }, [effectiveHoverSpeed]);
    const handleMouseLeave = useCallback(() => {
      if (effectiveHoverSpeed !== undefined) setIsHovered(false);
    }, [effectiveHoverSpeed]);

    const renderLogoItem = useCallback(
      (item, key) => {
        if (renderItem) {
          return (
            <li className="logoloop__item" key={key} role="listitem">
              {renderItem(item, key)}
            </li>
          );
        }
        const isNodeItem = 'node' in item;
        const content = isNodeItem ? (
          <span className="logoloop__node" aria-hidden={!!item.href && !item.ariaLabel}>
            {item.node} {item.title && <span style={{ marginLeft: 8 }}>{item.title}</span>}
          </span>
        ) : (
          <img
            src={item.src}
            width={item.width}
            height={item.height}
            alt={item.alt ?? ''}
            title={item.title}
            loading="lazy"
            draggable={false}
          />
        );
        const itemAriaLabel = isNodeItem ? (item.ariaLabel ?? item.title) : (item.alt ?? item.title);
        const itemContent = item.href ? (
          <a
            className="logoloop__link"
            href={item.href}
            aria-label={itemAriaLabel || 'logo link'}
            target="_blank"
            rel="noreferrer noopener"
            style={{ color: 'inherit', textDecoration: 'none' }}
          >
            {content}
          </a>
        ) : (
          content
        );
        return (
          <li className="logoloop__item" key={key} role="listitem">
            {itemContent}
          </li>
        );
      },
      [renderItem]
    );

    const logoLists = useMemo(
      () =>
        Array.from({ length: copyCount }, (_, copyIndex) => (
          <ul
            className="logoloop__list"
            key={`copy-${copyIndex}`}
            role="list"
            aria-hidden={copyIndex > 0}
            ref={copyIndex === 0 ? seqRef : undefined}
          >
            {logos.map((item, itemIndex) => renderLogoItem(item, `${copyIndex}-${itemIndex}`))}
          </ul>
        )),
      [copyCount, logos, renderLogoItem]
    );

    const containerStyle = useMemo(
      () => ({
        width: isVertical
          ? toCssLength(width) === '100%'
            ? undefined
            : toCssLength(width)
          : (toCssLength(width) ?? '100%'),
        ...cssVariables,
        ...style
      }),
      [width, cssVariables, style, isVertical]
    );

    return (
      <div ref={containerRef} className={rootClassName} style={containerStyle} role="region" aria-label={ariaLabel}>
        <div className="logoloop__track" ref={trackRef} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
          {logoLists}
        </div>
      </div>
    );
  }
);

// ClickSpark
const ClickSpark = ({
  sparkColor = 'var(--amber)',
  sparkSize = 10,
  sparkRadius = 15,
  sparkCount = 8,
  duration = 400,
  easing = 'ease-out',
  extraScale = 1.0,
  children
}) => {
  const canvasRef = useRef(null);
  const sparksRef = useRef([]);
  const startTimeRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    let resizeTimeout;

    const resizeCanvas = () => {
      const { width, height } = parent.getBoundingClientRect();
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
    };

    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(resizeCanvas, 100);
    };

    const ro = new ResizeObserver(handleResize);
    ro.observe(parent);

    resizeCanvas();

    return () => {
      ro.disconnect();
      clearTimeout(resizeTimeout);
    };
  }, []);

  const easeFunc = useCallback(
    t => {
      switch (easing) {
        case 'linear':
          return t;
        case 'ease-in':
          return t * t;
        case 'ease-in-out':
          return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        default:
          return t * (2 - t);
      }
    },
    [easing]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let animationId;

    const draw = timestamp => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      sparksRef.current = sparksRef.current.filter(spark => {
        const elapsed = timestamp - spark.startTime;
        if (elapsed >= duration) {
          return false;
        }

        const progress = elapsed / duration;
        const eased = easeFunc(progress);

        const distance = eased * sparkRadius * extraScale;
        const lineLength = sparkSize * (1 - eased);

        const x1 = spark.x + distance * Math.cos(spark.angle);
        const y1 = spark.y + distance * Math.sin(spark.angle);
        const x2 = spark.x + (distance + lineLength) * Math.cos(spark.angle);
        const y2 = spark.y + (distance + lineLength) * Math.sin(spark.angle);

        ctx.strokeStyle = sparkColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        return true;
      });

      animationId = requestAnimationFrame(draw);
    };

    animationId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [sparkColor, sparkSize, sparkRadius, sparkCount, duration, easeFunc, extraScale]);

  const handleClick = e => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const now = performance.now();
    const newSparks = Array.from({ length: sparkCount }, (_, i) => ({
      x,
      y,
      angle: (2 * Math.PI * i) / sparkCount,
      startTime: now
    }));

    sparksRef.current.push(...newSparks);
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh'
      }}
      onClick={handleClick}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          userSelect: 'none',
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          zIndex: 9999
        }}
      />
      {children}
    </div>
  );
};

// TextType
const TextType = ({
  text,
  as: Component = 'div',
  typingSpeed = 50,
  initialDelay = 0,
  pauseDuration = 2000,
  deletingSpeed = 30,
  loop = true,
  className = '',
  showCursor = true,
  hideCursorWhileTyping = false,
  cursorCharacter = '|',
  cursorClassName = '',
  cursorBlinkDuration = 0.5,
  textColors = [],
  variableSpeed,
  onSentenceComplete,
  startOnVisible = false,
  reverseMode = false,
  ...props
}) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(!startOnVisible);
  const cursorRef = useRef(null);
  const containerRef = useRef(null);

  const textArray = useMemo(() => (Array.isArray(text) ? text : [text]), [text]);

  const getRandomSpeed = useCallback(() => {
    if (!variableSpeed) return typingSpeed;
    const { min, max } = variableSpeed;
    return Math.random() * (max - min) + min;
  }, [variableSpeed, typingSpeed]);

  const getCurrentTextColor = () => {
    if (textColors.length === 0) return 'inherit';
    return textColors[currentTextIndex % textColors.length];
  };

  useEffect(() => {
    if (!startOnVisible || !containerRef.current) return;

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setIsVisible(true);
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [startOnVisible]);

  useEffect(() => {
    if (showCursor && cursorRef.current) {
      gsap.set(cursorRef.current, { opacity: 1 });
      gsap.to(cursorRef.current, {
        opacity: 0,
        duration: cursorBlinkDuration,
        repeat: -1,
        yoyo: true,
        ease: 'power2.inOut'
      });
    }
  }, [showCursor, cursorBlinkDuration]);

  useEffect(() => {
    if (!isVisible) return;

    let timeout;
    const currentText = textArray[currentTextIndex];
    if (!currentText) return;
    const processedText = reverseMode ? currentText.split('').reverse().join('') : currentText;

    const executeTypingAnimation = () => {
      if (isDeleting) {
        if (displayedText === '') {
          setIsDeleting(false);
          if (currentTextIndex === textArray.length - 1 && !loop) {
            return;
          }

          if (onSentenceComplete) {
            onSentenceComplete(textArray[currentTextIndex], currentTextIndex);
          }

          setCurrentTextIndex(prev => (prev + 1) % textArray.length);
          setCurrentCharIndex(0);
          timeout = setTimeout(() => { }, pauseDuration);
        } else {
          timeout = setTimeout(() => {
            setDisplayedText(prev => prev.slice(0, -1));
          }, deletingSpeed);
        }
      } else {
        if (currentCharIndex < processedText.length) {
          timeout = setTimeout(
            () => {
              setDisplayedText(prev => prev + processedText[currentCharIndex]);
              setCurrentCharIndex(prev => prev + 1);
            },
            variableSpeed ? getRandomSpeed() : typingSpeed
          );
        } else if (textArray.length >= 1) {
          if (!loop && currentTextIndex === textArray.length - 1) return;
          timeout = setTimeout(() => {
            setIsDeleting(true);
          }, pauseDuration);
        }
      }
    };

    if (currentCharIndex === 0 && !isDeleting && displayedText === '') {
      timeout = setTimeout(executeTypingAnimation, initialDelay);
    } else {
      executeTypingAnimation();
    }

    return () => clearTimeout(timeout);
  }, [
    currentCharIndex,
    displayedText,
    isDeleting,
    typingSpeed,
    deletingSpeed,
    pauseDuration,
    textArray,
    currentTextIndex,
    loop,
    initialDelay,
    isVisible,
    reverseMode,
    variableSpeed,
    onSentenceComplete,
    getRandomSpeed
  ]);

  const shouldHideCursor =
    hideCursorWhileTyping && (currentCharIndex < textArray[currentTextIndex].length || isDeleting);

  return createElement(
    Component,
    {
      ref: containerRef,
      className: `text-type ${className}`,
      ...props
    },
    <span className="text-type__content" style={{ color: getCurrentTextColor() || 'inherit' }}>
      {displayedText}
    </span>,
    showCursor && (
      <span
        ref={cursorRef}
        className={`text-type__cursor ${cursorClassName} ${shouldHideCursor ? 'text-type__cursor--hidden' : ''}`}
      >
        {cursorCharacter}
      </span>
    )
  );
};

// TrueFocus
const TrueFocus = ({
  sentence = 'True Focus',
  separator = ' ',
  manualMode = false,
  blurAmount = 5,
  borderColor = 'var(--amber)',
  glowColor = 'rgba(232, 160, 32, 0.6)',
  animationDuration = 0.5,
  pauseBetweenAnimations = 1
}) => {
  const words = sentence.split(separator);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lastActiveIndex, setLastActiveIndex] = useState(null);
  const containerRef = useRef(null);
  const wordRefs = useRef([]);
  const [focusRect, setFocusRect] = useState({ x: 0, y: 0, width: 0, height: 0 });

  useEffect(() => {
    if (!manualMode) {
      const interval = setInterval(
        () => {
          setCurrentIndex(prev => (prev + 1) % words.length);
        },
        (animationDuration + pauseBetweenAnimations) * 1000
      );

      return () => clearInterval(interval);
    }
  }, [manualMode, animationDuration, pauseBetweenAnimations, words.length]);

  useEffect(() => {
    if (currentIndex === null || currentIndex === -1) return;

    if (!wordRefs.current[currentIndex] || !containerRef.current) return;

    const parentRect = containerRef.current.getBoundingClientRect();
    const activeRect = wordRefs.current[currentIndex].getBoundingClientRect();

    setFocusRect({
      x: activeRect.left - parentRect.left,
      y: activeRect.top - parentRect.top,
      width: activeRect.width,
      height: activeRect.height
    });
  }, [currentIndex, words.length]);

  const handleMouseEnter = index => {
    if (manualMode) {
      setLastActiveIndex(index);
      setCurrentIndex(index);
    }
  };

  const handleMouseLeave = () => {
    if (manualMode) {
      setCurrentIndex(lastActiveIndex);
    }
  };

  return (
    <div className="focus-container" ref={containerRef}>
      {words.map((word, index) => {
        const isActive = index === currentIndex;
        return (
          <span
            key={index}
            ref={el => (wordRefs.current[index] = el)}
            className={`focus-word ${manualMode ? 'manual' : ''} ${isActive && !manualMode ? 'active' : ''}`}
            style={{
              filter: manualMode
                ? isActive
                  ? `blur(0px)`
                  : `blur(${blurAmount}px)`
                : isActive
                  ? `blur(0px)`
                  : `blur(${blurAmount}px)`,
              '--border-color': borderColor,
              '--glow-color': glowColor,
              transition: `filter ${animationDuration}s ease`
            }}
            onMouseEnter={() => handleMouseEnter(index)}
            onMouseLeave={handleMouseLeave}
          >
            {word}
          </span>
        );
      })}

      <motion.div
        className="focus-frame"
        animate={{
          x: focusRect.x,
          y: focusRect.y,
          width: focusRect.width,
          height: focusRect.height,
          opacity: currentIndex >= 0 ? 1 : 0
        }}
        transition={{
          duration: animationDuration
        }}
        style={{
          '--border-color': borderColor,
          '--glow-color': glowColor
        }}
      >
        <span className="corner top-left"></span>
        <span className="corner top-right"></span>
        <span className="corner bottom-left"></span>
        <span className="corner bottom-right"></span>
      </motion.div>
    </div>
  );
};

// CountUp
const CountUp = ({
  to,
  from = 0,
  direction = 'up',
  delay = 0,
  duration = 2,
  className = '',
  startWhen = true,
  separator = '',
  onStart,
  onEnd
}) => {
  const ref = useRef(null);
  const motionValue = useMotionValue(direction === 'down' ? to : from);

  const damping = 20 + 40 * (1 / duration);
  const stiffness = 100 * (1 / duration);

  const springValue = useSpring(motionValue, {
    damping,
    stiffness
  });

  const isInView = useInView(ref, { once: true, amount: 0.5 });

  const getDecimalPlaces = num => {
    const str = num.toString();
    if (str.includes('.')) {
      const decimals = str.split('.')[1];
      if (parseInt(decimals) !== 0) {
        return decimals.length;
      }
    }
    return 0;
  };

  const maxDecimals = Math.max(getDecimalPlaces(from), getDecimalPlaces(to));

  const formatValue = useCallback(
    latest => {
      const hasDecimals = maxDecimals > 0;
      const options = {
        useGrouping: !!separator,
        minimumFractionDigits: hasDecimals ? maxDecimals : 0,
        maximumFractionDigits: hasDecimals ? maxDecimals : 0
      };
      const formattedNumber = Intl.NumberFormat('en-US', options).format(latest);
      return separator ? formattedNumber.replace(/,/g, separator) : formattedNumber;
    },
    [maxDecimals, separator]
  );

  useEffect(() => {
    if (ref.current) {
      ref.current.textContent = formatValue(direction === 'down' ? to : from);
    }
  }, [from, to, direction, formatValue]);

  useEffect(() => {
    if (isInView && startWhen) {
      if (typeof onStart === 'function') onStart();
      const timeoutId = setTimeout(() => {
        motionValue.set(direction === 'down' ? from : to);
      }, delay * 1000);

      const durationTimeoutId = setTimeout(
        () => {
          if (typeof onEnd === 'function') onEnd();
        },
        delay * 1000 + duration * 1000
      );

      return () => {
        clearTimeout(timeoutId);
        clearTimeout(durationTimeoutId);
      };
    }
  }, [isInView, startWhen, motionValue, direction, from, to, delay, onStart, onEnd, duration]);

  useEffect(() => {
    const unsubscribe = springValue.on('change', latest => {
      if (ref.current) {
        ref.current.textContent = formatValue(latest);
      }
    });
    return () => unsubscribe();
  }, [springValue, formatValue]);

  return <span className={className} ref={ref} />;
};

// ─── MAGIC BENTO COMPONENTS ───────────────────────────────────────────────

const MagicCard = ({ children, className = "", style = {}, isDanger = false, noParticles = false }) => {
  const cardRef = useRef(null);
  const isHoveredRef = useRef(false);
  const particlesRef = useRef([]);
  const timeoutsRef = useRef([]);
  const glowColor = "232, 160, 32"; // Project Amber

  const clearParticles = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    particlesRef.current.forEach(p => {
      gsap.to(p, { scale: 0, opacity: 0, duration: 0.3, onComplete: () => p.remove() });
    });
    particlesRef.current = [];
  }, []);

  const spawnParticles = useCallback(() => {
    if (noParticles || !cardRef.current || !isHoveredRef.current) return;
    const count = 8;
    for (let i = 0; i < count; i++) {
      const tid = setTimeout(() => {
        if (!isHoveredRef.current || !cardRef.current) return;
        const p = document.createElement("div");
        p.className = "particle";
        const rect = cardRef.current.getBoundingClientRect();
        p.style.left = `${Math.random() * rect.width}px`;
        p.style.top = `${Math.random() * rect.height}px`;
        cardRef.current.appendChild(p);
        particlesRef.current.push(p);

        gsap.fromTo(p, { scale: 0, opacity: 0 }, { scale: 1, opacity: 0.8, duration: 0.4 });
        gsap.to(p, {
          x: (Math.random() - 0.5) * 60,
          y: (Math.random() - 0.5) * 60,
          opacity: 0,
          duration: 1.5 + Math.random(),
          ease: "power1.out",
          onComplete: () => {
            p.remove();
            particlesRef.current = particlesRef.current.filter(x => x !== p);
          }
        });
      }, i * 150);
      timeoutsRef.current.push(tid);
    }
  }, [noParticles]);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const onEnter = () => { isHoveredRef.current = true; spawnParticles(); };
    const onLeave = () => { isHoveredRef.current = false; clearParticles(); };
    const onMove = (e) => {
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      el.style.setProperty("--glow-x", `${x}%`);
      el.style.setProperty("--glow-y", `${y}%`);
      el.style.setProperty("--glow-intensity", "1");
    };

    el.addEventListener("mouseenter", onEnter);
    el.addEventListener("mouseleave", onLeave);
    el.addEventListener("mousemove", onMove);
    return () => {
      el.removeEventListener("mouseenter", onEnter);
      el.removeEventListener("mouseleave", onLeave);
      el.removeEventListener("mousemove", onMove);
      clearParticles();
    };
  }, [spawnParticles, clearParticles]);

  return (
    <div ref={cardRef} className={`magic-card ${className}`} style={{ ...style, cursor: 'pointer' }}>
      <div className="magic-card-content" style={{ height: '100%', width: '100%' }}>
        {children}
      </div>
    </div>
  );
};

const SpotlightGrid = ({ children, className = "" }) => {
  const containerRef = useRef(null);
  const spotlightRef = useRef(null);

  useEffect(() => {
    const spotlight = document.createElement("div");
    spotlight.className = "global-spotlight";
    document.body.appendChild(spotlight);
    spotlightRef.current = spotlight;

    const onMove = (e) => {
      const rect = containerRef.current.getBoundingClientRect();
      const isInside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;

      gsap.to(spotlight, {
        left: e.clientX,
        top: e.clientY,
        opacity: isInside ? 1 : 0,
        duration: 0.2,
        ease: "power2.out"
      });

      const cards = containerRef.current.querySelectorAll(".magic-card");
      cards.forEach(card => {
        const cRect = card.getBoundingClientRect();
        const dist = Math.hypot(e.clientX - (cRect.left + cRect.width / 2), e.clientY - (cRect.top + cRect.height / 2));
        const intensity = isInside ? Math.max(0, 1 - dist / 400) : 0;
        card.style.setProperty("--glow-intensity", intensity.toString());
      });
    };

    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      spotlight.remove();
    };
  }, []);

  return <div ref={containerRef} className={className}>{children}</div>;
};

// LandingNav
const LandingNav = ({ onStart }) => (
  <nav className="landing-nav">
    <img src={logo2} alt="Monetra Logo" className="nav-logo-img" style={{ height: '32px', cursor: 'pointer' }} />
    <div className="nav-links-center">
      <a href="#features" className="nav-link">Features</a>
      <a href="#benefits" className="nav-link">Benefits</a>
      <a href="#stats" className="nav-link">Stats</a>
    </div>
    <button className="btn-primary" style={{ padding: '10px 22px', fontSize: '0.85rem' }} onClick={onStart}>
      Get Started
    </button>
  </nav>
);

// LandingPage
function LandingPage({ onStart, user }) {
  const techLogos = [
    { node: <SiReact />, title: "React", href: "https://react.dev" },
    { node: <SiGooglecloud />, title: "MongoDB", href: "https://www.mongodb.com/" },
    { node: <SiGooglecloud />, title: "Gemini", href: "https://deepmind.google/technologies/gemini/" },
    { node: <SiFastapi />, title: "FastAPI", href: "https://fastapi.tiangolo.com" },
    { node: <SiPython />, title: "Python", href: "https://python.org" },
    { node: <SiVite />, title: "Vite", href: "https://vitejs.dev" },
    { node: <SiTailwindcss />, title: "Tailwind", href: "https://tailwindcss.com" },
  ];

  return (
    <div className="landing-root">
      <LandingNav onStart={onStart} />

      {/* ── Hero ── */}
      <section className="landing-hero">
        <div className="landing-hero-content">
          <div className="section-tag" style={{ marginBottom: 20 }}>✦ AI-Powered Financial Intelligence</div>

          <TrueFocus
            sentence="Financial Co-Pilot"
            manualMode={false}
            blurAmount={5}
            borderColor="var(--amber)"
            animationDuration={0.5}
            pauseBetweenAnimations={1}
          />

          <p className="landing-sub" style={{ marginTop: 28 }}>
            Smart financial management designed for micro-businesses. Get real-time insights,
            automated tracking, and AI-powered recommendations to grow your business with confidence.
          </p>
          <div className="hero-cta-row">
            <button className="btn-primary" onClick={onStart}>Get Started Free →</button>
            <button className="nav-btn" style={{ border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.75)', borderRadius: 999, padding: '10px 24px', fontSize: '0.9rem', background: 'transparent', fontWeight: 500, cursor: 'pointer' }}>
              See How It Works
            </button>
          </div>
        </div>
      </section>

      {/* ── Tech Stack Ticker ── */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', borderTop: '1px solid var(--border)', padding: '18px 0' }}>
        <LogoLoop
          logos={techLogos}
          speed={60}
          direction="left"
          logoHeight={22}
          gap={48}
          fadeOut
          scaleOnHover
        />
      </div>

      {/* ── Features ── */}
      <section id="features" className="landing-section">
        <div className="landing-section-content">
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div className="section-tag">Features</div>
            <h2 className="section-h2" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '2.5em' }}>
              <TextType
                text={["Everything You Need to Manage Finances", "Smart Insights for Your Business", "AI-Powered Growth Tools"]}
                typingSpeed={70}
                pauseDuration={2000}
                showCursor
                cursorCharacter="_"
                deletingSpeed={45}
                loop={true}
                as="span"
              />
            </h2>
            <p className="section-p" style={{ maxWidth: 520, margin: '0 auto' }}>Powerful tools designed specifically for small businesses and entrepreneurs.</p>
          </div>

          <SpotlightGrid className="features-grid">
            {[
              { icon: '📊', icon2: '📈', title: 'Real-Time Dashboard', desc: 'Monitor revenue, expenses, and cashflow at a glance with beautiful visualizations.', badge: 'Live Data', badgeColor: '#E8A020', bg: 'linear-gradient(135deg, #FFF8E8 0%, #FFF3D0 50%, #FEF0C0 100%)' },
              { icon: '📓', icon2: '🔍', title: 'Smart Transactions', desc: 'Auto-categorize and organize transactions. Search, filter, and analyze effortlessly.', badge: 'AI Sorted', badgeColor: '#2D9E6B', bg: 'linear-gradient(135deg, #EDFAF4 0%, #D6F4E8 50%, #C5EFE0 100%)' },
              { icon: '💡', icon2: '⚡', title: 'AI Insights', desc: 'Intelligent recommendations and alerts. Detect anomalies and make data-driven decisions.', badge: 'Gemini AI', badgeColor: '#3B74D4', bg: 'linear-gradient(135deg, #EBF1FB 0%, #D6E5F8 50%, #C5D9F5 100%)' },
              { icon: '📓', icon2: '🤖', title: 'AI Assistant', desc: 'Chat with your financial data. Ask questions in plain language and get instant answers.', badge: 'Always On', badgeColor: '#E8A020', bg: 'linear-gradient(135deg, #FFF5EC 0%, #FFE8D0 50%, #FFDCC0 100%)' },
              { icon: '⚡', icon2: '🔔', title: 'Smart Alerts', desc: 'Never miss important financial events. Get notified about unusual expenses or opportunities.', badge: 'Real-time', badgeColor: '#D94F3A', bg: 'linear-gradient(135deg, #FEF0EE 0%, #FDE0DB 50%, #FDD0C9 100%)' },
              { icon: '📱', icon2: '🌐', title: 'Mobile Ready', desc: 'Access your financial data anywhere. Fully responsive design works on all devices.', badge: 'Any Device', badgeColor: '#7B5EA7', bg: 'linear-gradient(135deg, #F3EFFE 0%, #E8E0FC 50%, #DDD0FA 100%)' },
            ].map(({ icon, icon2, title, desc, badge, badgeColor, bg }) => (
              <MagicCard key={title} className="feat-card" style={{ background: bg }}>
                <div className="feat-card-top">
                  <div className="feat-icons">
                    <div className="feat-icon-box">{icon}</div>
                    <div className="feat-icon-box">{icon2}</div>
                  </div>
                  <div className="feat-pin">♡</div>
                </div>
                <div className="feat-card-body">
                  <h3 className="feat-h3">{title}</h3>
                  <p className="feat-p">{desc}</p>
                </div>
                <div className="feat-card-footer">
                  <span className="feat-badge">
                    <span className="feat-badge-dot" style={{ background: badgeColor }} />
                    {badge}
                  </span>
                </div>
              </MagicCard>
            ))}
          </SpotlightGrid>
        </div>
      </section>

      {/* ── Benefits ── */}
      <section id="benefits" className="landing-section" style={{ background: 'var(--surface)' }}>
        <div className="landing-section-content">
          <div className="benefits-split">
            <div>
              <div className="section-tag">Benefits</div>
              <h2 className="section-h2">Why Choose Monetra?</h2>
              <p className="section-p">Built for micro-businesses that want to focus on growth, not accounting.</p>

              {[
                { title: 'Save Hours Every Week', desc: 'Automate financial tracking and reporting. Spend less time on bookkeeping.' },
                { title: 'Make Smarter Decisions', desc: 'AI-powered insights help you spot trends, identify risks, and seize opportunities.' },
                { title: 'Stay In Control', desc: 'Real-time cashflow monitoring ensures you\'re always aware of your financial health.' },
              ].map(({ title, desc }) => (
                <div key={title} className="benefit-item">
                  <span className="benefit-check">✓</span>
                  <div>
                    <h4 className="benefit-h4">{title}</h4>
                    <p className="benefit-p">{desc}</p>
                  </div>
                </div>
              ))}

              <button className="btn-primary" style={{ marginTop: 8 }} onClick={onStart}>Start For Free →</button>
            </div>

            {/* Mock Dashboard Visual */}
            <div className="mock-dashboard">
              <div className="mock-dash-header">
                <span className="mock-dash-title">Overview · This Month</span>
                <span className="mock-dash-badge">● Live</span>
              </div>
              <div className="mock-stat-row">
                <div className="mock-stat">
                  <div className="mock-stat-label">Cash In</div>
                  <div className="mock-stat-value up">PKR 165k</div>
                </div>
                <div className="mock-stat">
                  <div className="mock-stat-label">Cash Out</div>
                  <div className="mock-stat-value down">PKR 59k</div>
                </div>
              </div>
              <div className="mock-bar-section">
                <div className="mock-bar-label"><span className="mock-bar-name">Materials</span><span className="mock-bar-val">PKR 24.5k</span></div>
                <div className="mock-bar-track"><div className="mock-bar-fill" style={{ width: '72%', background: 'var(--amber)' }} /></div>
              </div>
              <div className="mock-bar-section">
                <div className="mock-bar-label"><span className="mock-bar-name">Labor</span><span className="mock-bar-val">PKR 18.2k</span></div>
                <div className="mock-bar-track"><div className="mock-bar-fill" style={{ width: '55%', background: '#4B9EE8' }} /></div>
              </div>
              <div className="mock-bar-section">
                <div className="mock-bar-label"><span className="mock-bar-name">Marketing</span><span className="mock-bar-val">PKR 9.1k</span></div>
                <div className="mock-bar-track"><div className="mock-bar-fill" style={{ width: '28%', background: 'var(--green)' }} /></div>
              </div>
              <div className="mock-ai-chip">
                <div className="mock-ai-dot" />
                <span className="mock-ai-text">AI detected a 15% spike in material costs. Consider bulk purchasing to save ~PKR 3.2k.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <div id="stats" style={{ padding: '0 clamp(20px, 4vw, 40px)' }}>
        <div className="stats-bar">
          <div className="stat-item">
            <div className="stat-val">
              <CountUp to={10} duration={1.5} />k+
            </div>
            <div className="stat-lbl">Businesses Trust Us</div>
          </div>
          <div className="stat-item">
            <div className="stat-val">
              PKR <CountUp to={2.5} duration={1.5} />B+
            </div>
            <div className="stat-lbl">Transactions Tracked</div>
          </div>
          <div className="stat-item">
            <div className="stat-val">
              <CountUp to={98} duration={1.5} />%
            </div>
            <div className="stat-lbl">Customer Satisfaction</div>
          </div>
          <div className="stat-item">
            <div className="stat-val">
              <CountUp to={24} duration={1.5} />/7
            </div>
            <div className="stat-lbl">AI Support Available</div>
          </div>
        </div>
      </div>

      {/* ── CTA ── */}
      <section className="landing-section">
        <div className="cta-box">
          <h2 className="section-h2">Ready to Transform Your Finances?</h2>
          <p className="section-p">Join thousands of micro-businesses already using AI to make smarter decisions.</p>
          <button className="btn-primary" style={{ margin: '0 auto' }} onClick={onStart}>Launch Dashboard Now →</button>
        </div>
      </section>

      {/* ── Footer ── */}
      <div className="footer-wrap">
        <footer className="footer">
          <div>
            <img src={logo2} alt="Monetra Logo" className="footer-logo-img" style={{ height: '40px', marginBottom: '16px' }} />
            <p className="footer-desc">AI-powered financial management for micro-businesses. Make smarter decisions with real-time insights.</p>
          </div>
          <div>
            <h5 className="footer-h5">Product</h5>
            <a href="#features" className="footer-link">Features</a>
            <a href="#benefits" className="footer-link">Benefits</a>
            <a href="#" className="footer-link">Dashboard</a>
          </div>
          <div>
            <h5 className="footer-h5">Company</h5>
            <a href="#" className="footer-link">About Us</a>
            <a href="#" className="footer-link">Blog</a>
            <a href="#" className="footer-link">Careers</a>
          </div>
          <div>
            <h5 className="footer-h5">Legal</h5>
            <a href="#" className="footer-link">Privacy Policy</a>
            <a href="#" className="footer-link">Terms of Service</a>
            <a href="#" className="footer-link">Compliance</a>
          </div>
        </footer>
        <div className="footer-bottom-bar">
          <span>© 2026 Monetra. All rights reserved.</span>
          <span>Built with ♥ for micro-businesses</span>
        </div>
      </div>
    </div>
  );
}



function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmText = "Confirm", cancelText = "Cancel", isDanger = false }) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">{title}</h3>
        <p className="modal-body">{message}</p>
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onCancel} style={{ padding: '10px 20px', fontSize: '0.9rem' }}>{cancelText}</button>
          <button
            className={isDanger ? "" : "btn-primary"}
            onClick={onConfirm}
            style={isDanger ? {
              background: 'var(--red)',
              color: 'white',
              border: 'none',
              padding: '10px 24px',
              borderRadius: 12,
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(220, 38, 38, 0.2)'
            } : { padding: '10px 24px', fontSize: '0.9rem' }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

// SummaryCard
function SummaryCard({ label, value, type, tag }) {
  const fmt = (v) => "PKR " + Math.abs(v).toLocaleString();
  return (
    <MagicCard className="summary-card" style={{ padding: 0 }}>
      <div style={{ padding: '24px' }}>
        <div className="summary-label">{label}</div>
        <div className={`summary-value ${type}`}>{fmt(value)}</div>
        {tag && <div className="summary-tag">{tag}</div>}
      </div>
    </MagicCard>
  );
}

// InsightCard
function InsightCard({ message, severity, type }) {
  const icons = {
    positive: "✅",
    medium: "⚠️",
    high: "🔺",
    low: "ℹ️",
    anomaly_spike: "🧨",
    large_expense: "💸"
  };

  const isAnomaly = type === "anomaly_spike" || type === "large_expense";

  return (
    <div className={`insight-card ${severity} ${isAnomaly ? 'anomaly' : ''}`}>
      <span className="insight-icon">{icons[type] || icons[severity] || "•"}</span>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span className="insight-text">{message}</span>
        {isAnomaly && (
          <span style={{
            fontSize: '0.7rem',
            textTransform: 'uppercase',
            fontWeight: 700,
            marginTop: 4,
            color: severity === 'high' ? 'var(--red)' : 'var(--amber)'
          }}>
            {type === "anomaly_spike" ? "Action Required: Spending Spike" : "Review Required: Large Transaction"}
          </span>
        )}
      </div>
    </div>
  );
}

// Custom Tooltip for Recharts
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip">
        <p className="label">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="val">
            <span style={{ color: entry.color, fontSize: '0.75rem' }}>● {entry.name}:</span>
            <span style={{ fontWeight: 600 }}>PKR {entry.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// TrendsChart
function TrendsChart({ data }) {
  if (!data || data.length === 0) return <div className="chart-empty">No trend data available for the selected period.</div>;

  return (
    <div style={{ width: '100%', height: 260 }}>
      <ResponsiveContainer>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--green)" stopOpacity={0.2} />
              <stop offset="95%" stopColor="var(--green)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--amber)" stopOpacity={0.2} />
              <stop offset="95%" stopColor="var(--amber)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--ink-muted)', fontSize: 11 }}
            dy={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--ink-muted)', fontSize: 11 }}
            tickFormatter={(v) => `PKR ${v}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            name="Income"
            type="monotone"
            dataKey="income"
            stroke="var(--green)"
            fillOpacity={1}
            fill="url(#colorIn)"
          />
          <Area
            name="Expense"
            type="monotone"
            dataKey="expense"
            stroke="var(--amber)"
            fillOpacity={1}
            fill="url(#colorOut)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// CategoryChart
function CategoryChart({ data }) {
  if (!data || data.length === 0) return <div className="chart-empty">No category data available.</div>;

  const COLORS = ['#E8A020', '#4B9EE8', '#2D9E6B', '#7B5EA7', '#D94F3A', '#8D99AE'];

  return (
    <div style={{ width: '100%', height: 260, position: 'relative' }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            innerRadius={65}
            outerRadius={90}
            paddingAngle={5}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center',
        pointerEvents: 'none'
      }}>
        <div style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', textTransform: 'uppercase' }}>Expenses</div>
        <div style={{ fontSize: '1.2rem', fontWeight: 600, fontFamily: 'DM Serif Display' }}>By Type</div>
      </div>
    </div>
  );
}

// UploadBox
function UploadBox({ onSuccess }) {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("idle"); // idle, uploading, analyzing
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [mode, setMode] = useState("file"); // "file" or "manual"
  const [manualData, setManualData] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: "",
    description: "",
    direction: "out",
    category: "Other"
  });
  const inputRef = useRef();

  const handleFile = (f) => {
    if (f && f.name.endsWith(".csv")) { setFile(f); setError(""); }
    else setError("Please upload a CSV file.");
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleSubmitFile = async () => {
    if (!file) return;
    setStatus("uploading"); setError("");
    try {
      const data = await api.upload(file);
      api.classify(100).catch(err => console.warn("Background analysis started/failed:", err));
      onSuccess(data || { summary: MOCK_SUMMARY });
    } catch (err) {
      console.error("Upload failed:", err);
      setError("Upload failed. Please check your connection and try again.");
    } finally {
      setStatus("idle");
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualData.amount || !manualData.description) {
      setError("Please fill in all basic fields.");
      return;
    }
    setStatus("uploading");
    setError("");
    try {
      await api.addTransaction(manualData);
      // Trigger dashboard data refresh properly
      onSuccess({ manual: true });
      // Reset form
      setManualData({
        date: new Date().toISOString().split('T')[0],
        amount: "",
        description: "",
        direction: "out",
        category: "Other"
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setStatus("idle");
    }
  };

  const isLoading = status !== "idle";

  return (
    <div className="upload-hero">
      <div>
        <div className="upload-badge">✦ Data Management</div>
      </div>
      <div>
        <h1 className="upload-title">Add Your<br /><em>Business Transactions</em></h1>
        <p className="upload-sub" style={{ marginTop: 12 }}>
          Choose how you want to add your data today.
        </p>
      </div>

      <div className="mode-toggle">
        <button className={`mode-btn ${mode === 'file' ? 'active' : ''}`} onClick={() => setMode('file')}>CSV Upload</button>
        <button className={`mode-btn ${mode === 'manual' ? 'active' : ''}`} onClick={() => setMode('manual')}>Manual Entry</button>
      </div>

      {mode === 'file' ? (
        <div
          className={`dropzone${file ? " file-selected" : ""}${dragging ? " active" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => !file && !isLoading && inputRef.current.click()}
        >
          <input ref={inputRef} type="file" accept=".csv" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files[0])} />
          {file ? (
            <>
              <span style={{ fontSize: "2rem" }}>📄</span>
              <span className="file-name">{file.name}</span>
              <span style={{ fontSize: "0.8rem", color: "var(--green)" }}>Ready to analyze</span>
              {!isLoading && (
                <button style={{ fontSize: "0.8rem", background: "none", border: "none", color: "var(--ink-muted)", cursor: "pointer", marginTop: 4 }} onClick={(e) => { e.stopPropagation(); setFile(null); }}>
                  Change file
                </button>
              )}
            </>
          ) : (
            <>
              <span className="dropzone-icon">📁</span>
              <p className="dropzone-text"><strong>Drop your CSV here</strong> or click to browse</p>
              <p style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>Supports exports from most banks</p>
            </>
          )}
        </div>
      ) : (
        <form className="manual-form-wrap" onSubmit={handleManualSubmit}>
          <div className="form-grid">
            <div className="form-field">
              <label className="form-label">Date</label>
              <input
                type="date"
                className="form-input"
                value={manualData.date}
                onChange={e => setManualData({ ...manualData, date: e.target.value })}
                required
              />
            </div>
            <div className="form-field">
              <label className="form-label">Amount (PKR)</label>
              <input
                type="number"
                className="form-input"
                placeholder="0.00"
                value={manualData.amount}
                onChange={e => setManualData({ ...manualData, amount: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-field">
            <label className="form-label">Description / Business Name</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Fuel Purchase, Client XYZ Payment"
              value={manualData.description}
              onChange={e => setManualData({ ...manualData, description: e.target.value })}
              required
            />
          </div>

          <div className="form-grid">
            <div className="form-field">
              <label className="form-label">Type</label>
              <select
                className="form-select"
                value={manualData.direction}
                onChange={e => setManualData({ ...manualData, direction: e.target.value })}
              >
                <option value="out">Expense (Cash Out)</option>
                <option value="in">Income (Cash In)</option>
              </select>
            </div>
            <div className="form-field">
              <label className="form-label">Category</label>
              <select
                className="form-select"
                value={manualData.category}
                onChange={e => setManualData({ ...manualData, category: e.target.value })}
              >
                {manualData.direction === 'out' ? (
                  <>
                    <option value="Fuel">Fuel</option>
                    <option value="Tools">Tools / Equipment</option>
                    <option value="Subcontractor">Subcontractor</option>
                    <option value="Subscription">Subscription</option>
                    <option value="Rent">Rent / Utilities</option>
                    <option value="Other">Other Expense</option>
                  </>
                ) : (
                  <>
                    <option value="Sales">Service / Product Sales</option>
                    <option value="Investment">Investment</option>
                    <option value="Refund">Refund Received</option>
                    <option value="Other">Other Income</option>
                  </>
                )}
              </select>
            </div>
          </div>
        </form>
      )}

      {error && <div className="error-msg" style={{ marginTop: 16 }}>⚠️ {error}</div>}

      <button
        className={`btn-primary${isLoading ? " loading" : ""}`}
        onClick={mode === 'file' ? handleSubmitFile : handleManualSubmit}
        disabled={(mode === 'file' && !file) || isLoading}
        style={{ marginTop: mode === 'file' ? 0 : 8 }}
      >
        {isLoading ? (
          <>
            <span style={{ animation: "spin 1s linear infinite", display: "inline-block", marginRight: 8 }}>⟳</span>
            Processing…
          </>
        ) : mode === 'file' ? "Analyze CSV Data →" : "Add Entry to Records +"}
      </button>

      <p style={{ fontSize: "0.78rem", color: "var(--ink-muted)", textAlign: "center" }}>
        Your financial integrity is our priority. No data shared with third parties.
      </p>
    </div>
  );
}

// ChatBox
function ChatBox() {
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Hey! I know your finances inside out. Ask me anything about your business money." }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef();

  const suggestions = [
    "Where is my money going?",
    "Am I doing better than last month?",
    "What if I spend $2000 on new tools?",
    "What if I hire a part-time helper?"
  ];

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async (text) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput("");
    const newMessages = [...messages, { role: "user", text: msg }];
    setMessages(newMessages);
    setLoading(true);
    try {
      const history = newMessages.map((m) => ({ role: m.role, content: m.text }));
      const data = await api.chat(msg, history);

      if (data && (data.reply || data.message)) {
        setMessages([...newMessages, { role: "assistant", text: data.reply || data.message }]);
      } else {
        throw new Error("Empty response from advisor.");
      }
    } catch (err) {
      console.error("Advisor error:", err);
      let errorText = "I'm having trouble connecting to my brain right now. Please check if the backend server is running.";
      if (err.message.includes("429") || err.message.lower?.includes("rate limit")) {
        errorText = "I'm a bit overwhelmed with requests right now. Could you try asking again in a few seconds?";
      }
      setMessages([...newMessages, {
        role: "assistant",
        text: errorText
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-wrap">
      <h2 className="chat-title">Ask Your Co-Pilot</h2>
      <p className="chat-sub">Plain-English answers about your money.</p>

      <div className="suggestions">
        {suggestions.map((s) => (
          <button key={s} className="suggestion-chip" onClick={() => send(s)}>{s}</button>
        ))}
      </div>

      <div className="chat-messages">
        {messages.map((m, i) => (
          <div key={i} className={`chat-bubble ${m.role}`}>{m.text}</div>
        ))}
        {loading && <div className="chat-bubble assistant typing">Thinking…</div>}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-row">
        <input
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Ask about your business…"
        />
        <button className="chat-send" onClick={() => send()} disabled={!input.trim() || loading}>↑</button>
      </div>
    </div>
  );
}

// ─── DASHBOARD COMPONENTS ───────────────────────────────────────────────────

function Sidebar({ activePage, setPage, onSignOut, isDemo, user, isOpen, onClose }) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const menuItems = [
    { id: 'dashboard', label: 'Home', icon: <FiHome /> },
    { id: 'upload', label: 'Add Data', icon: <FiPlusCircle /> },
    { id: 'insights', label: 'Critical Insights', icon: <FiAlertCircle /> },
    { id: 'chat', label: 'Ask AI', icon: <LuBrainCircuit /> },
    { id: 'history', label: 'Transaction History', icon: <FiList /> },
    { id: 'settings', label: 'Settings', icon: <FiSettings /> },
  ];

  const handleNavClick = (pageId) => {
    setPage(pageId);
    if (isMobile && onClose) onClose();
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobile && isOpen && (
        <div 
          className="mobile-sidebar-overlay" 
          onClick={onClose}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            zIndex: 999,
            animation: 'fadeIn 0.3s ease'
          }}
        />
      )}

      <div className={`sidebar ${isMobile ? 'mobile' : ''} ${isOpen ? 'open' : ''}`}>
        {/* Mobile Header with Close Button */}
        {isMobile && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.08)'
          }}>
            <div className="sidebar-logo" style={{ marginBottom: 0 }}>
              <img src={logo} alt="Monetra" style={{ height: 28, filter: 'drop-shadow(0 2px 8px rgba(232,160,32,0.3))' }} />
            </div>
            <button 
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: '8px',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '1.2rem',
                cursor: 'pointer'
              }}
            >
              <FiX />
            </button>
          </div>
        )}

        {/* Desktop Logo */}
        {!isMobile && (
          <div className="sidebar-logo">
            <img src={logo} alt="Monetra" style={{ height: 32, filter: 'drop-shadow(0 2px 8px rgba(232,160,32,0.3))' }} />
          </div>
        )}

        <div className="sidebar-nav">
          {menuItems.map(item => (
            <div
              key={item.id}
              className={`sidebar-link ${activePage === item.id ? 'active' : ''}`}
              onClick={() => handleNavClick(item.id)}
            >
              <span className="sidebar-link-icon">{item.icon}</span>
              {item.label}
            </div>
          ))}
        </div>

        <div style={{ marginTop: 'auto', padding: '16px 0 0', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          {user && (
            <div style={{
              background: isDemo ? 'var(--amber)' : 'rgba(255,255,255,0.03)',
              color: isDemo ? 'var(--ink)' : 'rgba(255,255,255,0.7)',
              padding: '10px 12px',
              borderRadius: 12,
              marginBottom: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              border: isDemo ? 'none' : '1px solid rgba(255,255,255,0.05)'
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 6,
                background: isDemo ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.05)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem'
              }}>
                <FiUser style={{ opacity: isDemo ? 1 : 0.6 }} />
              </div>
              <div style={{ overflow: 'hidden', flex: 1 }}>
                <div style={{ fontSize: '0.55rem', opacity: 0.5, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>{isDemo ? 'Demo Mode' : 'Account'}</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
              </div>
            </div>
          )}
          <div
            className="sidebar-link"
            onClick={onSignOut}
            style={{ color: 'var(--red)', opacity: 0.9, marginTop: 4, padding: '8px 12px' }}
          >
            <span className="sidebar-link-icon" style={{ fontSize: '1rem' }}><FiLogOut /></span>
            <span style={{ fontSize: '0.85rem' }}>{isDemo ? 'Exit Demo' : 'Sign Out'}</span>
          </div>
        </div>
      </div>
    </>
  );
}

function DashboardLayout({ children, activePage, setPage, onSignOut, isDemo, user }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div className="dashboard-layout">
      {/* Mobile Header with Hamburger */}
      {isMobile && (
        <div className="mobile-header">
          <button 
            className="hamburger-btn"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
          <img src={logo} alt="Monetra" className="mobile-logo" />
          <div style={{ width: '40px' }} /> {/* Spacer for balance */}
        </div>
      )}

      <Sidebar 
        activePage={activePage} 
        setPage={setPage} 
        onSignOut={onSignOut} 
        isDemo={isDemo} 
        user={user}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      
      <div className="main-content">
        {children}
      </div>
    </div>
  );
}

function SettingsPage({ user, setUser, onSignOut }) {
  const [email, setEmail] = useState(user?.email || "");
  const [status, setStatus] = useState({ type: "", msg: "" });
  const [loading, setLoading] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleUpdateEmail = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: "", msg: "" });
    try {
      const res = await api.updateEmail(email);
      setUser({ ...user, email: res.email });
      setStatus({ type: "success", msg: "Email updated successfully!" });
    } catch (err) {
      setStatus({ type: "error", msg: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleClearData = async () => {
    setShowClearConfirm(false);
    setLoading(true);
    setStatus({ type: "", msg: "" });
    try {
      await api.clearData();
      setStatus({ type: "success", msg: "All data has been cleared successfully. Your dashboard is now reset." });
    } catch (err) {
      setStatus({ type: "error", msg: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard" style={{ maxWidth: 640 }}>
      <ConfirmModal
        isOpen={showClearConfirm}
        title="Permanently Clear Data?"
        message="This will permanently delete all your transactions, categories, and AI insights. This action cannot be undone."
        confirmText="Yes, Clear All Data"
        cancelText="Keep My Data"
        isDanger={true}
        onConfirm={handleClearData}
        onCancel={() => setShowClearConfirm(false)}
      />

      <div className="dash-header">
        <h1 className="dash-title">Settings</h1>
        <p className="dash-sub">Manage your account and data preferences</p>
      </div>

      <div className="health-card" style={{ marginBottom: 24 }}>
        <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '1rem' }}>
          <FiUser style={{ color: 'var(--amber)' }} /> Account Profile
        </h3>
        <form onSubmit={handleUpdateEmail}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Email Address / Username
            </label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%' }}
              required
            />
          </div>
          <button className="btn-primary" disabled={loading} style={{ width: 'auto', padding: '10px 24px', fontSize: '0.85rem' }}>
            {loading ? "Updating..." : "Update Profile"}
          </button>
        </form>
      </div>

      <div className="health-card" style={{ marginBottom: 24 }}>
        <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '1rem' }}>
          <FiShield style={{ color: 'var(--amber)' }} /> Preferences
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Theme Mode</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>Toggle between light and dark</div>
            </div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, background: 'var(--amber-light)', color: '#9A6800', padding: '4px 12px', borderRadius: 20 }}>System Default</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Base Currency</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>Primary currency for reporting</div>
            </div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, background: 'var(--border)', padding: '4px 12px', borderRadius: 20 }}>PKR</div>
          </div>
        </div>
      </div>

      <div className="health-card" style={{ marginBottom: 24, borderLeft: '4px solid var(--red)' }}>
        <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '1rem', color: 'var(--red)' }}>
          <FiTrash2 /> Danger Zone
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--ink-muted)', marginBottom: 20, lineHeight: '1.5' }}>
          The following actions are destructive and cannot be reversed. Please proceed with caution.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            onClick={() => setShowClearConfirm(true)}
            disabled={loading}
            style={{
              background: 'white',
              color: 'var(--ink)',
              border: '1.5px solid var(--border)',
              padding: '12px 20px',
              borderRadius: 12,
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.2s',
              boxShadow: 'var(--shadow)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = 'var(--red)';
              e.currentTarget.style.color = 'var(--red)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.color = 'var(--ink)';
            }}
          >
            <FiDatabase /> Clear All Financial Data
          </button>

          <button
            onClick={onSignOut}
            style={{
              background: 'var(--red)',
              color: 'white',
              border: 'none',
              padding: '12px 20px',
              borderRadius: 12,
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.2s',
              boxShadow: 'var(--shadow)'
            }}
            onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
            onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
          >
            <FiLogOut /> Sign Out from Account
          </button>
        </div>
      </div>

      {status.msg && (
        <div className={`error-msg ${status.type}`} style={{
          background: status.type === 'success' ? 'var(--green-light)' : 'var(--red-light)',
          color: status.type === 'success' ? 'var(--green)' : 'var(--red)',
          border: `1.5px solid ${status.type === 'success' ? 'var(--green)' : 'var(--red)'}`,
          marginBottom: 24,
          textAlign: 'center',
          fontWeight: 500
        }}>
          {status.msg}
        </div>
      )}
    </div>
  );
}

function InsightsPage(props) {
  return (
    <div className="page">
      <h2 className="section-title">Critical Insights</h2>
      <div className="insights-list">
        {props.loading
          ? Array(5).fill(0).map((_, i) => (
            <div key={i} style={{ background: "white", borderRadius: 10, padding: "16px 20px", border: "1px solid var(--border)" }}>
              <div className="skeleton" style={{ width: "80%" }} />
            </div>
          ))
          : props.insights.length > 0 ? props.insights.map((ins, i) => (
            <InsightCard key={i} message={ins.message} severity={ins.severity} type={ins.type} />
          )) : (
            <div className="health-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
              <p style={{ color: 'var(--ink-muted)' }}>No critical insights to show yet. Add some transactions to see AI analysis.</p>
            </div>
          )
        }
      </div>
    </div>
  );
}

function HistoryPage() {
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    api.getTransactions()
      .then(data => {
        setTxs(data || []);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch history:", err);
        setError("Could not load transaction history.");
        setLoading(false);
      });
  };

  useEffect(load, []);

  if (loading) return (
    <div className="page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <div style={{ animation: 'spin 1s linear infinite', fontSize: '2rem' }}>⟳</div>
    </div>
  );

  return (
    <div className="page">
      <div className="dash-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="dash-title">Transaction History</h1>
          <p className="dash-sub">Review every record in your account.</p>
        </div>
        <button onClick={load} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.8rem' }}>Refresh List</button>
      </div>

      {error && <div className="error-msg" style={{ marginBottom: 20 }}>{error}</div>}

      {txs.length === 0 ? (
        <div className="health-card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '3rem', marginBottom: 20 }}>📋</div>
          <h3>No transactions found</h3>
          <p style={{ color: 'var(--ink-muted)', marginTop: 8 }}>Start by uploading a CSV or adding a transaction manually.</p>
        </div>
      ) : (
        <div className="health-card" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#F9F8F6', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '16px', fontSize: '0.75rem', color: 'var(--ink-muted)' }}>DATE</th>
                <th style={{ padding: '16px', fontSize: '0.75rem', color: 'var(--ink-muted)' }}>DESCRIPTION</th>
                <th style={{ padding: '16px', fontSize: '0.75rem', color: 'var(--ink-muted)' }}>CATEGORY</th>
                <th style={{ padding: '16px', fontSize: '0.75rem', color: 'var(--ink-muted)', textAlign: 'right' }}>AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {txs.map((tx, idx) => {
                const isExpense = tx.direction === 'out';
                const cat = tx.classification ? (tx.classification.expense_type || tx.classification.revenue_stream || "General") : "Unclassified";
                return (
                  <tr key={tx.id || idx} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '16px', fontSize: '0.9rem' }}>{tx.date}</td>
                    <td style={{ padding: '16px' }}>
                      <div style={{ fontWeight: 500, fontSize: '0.92rem' }}>{tx.description}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>{tx.source === 'manual' ? 'Manual Entry' : 'CSV Import'}</div>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '0.72rem',
                        background: isExpense ? '#FEF2F2' : '#F0FDF4',
                        color: isExpense ? '#991B1B' : '#166534',
                        fontWeight: 600,
                        textTransform: 'uppercase'
                      }}>
                        {cat}
                      </span>
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right', fontWeight: 600, color: isExpense ? 'var(--red)' : 'var(--green)' }}>
                      {isExpense ? '-' : '+'} PKR {tx.amount.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── PAGES ────────────────────────────────────────────────────────────────────

function UploadPage({ onSuccess }) {
  return (
    <div className="page">
      <UploadBox onSuccess={onSuccess} />
    </div>
  );
}

function DashboardPage({
  summary,
  insights,
  health,
  topCustomers,
  topSuppliers,
  recurringExpenses,
  advisorSummary,
  summaryThis,
  summaryLast,
  summaryTotal,
  visuals,
  loading,
  onRefresh,
  user
}) {

  const isActuallyZero = (val) => val === 0 || val === "0";
  const s = (summaryThis !== null) ? summaryThis : (summary !== null ? summary : (user?.isDemo ? MOCK_SUMMARY : { cash_in: 0, cash_out: 0, net: 0, balance: 0 }));
  const st = summaryTotal || (user?.isDemo ? MOCK_SUMMARY : s);
  const sl = (summaryLast !== null) ? summaryLast : { cash_in: 0, cash_out: 0, net: 0 };

  const calcGrowth = (curr, prev) => {
    if (!prev || prev === 0) return null;
    return Math.round(((curr - prev) / Math.abs(prev)) * 100);
  };

  const growthIn = calcGrowth(s.cash_in, sl.cash_in);
  const growthOut = calcGrowth(s.cash_out, sl.cash_out);
  const growthNet = calcGrowth(s.net, sl.net);

  const h = health || { score: 85, status: "Healthy", runway_weeks: 14.5, cash_reserve: s.net };
  const advisor = advisorSummary || "• Collect outstanding invoices to boost cash flow.\n• Keep materials spending under 15% of revenue.\n• Your cash runway is healthy at 14+ weeks.";

  // Calculate dynamic color for health score
  const getHealthColor = (score) => {
    if (score >= 80) return "var(--green)";
    if (score >= 50) return "var(--amber)";
    return "var(--red)";
  };

  return (
    <div className="page">
      <div className="dashboard">
        <div className="dash-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="dash-title">Financial Intelligence</h1>
            <p className="dash-sub">Proactive insights and health metrics for your business.</p>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 20,
                padding: '7px 16px',
                fontSize: '0.82rem',
                fontWeight: 500,
                cursor: loading ? 'not-allowed' : 'pointer',
                color: 'var(--ink-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s',
                opacity: loading ? 0.6 : 1,
                flexShrink: 0,
              }}
            >
              <span style={{ display: 'inline-block', animation: loading ? 'spin 1s linear infinite' : 'none' }}>⟳</span>
              {loading ? 'Refreshing…' : 'Refresh Charts'}
            </button>
          )}
        </div>

        <SpotlightGrid>
          <div className="dash-header" style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Lifetime Overview
            </h3>
          </div>
          <div className="summary-grid" style={{ marginBottom: 24 }}>
            <SummaryCard
              label="Total Business Cash"
              value={st.net}
              type="neutral"
              tag="Cumulative net from all records"
            />
          </div>

          <div className="dash-header" style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Current Month Performance
            </h3>
          </div>
          <div className="summary-grid" style={{ marginBottom: 24 }}>
            <SummaryCard
              label="Cash In"
              value={s.cash_in || 0}
              type="up"
              tag={growthIn !== null ? `${growthIn >= 0 ? '↑' : '↓'} ${Math.abs(growthIn)}% vs last month` : "Total revenue this month"}
            />
            <SummaryCard
              label="Cash Out"
              value={s.cash_out || 0}
              type="down"
              tag={growthOut !== null ? `${growthOut >= 0 ? '↑' : '↓'} ${Math.abs(growthOut)}% vs last month` : "Total spend this month"}
            />
            <SummaryCard
              label="Monthly Net Profit"
              value={s.net || (s.cash_in - s.cash_out)}
              type={s.net >= 0 ? "up" : "down"}
              tag={growthNet !== null ? `${growthNet >= 0 ? '↑' : '↓'} ${Math.abs(growthNet)}% vs last month` : "Net take-home for February"}
            />
          </div>
        </SpotlightGrid>

        {/* 2. Survival Runway */}
        <MagicCard className="health-card" style={{ marginBottom: 24, padding: 0 }}>
          <div style={{ padding: '24px' }}>
            <div style={{ marginBottom: 16 }}>
              <div className="summary-label">Estimated Runway</div>
              <div className="summary-value" style={{ fontSize: '1.8rem' }}>
                {h.runway_weeks} <span style={{ fontSize: '0.9rem', color: 'var(--ink-muted)' }}>Weeks</span>
              </div>
            </div>
            <div className="runway-meter">
              <div className="runway-fill" style={{
                width: `${Math.min(100, (h.runway_weeks / 24) * 100)}%`,
                background: h.runway_weeks > 12 ? 'var(--green)' : h.runway_weeks > 4 ? 'var(--amber)' : 'var(--red)'
              }} />
            </div>
            <div className="runway-stats">
              <span>0w</span>
              <span>Target: 24w</span>
            </div>
          </div>
        </MagicCard>

        {/* 3. Cash Flow Pattern */}
        <div className="chart-card" style={{ marginBottom: 24 }}>
          <div className="chart-header">
            <h3 className="chart-title">Cash Flow Pattern</h3>
            <span className="chart-tag">Daily</span>
          </div>
          <TrendsChart data={visuals?.trends} />
        </div>

        {/* 4. Spend Allocation & Business Health in one row */}
        <div className="visuals-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: 24 }}>
          <MagicCard className="chart-card" style={{ padding: 0 }}>
            <div style={{ padding: '24px' }}>
              <div className="chart-header">
                <h3 className="chart-title">Spending Allocation</h3>
                <span className="chart-tag">Categorized</span>
              </div>
              <CategoryChart data={visuals?.distribution} />
            </div>
          </MagicCard>

          <MagicCard className="health-card" style={{ padding: '24px' }}>
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div className="health-score-ring" style={{ borderColor: getHealthColor(h.score) + "33", marginBottom: 16 }}>
                <div className="health-score-val" style={{ color: getHealthColor(h.score) }}>{h.score}</div>
                <div className="health-score-label">Score</div>
              </div>
              <div className="health-label">Business Status: <span style={{ color: getHealthColor(h.score) }}>{h.status}</span></div>
            </div>
          </MagicCard>
        </div>

        <MagicCard className="health-card" style={{ marginBottom: 24, borderLeft: `4px solid ${getHealthColor(h.score)}`, padding: 0 }}>
          <div style={{ padding: '24px' }}>
            <h3 className="section-title" style={{ fontSize: '1rem', marginBottom: 8, color: getHealthColor(h.score) }}>✦ AI Advisor Brief</h3>
            <div style={{ whiteSpace: 'pre-line', fontSize: '0.92rem', color: 'var(--ink)', lineHeight: '1.6', fontWeight: 400 }}>
              {advisor}
            </div>
          </div>
        </MagicCard>

        <div className="entities-grid" style={{ marginBottom: 24 }}>
          <MagicCard className="health-card" style={{ padding: 0 }}>
            <div style={{ padding: '20px' }}>
              <h3 className="section-title" style={{ fontSize: '1rem', marginBottom: 12 }}>Top Revenue Sources</h3>
              {topCustomers.length > 0 ? topCustomers.map((c, i) => (
                <div key={i} className="entity-item">
                  <span className="entity-name">{c.name}</span>
                  <div>
                    <span className="entity-amount">PKR {Math.round(c.amount).toLocaleString()}</span>
                    <span className="entity-pct">{c.percentage}%</span>
                  </div>
                </div>
              )) : (
                <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>No customer data available yet.</p>
              )}
            </div>
          </MagicCard>
          <MagicCard className="health-card" style={{ padding: 0 }}>
            <div style={{ padding: '20px' }}>
              <h3 className="section-title" style={{ fontSize: '1rem', marginBottom: 12 }}>Top Suppliers</h3>
              {topSuppliers.length > 0 ? topSuppliers.map((s, i) => (
                <div key={i} className="entity-item">
                  <span className="entity-name">{s.name}</span>
                  <div>
                    <span className="entity-amount">PKR {Math.round(s.amount).toLocaleString()}</span>
                    <span className="entity-pct">{s.percentage}%</span>
                  </div>
                </div>
              )) : (
                <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>No supplier data available yet.</p>
              )}
            </div>
          </MagicCard>
        </div>

        <MagicCard className="health-card" style={{ marginBottom: 24, padding: 0 }}>
          <div style={{ padding: '20px' }}>
            <h3 className="section-title" style={{ fontSize: '1rem', marginBottom: 12 }}>Recurring Expense Tracker</h3>
            {recurringExpenses.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {recurringExpenses.map((r, i) => (
                  <div key={i} className="entity-item">
                    <span className="entity-name">
                      {r.name}
                      <span style={{ fontSize: '0.7rem', background: 'var(--border)', padding: '2px 6px', borderRadius: '4px', marginLeft: 8, color: 'var(--ink-muted)' }}>
                        {r.frequency}
                      </span>
                    </span>
                    <span className="entity-amount">PKR {Math.round(r.amount).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>No recurring expenses detected yet.</p>
            )}
          </div>
        </MagicCard>

        {/* 8. Critical Intelligence (At Last) */}
        <h2 className="section-title" style={{ marginTop: 16 }}>Critical Insights</h2>
        <div className="insights-list">
          {loading
            ? Array(3).fill(0).map((_, i) => (
              <div key={i} style={{ background: "white", borderRadius: 10, padding: "16px 20px", border: "1.5px solid var(--border)", boxShadow: "var(--shadow)" }}>
                <div className="skeleton" style={{ width: "80%" }} />
              </div>
            ))
            : insights.map((ins, i) => (
              <InsightCard key={i} message={ins.message} severity={ins.severity} type={ins.type} />
            ))
          }
        </div>
      </div>
    </div>
  );
}

function ChatPage() {
  return (
    <div className="page">
      <ChatBox />
    </div>
  );
}

// ─── NAV ──────────────────────────────────────────────────────────────────────

function Nav({ page, setPage, uploaded, user, onSignOut }) {
  if (page === "landing") return null;
  const isDemo = user?.isDemo;
  return (
    <div className="nav" style={{ maxWidth: 720, margin: "0 auto", padding: "20px 0 16px" }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <img src={logo} alt="Monetra" style={{ height: 28 }} />
      </div>
    </div>
  );
}

function AuthPage({ onAuthSuccess, onBack, setUser, onDemoLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    /* global google */
    const handleGoogleResponse = async (response) => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.googleLogin(response.credential);
        localStorage.setItem("token", data.access_token);

        // Decode the JWT to get user info 
        let userEmail = "Google User";
        try {
          const payload = JSON.parse(atob(response.credential.split('.')[1]));
          userEmail = payload.email || "Google User";
        } catch (e) { console.warn("Failed to decode google token", e); }

        localStorage.setItem("user", JSON.stringify({ email: userEmail }));
        setUser({ email: userEmail });
        onAuthSuccess();
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (window.google) {
      google.accounts.id.initialize({
        client_id: "1035751746820-88qdnhupc7uq3l4ich1h81vne4d3vr1v.apps.googleusercontent.com",
        callback: handleGoogleResponse
      });
      google.accounts.id.renderButton(
        document.getElementById("google-button"),
        { theme: "outline", size: "large", width: "100%" }
      );
    }
  }, [onAuthSuccess]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isLogin) {
        const data = await api.login(email, password);
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("user", JSON.stringify({ email }));
        setUser({ email }); // Update state immediately
      } else {
        await api.signup(email, password);
        const data = await api.login(email, password);
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("user", JSON.stringify({ email }));
        setUser({ email }); // Update state immediately
      }
      onAuthSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <style>{`
        .auth-container {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: calc(100vh - 100px);
          padding: 20px;
        }
        .auth-card {
          display: flex;
          width: 100%;
          max-width: 900px;
          min-height: 540px;
          background: #FFF;
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.1);
          border: 1px solid var(--border);
        }
        .auth-visual {
          flex: 1;
          position: relative;
          background: #0F0E0C;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px;
          color: white;
          text-align: center;
          overflow: hidden;
        }
        .auth-visual::before {
          content: "";
          position: absolute;
          width: 300px;
          height: 300px;
          background: var(--amber);
          filter: blur(100px);
          top: -100px;
          left: -100px;
          opacity: 0.4;
          animation: float-blob 15s infinite alternate ease-in-out;
        }
        .auth-visual::after {
          content: "";
          position: absolute;
          width: 250px;
          height: 250px;
          background: #D4900E;
          filter: blur(80px);
          bottom: -80px;
          right: -50px;
          opacity: 0.3;
          animation: float-blob 12s infinite alternate-reverse ease-in-out;
        }
        @keyframes float-blob {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(40px, 30px) scale(1.2); }
        }
        .auth-visual-content {
          position: relative;
          z-index: 10;
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(10px);
          padding: 40px 30px;
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        }
        .auth-form-side {
          flex: 1;
          padding: 48px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          background: #FFF;
        }
        .auth-title {
          font-family: 'DM Serif Display', serif;
          font-size: 2rem;
          margin-bottom: 8px;
          color: var(--ink);
        }
        .auth-subtitle {
          color: var(--ink-muted);
          font-size: 0.9rem;
          margin-bottom: 32px;
        }
        .auth-row-btns {
          display: flex;
          gap: 12px;
          margin-bottom: 24px;
        }
        .auth-divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
          color: var(--ink-muted);
          font-size: 0.8rem;
        }
        .auth-divider::before, .auth-divider::after {
          content: "";
          flex: 1;
          height: 1px;
          background: var(--border);
        }
        .auth-input-group {
          margin-bottom: 16px;
        }
        .auth-input-label {
          display: block;
          font-size: 0.8rem;
          font-weight: 600;
          margin-bottom: 6px;
          color: var(--ink);
        }
        .auth-input-field {
          width: 100%;
          padding: 12px 16px;
          border-radius: 10px;
          border: 1.5px solid var(--border);
          font-family: inherit;
          font-size: 0.95rem;
          transition: all 0.2s;
          box-sizing: border-box;
        }
        .auth-input-field:focus {
          outline: none;
          border-color: var(--amber);
          box-shadow: 0 0 0 3px rgba(232, 160, 32, 0.1);
        }
        .auth-submit-btn {
          width: 100%;
          padding: 14px;
          background: var(--ink);
          color: white;
          border: none;
          border-radius: 10px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          margin-top: 8px;
        }
        .auth-submit-btn:hover {
          background: #000;
          transform: translateY(-1px);
        }
        .auth-footer-links {
          margin-top: 24px;
          text-align: center;
        }
        .auth-demo-pill {
          background: var(--amber);
          color: var(--ink);
          padding: 10px 16px;
          border-radius: 10px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
          justify-content: center;
          transition: all 0.2s;
        }
        .auth-demo-pill:hover {
          background: #d4900e;
        }
        @media (max-width: 768px) {
          .auth-visual { display: none; }
          .auth-card { max-width: 450px; }
          .auth-form-side { padding: 32px; }
        }
      `}</style>

      <div className="auth-card">
        <div className="auth-visual">
          <div className="auth-visual-content">
            <img
              src={logo}
              alt="Monetra Logo"
              style={{ height: 64, marginBottom: 24, filter: 'drop-shadow(0 4px 12px rgba(232,160,32,0.3))' }}
            />
            <h2 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '2.4rem', lineHeight: 1.2 }}>
              {isLogin ? "Welcome back!" : "Let's Get Started!"}
            </h2>
            <p style={{ opacity: 0.7, maxWidth: 260, margin: '16px auto 0', fontSize: '0.95rem' }}>
              Your AI-powered bridge to financial clarity and business growth.
            </p>
          </div>
        </div>

        <div className="auth-form-side">
          <h1 className="auth-title">{isLogin ? "Login" : "Sign Up"}</h1>
          <p className="auth-subtitle">Please enter your details to {isLogin ? "access your account" : "get started"}.</p>

          <div className="auth-row-btns">
            <div id="google-button" style={{ flex: 1.5 }}></div>
            <button className="auth-demo-pill" onClick={onDemoLogin}>
              <span>🚀</span> Try Demo
            </button>
          </div>

          <div className="auth-divider">or continue with email</div>

          <form onSubmit={handleAuth}>
            <div className="auth-input-group">
              <label className="auth-input-label">Email Address</label>
              <input
                className="auth-input-field"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="auth-input-group" style={{ marginBottom: 8 }}>
              <label className="auth-input-label">Password</label>
              <input
                className="auth-input-field"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {isLogin && (
              <div style={{ textAlign: 'right', marginBottom: 24 }}>
                <button type="button" className="nav-btn" style={{ fontSize: '0.8rem', padding: 0 }}>Forgot password?</button>
              </div>
            )}

            {error && <div className="error-msg" style={{ marginBottom: 16 }}>{error}</div>}

            <button className="auth-submit-btn" type="submit" disabled={loading}>
              {loading ? "Processing..." : (isLogin ? "Login" : "Create Account")}
            </button>
          </form>

          <div className="auth-footer-links">
            <button type="button" className="nav-btn" onClick={() => setIsLogin(!isLogin)}>
              {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Login"}
            </button>
            <div style={{ marginTop: 12 }}>
              <button type="button" className="nav-btn" style={{ opacity: 0.6 }} onClick={onBack}>← Back to landing</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────

export default function App() {
  const [page, setPage] = useState("landing");
  const [summary, setSummary] = useState(null);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  // Dashboard Stats
  const [insights, setInsights] = useState([]);
  const [health, setHealth] = useState(null);
  const [topCustomers, setTopCustomers] = useState([]);
  const [topSuppliers, setTopSuppliers] = useState([]);
  const [recurringExpenses, setRecurringExpenses] = useState([]);
  const [advisorSummary, setAdvisorSummary] = useState("");
  const [summaryThis, setSummaryThis] = useState(null);
  const [summaryLast, setSummaryLast] = useState(null);
  const [summaryTotal, setSummaryTotal] = useState(null);
  const [visuals, setVisuals] = useState({ trends: [], distribution: [] });
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  const fetchDashboardData = () => {
    setDashboardLoading(true);
    api.insights()
      .then((data) => {
        if (data && typeof data === 'object') {
          const receivedInsights = data.insights || (Array.isArray(data) ? data : null);
          if (receivedInsights && Array.isArray(receivedInsights)) {
            setInsights(receivedInsights);
          }
          if (data.health) setHealth(data.health);
          if (data.top_customers) setTopCustomers(data.top_customers);
          if (data.top_suppliers) setTopSuppliers(data.top_suppliers);
          if (data.recurring_expenses) setRecurringExpenses(data.recurring_expenses);
          if (data.advisor_summary) setAdvisorSummary(data.advisor_summary);
          if (data.summary_this) setSummaryThis(data.summary_this);
          if (data.summary_last) setSummaryLast(data.summary_last);
          if (data.summary_total) setSummaryTotal(data.summary_total);
        }
      })
      .catch((err) => console.error("Failed to fetch dashboard data:", err))
      .finally(() => setDashboardLoading(false));

    api.visuals()
      .then((data) => {
        if (data) setVisuals(data);
      })
      .catch((err) => console.error("Failed to fetch visuals:", err));
  };

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const token = localStorage.getItem("token");
    if (storedUser && token) {
      const u = JSON.parse(storedUser);
      setUser(u);
      setPage("dashboard");
      // Auto fetch data if we're resuming a session
      fetchDashboardData();
    }
    setAuthLoading(false);
  }, []);

  const handleUploadSuccess = (data) => {
    // If it's a manual entry, we don't have the summary in 'data' immediately
    if (data && data.summary) {
      setSummary(data.summary);
    }
    setPage("dashboard");

    // Immediate refresh
    fetchDashboardData();

    // Delayed refresh to catch any background processing
    setTimeout(() => {
      fetchDashboardData();
    }, 5000);
  };

  const handleDemoLogin = () => {
    // Load all demo data instantly — no backend needed
    setUser(DEMO_DATA.user);
    setIsDemo(true);
    setSummary(DEMO_DATA.summary);
    setSummaryThis(DEMO_DATA.summaryThis);
    setSummaryLast(DEMO_DATA.summaryLast);
    setHealth(DEMO_DATA.health);
    setInsights(DEMO_DATA.insights);
    setTopCustomers(DEMO_DATA.topCustomers);
    setTopSuppliers(DEMO_DATA.topSuppliers);
    setRecurringExpenses(DEMO_DATA.recurringExpenses);
    setAdvisorSummary(DEMO_DATA.advisorSummary);
    setVisuals(DEMO_DATA.visuals);
    setPage("dashboard");
  };

  const doSignOut = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setIsDemo(false);
    setPage("landing");
    setSummary(null);
    // Reset all dashboard state
    setInsights(MOCK_INSIGHTS);
    setHealth(null);
    setTopCustomers([]);
    setTopSuppliers([]);
    setRecurringExpenses([]);
    setAdvisorSummary("");
    setSummaryThis(null);
    setSummaryLast(null);
    setVisuals({ trends: [], distribution: [] });
    setShowSignOutConfirm(false);
  };

  const handleSignOut = () => setShowSignOutConfirm(true);

  if (authLoading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAF8F4' }}>
        <div className="skeleton" style={{ width: '200px', height: '4px' }}></div>
      </div>
    );
  }

  const activePage = (!user && page !== "landing" && page !== "auth") ? "landing" : page;
  const showSidebar = user && activePage !== "landing" && activePage !== "auth";

  const renderPage = () => {
    switch (activePage) {
      case "landing": return <LandingPage user={user} onStart={() => user ? setPage("dashboard") : setPage("auth")} />;
      case "auth": return <AuthPage onAuthSuccess={() => setPage("dashboard")} onBack={() => setPage("landing")} setUser={setUser} onDemoLogin={handleDemoLogin} />;
      case "upload": return <UploadPage onSuccess={handleUploadSuccess} />;
      case "dashboard": return (
        <DashboardPage
          summary={summary}
          insights={insights}
          health={health}
          topCustomers={topCustomers}
          topSuppliers={topSuppliers}
          recurringExpenses={recurringExpenses}
          advisorSummary={advisorSummary}
          summaryThis={summaryThis}
          summaryLast={summaryLast}
          summaryTotal={summaryTotal}
          visuals={visuals}
          loading={dashboardLoading}
          onRefresh={fetchDashboardData}
          user={user}
        />
      );
      case "chat": return <ChatPage />;
      case "insights": return <InsightsPage insights={insights} loading={dashboardLoading} />;
      case "history": return <HistoryPage />;
      case "settings": return <SettingsPage user={user} setUser={setUser} onSignOut={handleSignOut} />;
      default: return <LandingPage user={user} onStart={() => setPage("auth")} />;
    }
  };

  return (
    <ClickSpark
      sparkColor='var(--amber)'
      sparkSize={10}
      sparkRadius={15}
      sparkCount={8}
      duration={400}
    >
      <style>{styles.root}</style>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <ConfirmModal
        isOpen={showSignOutConfirm}
        title={isDemo ? "Exit Demo Mode?" : "Sign Out?"}
        message={isDemo ? "You are about to exit demo mode. All session progress will be cleared." : "Are you sure you want to sign out? You will need to login again to access your data."}
        confirmText={isDemo ? "Yes, Exit Demo" : "Yes, Sign Out"}
        cancelText="Stay Logged In"
        isDanger={true}
        onConfirm={doSignOut}
        onCancel={() => setShowSignOutConfirm(false)}
      />

      {!showSidebar && activePage !== "landing" && (
        <div style={{ maxWidth: "min(752px, 100%)", margin: "0 auto", padding: "0 16px", width: "100%", boxSizing: "border-box" }}>
          <Nav page={activePage} setPage={setPage} uploaded={!!summary} user={user} onSignOut={handleSignOut} />
        </div>
      )}

      {showSidebar ? (
        <DashboardLayout activePage={activePage} setPage={setPage} onSignOut={handleSignOut} isDemo={isDemo} user={user}>
          {renderPage()}
        </DashboardLayout>
      ) : (
        renderPage()
      )}
    </ClickSpark>
  );
}
