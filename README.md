# 💰 Personal Finance Tracker

A clean, light-weight, and beginner-friendly web application designed to help users log, track, and manage their daily personal expenses and income seamlessly right from their browser.

Built strictly using pure front-end web technologies (**HTML5, CSS3, Vanilla JavaScript, and Local Storage**), this project requires **no backend server, no database, and no heavy frameworks**. It serves as an ideal hands-on project for students and beginners aiming to master fundamental web development skills.

---

## 📖 Project Overview

Managing personal finances effectively requires clarity and simplicity. **Personal Finance Tracker** provides an intuitive interface for users to keep track of their earnings and expenditures in real-time.

With this application, users can:
- View their real-time financial balance, overall income, and total expenses.
- Log daily financial transactions with custom categories, dates, and amounts.
- Search, filter, and organize transactions effortlessly.
- Personalize their interface with Dark and Light mode themes.
- Store all data locally in their browser without privacy concerns or server dependencies.

---

## ✨ Features

- 📊 **Dashboard**: Displays Total Balance, Total Income, Total Expenses, and Savings rate.
- ➕ **Add Transaction**: Simple form to record new income or expense items with category and date.
- ✏️ **Edit Transaction**: Update existing transaction details on the fly.
- 🗑️ **Delete Transaction**: Remove entries with immediate real-time dashboard calculations update.
- 🔍 **Search Transactions**: Instant search bar to filter transactions by description/title.
- 🏷️ **Filter by Category**: Categorize transactions (e.g., Food, Salary, Entertainment, Utilities, Transport).
- 🔄 **Filter by Income/Expense**: Toggle views to show All, Income only, or Expenses only.
- 📅 **Filter by Date**: Filter financial records by specific date ranges or exact dates.
- 🕒 **Recent Transactions**: List view displaying recent activity with color-coded badges.
- ✅ **Form Validation**: Strict client-side validation preventing empty inputs, negative values, or invalid dates.
- 🌙 **Dark/Light Mode**: Toggle between light and sleek dark themes with user preference memory.
- 📱 **Responsive Design**: Fully responsive layout optimized for mobile, tablet, and desktop viewports.
- ✨ **Smooth Animations**: Subtle transitions for modals, toasts, hover states, and theme switching.
- 🔔 **Toast Notifications**: Non-intrusive alert popups for actions like adding, editing, or deleting items.
- ⚠️ **Confirmation Dialog**: Modal prompt asking for confirmation before permanently deleting a record.
- 💾 **Local Storage**: Data persistence using Browser `localStorage` (data survives browser refreshes).

---

## 🛠 Tech Stack

| Technology | Purpose |
| :--- | :--- |
| **HTML5** | Semantic structure and clean document layout |
| **CSS3** | Modern styling, Flexbox/Grid layouts, CSS variables, dark mode, animations |
| **Vanilla JavaScript (ES6+)** | Dynamic DOM manipulation, state management, filtering logic, and event handling |
| **Browser Local Storage** | Persistent data storage without backend services |

---

## 📂 Folder Structure

```text
Personal-Finance-Tracker/
├── index.html      ← App shell, semantic HTML, toast + modal markup
├── style.css       ← Design tokens, layouts, components, animations
├── script.js       ← State management, CRUD, filtering, UI logic
├── storage.js      ← localStorage helpers (Phase 3)
└── README.md
```

---

## ⚙ Functional Requirements

### 1. Dashboard Summary
- Dynamically calculates:
  - **Total Balance** = `Total Income` - `Total Expenses`
  - **Total Income** = Sum of all "Income" entries
  - **Total Expenses** = Sum of all "Expense" entries
  - **Savings** = Percentage of income saved

### 2. Transaction Management
- **Add**: Users enter Title, Amount, Type (Income/Expense), Category, and Date.
- **Edit**: Clicking "Edit" populates the form with existing values for quick modification.
- **Delete**: Prompts a confirmation modal before removing the transaction record.

### 3. Search & Filtering System
- Real-time text search for title/notes.
- Dropdown selector for categories (Food, Rent, Salary, Shopping, Bills, Investments, Others).
- Filter controls for transaction type (All / Income / Expense).
- Date filter to view transactions for a specific date or date range.

