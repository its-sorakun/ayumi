# <img src="https://imgh.in/host/y49107" width="48" style="vertical-align: middle; border-radius: 12px;" /> Ayumi

*A beautiful, privacy-first, offline health data viewer for Android.*

---

## 🌱 Why Ayumi Exists

Ayumi exists because I couldn't find the app I was looking for.

I wanted a simple, open-source application that could display the activity metrics my phone was already recording. Instead, most health apps I found required proprietary ecosystems, mandatory accounts, forced cloud synchronization, intrusive ads, or bundled features I didn't need.

After digging into how Android handles health data, I realized the data is often already there. Modern Android devices aggregate metrics through APIs like Health Connect, and many devices—including those running de-Googled custom ROMs—expose activity data directly through hardware sensors. If the device already holds my health data, there should be a lightweight application that simply lets me view it without artificial barriers or internet access.

That application didn't exist. So I built it.

Ayumi is designed for people who prefer open-source software, value privacy, and want to own their devices. Whether you are running stock Android, a de-Googled phone, or a custom ROM like LineageOS, Ayumi intelligently adapts to fetch your data from the most appropriate available source. It doesn't try to become another bloated fitness platform; it simply provides a transparent window into your own health data.

If you've ever looked for a health client that *does less, but does it well*, Ayumi is for you.

---

## 📸 Screenshots

| Dashboard | Water Tracker | Settings |
| :---: | :---: | :---: |
| <img src="https://imgh.in/host/odlp92" width="250"/> | <img src="https://imgh.in/host/c8e1cq" width="250"/> | <img src="https://imgh.in/host/d88gbn" width="250"/> |

---

## 🛡️ Privacy by Design

Ayumi is built on a strict privacy-first philosophy:
*   **On-Device Processing:** All data aggregation and visualization happens locally on your phone.
*   **Zero Accounts Required:** There is no sign-up, no login, and no profile creation.
*   **No Analytics or Telemetry:** Ayumi does not track your usage, collect crash logs, or monitor your behavior.
*   **No Advertisements:** A clean, distraction-free interface forever.
*   **No Forced Cloud Sync:** Your data never leaves your device through Ayumi. If you choose to use the Google Health Connect backend, that data may be synced by your OS according to your system settings, but Ayumi itself remains completely offline.

---

## ✨ Features

*   **Zero Accounts, Zero Tracking:** Ayumi operates 100% offline. No cloud sync, no accounts, and no data leaving your device.
*   **Dual Data Modes:** Choose your preferred tracking backend:
    *   **Health Connect:** Seamlessly read your history from other fitness apps, automatically pulling active calories and aggregating your steps across devices.
    *   **Device Sensor Only:** A fully de-Googled mode. Bypass Health Connect entirely and pull data directly from your phone's hardware sensor APIs for 100% private, standalone tracking.
*   **Advanced Calorie Tracking:** Go beyond active calories. Input your Physical Stats to let Ayumi dynamically calculate your Total Calories using your Basal Metabolic Rate (BMR) scaled to the time of day.
*   **Interactive Water Tracker:** A simple hydration log on your dashboard. Features an automatic bodyweight-based daily goal, quick-add buttons (+250ml / +500ml), a daily timeline history, and a visual progress bar.
*   **Customizable Goals:** Set your own daily step, distance, and water targets directly from the Settings panel.
*   **Beautiful Aesthetics:** Features a sleek UI with smooth progress rings, and full support for Material You design on Android 12 and above. Customize your experience with Light, Dark, or System Adaptive theme options.
*   **F-Droid Friendly:** Built from the ground up to respect the privacy guidelines of the open-source community. Works perfectly on de-Googled devices.

---

## 📖 Health Guide

The accompanying [Health Guide](https://github.com/its-sorakun/ayumi/blob/main/HEALTH_GUIDE.md) provides an accessible introduction to the science behind everyday health metrics. It explores how the human body uses energy, how hydration requirements are estimated, why daily step counts matter, and the evidence behind several long-standing health myths that continue to circulate today.

---

## 🚀 Installation

*Note: Ayumi is currently in active development.*

**Option 1: F-Droid (Coming Soon)**
We are working on getting Ayumi published to the official F-Droid repository!

**Option 2: Direct Download**
You can download the latest standalone APK directly from the [Releases](https://github.com/its-sorakun/ayumi/releases) tab here on GitHub.

## 🤝 Contributing

Ayumi is fully open-source, and contributions are welcome! We are always looking for help with:
*   UI improvements and accessibility enhancements
*   Performance optimizations
*   Translations and localization
*   Bug fixes and code quality improvements
*   Adding support for additional health data providers
*   Improving documentation

Feel free to open an issue or submit a Pull Request. Let's build a better, more private health ecosystem together.

---
## 📄 License

Ayumi is licensed under GPL-3.0.

The goal is to ensure that improvements to the project remain available to the community and that the software continues to respect the principles of free and open-source software.
