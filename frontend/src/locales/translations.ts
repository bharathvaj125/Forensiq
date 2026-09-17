export type Language = "en" | "kn";

export const translations: Record<Language, Record<string, string>> = {
  en: {
    // --- Navigation & Sidebar ---
    nav_dashboard: "Command Center",
    nav_cases: "Cases Registry",
    nav_map: "GIS Crime Map",
    nav_hotspot: "Hotspot Analytics",
    nav_network: "Network Analytics",
    nav_predictive: "Predictive AI",
    nav_court: "Court Case Monitoring",
    nav_reports: "Executive Reports",
    nav_delegation: "Task Delegation",
    nav_assistant: "AI Officer Assistant",
    nav_collaboration: "Inter-Agency Vault",
    nav_admin: "System Admin",
    nav_system_title: "KARNATAKA STATE POLICE",
    nav_system_sub: "Crime Intelligence System",
    btn_logout: "System Log Out",
    guide_btn: "Walkthrough Guide",

    // --- TopBar & Search ---
    search_placeholder: "Search Case #, Accused name, evidence...",
    search_results_title: "Unified Search Results",
    search_no_results: "No matching records found.",
    notifications: "Notifications",
    unread: "unread",
    clear_all: "Clear All",
    no_notifications: "No active notifications.",
    officer_rank: "Officer",

    // --- Common Actions & Buttons ---
    btn_upload_evidence: "Upload Case Evidence",
    btn_upload_assigned_only: "Upload Case Evidence (Assigned Officers Only)",
    btn_download_pdf: "Download Case Dossier PDF",
    btn_download: "Download",
    btn_view_preview: "Preview",
    btn_play_cctv: "Play CCTV",
    btn_view_image: "View Image",
    btn_close: "Close",
    btn_cancel: "Cancel",
    btn_save: "Save",
    btn_submit: "Submit",
    btn_appoint: "Appoint Directive",
    btn_filter: "Filter",
    btn_refresh: "Refresh",
    btn_search: "Search",
    btn_login: "Login to Platform",

    // --- Status & Risk Badges ---
    status_active: "Active Investigation",
    status_pending: "Pending Review",
    status_closed: "Closed Case",
    status_completed: "Completed & Verified",
    status_in_progress: "In Field Progress",
    status_evidence_collected: "Evidence Collected",
    status_under_review: "Under Review",
    status_assigned: "Assigned",

    risk_critical: "Critical Risk 🔴",
    risk_high: "High Risk 🟠",
    risk_medium: "Medium Risk 🟡",
    risk_low: "Low Risk 🔵",

    priority_high: "High Priority",
    priority_medium: "Medium Priority",
    priority_low: "Low Priority",

    // --- Investigation Tabs & Headers ---
    tab_overview: "Overview",
    tab_people: "People / Accused",
    tab_evidence: "Evidence & Witnesses",
    tab_ai: "AI Threat & Risk",
    tab_network: "Network Graph",
    tab_timeline: "Smart Timeline",
    tab_similar: "Similar Cases",

    section_brief_facts: "Brief Facts of Case",
    section_accused_list: "Accused Entities & Suspects",
    section_victims: "Victim Records",
    section_evidence_items: "Physical & Digital Evidence Collections",
    section_witnesses: "Witness Statements",
    section_vehicles: "Seized Vehicles",

    col_item_category: "Item Category",
    col_description: "Description",
    col_attachment: "Attachment / File",
    col_collection_date: "Collection Date",
    col_actions: "Actions",
    col_name: "Name",
    col_age_gender: "Age/Gender",
    col_occupation: "Occupation",
    col_offence_flag: "Offence Flag",
    col_injury: "Injury Severity",
    col_relation: "Relation to Accused",

    // --- Evidence Categories ---
    cat_cctv: "📹 CCTV Footage",
    cat_picture: "🖼️ Picture / Snapshot",
    cat_document: "📄 Document",
    cat_dna: "🧪 Forensic DNA",
    cat_weapon: "🔪 Recovered Weapon",
    cat_telemetry: "📱 Mobile Telemetry",

    // --- Evidence Upload & Preview Modals ---
    modal_upload_title: "Upload Evidence File for Case",
    modal_preview_title: "Evidence Artifact Preview",
    field_evidence_cat: "1. Evidence Category *",
    field_evidence_desc: "2. Detailed Description *",
    field_evidence_file: "3. Attach Evidence File (CCTV Video, Image, PDF)",
    file_no_digital: "No Digital Attachment",
    access_denied_assigned_only: "Access Denied: You are not assigned to this case. Only assigned officers can upload evidence.",

    // --- Dashboard & Command Center ---
    dash_title: "Station Command Center",
    dash_sub: "Real-time precinct monitoring, operational risk indexes, and active caseload analytics.",
    kpi_active_cases: "Active Precinct Cases",
    kpi_critical_hotspots: "Critical Hotspots",
    kpi_pending_tasks: "Pending Directives",
    kpi_high_risk_accused: "High Risk Offender Flags",

    // --- Reports Compiler ---
    report_title: "Executive Report Compiler Center",
    report_sub: "Compile comprehensive legal KSP case dossiers, download offline local PDFs, and manage compilation history.",
    report_case_input_label: "Enter Case Number or Case Master ID",
    report_compile_btn: "Compile Executive PDF Dossier",
    report_history_title: "Officer Compilation History Logs",

    // --- Task Delegation ---
    task_portal_title: "Command & Task Delegation Portal",
    task_portal_sub: "Appoint operational directives and track real-time execution timelines for subordinate officers under your jurisdiction.",
    task_appoint_btn: "Appoint Directive / Task",
    task_my_workspace: "📌 My Assigned Directives",
    task_case_registry: "📁 Case Registry Files",

    // --- Collaboration & Vault ---
    collab_title: "Inter-Agency Intelligence Vault",
    collab_sub: "Secure inter-agency collaboration portal for CBI, ED, FSL, and State Police.",
    tab_requests: "Access Requests & Approvals",
    tab_workspace: "Agency Vault Workspace",
    tab_agencies: "Connected Federal Agencies",
    tab_officers: "Liaison Officers",

    // --- Admin ---
    admin_title: "System Admin & Officer Appointments",
    admin_sub: "Appoint new police officers, manage system credentials, and review platform telemetry.",
    tab_appointments: "Officer Appointments",
    tab_system_health: "System Health & Audit",

    // --- GIS Hotspots & Network ---
    hotspot_title: "GIS Crime Hotspot Prediction & Risk Analytics",
    hotspot_sub: "Spatial density mapping, temporal hotspot forecasting, and proactive patrol routing across Karnataka.",
    network_title: "Criminal Entity & Syndicate Network Analysis",
    network_sub: "Link analysis, gang hierarchy visualization, and suspect relationship graphs.",
    predictive_title: "AI Threat Forecasting & Repeat Offender Intelligence",
    predictive_sub: "Machine learning risk scoring, repeat offender identification, and time-series crime trends.",
  },

  kn: {
    // --- Navigation & Sidebar ---
    nav_dashboard: "ಆದೇಶ ಮತ್ತು ನಿಯಂತ್ರಣ ಕೇಂದ್ರ",
    nav_cases: "ಪ್ರಕರಣಗಳ ನೋಂದಣಿ",
    nav_map: "ಜಿಐಎಸ್ ಅಪರಾಧ ನಕ್ಷೆ",
    nav_hotspot: "ಅಪರಾಧ ಹಾಟ್‌ಸ್ಪಾಟ್‌ಗಳು",
    nav_network: "ಜಾಲಬಂಧ ವಿಶ್ಲೇಷಣೆ",
    nav_predictive: "ಭವಿಷ್ಯವಾಣಿ ಎಐ",
    nav_court: "ನ್ಯಾಯಾಲಯ ಪ್ರಕರಣಗಳ ಮೇಲ್ವಿಚಾರಣೆ",
    nav_reports: "ವರದಿ ಕೇಂದ್ರ",
    nav_delegation: "ಕಾರ್ಯ ನಿಯೋಜನೆ",
    nav_assistant: "ಎಐ ಅಧಿಕಾರಿ ಸಹಾಯಕಿ",
    nav_collaboration: "ಸಂಸ್ಥೆಗಳ ಸಹಯೋಗ",
    nav_admin: "ಸಿಸ್ಟಮ್ ನಿರ್ವಹಣೆ",
    nav_system_title: "ಕರ್ನಾಟಕ ರಾಜ್ಯ ಪೊಲೀಸ್",
    nav_system_sub: "ಅಪರಾಧ ಗುಪ್ತಚರ ವ್ಯವಸ್ಥೆ",
    btn_logout: "ಸಿಸ್ಟಮ್‌ನಿಂದ ನಿರ್ಗಮಿಸಿ",
    guide_btn: "ಮಾರ್ಗದರ್ಶಿ ಕೈಪಿಡಿ",

    // --- TopBar & Search ---
    search_placeholder: "ಪ್ರಕರಣದ ಸಂಖ್ಯೆ, ಆರೋಪಿಯ ಹೆಸರು, ಸಾಕ್ಷ್ಯಾಧಾರ ಶೋಧಿಸಿ...",
    search_results_title: "ಏಕೀಕೃತ ಶೋಧನೆಯ ಫಲಿತಾಂಶಗಳು",
    search_no_results: "ಯಾವುದೇ ದಾಖಲೆಗಳು ಕಂಡುಬಂದಿಲ್ಲ.",
    notifications: "ಸೂಚನೆಗಳು",
    unread: "ಓದದಿರುವುದು",
    clear_all: "ಎಲ್ಲವನ್ನೂ ತೆರವುಗೊಳಿಸಿ",
    no_notifications: "ಯಾವುದೇ ಸಕ್ರಿಯ ಸೂಚನೆಗಳಿಲ್ಲ.",
    officer_rank: "ಅಧಿಕಾರಿ",

    // --- Common Actions & Buttons ---
    btn_upload_evidence: "ಸಾಕ್ಷ್ಯಾಧಾರ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ",
    btn_upload_assigned_only: "ಸಾಕ್ಷ್ಯಾಧಾರ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ (ನಿಯೋಜಿತ ಅಧಿಕಾರಿಗಳಿಗೆ ಮಾತ್ರ)",
    btn_download_pdf: "ಕೇಸ್ ಡಾಸಿಯರ್ ಪಿಡಿಎಫ್ ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ",
    btn_download: "ಡೌನ್‌ಲೋಡ್",
    btn_view_preview: "ಪೂರ್ವವೀಕ್ಷಣೆ",
    btn_play_cctv: "ಸಿಸಿಟಿವಿ ಪ್ಲೇ ಮಾಡಿ",
    btn_view_image: "ಚಿತ್ರ ವೀಕ್ಷಿಸಿ",
    btn_close: "ಮುಚ್ಚಿ",
    btn_cancel: "ರದ್ದುಗೊಳಿಸಿ",
    btn_save: "ಉಳಿಸಿ",
    btn_submit: "ಸಲ್ಲಿಸಿ",
    btn_appoint: "ಆದೇಶ ನಿಯೋಜಿಸಿ",
    btn_filter: "ಫಿಲ್ಟರ್",
    btn_refresh: "ಮರುಸಜ್ಜಗೊಳಿಸಿ",
    btn_search: "ಹುಡುಕಿ",
    btn_login: "ವ್ಯವಸ್ಥೆಗೆ ಲಾಗಿನ್ ಮಾಡಿ",

    // --- Status & Risk Badges ---
    status_active: "ಸಕ್ರಿಯ ತನಿಖೆ",
    status_pending: "ಪರಿಶೀಲನೆಯಲ್ಲಿದೆ",
    status_closed: "ಪ್ರಕರಣ ಮುಕ್ತಾಯ",
    status_completed: "ಪೂರ್ಣಗೊಂಡಿದೆ ಮತ್ತು ದೃಢೀಕರಿಸಲಾಗಿದೆ",
    status_in_progress: "ಕ್ಷೇತ್ರ ತನಿಖೆಯಲ್ಲಿದೆ",
    status_evidence_collected: "ಸಾಕ್ಷ್ಯಾಧಾರ ಸಂಗ್ರಹಿಸಲಾಗಿದೆ",
    status_under_review: "ಮರುಪರಿಶೀಲನೆಯಲ್ಲಿದೆ",
    status_assigned: "ನಿಯೋಜಿಸಲಾಗಿದೆ",

    risk_critical: "ಗಂಭೀರ ಬೆದರಿಕೆ 🔴",
    risk_high: "ಹೆಚ್ಚಿನ ಬೆದರಿಕೆ 🟠",
    risk_medium: "ಮಧ್ಯಮ ಬೆದರಿಕೆ 🟡",
    risk_low: "ಕಡಿಮೆ ಬೆದರಿಕೆ 🔵",

    priority_high: "ಹೆಚ್ಚಿನ ಆದ್ಯತೆ",
    priority_medium: "ಮಧ್ಯಮ ಆದ್ಯತೆ",
    priority_low: "ಕಡಿಮೆ ಆದ್ಯತೆ",

    // --- Investigation Tabs & Headers ---
    tab_overview: "ಅವಲೋಕನ",
    tab_people: "ಆರೋಪಿಗಳು / ವ್ಯಕ್ತಿಗಳು",
    tab_evidence: "ಸಾಕ್ಷ್ಯಾಧಾರಗಳು ಮತ್ತು ಸಾಕ್ಷಿಗಳು",
    tab_ai: "ಎಐ ಬೆದರಿಕೆ ಮತ್ತು ರಿಸ್ಕ್",
    tab_network: "ಜಾಲಬಂಧ ರೇಖಾಚಿತ್ರ",
    tab_timeline: "ಸ್ಮಾರ್ಟ್ ಟೈಮ್‌ಲೈನ್",
    tab_similar: "ಹೋಲುವ ಪ್ರಕರಣಗಳು",

    section_brief_facts: "ಪ್ರಕರಣದ ಪ್ರಮುಖ ಸಂಗತಿಗಳು",
    section_accused_list: "ಆರೋಪಿಗಳ ಮತ್ತು ಶಂಕಿತರ ಪಟ್ಟಿ",
    section_victims: "ಸಂತ್ರಸ್ತರ ವಿವರಗಳು",
    section_evidence_items: "ಭೌತಿಕ ಮತ್ತು ಡಿಜಿಟಲ್ ಸಾಕ್ಷ್ಯಾಧಾರ ಸಂಗ್ರಹಣೆಗಳು",
    section_witnesses: "ಸಾಕ್ಷಿಗಳ ಹೇಳಿಕೆಗಳು",
    section_vehicles: "ವಶಪಡಿಸಿಕೊಂಡ ವಾಹನಗಳು",

    col_item_category: "ವಸ್ತು ವರ್ಗ",
    col_description: "ವಿವರಣೆ",
    col_attachment: "ಲಗತ್ತು / ಫೈಲ್",
    col_collection_date: "ಸಂಗ್ರಹಿಸಿದ ದಿನಾಂಕ",
    col_actions: "ಕ್ರಿಯೆಗಳು",
    col_name: "ಹೆಸರು",
    col_age_gender: "ವಯಸ್ಸು/ಲಿಂಗ",
    col_occupation: "ವೃತ್ತಿ",
    col_offence_flag: "ಅಪರಾಧ ಧ್ವಜ",
    col_injury: "ಗಾಯದ ತೀವ್ರತೆ",
    col_relation: "ಆರೋಪಿಯೊಂದಿಗಿನ ಸಂಬಂಧ",

    // --- Evidence Categories ---
    cat_cctv: "📹 ಸಿಸಿಟಿವಿ ದೃಶ್ಯಾವಳಿ",
    cat_picture: "🖼️ ಅಪರಾಧ ಸ್ಥಳದ ಛಾಯಾಚಿತ್ರ",
    cat_document: "📄 ಕಾನೂನು ದಾಖಲೆ / ಎಫ್.ಐ.ಆರ್",
    cat_dna: "🧪 ವಿಧಿವಿಜ್ಞಾನ ಡಿಎನ್‌ಎ ವರದಿ",
    cat_weapon: "🔪 ವಶಪಡಿಸಿಕೊಂಡ ಆಯುಧ",
    cat_telemetry: "📱 ಮೊಬೈಲ್ ಕರೆ ವಿವರಗಳು",

    // --- Evidence Upload & Preview Modals ---
    modal_upload_title: "ಪ್ರಕರಣಕ್ಕೆ ಸಾಕ್ಷ್ಯಾಧಾರ ಫೈಲ್ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ",
    modal_preview_title: "ಸಾಕ್ಷ್ಯಾಧಾರ ಫೈಲ್ ಪೂರ್ವವೀಕ್ಷಣೆ",
    field_evidence_cat: "1. ಸಾಕ್ಷ್ಯಾಧಾರ ವರ್ಗ *",
    field_evidence_desc: "2. ವಿವರವಾದ ವಿವರಣೆ *",
    field_evidence_file: "3. ಸಾಕ್ಷ್ಯಾಧಾರ ಫೈಲ್ ಲಗತ್ತಿಸಿ (ಸಿಸಿಟಿವಿ ವೀಡಿಯೊ, ಚಿತ್ರ, ಪಿಡಿಎಫ್)",
    file_no_digital: "ಡಿಜಿಟಲ್ ಫೈಲ್ ಲಭ್ಯವಿಲ್ಲ",
    access_denied_assigned_only: "ಪ್ರವೇಶ ನಿರಾಕರಿಸಲಾಗಿದೆ: ಈ ಪ್ರಕರಣಕ್ಕೆ ನೀವು ನಿಯೋಜಿತವಾಗಿಲ್ಲ. ನಿಯೋಜಿತ ಅಧಿಕಾರಿಗಳು ಮಾತ್ರ ಸಾಕ್ಷ್ಯಾಧಾರ ಅಪ್‌ಲೋಡ್ ಮಾಡಬಹುದು.",

    // --- Dashboard & Command Center ---
    dash_title: "ಠಾಣೆ ಆದೇಶ ಮತ್ತು ನಿಯಂತ್ರಣ ಕೇಂದ್ರ",
    dash_sub: "ನೈಜ ಸಮಯದ ಠಾಣೆ ವೀಕ್ಷಣೆ, ಕಾರ್ಯಾಚರಣೆಯ ರಿಸ್ಕ್ ಸೂಚ್ಯಂಕಗಳು ಮತ್ತು ಸಕ್ರಿಯ ಪ್ರಕರಣಗಳ ವಿಶ್ಲೇಷಣೆ.",
    kpi_active_cases: "ಸಕ್ರಿಯ ಪ್ರಕರಣಗಳು",
    kpi_critical_hotspots: "ಗಂಭೀರ ಹಾಟ್‌ಸ್ಪಾಟ್‌ಗಳು",
    kpi_pending_tasks: "ಬಾಕಿ ಇರುವ ಆದೇಶಗಳು",
    kpi_high_risk_accused: "ಹೆಚ್ಚಿನ ರಿಸ್ಕ್ ಅಪರಾಧಿಗಳು",

    // --- Reports Compiler ---
    report_title: "ವರದಿ ಸಂಕಲನ ಕೇಂದ್ರ",
    report_sub: "ಸಂಪೂರ್ಣ ಕೆಎಸ್‌ಪಿ ಪ್ರಕರಣದ ಡಾಸಿಯರ್‌ಗಳನ್ನು ಸಂಕಲಿಸಿ, ಆಫ್‌ಲೈನ್ ಸ್ಥಳೀಯ ಪಿಡಿಎಫ್ ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ ಮತ್ತು ವರದಿ ಇತಿಹಾಸ ನಿರ್ವಹಿಸಿ.",
    report_case_input_label: "ಪ್ರಕರಣದ ಸಂಖ್ಯೆ ಅಥವಾ ಮಾಸ್ಟರ್ ಐಡಿ ನಮೂದಿಸಿ",
    report_compile_btn: "ಪಿಡಿಎಫ್ ಡಾಸಿಯರ್ ತಯಾರಿಸಿ",
    report_history_title: "ಅಧಿಕಾರಿಯ ವರದಿ ತಯಾರಿಕೆ ಇತಿಹಾಸ",

    // --- Task Delegation ---
    task_portal_title: "ಆದೇಶ ಮತ್ತು ಕಾರ್ಯ ನಿಯೋಜನೆ ಪೋರ್ಟಲ್",
    task_portal_sub: "ನಿಮ್ಮ ಅಧಿಕಾರ ವ್ಯಾಪ್ತಿಯಲ್ಲಿರುವ ಅಧೀನ ಅಧಿಕಾರಿಗಳಿಗೆ ಕಾರ್ಯಾಚರಣೆಯ ಆದೇಶಗಳನ್ನು ನಿಯೋಜಿಸಿ ಮತ್ತು ಪ್ರಗತಿಯನ್ನು ವೀಕ್ಷಿಸಿ.",
    task_appoint_btn: "ಹೊಸ ಕಾರ್ಯ ನಿಯೋಜಿಸಿ",
    task_my_workspace: "📌 ನನಗೆ ನಿಯೋಜಿಸಲಾದ ಕಾರ್ಯಾಚರಣೆಗಳು",
    task_case_registry: "📁 ಪ್ರಕರಣಗಳ ನೋಂದಣಿ ಫೈಲ್‌ಗಳು",

    // --- Collaboration & Vault ---
    collab_title: "ಏಜೆನ್ಸಿಗಳ ಗುಪ್ತಚರ ಕೋಶ",
    collab_sub: "ಸಿಬಿಐ, ಇಡಿ, ಎಫ್‌ಎಸ್‌ಎಲ್ ಮತ್ತು ರಾಜ್ಯ ಪೊಲೀಸರಿಗೆ ಸುರಕ್ಷಿತ ಮಾಹಿತಿ ವಿನಿಮಯ ಪೋರ್ಟಲ್.",
    tab_requests: "ಪ್ರವೇಶ ವಿನಂತಿಗಳು ಮತ್ತು ಅನುಮೋದನೆಗಳು",
    tab_workspace: "ಏಜೆನ್ಸಿ ಕೋಶದ ಕೆಲಸದ ಕ್ಷೇತ್ರ",
    tab_agencies: "ಸಂಯೋಜಿತ ಕೇಂದ್ರ ಏಜೆನ್ಸಿಗಳು",
    tab_officers: "ಸಂಪರ್ಕ ಅಧಿಕಾರಿಗಳು",

    // --- Admin ---
    admin_title: "ಸಿಸ್ಟಮ್ ನಿರ್ವಹಣೆ ಮತ್ತು ಅಧಿಕಾರಿಗಳ ನೇಮಕಾತಿ",
    admin_sub: "ಹೊಸ ಪೊಲೀಸ್ ಅಧಿಕಾರಿಗಳನ್ನು ನೇಮಿಸಿ, ಖಾತೆಗಳನ್ನು ನಿರ್ವಹಿಸಿ ಮತ್ತು ತಾಂತ್ರಿಕ ವಿವರಗಳನ್ನು ಪರಿಶೀಲಿಸಿ.",
    tab_appointments: "ಅಧಿಕಾರಿಗಳ ನೇಮಕಾತಿ",
    tab_system_health: "ಸಿಸ್ಟಮ್ ಆರೋಗ್ಯ ಮತ್ತು ತನಿಖಾ ದಾಖಲೆಗಳು",

    // --- GIS Hotspots & Network ---
    hotspot_title: "ಜಿಐಎಸ್ ಅಪರಾಧ ಹಾಟ್‌ಸ್ಪಾಟ್ ಭವಿಷ್ಯವಾಣಿ ಮತ್ತು ರಿಸ್ಕ್ ವಿಶ್ಲೇಷಣೆ",
    hotspot_sub: "ಕರ್ನಾಟಕದಾದ್ಯಂತ ನೈಜ ಸಮಯದ ಹಾಟ್‌ಸ್ಪಾಟ್ ಗುರುತಿಸುವಿಕೆ ಮತ್ತು ಗಸ್ತು ಮಾರ್ಗಗಳ ಯೋಜನೆ.",
    network_title: "ಅಪರಾಧ ಸೂತ್ರಧಾರಿಗಳು ಮತ್ತು ಜಾಲಬಂಧ ವಿಶ್ಲೇಷಣೆ",
    network_sub: "ಅಪರಾಧ ಜಾಲಗಳು, ಗ್ಯಾಂಗ್ ಬಾಂಧವ್ಯಗಳು ಮತ್ತು ಶಂಕಿತರ ಸಂಪರ್ಕ ವಿಶ್ಲೇಷಣೆ.",
    predictive_title: "ಎಐ ಅಪರಾಧ ಭವಿಷ್ಯವಾಣಿ ಮತ್ತು ಅಭ್ಯಾಸಬಲ ಅಪರಾಧಿಗಳ ಪತ್ತೆ",
    predictive_sub: "ಯಂತ್ರ ಕಲಿಕೆ ಆಧಾರಿತ ಅಪರಾಧಿಗಳ ರಿಸ್ಕ್ ಸ್ಕೋರಿಂಗ್ ಮತ್ತು ಅಪರಾಧ ಪ್ರವೃತ್ತಿಗಳ ಭವಿಷ್ಯವಾಣಿ.",
  }
};
