import React, { createContext, useContext, useState, useEffect } from "react";
import { translations, Language } from "../../locales/translations";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, fallback?: string) => string;
  translateData: (text?: string) => string;
}

// Extensive dictionary for dynamic database data, terms, locations & statuses
const dataDictionary: Record<string, string> = {
  // --- Crime Head & Group Names ---
  "BURGLARY": "ಕನ್ನಗಳವು (ಮನೆಯಲ್ಲಿ ಕಳವು)",
  "Burglary": "ಕನ್ನಗಳವು (ಮನೆಯಲ್ಲಿ ಕಳವು)",
  "Burglary By Night": "ರಾತ್ರಿ ವೇಳೆಯ ಕನ್ನಗಳವು",
  "Burglary By Day": "ಹಗಲು ವೇಳೆಯ ಕನ್ನಗಳವು",
  "ROBBERY": "ದರೋಡೆ ಪ್ರಕರಣ",
  "Robbery": "ದರೋಡೆ ಪ್ರಕರಣ",
  "MURDER": "ಕೊಲೆ ಪ್ರಕರಣ",
  "Murder": "ಕೊಲೆ ಪ್ರಕರಣ",
  "CYBER CRIME": "ಸೈಬರ್ ಅಪರಾಧ",
  "Cyber Crime": "ಸೈಬರ್ ಅಪರಾಧ",
  "MOTOR VEHICLE THEFT": "ಮೋಟಾರು ವಾಹನ ಕಳವು",
  "Motor Vehicle Theft": "ಮೋಟಾರು ವಾಹನ ಕಳವು",
  "CHEATING": "ವಂಚನೆ ಪ್ರಕರಣ",
  "Cheating": "ವಂಚನೆ ಪ್ರಕರಣ",
  "CHAIN SNATCHING": "ಚೈನ್ ಕಸಿ ಪ್ರಕರಣ",
  "Chain Snatching": "ಚೈನ್ ಕಸಿ ಪ್ರಕರಣ",
  "KIDNAPPING": "ಅಪಹರಣ ಪ್ರಕರಣ",
  "Kidnapping": "ಅಪಹರಣ ಪ್ರಕರಣ",
  "RIOTS": "ಗಲಭೆ / ಕೋಮು ಗಲಭೆ",
  "Riots": "ಗಲಭೆ / ಕೋಮು ಗಲಭೆ",
  "POCSO": "ಪೋಕ್ಸೊ (ಮಕ್ಕಳ ಮೇಲಿನ ಲೈಂಗಿಕ ದೌರ್ಜನ್ಯ ತಡೆ ಕಾಯ್ದೆ)",
  "THEFT": "ಕಳವು / ಕಳ್ಳತನ",
  "Theft": "ಕಳವು / ಕಳ್ಳತನ",
  "NDPS": "ಮಾದಕ ದ್ರವ್ಯ ನಿಗ್ರಹ ಕಾಯ್ದೆ (NDPS)",
  "ARSON": "ಬೆಂಕಿ ಅವಘಡ / ದುಷ್ಕೃತ್ಯ",
  "ASSAULT": "ಹಲ್ಲೆ ಪ್ರಕರಣ",
  "DOWRY DEATH": "ವರದಕ್ಷಿಣೆ ಸಾವು",
  "EXTORTION": "ಹಪ್ತಾ ವಸೂಲಿ / ಹೆದರಿಸಿ ಹಣ ಕಸಿಯುವುದು",

  // --- Districts & Locations ---
  "Bengaluru City": "ಬೆಂಗಳೂರು ನಗರ",
  "Mysuru City": "ಮೈಸೂರು ನಗರ",
  "Hubballi-Dharwad": "ಹುಬ್ಬಳ್ಳಿ-ಧಾರವಾಡ",
  "Mangaluru City": "ಮಂಗಳೂರು ನಗರ",
  "Belagavi": "ಬೆಳಗಾವಿ",
  "Kalaburagi": "ಕಲಬುರಗಿ",
  "Ballari": "ಬಳ್ಳಾರಿ",
  "Shivamogga": "ಶಿವಮೊಗ್ಗ",
  "Tumakuru": "ತುಮಕೂರು",
  "Udupi": "ಉಡುಪಿ",
  "Kolar": "ಕೋಲಾರ",
  "Davanagere": "ದಾವಣಗೆರೆ",
  "Vijayapura": "ವಿಜಯಪುರ",
  "Hassan": "ಹಾಸನ",
  "Chikkamagaluru": "ಚಿಕ್ಕಮಗಳೂರು",
  "Mandya": "ಮಂಡ್ಯ",
  "Ramanagara": "ರಾಮನಗರ",
  "Bagalkot": "ಬಾಗಲಕೋಟೆ",
  "Bidar": "ಬೀದರ್",
  "Chitradurga": "ಚಿತ್ರದುರ್ಗ",
  "Chamarajanagar": "ಚಾಮರಾಜನಗರ",
  "Gadag": "ಗದಗ",
  "Haveri": "ಹಾವೇರಿ",
  "Kodagu": "ಕೊಡಗು",
  "Koppal": "ಕೊಪ್ಪಳ",
  "Raichur": "ರಾಯಚೂರು",
  "Yadgir": "ಯಾದಗಿರಿ",
  "Uttara Kannada": "ಉತ್ತರ ಕನ್ನಡ",
  "Dakshina Kannada": "ದಕ್ಷಿಣ ಕನ್ನಡ",

  // --- Police Stations ---
  "Koramangala PS": "ಕೋರಮಂಗಲ ಪೊಲೀಸ್ ಠಾಣೆ",
  "Jayanagar PS": "ಜಯನಗರ ಪೊಲೀಸ್ ಠಾಣೆ",
  "Indiranagar PS": "ಇಂದಿರಾನಗರ ಪೊಲೀಸ್ ಠಾಣೆ",
  "Electronic City PS": "ಎಲೆಕ್ಟ್ರಾನಿಕ್ ಸಿಟಿ ಪೊಲೀಸ್ ಠಾಣೆ",
  "Whitefield PS": "ವೈಟ್‌ಫೀಲ್ಡ್ ಪೊಲೀಸ್ ಠಾಣೆ",
  "Cubbon Park PS": "ಕಬ್ಬನ್ ಪಾರ್ಕ್ ಪೊಲೀಸ್ ಠಾಣೆ",
  "Commercial Street PS": "ಕಮರ್ಷಿಯಲ್ ಸ್ಟ್ರೀಟ್ ಪೊಲೀಸ್ ಠಾಣೆ",
  "Malleswaram PS": "ಮಲ್ಲೇಶ್ವರಂ ಪೊಲೀಸ್ ಠಾಣೆ",
  "Rajajinagar PS": "ರಾಜಾಜಿನಗರ ಪೊಲೀಸ್ ಠಾಣೆ",

  // --- Statuses & Priorities ---
  "Under Investigation": "ತನಿಖೆಯ ಹಂತದಲ್ಲಿದೆ",
  "Chargesheeted": "ದೋಷಾರೋಪಣೆ ಪಟ್ಟಿ ಸಲ್ಲಿಕೆ (ಚಾರ್ಜ್‌ಶೀಟ್)",
  "Pending Review": "ಪರಿಶೀಲನೆಗೆ ಬಾಕಿ ಇದೆ",
  "Pending Approval": "ಅನುಮೋದನೆಗೆ ಬಾಕಿ ಇದೆ",
  "Closed": "ಪ್ರಕರಣ ಮುಕ್ತಾಯಗೊಂಡಿದೆ",
  "High": "ಹೆಚ್ಚಿನ ಆದ್ಯತೆ",
  "Medium": "ಮಧ್ಯಮ ಆದ್ಯತೆ",
  "Low": "ಕಡಿಮೆ ಆದ್ಯತೆ",
  "Active": "ಸಕ್ರಿಯ ತನಿಖೆ",
  "Critical": "ಗಂಭೀರ ರಿಸ್ಕ್ 🔴",
  "Standard": "ಸಾಮಾನ್ಯ",
  "Overdue": "ಸಮಯ ಮೀರಿದೆ",
  "Completed": "ಪೂರ್ಣಗೊಂಡಿದೆ",

  // --- Victim & Accused Relations ---
  "Stranger": "ಅಪರಿಚಿತ ವ್ಯಕ್ತಿ",
  "Friend": "ಸ್ನೇಹಿತ",
  "Relative": "ಸಂಬಂಧಿಕರು",
  "Acquaintance": "ಪರಿಚಿತ ವ್ಯಕ್ತಿ",
  "Co-worker": "ಸಹೋದ್ಯೋಗಿ",
  "Neighbor": "ನೆರೆಹೊರೆಯವರು",
  "Spouse": "ಪತಿ/ಪತ್ನಿ",

  // --- Evidence Types ---
  "CCTV Footage": "📹 ಸಿಸಿಟಿವಿ ದೃಶ್ಯಾವಳಿ",
  "Crime Scene Picture": "🖼️ ಅಪರಾಧ ಸ್ಥಳದ ಛಾಯಾಚಿತ್ರ",
  "Legal Document": "📄 ಕಾನೂನು ದಾಖಲೆ / ಎಫ್.ಐ.ಆರ್",
  "Forensic DNA Report": "🧪 ವಿಧಿವಿಜ್ಞಾನ ಡಿಎನ್‌ಎ ವರದಿ",
  "Recovered Weapon": "🔪 ವಶಪಡಿಸಿಕೊಂಡ ಮಾರಕ ಆಯುಧ",
  "Mobile Telemetry": "📱 ಮೊಬೈಲ್ ಕರೆ ವಿವರಗಳ ದಾಖಲೆ",

  // --- Officer Ranks ---
  "DGP — Director General of Police": "ಡಿಜಿಪಿ — ಪೊಲೀಸ್ ಮಹಾನಿರ್ದೇಶಕರು",
  "ADGP — Addl. Director General": "ಎಡಿಜಿಪಿ — ಹೆಚ್ಚುವರಿ ಪೊಲೀಸ್ ಮಹಾನಿರ್ದೇಶಕರು",
  "IGP — Inspector General": "ಐಜಿಪಿ — ಪೊಲೀಸ್ ಮಹಾನಿರೀಕ್ಷಕರು",
  "DIGP — Deputy Inspector General": "ಡಿಐಜಿಪಿ — ಉಪ ಪೊಲೀಸ್ ಮಹಾನಿರೀಕ್ಷಕರು",
  "SP — Superintendent of Police": "ಎಸ್ಪಿ — ಪೊಲೀಸ್ ವರಿಷ್ಠಾಧಿಕಾರಿ",
  "DySP — Deputy Superintendent": "ಡಿವೈಎಸ್ಪಿ — ಉಪ ಪೊಲೀಸ್ ವರಿಷ್ಠಾಧಿಕಾರಿ",
  "PI — Police Inspector": "ಪಿಐ — ಪೊಲೀಸ್ ಇನ್ಸ್‌ಪೆಕ್ಟರ್",
  "PSI — Sub Inspector of Police": "ಪಿಎಸ್‌ಐ — ಪೊಲೀಸ್ ಸಬ್ ಇನ್ಸ್‌ಪೆಕ್ಟರ್",
  "ASI — Assistant Sub Inspector": "ಎಎಸ್‌ಐ — ಸಹಾಯಕ ಸಬ್ ಇನ್ಸ್‌ಪೆಕ್ಟರ್",
  "HC — Head Constable": "ಹೆಚ್‌ಸಿ — ಹೆಡ್ ಕಾನ್‌ಸ್ಟೇಬಲ್",
  "PC — Police Constable": "ಪಿಸಿ — ಪೊಲೀಸ್ ಕಾನ್‌ಸ್ಟೇಬಲ್",
  "System Administrator": "ಸಿಸ್ಟಮ್ ನಿರ್ವಾಹಕರು",

  // --- UI Action Phrases & Summaries ---
  "Directly assigned investigations.": "ನಿಮಗೆ ನೇರವಾಗಿ ನಿಯೋಜಿಸಲಾದ ತನಿಖೆಗಳು.",
  "Required chargesheet submissions.": "ಸಲ್ಲಿಸಬೇಕಾದ ಕಡ್ಡಾಯ ದೋಷಾರೋಪಣೆ ಪಟ್ಟಿಗಳು.",
  "Successfully closed cases.": "ಯಶಸ್ವಿಯಾಗಿ ಮುಕ್ತಾಯಗೊಂಡ ಪ್ರಕರಣಗಳು.",
  "Overall investigator capacity.": "ಒಟ್ಟಾರೆ ತನಿಖಾಧಿಕಾರಿಗಳ ಕಾರ್ಯಾಚರಣೆಯ ಸಾಮರ್ಥ್ಯ.",
  "Total ongoing cases registered across Karnataka.": "ಕರ್ನಾಟಕದಾದ್ಯಂತ ನೋಂದಾಯಿಸಲಾದ ಒಟ್ಟು ಸಕ್ರಿಯ ಪ್ರಕರಣಗಳು.",
  "High severity risk score classifications.": "ಹೆಚ್ಚಿನ ತೀವ್ರತೆಯ ರಿಸ್ಕ್ ವರ್ಗೀಕರಣಗಳು.",
  "Real-time situational intelligence and proactive decision support": "ನೈಜ ಸಮಯದ ತನಿಖಾ ಗುಪ್ತಚರ ಮತ್ತು ನಿರ್ಧಾರ ಬೆಂಬಲ ವ್ಯವಸ್ಥೆ",
  "Mission Critical Alerts Queue": "ಅತ್ಯಂತ ತುರ್ತು ಕಾರ್ಯಾಚರಣೆಯ ಸೂಚನೆಗಳು",
  "AI Recommended Actions Center": "ಎಐ ತನಿಖಾ ಶಿಫಾರಸುಗಳ ಕೇಂದ್ರ",
  "Chronological Mission Timeline": "ಕಾಲಾನುಕ್ರಮದ ತನಿಖಾ ಟೈಮ್‌ಲೈನ್",
  "Repeat Offender Match": "ಪುನರಾವರ್ತಿತ ಅಪರಾಧಿ ಗುರುತು ಹಚ್ಚಲಾಗಿದೆ",
  "Hotspot Re-calculated": "ಹಾಟ್‌ಸ್ಪಾಟ್ ವಲಯಗಳನ್ನು ಮರು-ಲೆಕ್ಕಾಚಾರ ಮಾಡಲಾಗಿದೆ",
  "Case Similarity Identified": "ಹೋಲುವ ಪ್ರಕರಣದ ವೆಕ್ಟರ್ ಗುರುತಿಸಲಾಗಿದೆ",
  "Dossier Assignment Alert": "ಕೇಸ್ ಫೈಲ್ ನಿಯೋಜನೆಯ ಸೂಚನೆ",
  "Risk Score Elevated": "ಅಪರಾಧ ರಿಸ್ಕ್ ಸ್ಕೋರ್ ಹೆಚ್ಚಿಸಲಾಗಿದೆ",

  // --- GIS Hotspots & Map Briefing ---
  "JURISDICTION: Statewide Intelligence Scope": "ಅಧಿಕಾರ ವ್ಯಾಪ್ತಿ: ರಾಜ್ಯಮಟ್ಟದ ಗುಪ್ತಚರ ಸೀಮೆ (ಎಲ್ಲಾ ೩೧ ಜಿಲ್ಲೆಗಳು)",
  "Full read access across all districts and divisions.": "ಎಲ್ಲಾ ೩೧ ಜಿಲ್ಲೆಗಳು ಮತ್ತು ಉಪ-ವಿಭಾಗಗಳ ತನಿಖಾ ದಾಖಲೆಗಳ ಪೂರ್ಣ ವೀಕ್ಷಣೆ ಪ್ರವೇಶ.",
  "TOP AI RISK HOTSPOTS": "ಅತ್ಯಂತ ಗಂಭೀರ ಎಐ ರಿಸ್ಕ್ ಹಾಟ್‌ಸ್ಪಾಟ್‌ಗಳು",
  "Zone #1": "ಹಾಟ್‌ಸ್ಪಾಟ್ ವಲಯ #೧",
  "Zone #2": "ಹಾಟ್‌ಸ್ಪಾಟ್ ವಲಯ #೨",
  "Zone #3": "ಹಾಟ್‌ಸ್ಪಾಟ್ ವಲಯ #೩",
  "Zone #4": "ಹಾಟ್‌ಸ್ಪಾಟ್ ವಲಯ #೪",
  "Zone #5": "ಹಾಟ್‌ಸ್ಪಾಟ್ ವಲಯ #೫",
  "Zone #6": "ಹಾಟ್‌ಸ್ಪಾಟ್ ವಲಯ #೬",
  "Zone #7": "ಹಾಟ್‌ಸ್ಪಾಟ್ ವಲಯ #೭",
  "100% AI Risk Score": "೧೦೦% ಎಐ ರಿಸ್ಕ್ ಸ್ಕೋರ್ 🔴",
  "99% AI Risk Score": "೯೯% ಎಐ ರಿಸ್ಕ್ ಸ್ಕೋರ್ 🔴",
  "98% AI Risk Score": "೯೮% ಎಐ ರಿಸ್ಕ್ ಸ್ಕೋರ್ 🔴",
  "97% AI Risk Score": "೯೭% ಎಐ ರಿಸ್ಕ್ ಸ್ಕೋರ್ 🔴",
  "95% AI Risk Score": "೯೫% ಎಐ ರಿಸ್ಕ್ ಸ್ಕೋರ್ 🔴",
  "Primary Crime Driver: Public Nuisance & Domestic Harassment (22 FIRs)": "ಪ್ರಮುಖ ಅಪರಾಧ: ಸಾರ್ವಜನಿಕ ಉಪದ್ರವ ಮತ್ತು ಗೃಹ ಹಿಂಸಾಚಾರ (೨೨ ಎಫ್.ಐ.ಆರ್)",
  "Primary Crime Driver: Public Nuisance & Domestic Harassment (21 FIRs)": "ಪ್ರಮುಖ ಅಪರಾಧ: ಸಾರ್ವಜನಿಕ ಉಪದ್ರವ ಮತ್ತು ಗೃಹ ಹಿಂಸಾಚಾರ (೨೧ ಎಫ್.ಐ.ಆರ್)",
  "Primary Crime Driver: Public Nuisance & Domestic Harassment (28 FIRs)": "ಪ್ರಮುಖ ಅಪರಾಧ: ಸಾರ್ವಜನಿಕ ಉಪದ್ರವ ಮತ್ತು ಗೃಹ ಹಿಂಸಾಚಾರ (೨೮ ಎಫ್.ಐ.ಆರ್)",
  "Primary Crime Driver: Public Nuisance & Domestic Harassment (20 FIRs)": "ಪ್ರಮುಖ ಅಪರಾಧ: ಸಾರ್ವಜನಿಕ ಉಪದ್ರವ ಮತ್ತು ಗೃಹ ಹಿಂಸಾಚಾರ (೨೦ ಎಫ್.ಐ.ಆರ್)",
  "Primary Crime Driver: Public Nuisance & Domestic Harassment (31 FIRs)": "ಪ್ರಮುಖ ಅಪರಾಧ: ಸಾರ್ವಜನಿಕ ಉಪದ್ರವ ಮತ್ತು ಗೃಹ ಹಿಂಸಾಚಾರ (೩೧ ಎಫ್.ಐ.ಆರ್)",
  "Primary Crime Driver: Public Nuisance & Domestic Harassment (27 FIRs)": "ಪ್ರಮುಖ ಅಪರಾಧ: ಸಾರ್ವಜನಿಕ ಉಪದ್ರವ ಮತ್ತು ಗೃಹ ಹಿಂಸಾಚಾರ (೨೭ ಎಫ್.ಐ.ಆರ್)",
  "Nearby FIR Volume: Multi-FIR cases": "ಸಮೀಪದ ಎಫ್.ಐ.ಆರ್ ಪ್ರಮಾಣ: ಬಹು-ಎಫ್.ಐ.ಆರ್ ಸಕ್ರಿಯ ಪ್ರಕರಣಗಳು",
  "PATROL SHIFT WINDOW": "ಗಸ್ತು ಸಮಯದ ಅವಧಿ (ಪಾಳಿ)",
  "00:00 (Night)": "೦೦:೦೦ (ರಾತ್ರಿ)",
  "04:00": "೦೪:೦೦",
  "08:00 (Morning)": "೦೮:೦೦ (ಬೆಳಗಿನ ಜಾವ)",
  "12:00 (Noon)": "೧೨:೦೦ (ಮಧ್ಯಾಹ್ನ)",

  // --- Dashboard Briefing & Cards ---
  "LIVE SIGNAL TICKER": "🔴 ನೈಜ ಸಮಯದ ತನಿಖಾ ಸಂದೇಶ",
  "AI SITUATIONAL COMMAND BRIEFING (HIGHEST PRIORITY)": "ಎಐ ಕಾರ್ಯಾಚರಣೆಯ ಪ್ರಮುಖ ಸಾರಾಂಶ (ಅತ್ಯುನ್ನತ ಆದ್ಯತೆ)",
  "Confidence Index": "ವಿಶ್ವಾಸಾರ್ಹತೆ ಸೂಚ್ಯಂಕ",
  "Priority District": "ಆದ್ಯತೆಯ ಜಿಲ್ಲೆ",
  "Suggested Action": "ಶಿಫಾರಸು ಮಾಡಿದ ಕ್ರಮ",
  "Last Synced": "ಕೊನೆಯದಾಗಿ ಸಿಂಕ್ ಮಾಡಲಾಗಿದೆ",
  "Expand Intel": "ಹೆಚ್ಚಿನ ಗುಪ್ತಚರ ಸಾರಾಂಶ ವೀಕ್ಷಿಸಿ",
  "Action Required": "ತುರ್ತು ಕ್ರಮ ಅಗತ್ಯವಿದೆ",
  "Decision Support": "ತನಿಖಾ ಬೆಂಬಲ ವ್ಯವಸ್ಥೆ",
  "Live Feed": "ಲೈವ್ ಫೀಡ್",

  "Crime registered activities within active jurisdiction scope: 5000 total active files.": "ನಿಮ್ಮ ಅಧಿಕಾರ ವ್ಯಾಪ್ತಿಯಲ್ಲಿ ನೋಂದಾಯಿಸಲಾದ ಒಟ್ಟು ಸಕ್ರಿಯ ಪ್ರಕರಣಗಳು: ೫೦೦೦ ಫೈಲ್‌ಗಳು.",
  "AI threat risk engine flagged 140 cases exceeding severity threshold limit.": "ಎಐ ಬೆದರಿಕೆ ಸೂಚ್ಯಂಕವು ೧೪೦ ಗಂಭೀರ ಪ್ರಕರಣಗಳನ್ನು ಗುರುತಿಸಿದೆ.",
  "Modus operandi analysis shows 0 property-related/theft incident logs registered.": "ಕಾರ್ಯಾಚರಣೆಯ ಶೈಲಿಯ ವಿಶ್ಲೇಷಣೆಯು ಆಸ್ತಿ/ಕಳವು ಪ್ರಕರಣಗಳಲ್ಲಿ ಸಕ್ರಿಯ ಬದಲಾವಣೆ ತೋರಿಸುತ್ತದೆ.",
  "AI recommended action: Escalated security protocols active across southern precincts.": "ಎಐ ಶಿಫಾರಸು: ದಕ್ಷಿಣ ವಲಯದಾದ್ಯಂತ ಕಟ್ಟುನಿಟ್ಟಿನ ಭದ್ರತಾ ನಿಯಮಗಳನ್ನು ಜಾರಿಗೊಳಿಸಲಾಗಿದೆ.",
  "Patrol deployments reinforcement suggested near sector boundaries between 18:00 - 22:00.": "ಸಂಜೆ ೧೮:೦೦ ರಿಂದ ೨೨:೦೦ ರ ನಡುವೆ ಗಸ್ತು ಕಾರ್ಯಾಚರಣೆಯನ್ನು ತೀವ್ರಗೊಳಿಸಲು ಶಿಫಾರಸು ಮಾಡಲಾಗಿದೆ.",

  "MISSION CRITICAL ALERTS QUEUE": "ಅತ್ಯಂತ ತುರ್ತು ಕಾರ್ಯಾಚರಣೆಯ ಸೂಚನೆಗಳು",
  "AI RECOMMENDED ACTIONS CENTER": "ಎಐ ಕಾರ್ಯಾಚರಣೆಯ ಶಿಫಾರಸುಗಳ ಕೇಂದ್ರ",
  "CHRONOLOGICAL MISSION TIMELINE": "ಕಾಲಾನುಕ್ರಮದ ತನಿಖಾ ಟೈಮ್‌ಲೈನ್",
  "ANOMALY DETECTED": "ಅಸಾಮಾನ್ಯ ಚಟುವಟಿಕೆ ಗುರುತಿಸಲಾಗಿದೆ ⚠️",
  "Factors: Unusually long reporting delay (72.0 hours)": "ಕಾರಣ: ವರದಿ ಮಾಡುವಿಕೆಯಲ್ಲಿ ಅಸಾಮಾನ್ಯ ವಿಳಂಬ (೭೨ ಗಂಟೆಗಳು)",
  "Factors: Unusual combination of feature ratios (delay-evidence)": "ಕಾರಣ: ಸಾಕ್ಷ್ಯಾಧಾರ ಮತ್ತು ದಿನಾಂಕಗಳಲ್ಲಿ ಅಸಂಗತತೆ",

  "REINFORCE PATROL ROUTE": "ಗಸ್ತು ಮಾರ್ಗವನ್ನು ಬಲಪಡಿಸಿ",
  "Deploy Unit to Hotspot Zone 3": "ಹಾಟ್‌ಸ್ಪಾಟ್‌ ವಲಯ ೩ ಕ್ಕೆ ಗಸ್ತು ಪಡೆಯನ್ನು ನಿಯೋಜಿಸಿ",
  "Reason: Burglary probability spikes between 18:00 - 22:00.": "ಕಾರಣ: ಸಂಜೆ ೧೮:೦೦ ರಿಂದ ೨೨:೦೦ ರವರೆಗೆ ಕನ್ನಗಳವು ಸಂಭವಿಸುವ ಸಾಧ್ಯತೆ ಹೆಚ್ಚಿದೆ.",
  "DOSSIER ASSIGNMENT": "ಕೇಸ್ ಫೈಲ್ ನಿಯೋಜನೆ",
  "Assign Senior Investigator to KSP-102": "KSP-102 ಪ್ರಕರಣಕ್ಕೆ ಹಿರಿಯ ತನಿಖಾಧಿಕಾರಿಯನ್ನು ನೇಮಿಸಿ",
  "Reason: Complex cross-circle linkages require specialized MO experience.": "ಕಾರಣ: ಸಂಕೀರ್ಣ ಅಪರಾಧ ಜಾಲದ ತನಿಖೆಗೆ ಹಿರಿಯ ಅಧಿಕಾರಿಯ ಅಗತ್ಯವಿದೆ.",
  "ORGANIZED CRIME REVIEW": "ಸಂಘಟಿತ ಅಪರಾಧ ಜಾಲದ ಮರುಪರಿಶೀಲನೆ",
  "Escalate Gang Alpha Similarity Linkage": "ಗ್ಯಾಂಗ್ ಆಲ್ಫಾ ಅಪರಾಧ ಜಾಲದ ತನಿಖೆಯನ್ನು ತೀವ್ರಗೊಳಿಸಿ",
  "Reason: Co-accused network indicates active community boundary expansions.": "ಕಾರಣ: ಸಹ-ಆರೋಪಿಗಳ ಜಾಲವು ವಿಸ್ತರಿಸುತ್ತಿರುವುದು ಕಂಡುಬಂದಿದೆ.",

  "REPEAT OFFENDER MATCH": "ಪುನರಾವರ್ತಿತ ಅಪರಾಧಿ ಗುರುತು ಹಚ್ಚಲಾಗಿದೆ",
  "Repeat offender resolved on suspect coordinates in Western sector.": "ಪಶ್ಚಿಮ ವಲಯದಲ್ಲಿ ಅಭ್ಯಾಸಬಲ ಅಪರಾಧಿಯನ್ನು ಗುರುತಿಸಲಾಗಿದೆ.",
  "HOTSPOT RE-CALCULATED": "ಹಾಟ್‌ಸ್ಪಾಟ್ ವಲಯ ಮರು-ಲೆಕ್ಕಾಚಾರ",
  "Burglary predictions updated for Southern precinct zones.": "ದಕ್ಷಿಣ ಠಾಣೆ ವಲಯಗಳ ಅಪರಾಧ ಭವಿಷ್ಯವಾಣಿಯನ್ನು ನವೀಕರಿಸಲಾಗಿದೆ.",
  "CASE SIMILARITY IDENTIFIED": "ಹೋಲುವ ಪ್ರಕರಣ ಗುರುತಿಸಲಾಗಿದೆ",
  "Vector pgvector similarity indices mapped against Gang Alpha syndicate.": "ಗ್ಯಾಂಗ್ ಆಲ್ಫಾ ಜಾಲದೊಂದಿಗೆ ಹೋಲುವ ಪ್ರಕರಣಗಳ ಸೂಚ್ಯಂಕ ಪತ್ತೆಯಾಗಿದೆ.",
  "DOSSIER ASSIGNMENT ALERT": "ಕೇಸ್ ಫೈಲ್ ನಿಯೋಜನೆಯ ಸೂಚನೆ",
  "Escalated case file dispatched to Senior Officer in Mysore circle.": "ಮೈಸೂರು ವಲಯದ ಹಿರಿಯ ಅಧಿಕಾರಿಗೆ ಕೇಸ್ ಫೈಲ್ ಕಳುಹಿಸಲಾಗಿದೆ.",
  "RISK SCORE ELEVATED": "ಅಪರಾಧ ರಿಸ್ಕ್ ಸ್ಕೋರ್ ಹೆಚ್ಚಿಸಲಾಗಿದೆ",
  "KSP-102 risk classification score upgraded to 92%.": "KSP-102 ಪ್ರಕರಣದ ರಿಸ್ಕ್ ಸ್ಕೋರ್‌ ಅನ್ನು ೯೨% ಗೆ ಹೆಚ್ಚಿಸಲಾಗಿದೆ."
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem("ksp_language");
    return saved === "kn" || saved === "en" ? saved : "en";
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("ksp_language", lang);
  };

  const t = (key: string, fallback?: string): string => {
    const dict = translations[language];
    if (dict && dict[key]) {
      return dict[key];
    }
    if (translations["en"][key]) {
      return translations["en"][key];
    }
    if (language === "en") {
      return key;
    }
    if (dataDictionary[key]) {
      return dataDictionary[key];
    }
    return fallback || key;
  };

  const translateData = (text?: string): string => {
    if (!text) return "";
    if (language === "en") return text;

    const trimmed = text.trim();
    
    // 1. Direct dictionary match
    if (dataDictionary[trimmed]) {
      return dataDictionary[trimmed];
    }

    // 2. Pattern sentence replacements for FIR descriptions & AI narratives
    let translated = text;

    // Sentence & phrase structure replacements
    translated = translated.replace(/Offence registered regarding property harassment and financial fraud/gi, "ಆಸ್ತಿ ಕಿರುಕುಳ ಮತ್ತು ಆರ್ಥಿಕ ವಂಚನೆಗೆ ಸಂಬಂಧಿಸಿದಂತೆ ಅಪರಾಧ ನೋಂದಾಯಿಸಲಾಗಿದೆ");
    translated = translated.replace(/Offence registered regarding/gi, "ಸಂಬಂಧಿಸಿದಂತೆ ಪ್ರಕರಣ ನೋಂದಾಯಿಸಲಾಗಿದೆ:");
    translated = translated.replace(/Offence registered|Offense registered/gi, "ಅಪರಾಧ ನೋಂದಾಯಿಸಲಾಗಿದೆ");
    translated = translated.replace(/The accused brandished a gun in a public place during a local dispute/gi, "ಸ್ಥಳೀಯ ಗಲಾಟೆಯ ಸಮಯದಲ್ಲಿ ಆರೋಪಿಯು ಸಾರ್ವಜನಿಕ ಸ್ಥಳದಲ್ಲಿ ಬಂದೂಕು ತೋರಿಸಿ ಬೆದರಿಕೆ ಹಾಕಿದ್ದಾನೆ");
    translated = translated.replace(/Police later collected Scene Photograph and Witness Statement Record as part of the case file/gi, "ತನಿಖಾಧಿಕಾರಿಗಳು ಅಪರಾಧ ಸ್ಥಳದ ಛಾಯಾಚಿತ್ರ ಮತ್ತು ಸಾಕ್ಷಿಗಳ ಹೇಳಿಕೆಯನ್ನು ಸಂಗ್ರಹಿಸಿದ್ದಾರೆ");
    translated = translated.replace(/Police later collected/gi, "ಪೊಲೀಸರು ತರುವಾಯ ಸಂಗ್ರಹಿಸಿದ್ದಾರೆ");
    translated = translated.replace(/Scene Photograph/gi, "ಅಪರಾಧ ಸ್ಥಳದ ಛಾಯಾಚಿತ್ರ");
    translated = translated.replace(/Witness Statement Record/gi, "ಸಾಕ್ಷಿಗಳ ಹೇಳಿಕೆ ದಾಖಲೆ");
    translated = translated.replace(/as part of the case file/gi, "ಕೇಸ್ ಫೈಲ್ ಭಾಗವಾಗಿ");
    translated = translated.replace(/The suspect was arrested for transporting chemically spiked prohibited narcotics/gi, "ರಾಸಾಯನಿಕ ಮಿಶ್ರಿತ ನಿಷೇಧಿತ ಮಾದಕ ದ್ರವ್ಯ ಸಾಗಿಸುತ್ತಿದ್ದ ಶಂಕಿತ ಆರೋಪಿಯನ್ನು ಬಂಧಿಸಲಾಗಿದೆ");
    translated = translated.replace(/prohibited narcotics/gi, "ನಿಷೇಧಿತ ಮಾದಕ ದ್ರವ್ಯ");
    translated = translated.replace(/chemically spiked/gi, "ರಾಸಾಯನಿಕ ಮಿಶ್ರಿತ");
    translated = translated.replace(/was arrested for transporting/gi, "ಸಾಗಾಣಿಕೆಗಾಗಿ ಬಂಧಿಸಲಾಗಿದೆ");
    translated = translated.replace(/The offense occurred near a general\/public place/gi, "ಸಾರ್ವಜನಿಕ ಪ್ರದೇಶದ ಸಮೀಪದಲ್ಲಿ ಅಪರಾಧ ಸಂಭವಿಸಿದೆ");
    translated = translated.replace(/The offense occurred near|The offence occurred near/gi, "ಅಪರಾಧ ಸ್ಥಳ:");
    translated = translated.replace(/general\/public place/gi, "ಸಾರ್ವಜನಿಕ ಪ್ರದೇಶ");
    translated = translated.replace(/property harassment/gi, "ಆಸ್ತಿ ಕಿರುಕುಳ");
    translated = translated.replace(/financial fraud/gi, "ಆರ್ಥಿಕ ವಂಚನೆ");
    translated = translated.replace(/brandished a gun/gi, "ಬಂದೂಕು ತೋರಿಸಿ ಬೆದರಿಕೆ ಹಾಕಿದ್ದಾನೆ");
    translated = translated.replace(/in a public place/gi, "ಸಾರ್ವಜನಿಕ ಸ್ಥಳದಲ್ಲಿ");
    translated = translated.replace(/during a local dispute/gi, "ಸ್ಥಳೀಯ ಗಲಾಟೆಯ ಸಮಯದಲ್ಲಿ");
    translated = translated.replace(/The complainant reported that/gi, "ದೂರುದಾರರು ಸಲ್ಲಿಸಿದ ದೂರಿನಂತೆ");
    translated = translated.replace(/unknown miscreants/gi, "ಅಪರಿಚಿತ ದುಷ್ಕರ್ಮಿಗಳು");
    translated = translated.replace(/broke into/gi, "ಅಕ್ರಮವಾಗಿ ಪ್ರವೇಶಿಸಿ");
    translated = translated.replace(/residential house/gi, "ವಾಸದ ಮನೆಗೆ");
    translated = translated.replace(/stolen gold ornaments/gi, "ಬಂಗಾರದ ಆಭರಣಗಳನ್ನು ಕಳವು ಮಾಡಿದ್ದಾರೆ");
    translated = translated.replace(/stolen vehicle/gi, "ಕಳುವಾದ ವಾಹನದಲ್ಲಿ");
    translated = translated.replace(/during night hours/gi, "ರಾತ್ರಿ ವೇಳೆಯಲ್ಲಿ");
    translated = translated.replace(/CCTV footage captured/gi, "ಸಿಸಿಟಿವಿ ದೃಶ್ಯಾವಳಿಯಲ್ಲಿ ಶಂಕಿತನ ಚಲನವಲನ ದಾಖಲಾಗಿದೆ");
    translated = translated.replace(/Accused arrested by/gi, "ಆರೋಪಿಯನ್ನು ಬಂಧಿಸಲಾಗಿದೆ");
    translated = translated.replace(/Seized weapon/gi, "ಮಾರಕ ಆಯುಧವನ್ನು ವಶಪಡಿಸಿಕೊಳ್ಳಲಾಗಿದೆ");
    translated = translated.replace(/Under Investigation/gi, "ತನಿಖೆಯಲ್ಲಿದೆ");
    translated = translated.replace(/Chargesheeted/gi, "ದೋಷಾರೋಪಣೆ ಪಟ್ಟಿ ಸಲ್ಲಿಕೆ");
    translated = translated.replace(/AI recommended action/gi, "ಎಐ ಕಾರ್ಯಾಚರಣೆಯ ಶಿಫಾರಸು");
    translated = translated.replace(/Patrol deployments reinforcement suggested/gi, "ಗಸ್ತು ಪಡೆ ಹೆಚ್ಚಳಕ್ಕೆ ಎಐ ಶಿಫಾರಸು ಮಾಡಿದೆ");
    translated = translated.replace(/Security protocols active/gi, "ಸುರಕ್ಷತಾ ಪ್ರೋಟೋಕಾಲ್ ಸಕ್ರಿಯಗೊಳಿಸಲಾಗಿದೆ");
    translated = translated.replace(/Escalated case file/gi, "ಉನ್ನತ ಮಟ್ಟದ ತನಿಖೆಗೆ ವರ್ಗಾಯಿಸಲಾಗಿದೆ");
    translated = translated.replace(/Vector pgvector similarity indices mapped/gi, "ವೆಕ್ಟರ್ ಹೋಲಿಕೆ ಆಧಾರಿತ ಶಂಕಿತರ ಪಟ್ಟಿ ಸಿದ್ಧಪಡಿಸಲಾಗಿದೆ");
    translated = translated.replace(/Burglary probability spikes/gi, "ಕಳವು ಕೃತ್ಯ ನಡೆಯುವ ಸಂಭವನೀಯತೆ ಹೆಚ್ಚಾಗಿದೆ");
    translated = translated.replace(/Telemetry received/gi, "ಟೆಲಿಮೆಟ್ರಿ ಮಾಹಿತಿ ಸ್ವೀಕರಿಸಲಾಗಿದೆ");

    // Word-level fallback replacements for keywords inside strings
    Object.keys(dataDictionary).forEach((key) => {
      if (key.length > 3 && translated.includes(key)) {
        translated = translated.split(key).join(dataDictionary[key]);
      }
    });

    return translated;
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, translateData }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
