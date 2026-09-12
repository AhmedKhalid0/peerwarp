"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type Language = "en" | "ar";

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  isRTL: boolean;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Navbar
    nav_how_it_works: "How It Works",
    nav_why_peerwarp: "Why PeerWarp",
    nav_faq: "FAQ",
    nav_encrypted: "End-to-End Encrypted",
    nav_github: "GitHub",
    nav_lang_toggle: "العربية",

    // Hero
    hero_badge: "Zero Cloud Storage • Direct Device-to-Device",
    hero_title_1: "Send Large Files Directly.",
    hero_title_2: "No Cloud Uploads. No Size Limits.",
    hero_subtitle:
      "Stream files of any size directly from your browser to another device using WebRTC. Zero cloud storage, no account required, and 100% free forever.",

    // Tabs
    tab_send: "Send Files",
    tab_receive: "Receive Files",
    tab_radar: "Wi-Fi Direct Radar",

    // DropZone
    drop_drag_title: "Drag & drop files or folders here",
    drop_drag_subtitle: "or use the buttons below to choose from your computer",
    drop_browse_files: "Browse Files",
    drop_browse_folders: "Browse Folders",
    badge_no_limits: "No File Size Limits",
    badge_zero_storage: "Zero Cloud Storage",
    badge_encrypted: "End-to-End Encrypted",
    badge_free_open_source: "100% Free & Open Source",
    queue_ready_title: "Files ready to send",
    queue_clear_all: "Clear all",

    // Multi-recipient & Knock
    multi_recipients_label: "Simultaneous Recipients",
    multi_recipients_desc: "Send to up to 20 devices in parallel over WebRTC mesh.",
    knock_gate_title: "Knock-to-Join Gate (Human Verification)",
    knock_gate_desc:
      "Shows an instant popup asking you to Accept/Decline whenever an unfamiliar device attempts to join.",
    btn_create_room: "Create Transfer Room & QR Code",

    // Pairing Modal
    pair_title: "Pair your devices",
    pair_subtitle: "Scan this QR code with your phone camera, or send the direct link to your colleagues.",
    waiting_recipients: "Waiting for recipients (Up to {max} allowed)...",
    connected_recipients: "{count} of {max} Recipients Connected",
    room_code_label: "One-Time Room Code",
    btn_copy_link: "Copy Link",
    btn_copied: "Copied!",
    share_whatsapp: "WhatsApp",
    share_telegram: "Telegram",
    share_web: "Share...",

    // Receive Section
    recv_join_title: "Join a Transfer Room",
    recv_join_subtitle: "Enter the 6-character room code shown on the sender's screen.",
    recv_input_label: "Enter 6-character code",
    recv_btn_connect: "Connect & Receive Files",

    // Steps
    steps_badge: "Simple & Transparent",
    steps_title: "How PeerWarp Works in 3 Steps",
    steps_subtitle: "No software installation or registration. Transfer directly from your laptop to a phone or friend in seconds.",
    step1_title: "Choose Files or Full Folders",
    step1_desc: "Drag and drop photos, 4K video footage, zip archives, or pick entire directory trees using our large Browse buttons. No file size restrictions.",
    step2_title: "Share Code or Scan QR",
    step2_desc: "Point your phone camera at the QR code, or copy the direct link. Recipients connect instantly with zero setup or signups.",
    step3_title: "Direct Streaming Download",
    step3_desc: "Files stream device-to-device through encrypted memory channels. Chunks save directly to disk with hardware speed.",

    // Legal notice & Footer
    legal_agree_prefix: "By transferring or receiving files, you agree to our",
    legal_terms_link: "Terms of Use & Legal Disclaimer",
    legal_and: "and",
    legal_privacy_link: "Privacy Policy",
    legal_agree_suffix: "Transfers are direct P2P; users bear sole responsibility for content.",
    footer_privacy: "Privacy Policy",
    footer_terms: "Terms of Use & Legal Disclaimer",
    footer_license: "MIT License",
    footer_engineered_by: "Engineered by",
    footer_disclaimer_text:
      "PeerWarp is an open-source peer-to-peer file streaming web application engineered by Ahmed Algendy. All transfers operate as direct P2P conduits with zero server storage. Users bear sole and exclusive legal responsibility for all transmitted content.",
  },
  ar: {
    // Navbar
    nav_how_it_works: "طريقة العمل",
    nav_why_peerwarp: "لماذا بير وارب",
    nav_faq: "الأسئلة الشائعة",
    nav_encrypted: "مشفر بالكامل (P2P)",
    nav_github: "جيت هاب",
    nav_lang_toggle: "English",

    // Hero
    hero_badge: "تخزين سحابي صفري • مباشرة بين الأجهزة",
    hero_title_1: "أرسل الملفات الكبيرة مباشرة.",
    hero_title_2: "بدون رفع للسحابة. بلا حدود للحجم.",
    hero_subtitle:
      "انقل ملفاتك بأي حجم كانت مباشرة من متصفحك إلى أي جهاز آخر عبر تقنية WebRTC. بدون تخزين سحابي، بدون إنشاء حساب، ومجاني 100% للأبد.",

    // Tabs
    tab_send: "إرسال ملفات",
    tab_receive: "استلام ملفات",
    tab_radar: "رادار الواي فاي المباشر",

    // DropZone
    drop_drag_title: "اسحب وأفلت الملفات أو المجلدات هنا",
    drop_drag_subtitle: "أو استخدم الأزرار أدناه للاختيار والتصفح من جهازك",
    drop_browse_files: "تصفح الملفات",
    drop_browse_folders: "تصفح المجلدات",
    badge_no_limits: "بلا حدود لحجم الملف",
    badge_zero_storage: "بدون تخزين سحابي",
    badge_encrypted: "مشفر نظير لنظير",
    badge_free_open_source: "مجاني ومفتوح المصدر 100%",
    queue_ready_title: "ملفات جاهزة للإرسال",
    queue_clear_all: "مسح الكل",

    // Multi-recipient & Knock
    multi_recipients_label: "عدد المستلمين في نفس الوقت",
    multi_recipients_desc: "أرسل إلى ما يصل إلى 20 جهازاً بالتوازي عبر شبكة WebRTC.",
    knock_gate_title: "بوابة الاستئذان (التحقق البشري)",
    knock_gate_desc: "تُظهر نافذة فورية تطلب منك قبول أو رفض أي جهاز غير معروف يحاول الاتصال بالغرفة.",
    btn_create_room: "إنشاء غرفة النقل ورمز الـ QR",

    // Pairing Modal
    pair_title: "اربط أجهزتك الآن",
    pair_subtitle: "امسح رمز الـ QR بكاميرا الهاتف، أو أرسل الرابط المباشر للطرف الآخر.",
    waiting_recipients: "في انتظار اتصال المستلمين (مسموح حتى {max})...",
    connected_recipients: "تم اتصال {count} من أصل {max} أجهزة",
    room_code_label: "رمز الغرفة السريع",
    btn_copy_link: "نسخ الرابط",
    btn_copied: "تم النسخ!",
    share_whatsapp: "واتساب",
    share_telegram: "تليجرام",
    share_web: "مشاركة...",

    // Receive Section
    recv_join_title: "الانضمام لغرفة نقل ملفات",
    recv_join_subtitle: "أدخل رمز الغرفة المكون من 6 خانات المعروض على شاشة المُرسل.",
    recv_input_label: "أدخل الرمز المكون من 6 خانات",
    recv_btn_connect: "اتصال واستلام الملفات",

    // Steps
    steps_badge: "سهل وسريع ومباشر",
    steps_title: "كيف يعمل PeerWarp في 3 خطوات",
    steps_subtitle: "بدون تثبيت برامج أو إنشاء حسابات. انقل الملفات مباشرة بين اللابتوب والموبايل في ثوانٍ.",
    step1_title: "اختر الملفات أو المجلدات الكاملة",
    step1_desc: "اسحب الفيديوهات، الصور، الملفات المضغوطة، أو حدد مجلدات كاملة. لا توجد أي قيود على الحجم.",
    step2_title: "شارك الرمز أو امسح الـ QR",
    step2_desc: "وجّه كاميرا هاتفك نحو رمز الـ QR أو انسخ الرابط. يتصل الطرف الآخر فوراً بدون أي إعدادات.",
    step3_title: "بث وتنزيل فوري ومباشر",
    step3_desc: "تتدفق البيانات مباشرة من جهاز لجهاز عبر قنوات مشفرة وتُحفظ مباشرة في القرص بأقصى سرعة للأجهزة.",

    // Legal notice & Footer
    legal_agree_prefix: "بنقلك أو استلامك للملفات، فإنك توافق على",
    legal_terms_link: "شروط الاستخدام وإخلاء المسؤولية",
    legal_and: "و",
    legal_privacy_link: "سياسة الخصوصية",
    legal_agree_suffix: "عمليات النقل مباشرة (P2P)؛ ويتحمل المستخدم المسؤولية الحصرية عن المحتوى.",
    footer_privacy: "سياسة الخصوصية",
    footer_terms: "شروط الاستخدام وإخلاء المسؤولية",
    footer_license: "ترخيص MIT",
    footer_engineered_by: "تطوير وهندسة",
    footer_disclaimer_text:
      "تطبيق PeerWarp مفتوح المصدر للبث المباشر للملفات تم تطويره بواسطة Ahmed Algendy. تتم جميع عمليات النقل كقناة مباشرة بين الأجهزة (P2P) دون أي تخزين سحابي. يتحمل المستخدمون وحدهم المسؤولية القانونية الكاملة عن أي محتوى متداول.",
  },
};

const LanguageContext = createContext<LanguageContextType>({
  lang: "en",
  setLang: () => {},
  isRTL: false,
  t: (key) => key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>("en");

  useEffect(() => {
    // Read saved preference or detect browser language
    const saved = localStorage.getItem("peerwarp_lang") as Language | null;
    if (saved && (saved === "en" || saved === "ar")) {
      setLang(saved);
    } else if (typeof navigator !== "undefined" && navigator.language?.startsWith("ar")) {
      setLang("ar");
    }
  }, []);

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem("peerwarp_lang", newLang);
    if (typeof document !== "undefined") {
      document.documentElement.dir = newLang === "ar" ? "rtl" : "ltr";
      document.documentElement.lang = newLang;
    }
  };

  const isRTL = lang === "ar";

  const t = (key: string): string => {
    return translations[lang]?.[key] || translations["en"]?.[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, isRTL, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
