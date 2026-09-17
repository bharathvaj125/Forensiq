import httpx
import sys

BASE_URL = "https://ksp-backend-50044331349.development.catalystappsail.in"

def test_live_appsail():
    print("\n=======================================================")
    print("    LIVE CATALYST APPSAIL END-TO-END VERIFICATION       ")
    print("=======================================================\n")

    client = httpx.Client(timeout=30.0)

    # 1. Login
    login_res = client.post(
        f"{BASE_URL}/api/v1/auth/login",
        data={"username": "ksp_admin", "password": "change_me"},
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    print(f"[OK] Login Status: {login_res.status_code}")
    if login_res.status_code != 200:
        print(f"   Login Body: {login_res.text}")
        sys.exit(1)
    
    token = login_res.json()["access_token"]
    params = {"token": token}

    # TASK 1: AI Risk Score
    risk_res = client.get(f"{BASE_URL}/api/v1/intelligence/cases/1/predict", params=params)
    print(f"[OK] TASK 1 - AI Risk Score Status: {risk_res.status_code}")
    if risk_res.status_code == 200:
        print(f"     Payload Snippet: {risk_res.text[:140]}")

    # TASK 2: Top AI Risk Hotspots
    hotspot_res = client.get(f"{BASE_URL}/api/v1/hotspot/predicted", params=params)
    print(f"[OK] TASK 2 - Top AI Hotspots Status: {hotspot_res.status_code}")
    if hotspot_res.status_code == 200:
        print(f"     Payload Snippet: {hotspot_res.text[:140]}")

    # TASK 3 & 4: Mission Critical & High Risk Alerts Queue
    notif_res = client.get(f"{BASE_URL}/api/v1/notifications", params=params)
    print(f"[OK] TASK 3 & 4 - Alert Queue Status: {notif_res.status_code}")
    if notif_res.status_code == 200:
        print(f"     Payload Snippet: {notif_res.text[:160]}")

    # TASK 5: Executive PDF Generator
    pdf_res = client.post(f"{BASE_URL}/api/v1/reports/compile", params=params, json={"case_input": 1})
    print(f"[OK] TASK 5 - Executive PDF Compile Status: {pdf_res.status_code}")
    if pdf_res.status_code == 200:
        job_id = pdf_res.json()["ReportJobID"]
        print(f"     Compiled Job ID: {job_id}, PDFUrl: {pdf_res.json().get('PDFUrl')}")
        download_res = client.get(f"{BASE_URL}/api/v1/reports/jobs/{job_id}/download", params=params)
        print(f"     PDF Binary Download Status: {download_res.status_code} ({len(download_res.content)} bytes)")

if __name__ == "__main__":
    test_live_appsail()
