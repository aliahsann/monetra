import { useState, useEffect, useRef, useLayoutEffect, useMemo, useCallback, memo, createElement } from "react";
import logo from "./monetra logo 2.png";
import { gsap } from "gsap";
import { GoArrowUpRight } from "react-icons/go";
import { motion } from "framer-motion";
import { SiReact, SiGooglecloud, SiTailwindcss, SiVite, SiPython, SiFastapi } from "react-icons/si";

// ─── API ───────────────────────────────────────────────────────────────────────
const BASE = "http://localhost:8000";

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
    }).then((r) => r.json());
  },
};

// ─── MOCK DATA (used if API unreachable) ──────────────────────────────────────
const MOCK_SUMMARY = { cash_in: 165000, cash_out: 59800, net: 105200 };
const MOCK_INSIGHTS = [
  { message: "You brought in $165,000 this month — strongest month on record.", severity: "positive" },
  { message: "Materials spending is up 15%. Consider buying in bulk to save.", severity: "medium" },
  { message: "You have $12,400 in outstanding invoices from 4 clients.", severity: "high" },
  { message: "Marketing ROI improved by 20% compared to last quarter.", severity: "positive" },
  { message: "Fuel costs are stabilizing after last month's spike.", severity: "low" },
];

const MOCK_CHAT_RESPONSES = {
  "where is my money going?": "Most of your money this month went to Materials ($24,500) and Labor ($18,200). You also had a significant spike in Fuel costs early in the month.",
  "am i doing better than last month?": "Yes! Your net profit is up 12% compared to last month, mainly due to the large Khan Builders contract completion.",
  "any risks i should know about?": "The main risk is your outstanding invoices. You have $12,400 unpaid, which could impact your cash flow next month if not collected soon.",
  "default": "I'm analyzing your finances now. Based on your data, you're having a strong month with $105,200 in net change. Is there a specific category you'd like to dive into?"
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
      --border: #EDE9E1;
      --shadow: 0 2px 12px rgba(26,24,20,0.07);
      --shadow-lg: 0 8px 32px rgba(26,24,20,0.10);
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
      grid-template-columns: repeat(3, 1fr); 
      gap: 12px; 
      margin-bottom: 24px;
      width: 100%;
    }
    @media (max-width: 1024px) {
      .summary-grid {
        grid-template-columns: repeat(2, 1fr);
      }
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
      border: 1px solid var(--border);
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
      border: 1px solid var(--border);
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
      color: var(--ink);
    }
    .focus-word.active { filter: blur(0); }
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