### 4. User Experience & Preferences
- **Theme Switcher**: Toggles between Light and Dark mode using custom CSS variables.
- **Notifications**: Trigger toast alerts (e.g., *"Transaction added successfully!"*).
- **Validation**: Displays error messages if required fields are missing or invalid.

---

## 🎨 UI Overview

The application features a clean single-page layout divided into logical sections:

1. **Header**: Application logo/title, live clock/date display, and Dark/Light mode toggle button.
2. **Dashboard Cards**: 4 summary cards showing Total Balance, Income, Expenses, and Savings.
3. **Transaction Form**: Card layout with input fields for title, amount, category, date, and type toggle.
4. **Search & Filter Section**: Bar containing search input field, category filter dropdown, type filter buttons, and date selector.
5. **Transaction List**: Clean table/card view listing transactions with color-coded tags (Green for Income, Red for Expense) along with Edit and Delete buttons.
6. **Statistics Section**: Simple visual breakdown of top expense categories and monthly summary.
7. **Footer**: Copyright information, project links, and credits.

---

## 🎨 Color Theme

### ☀️ Light Mode
| Element | Hex Code | Usage |
| :--- | :--- | :--- |
| **Primary Background** | `#F8FAFC` | Page background |
| **Card / Container** | `#FFFFFF` | Form, list, and summary card backgrounds |
| **Text Primary** | `#0F172A` | Headings and main text |
| **Text Secondary** | `#64748B` | Subtitles, labels, and muted text |
| **Income (Accent)** | `#10B981` | Positive numbers, income badges, success toasts |
| **Expense (Accent)** | `#EF4444` | Negative numbers, expense badges, warning toasts |
| **Primary Brand** | `#6366F1` | Buttons, active navigation, focus rings |

### 🌙 Dark Mode
| Element | Hex Code | Usage |
| :--- | :--- | :--- |
| **Primary Background** | `#0F172A` | Page background |
| **Card / Container** | `#1E293B` | Form, list, and summary card backgrounds |
| **Text Primary** | `#F8FAFC` | Headings and main text |
| **Text Secondary** | `#94A3B8` | Subtitles, labels, and muted text |
| **Income (Accent)** | `#34D399` | Income text and badges |
| **Expense (Accent)** | `#F87171` | Expense text and badges |
| **Primary Brand** | `#818CF8` | Buttons, active navigation, highlight focus |

---

## 📱 Responsive Design

The app is built using a mobile-first approach with flexible layouts (CSS Flexbox & Grid):

- **Desktop (>= 1024px)**: Multi-column view with side-by-side dashboard cards, form, and transaction list.
- **Tablet (768px - 1023px)**: Two-column grid adapting dashboard cards into 2x2 layout and responsive filter controls.
- **Mobile (< 768px)**: Single-column stack layout, scrollable transaction tables, full-width inputs, and accessible touch-friendly buttons.

---

## 💾 Local Storage Usage

All app state persists in `localStorage` under specific key-value pairs:

| Storage Key | Type | Description |
| :--- | :--- | :--- |
| `finance_tracker_transactions` | Array of Objects | Stores transaction records (ID, title, amount, type, category, date). |
| `finance_tracker_theme` | String | Stores user preference (`"light"` or `"dark"`). |
| `finance_tracker_settings` | Object | User settings like currency symbol (e.g., `₹`, `$`) and preferences. |

---

## 🚀 Future Enhancements

- 📊 **Charts & Graphs**: Graphical visualization of spending habits using Chart.js or SVG.
- 🎯 **Budget Planning**: Set monthly category spending limits with alert thresholds.
- 📥 **Export Data**: Download transaction history in CSV or PDF format.
- 🔁 **Recurring Transactions**: Automatically log monthly bills or scheduled income.
- 💳 **Multiple Accounts**: Manage separate accounts (Bank, Cash, Credit Card).

---

## 🎓 Learning Outcomes

Building this project provides practical hands-on practice for computer science / BCA students in:

