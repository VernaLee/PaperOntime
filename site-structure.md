# 🌐 PaperOntime – Site Structure & Logic Overview

This document outlines the structure of the PaperOntime website and the functionality of each key page. It also summarizes how the custom code interacts across the site.

---

## 🔹 1. Home (`/`)
- **Purpose**: Landing page with branding, brief introduction, and call-to-action.
- **Features**:
  - "Get Started" button direct to Order Form section
  - Links to About us, Samples, Track my order, FAQ, Blog

---

## 🔹 2. Order (`/order`)
- **Purpose**: Main page for clients to submit academic help requests.
- **Custom Code**:
  - Multi-step form using Velo
  - Conditional logic based on academic level, type of work
  - Estimated pricing logic (client-side)
  - Submission triggers backend functions to store data and trigger emails

---

## 🔹 3. Payment Integration (Stripe)
- **Location**: Integrated within the Order Page
- **Functionality**:
  - Stripe payment triggered after form submission
  - Backend function handles token generation and secure processing

---

## 🔹 5. Track My Order Page
- **Purpose**: Allows users to view the real-time status of their order and make limited changes (e.g., update details or upload supporting files) within a 3-hour window after placing the order.
- **Features**:
  - Displays current order status (e.g., Received, In Progress, Completed)
  - Allows limited updates to order details within the 3-hour post-submission window
  - Supports file uploads for additional instructions or materials
  - Read-only mode after the editing window closes

---

## 🔹 5. Dashboard (Admin Only)
- **Purpose**: Manage incoming orders (Wix Members + Wix Data)
- **Features**:
  - View new submissions
  - Change status (e.g., in progress, completed)
  - Basic filtering

---

## 🔹 5. Additional Pages
| Page                     | Purpose                                                                       |
|--------------------------|-------------------------------------------------------------------------------|
| `/about us`              | Introduces the team of writers and highlights their expertise                 |
| `/samples `              | Showcases examples of previous academic work to build trust and credibility   |
| `/faq`                   | Answers to common questions                                                   |
| `/blog    `              | Offers writing tips and insights; also supports SEO and content marketing     |
| `/privacy policy`        | Outlines how user data is collected, stored, and protected                    |
| `/terms and conditions`  | Details the terms and conditions governing the use of the website             |

---

## 🔧 Wix Collections (Databases)

| Collection Name     | Purpose                          |
|---------------------|----------------------------------|
| `Orders`            | Stores all order form submissions |
| `Contact`           | Store user email after mailing list form submission |

---

## 🔁 Flow Summary

1. User lands on homepage and clicks **Get Help Now**
2. Redirected to **Order**
3. Completes form → Triggers backend logic
4. Payment via **Stripe**
5. Order data stored in Wix Collection
6. User uses **Track my Order** to view status and update the order 
7. Admin views order in dashboard

---

## 🧠 Notes

- Site is responsive and optimized for desktop/mobile.
- Custom code is located in `/public/` and `/backend/` folders (see repo).