// LandingNav
const LandingNav = ({ onStart }) => (
  <nav className="landing-nav">
    <img src={logo} alt="Monetra Logo" className="nav-logo-img" style={{ height: '32px', cursor: 'pointer' }} />
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

          <div className="features-grid">
            {[
              { icon: '📊', icon2: '📈', title: 'Real-Time Dashboard', desc: 'Monitor revenue, expenses, and cashflow at a glance with beautiful visualizations.', badge: 'Live Data', badgeColor: '#E8A020', bg: 'linear-gradient(135deg, #FFF8E8 0%, #FFF3D0 50%, #FEF0C0 100%)' },
              { icon: '📓', icon2: '🔍', title: 'Smart Transactions', desc: 'Auto-categorize and organize transactions. Search, filter, and analyze effortlessly.', badge: 'AI Sorted', badgeColor: '#2D9E6B', bg: 'linear-gradient(135deg, #EDFAF4 0%, #D6F4E8 50%, #C5EFE0 100%)' },
              { icon: '💡', icon2: '⚡', title: 'AI Insights', desc: 'Intelligent recommendations and alerts. Detect anomalies and make data-driven decisions.', badge: 'Gemini AI', badgeColor: '#3B74D4', bg: 'linear-gradient(135deg, #EBF1FB 0%, #D6E5F8 50%, #C5D9F5 100%)' },
              { icon: '💬', icon2: '🤖', title: 'AI Assistant', desc: 'Chat with your financial data. Ask questions in plain language and get instant answers.', badge: 'Always On', badgeColor: '#E8A020', bg: 'linear-gradient(135deg, #FFF5EC 0%, #FFE8D0 50%, #FFDCC0 100%)' },
              { icon: '⚡', icon2: '🔔', title: 'Smart Alerts', desc: 'Never miss important financial events. Get notified about unusual expenses or opportunities.', badge: 'Real-time', badgeColor: '#D94F3A', bg: 'linear-gradient(135deg, #FEF0EE 0%, #FDE0DB 50%, #FDD0C9 100%)' },
              { icon: '📱', icon2: '🌐', title: 'Mobile Ready', desc: 'Access your financial data anywhere. Fully responsive design works on all devices.', badge: 'Any Device', badgeColor: '#7B5EA7', bg: 'linear-gradient(135deg, #F3EFFE 0%, #E8E0FC 50%, #DDD0FA 100%)' },
            ].map(({ icon, icon2, title, desc, badge, badgeColor, bg }) => (
              <div key={title} className="feat-card" style={{ background: bg }}>
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
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Benefits ── */}
      <section id="benefits" className="landing-section" style={{ background: 'var(--surface)' }}>
        <div className="landing-section-content">
          <div className="benefits-split">
            <div>
              <div className="section-tag">Benefits</div>
              <h2 className="section-h2">Why Choose AI Financial Co-Pilot?</h2>
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
                  <div className="mock-stat-value up">$165k</div>
                </div>
                <div className="mock-stat">
                  <div className="mock-stat-label">Cash Out</div>
                  <div className="mock-stat-value down">$59k</div>
                </div>
              </div>
              <div className="mock-bar-section">
                <div className="mock-bar-label"><span className="mock-bar-name">Materials</span><span className="mock-bar-val">$24.5k</span></div>
                <div className="mock-bar-track"><div className="mock-bar-fill" style={{ width: '72%', background: 'var(--amber)' }} /></div>
              </div>
              <div className="mock-bar-section">
                <div className="mock-bar-label"><span className="mock-bar-name">Labor</span><span className="mock-bar-val">$18.2k</span></div>
                <div className="mock-bar-track"><div className="mock-bar-fill" style={{ width: '55%', background: '#4B9EE8' }} /></div>
              </div>
              <div className="mock-bar-section">
                <div className="mock-bar-label"><span className="mock-bar-name">Marketing</span><span className="mock-bar-val">$9.1k</span></div>
                <div className="mock-bar-track"><div className="mock-bar-fill" style={{ width: '28%', background: 'var(--green)' }} /></div>
              </div>
              <div className="mock-ai-chip">
                <div className="mock-ai-dot" />
                <span className="mock-ai-text">AI detected a 15% spike in material costs. Consider bulk purchasing to save ~$3.2k.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <div id="stats" style={{ padding: '0 clamp(20px, 4vw, 40px)' }}>
        <div className="stats-bar">
          <div className="stat-item"><div className="stat-val">10k+</div><div className="stat-lbl">Businesses Trust Us</div></div>
          <div className="stat-item"><div className="stat-val">$2.5B+</div><div className="stat-lbl">Transactions Tracked</div></div>
          <div className="stat-item"><div className="stat-val">98%</div><div className="stat-lbl">Customer Satisfaction</div></div>
          <div className="stat-item"><div className="stat-val">24/7</div><div className="stat-lbl">AI Support Available</div></div>
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
            <img src={logo} alt="Monetra Logo" className="footer-logo-img" style={{ height: '40px', marginBottom: '16px' }} />
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
          <span>© 2026 AI Financial Co-Pilot. All rights reserved.</span>
          <span>Built with ♥ for micro-businesses</span>
        </div>
      </div>
    </div>
  );
}



// SummaryCard
function SummaryCard({ label, value, type, tag }) {
  const fmt = (v) => "$" + Math.abs(v).toLocaleString();
  return (
    <div className="summary-card">
      <div className="summary-label">{label}</div>
      <div className={`summary-value ${type}`}>{fmt(value)}</div>
      {tag && <div className="summary-tag">{tag}</div>}
    </div>
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

// UploadBox
function UploadBox({ onSuccess }) {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("idle"); // idle, uploading, analyzing
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  const handleFile = (f) => {
    if (f && f.name.endsWith(".csv")) { setFile(f); setError(""); }
    else setError("Please upload a CSV file.");
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setStatus("uploading"); setError("");
    try {
      // Step 1: Upload the file
      const data = await api.upload(file);

      // Step 2: Move to dashboard immediately
      // We trigger classification in the background so the user isn't stuck
      api.classify(100).catch(err => console.warn("Background analysis started/failed:", err));

      onSuccess(data || { summary: MOCK_SUMMARY });
    } catch (err) {
      console.error("Upload failed:", err);
      setError("Upload failed. Please check your connection and try again.");
    } finally {
      setStatus("idle");
    }
  };

  const isLoading = status !== "idle";

  return (
    <div className="upload-hero">
      <div>
        <div className="upload-badge">✦ AI Financial Co-Pilot</div>
      </div>
      <div>
        <h1 className="upload-title">Understand Your<br /><em>Business Finances</em></h1>
        <p className="upload-sub" style={{ marginTop: 12 }}>
          Upload your bank transactions. We'll handle the rest — no jargon, just clarity.
        </p>
      </div>

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

      {error && <div className="error-msg">⚠️ {error}</div>}

      <button
        className={`btn-primary${isLoading ? " loading" : ""}`}
        onClick={handleSubmit}
        disabled={!file || isLoading}
      >
        {status === "uploading" ? (
          <>
            <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span>
            Uploading transactions…
          </>
        ) : status === "analyzing" ? (
          <>
            <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span>
            AI analyzing data…
          </>
        ) : "Analyze My Business →"}
      </button>

      <p style={{ fontSize: "0.78rem", color: "var(--ink-muted)", textAlign: "center" }}>
        Your data stays private. We don't store your transactions.
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
      const response = await fetch(`${BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, history }),
      });

      const data = await response.json();

      if (response.ok && (data.reply || data.message)) {
        setMessages([...newMessages, { role: "assistant", text: data.reply || data.message }]);
      } else {
        // If backend returned a structured fallback (e.g. during rate limit), it might still be in data.reply
        if (data.reply) {
          setMessages([...newMessages, { role: "assistant", text: data.reply }]);
        } else {
          throw new Error(data.detail || "Empty response from advisor.");
        }
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

// ─── PAGES ────────────────────────────────────────────────────────────────────

function UploadPage({ onSuccess }) {
  return (
    <div className="page">
      <UploadBox onSuccess={onSuccess} />
    </div>
  );
}

function DashboardPage({ summary }) {
  const [insights, setInsights] = useState(MOCK_INSIGHTS);
  const [health, setHealth] = useState(null);
  const [topCustomers, setTopCustomers] = useState([]);
  const [topSuppliers, setTopSuppliers] = useState([]);
  const [recurringExpenses, setRecurringExpenses] = useState([]);
  const [advisorSummary, setAdvisorSummary] = useState("");
  const [summaryThis, setSummaryThis] = useState(null);
  const [summaryLast, setSummaryLast] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.insights()
      .then((data) => {
        console.log("Dashboard insights data:", data);
        if (data && typeof data === 'object') {
          const receivedInsights = data.insights || (Array.isArray(data) ? data : null);
          if (receivedInsights && Array.isArray(receivedInsights) && receivedInsights.length > 0) {
            setInsights(receivedInsights);
          }
          if (data.health) setHealth(data.health);
          if (data.top_customers) setTopCustomers(data.top_customers);
          if (data.top_suppliers) setTopSuppliers(data.top_suppliers);
          if (data.recurring_expenses) setRecurringExpenses(data.recurring_expenses);
          if (data.advisor_summary) setAdvisorSummary(data.advisor_summary);
          if (data.summary_this) setSummaryThis(data.summary_this);
          if (data.summary_last) setSummaryLast(data.summary_last);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch insights:", err);
      })
      .finally(() => setLoading(false));
  }, []);

  const s = summaryThis || summary || MOCK_SUMMARY;
  const sl = summaryLast || { cash_in: s.cash_in * 0.9, cash_out: s.cash_out * 0.95, net: s.net * 0.8 };

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
        <div className="dash-header">
          <h1 className="dash-title">Financial Intelligence</h1>
          <p className="dash-sub">Proactive insights and health metrics for your business.</p>
        </div>

        <div className="health-grid">
          <div className="health-card">
            <div className="health-score-ring" style={{ borderColor: getHealthColor(h.score) + "33" }}>
              <div className="health-score-val" style={{ color: getHealthColor(h.score) }}>{h.score}</div>
              <div className="health-score-label">Score</div>
            </div>
            <div className="health-label">Business Status: <span style={{ color: getHealthColor(h.score) }}>{h.status}</span></div>
          </div>
          <div className="health-card">
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
        </div>

        <div className="health-card" style={{ marginBottom: 24, borderLeft: `4px solid ${getHealthColor(h.score)}` }}>
          <h3 className="section-title" style={{ fontSize: '1rem', marginBottom: 8, color: getHealthColor(h.score) }}>✦ AI Advisor Brief</h3>
          <div style={{ whiteSpace: 'pre-line', fontSize: '0.92rem', color: 'var(--ink)', lineHeight: '1.6', fontWeight: 400 }}>
            {advisor}
          </div>
        </div>

        <div className="summary-grid">
          <SummaryCard
            label="Cash In"
            value={s.cash_in || 0}
            type="up"
            tag={growthIn !== null ? `${growthIn >= 0 ? '↑' : '↓'} ${Math.abs(growthIn)}% vs last month` : "Payments received"}
          />
          <SummaryCard
            label="Cash Out"
            value={s.cash_out || 0}
            type="down"
            tag={growthOut !== null ? `${growthOut >= 0 ? '↑' : '↓'} ${Math.abs(growthOut)}% vs last month` : "Money spent"}
          />
          <SummaryCard
            label="Net Change"
            value={s.net || (s.cash_in - s.cash_out)}
            type={s.net >= 0 ? "up" : "down"}
            tag={growthNet !== null ? `${growthNet >= 0 ? '↑' : '↓'} ${Math.abs(growthNet)}% vs last month` : "Your take-home"}
          />
        </div>

        <h2 className="section-title">Critical Insights</h2>
        <div className="insights-list">
          {loading
            ? Array(3).fill(0).map((_, i) => (
              <div key={i} style={{ background: "white", borderRadius: 10, padding: "16px 20px", border: "1px solid var(--border)" }}>
                <div className="skeleton" style={{ width: "80%" }} />
              </div>
            ))
            : insights.map((ins, i) => (
              <InsightCard key={i} message={ins.message} severity={ins.severity} type={ins.type} />
            ))
          }
        </div>

        <div className="entities-grid">
          <div className="health-card">
            <h3 className="section-title" style={{ fontSize: '1rem', marginBottom: 12 }}>Top Revenue Sources</h3>
            {topCustomers.length > 0 ? topCustomers.map((c, i) => (
              <div key={i} className="entity-item">
                <span className="entity-name">{c.name}</span>
                <div>
                  <span className="entity-amount">${Math.round(c.amount).toLocaleString()}</span>
                  <span className="entity-pct">{c.percentage}%</span>
                </div>
              </div>
            )) : (
              <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>No customer data available yet.</p>
            )}
          </div>
          <div className="health-card">
            <h3 className="section-title" style={{ fontSize: '1rem', marginBottom: 12 }}>Top Suppliers</h3>
            {topSuppliers.length > 0 ? topSuppliers.map((s, i) => (
              <div key={i} className="entity-item">
                <span className="entity-name">{s.name}</span>
                <div>
                  <span className="entity-amount">${Math.round(s.amount).toLocaleString()}</span>
                  <span className="entity-pct">{s.percentage}%</span>
                </div>
              </div>
            )) : (
              <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>No supplier data available yet.</p>
            )}
          </div>
        </div>

        <div className="health-card" style={{ marginTop: 24 }}>
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
                  <span className="entity-amount">${Math.round(r.amount).toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>No recurring expenses detected yet.</p>
          )}
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
  return (
    <div className="nav" style={{ maxWidth: 720, margin: "0 auto", padding: "20px 0 16px" }}>
      <span className="nav-logo">Co<span>Pilot</span></span>
      <div className="nav-links">
        {uploaded && (
          <>
            <button className={`nav-btn${page === "dashboard" ? " active" : ""}`} onClick={() => setPage("dashboard")}>Overview</button>
            <button className={`nav-btn${page === "chat" ? " active" : ""}`} onClick={() => setPage("chat")}>Ask</button>
            <button className="nav-btn" onClick={() => setPage("upload")}>+ New</button>
          </>
        )}
        {user && <button className="nav-btn" onClick={onSignOut}>Sign Out</button>}
      </div>
    </div>
  );
}

function AuthPage({ onAuthSuccess, onBack, setUser }) {
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
        
        // Decode the JWT to get user info if possible, or just set a placeholder
        // For now, let's just set a generic Google User until we can fetch profile
        localStorage.setItem("user", JSON.stringify({ email: "Google User" })); 
        setUser({ email: "Google User" }); // Update state immediately
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
    <div className="upload-hero" style={{ textAlign: 'center' }}>
      <div className="upload-badge">Secure Access</div>
      <h1 className="upload-title">{isLogin ? "Welcome Back" : "Create Account"}</h1>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>
        <div id="google-button"></div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '10px 0' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
          <span style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>or</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
        </div>

        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input 
            className="chat-input" 
            type="email" 
            placeholder="Email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required 
          />
          <input 
            className="chat-input" 
            type="password" 
            placeholder="Password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required 
          />
          {error && <div className="error-msg">{error}</div>}
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? "Processing..." : (isLogin ? "Sign In" : "Sign Up")}
          </button>
          <button type="button" className="nav-btn" onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? "Need an account? Sign Up" : "Have an account? Sign In"}
          </button>
          <button type="button" className="nav-btn" onClick={onBack}>← Back</button>
        </form>
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

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const token = localStorage.getItem("token");
    if (storedUser && token) {
      setUser(JSON.parse(storedUser));
    }
    setAuthLoading(false);
  }, []);

  const handleUploadSuccess = (data) => {
    const s = data && typeof data === "object" && data.summary && typeof data.summary === "object" ? data.summary : null;
    setSummary(s || MOCK_SUMMARY);
    setPage("dashboard");
  };

  const handleSignOut = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setPage("landing");
    setSummary(null);
  };

  if (authLoading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAF8F4' }}>
        <div className="skeleton" style={{ width: '200px', height: '4px' }}></div>
      </div>
    );
  }

  const activePage = !user && (page !== "landing" && page !== "auth") ? "landing" : page;

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
      <div style={{ maxWidth: "min(752px, 100%)", margin: "0 auto", padding: "0 16px", width: "100%", boxSizing: "border-box", overflowX: "hidden" }}>
        <Nav page={activePage} setPage={setPage} uploaded={!!summary} user={user} onSignOut={handleSignOut} />
      </div>
      {activePage === "landing" && <LandingPage user={user} onStart={() => user ? setPage("upload") : setPage("auth")} />}
      {activePage === "auth" && <AuthPage onAuthSuccess={() => setPage("upload")} onBack={() => setPage("landing")} setUser={setUser} />}
      {activePage === "upload" && <UploadPage onSuccess={handleUploadSuccess} />}
      {activePage === "dashboard" && <DashboardPage summary={summary} />}
      {activePage === "chat" && <ChatPage />}
    </ClickSpark>
  );
}
