<div align="center">
  <img src="https://img.shields.io/badge/SafeHer_Route-Security_First-7C3AED?style=for-the-badge&logo=shield" alt="SafeHer Route Logo">
  <h1>🛡️ SafeHer Route</h1>
  <p><strong>AI-Powered Safety Navigation App for Safer Travel</strong></p>
  
  <a href="https://safeher-web-b9058.web.app"><strong>Live Demo</strong></a> · 
  <a href="#features"><strong>Explore Features</strong></a> · 
  <a href="#tech-stack"><strong>Tech Stack</strong></a>
  <br><br>

  [![Firebase](https://img.shields.io/badge/Firebase-Deployed-FFCA28?style=flat-square&logo=firebase&logoColor=black)](https://safeher-web-b9058.web.app)
  [![License](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
  [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)
</div>

<hr>

## 🚀 Overview

**SafeHer Route** is a modern, production-ready navigation application designed specifically with safety in mind. While traditional navigation apps prioritize the *fastest* route, SafeHer prioritizes the *safest* route by analyzing real-time crowd density, street lighting, historical risk zones, and community reports.

This repository contains the complete, secure codebase featuring full user authentication, server-side data validation, and native SOS bypassing for Android.

## ✨ Key Features

*   **🗺️ AI Risk Routing:** Calculates safety scores based on dynamic environmental factors (time of day, lighting, crowd density).
*   **🚨 Native SOS Bypass:** Instantly triggers an emergency call bypassing the Android dialer (using Capacitor).
*   **🔒 Production-Grade Security:**
    *   **Dual Authentication:** Secure login via Email/Password or SMS Phone OTP with invisible reCAPTCHA.
    *   **Firestore Rules:** Strict backend data isolation—users can only access their own encrypted trip data.
    *   **Soft Deletes:** Preserves data integrity with `deletedAt` timestamps instead of hard deletions.
*   **👩‍⚖️ GDPR Compliant:** Built-in "Right to Erasure" allowing users to permanently wipe their data.
*   **🛠️ Admin Dashboard:** A hidden management portal for system monitoring.

## 📱 Screenshots

> *(Add screenshots of your UI here later by replacing these placeholder links!)*

| Auth & Security | Live Navigation | Safety Dashboard |
|:---:|:---:|:---:|
| <img src="https://via.placeholder.com/250x500.png?text=Secure+Auth" alt="Auth"> | <img src="https://via.placeholder.com/250x500.png?text=Risk+Routing" alt="Map"> | <img src="https://via.placeholder.com/250x500.png?text=Dashboard" alt="Dashboard"> |

## 💻 Tech Stack

*   **Frontend:** Vanilla JS, HTML5, CSS3 (Glassmorphism UI)
*   **Mapping:** Leaflet.js, OSRM (Open Source Routing Machine), Nominatim API
*   **Backend & DB:** Firebase Authentication, Cloud Firestore
*   **Build Tool:** Vite
*   **Mobile Container:** Capacitor (Android Native Integration)

## 🛠️ Local Development

To run this project locally:

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/safeher-route.git
   cd safeher-route
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Deploy to Firebase**
   ```bash
   npm run deploy
   ```

## 🔐 Security Architecture

SafeHer is built following strict security best practices:
- No hard-coded credentials; all secrets managed via Firebase config.
- `firestore.rules` implemented to prevent unauthorized cross-tenant data reads.
- PII (Personally Identifiable Information) masking and secure UUID generation.

## 🤝 Contributing

Contributions make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
