# Arwright — Writing Process Platform

**A writing platform designed to help schools use AI without losing student thinking.**

![Arwright Banner](https://via.placeholder.com/800x200?text=Arwright+Writing+Process+Platform)  
*(Replace with a real screenshot when ready)*

---

## ✨ What is Arwright?

Arwright is an educational writing platform that helps students develop strong academic writing skills while giving educators visibility into the writing process.

It is built for schools navigating the impact of AI on writing instruction.

Instead of focusing only on final output, Arwright emphasizes:
- student thinking
- drafting behavior
- revision processes
- responsible AI use

---

## 🧠 How Arwright Is Different

Most AI writing tools focus on improving output.

**Arwright focuses on preserving the writing process.**

Instead of generating or rewriting student work, Arwright is designed to:
- Support students while they are actively writing
- Provide guidance without replacing student thinking
- Make writing processes visible to educators
- Enable responsible use of AI in academic settings

Arwright does **not**:
- generate essays for students  
- rewrite submissions  
- provide automated judgments of misconduct  

**Goal:** Help students become better writers — not complete writing for them.

---

## 🧭 Design Principles

Arwright is built around a small set of core principles:

- Students must do the thinking  
- AI supports, but does not replace writing  
- Guidance appears during moments of struggle, not just after submission  
- All insights are advisory — never punitive or deterministic  
- The writing process matters more than the final output  

These principles guide all product decisions.

---

## 🎯 Key Features

### ✍️ For Students
- Modern writing editor with process-aware support
- Real-time nudges when writing stalls (non-intrusive guidance)
- Draft and revision workflows
- Submission system with version history

---

### 👩🏫 For Teachers
- Class and cohort dashboards
- Visibility into student writing processes
- Writing Process Integrity Review (advisory, not automated judgment)
- Structured feedback tools

---

### 🏫 For Administrators
- School-level oversight
- Teacher and cohort management
- Secure onboarding via invite system
- Role-based access control

---

### ⚙️ Core Capabilities
- Writing Process Visibility
- Real-time, context-aware support (nudges)
- Post-submission review and reinforcement
- Secure multi-tenant architecture
- FERPA-aligned data handling

---

## 🧠 Real-Time Writing Support (Nudge System)

Arwright includes a real-time support system designed to assist students during the writing process.

The system:
- detects moments of writing friction (e.g., hesitation, repeated starts)
- provides gentle, non-intrusive guidance
- helps students continue without interrupting flow

### Design Constraints:
- triggers only in high-confidence "stuck" scenarios  
- shows at most one nudge per session  
- never interrupts typing or steals focus  
- never generates writing for the student  

**Purpose:** Support thinking without replacing it.

---

## 📊 Writing Process & Audit Model

Arwright captures structured signals to:
- understand how writing develops
- improve system behavior over time
- support teacher interpretation

Audit logging focuses on:
- when guidance is triggered
- why it was triggered
- what happened afterward

This enables continuous improvement without relying on intrusive monitoring.

---

## 📋 Who Is It For?

- Middle and high schools  
- English / Language Arts programs  
- Writing-intensive subjects (history, science, etc.)  
- Schools seeking responsible AI integration  

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js (v18+ recommended)
- Google Gemini API key

---

### Setup

Clone the repository:

```bash
git clone https://github.com/Watch1Do1/Arwright-Pilot.git
cd Arwright-Pilot
```

Install dependencies:
```bash
npm install
```

Create a `.env` file:
```env
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

Run development server:
```bash
npm run dev
```

---

## 🧰 Tech Stack

- **Frontend:** React + TypeScript + Vite
- **Styling:** Tailwind CSS
- **Backend:** Firebase (Auth + Firestore)
- **AI:** Google Gemini (API-assisted features only)
- **Animations:** Framer Motion
- **Icons:** Lucide React

---

## 🔐 Security & Compliance

- Role-based access control across all users
- Firestore security rules enforce data isolation
- API keys are never committed
- Designed for FERPA-aligned usage
- No automated disciplinary decisions

---

## 📄 Documentation

- FERPA Compliance Statement (add: `FERPA.md`)
- Privacy Policy (recommended)
- Teacher Guide (coming soon)
- Student Guide (coming soon)

---

## 🧪 Pilot Status

Arwright is currently in pilot phase.
The platform is being actively refined for real classroom environments, with a focus on:
- usability
- instructional value
- responsible AI integration

If your school is interested in piloting Arwright, please reach out.

---

## 📸 Screenshots

*(Add real screenshots when ready)*

- Student Writing View
- Teacher Dashboard
- Writing Review Interface
- School Admin Console

---

## 🤝 Contributing

This project is under active development.
Contributions are welcome:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request

---

## 📬 Contact

For pilot inquiries or questions:
- Arwright, LLC (Wyoming)
- hello@arwrightlearning.com

---

## ✅ Summary

Arwright is not just an AI writing tool.
It is a system designed to:
- preserve writing as a process
- support students during thinking
- give teachers visibility into learning
- help schools use AI responsibly

**Writing is thinking. Arwright helps keep it that way.**