1. **DOM Manipulation**: Creating, updating, reading, and deleting HTML elements programmatically.
2. **State Management**: Handling application state (transactions array) and re-rendering UI upon state updates.
3. **Array Methods**: Heavy usage of JavaScript ES6+ methods (`map`, `filter`, `reduce`, `find`, `sort`).
4. **Data Persistence**: Storing and parsing JSON objects with `localStorage.getItem` and `setItem`.
5. **Modern CSS Layouts**: Mastering Flexbox, CSS Grid, CSS Variables, and Media Queries.
6. **Form Handling & Validation**: Custom input validation, event listeners, and user feedback mechanisms.

---

## ⚡ Installation & Setup

No installation or command-line dependencies are needed!

### Steps to Run Locally:

1. **Clone or Download the Repository**:
   ```bash
   git clone https://github.com/your-username/Personal-Finance-Tracker.git
   ```
2. **Navigate into the Project Folder**:
   ```bash
   cd Personal-Finance-Tracker
   ```
3. **Open with Live Server**:
   - Open VS Code.
   - Install the **Live Server** extension (if not already installed).
   - Right-click `index.html` and select **"Open with Live Server"**.
4. **Or Open Directly**:
   - Double-click `index.html` to open it in any web browser (Chrome, Firefox, Edge, Safari).

---

## 🏗️ Development Phases

The project is structured into **exactly 4 development phases**:

### Phase 1 – Project Setup & User Interface ✅ COMPLETE
- **Objective**: Establish project folder structure and construct the core responsive UI layout.
- **Features Implemented**:
  - HTML structure for Header, Dashboard cards, Transaction Form, Filter bar, and Transaction List.
  - Base CSS styling, reset styles, typography, dynamic layouts (Flexbox/Grid), and responsive design.
- **Files Modified**: `index.html`, `style.css`
- **Output**: A fully responsive, visually polished page with all structural elements and components.

---

### Phase 2 – Transaction Management ✅ COMPLETE
- **Objective**: Implement JavaScript logic to handle data processing, calculations, and search/filtering.
- **Features Implemented**:
  - Add / Edit / Delete transactions with type, amount, category, and date.
  - Client-side form validation with inline error messages.
  - Dynamic live search and multi-dimensional filtering (category, type, date range).
  - Dashboard auto-recalculation, monthly stats, spending insights, health score, pagination.
- **Files Modified**: `script.js`
- **Output**: Fully functional dynamic app with CRUD, search, and statistics.

---

### Phase 3 – Local Storage & Personalization ✅ COMPLETE
- **Objective**: Add data persistence, dark/light theme switcher, toast alerts, and modal dialogs.
- **Features Implemented**:
  - `storage.js` module with safe `localStorage` read/write wrappers (handles private browsing / quota errors).
  - All transaction mutations (add, edit, delete) are persisted immediately.
  - Dark/Light mode toggle uses CSS custom properties and saves preference to `localStorage`.
  - Custom toast notification system with slide-in/out animations and auto-dismiss.
  - Confirmation modal dialog with animated entrance before every deletion.
- **Files Modified**: `storage.js` (new), `script.js`, `style.css`
- **Output**: App data and theme survive browser refreshes. Toast and modal feedback on all actions.

---

### Phase 4 – Final Polish & Optimization ✅ COMPLETE
- **Objective**: Refine UI animations, verify accessibility, optimize performance, and complete documentation.
- **Features Implemented**:
  - Staggered entrance animations for dashboard cards and transaction rows (`@keyframes fadeSlideUp`, `cardRiseIn`).
  - Animated modal entrance (`modalScaleIn`) and toast slide-in/out (`toastSlideIn / toastSlideOut`).
  - Savings bar fill animated smoothly via CSS transition.
  - **Accessibility**: Skip-to-content link, global `:focus-visible` ring, modal focus trap (Tab/Shift+Tab cycle), Escape closes modal, cancel button auto-focused on modal open.
  - **Cross-browser**: Custom scrollbar styling (WebKit + Firefox `scrollbar-width`), `-webkit-backdrop-filter`, `will-change` hints.
  - `@media (prefers-reduced-motion: reduce)` disables all decorative animations for users who need it.
  - Code comments updated; all Phase stubs replaced with production implementations.
- **Files Modified**: `style.css`, `script.js`, `index.html`, `README.md`
- **Output**: Production-ready app with smooth animations, full keyboard accessibility, zero console errors, and GitHub-ready documentation.
