import sys
import logging
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import create_access_token

client = TestClient(app)

def run_tests():
    token = create_access_token(subject="ksp_admin")
    query_param = f"?token={token}"

    endpoints = [
        ("GET", f"/api/v1/auth/me{query_param}"),
        ("GET", f"/api/v1/cases/{query_param}"),
        ("GET", f"/api/v1/cases/1{query_param}"),
        ("GET", f"/api/v1/hotspot{query_param}"),
        ("GET", f"/api/v1/hotspot/predicted{query_param}"),
        ("GET", f"/api/v1/predictive/dashboard{query_param}"),
        ("GET", f"/api/v1/network/graph{query_param}"),
        ("GET", f"/api/v1/network/gangs{query_param}"),
        ("GET", f"/api/v1/court/cases{query_param}"),
        ("GET", f"/api/v1/reports/history{query_param}"),
        ("GET", f"/api/v1/reports/export/csv{query_param}"),
        ("GET", f"/api/v1/reports/export/excel/1{query_param}"),
        ("GET", f"/api/v1/reports/export/docx/1{query_param}"),
        ("GET", f"/api/v1/notifications{query_param}"),
        ("GET", f"/api/v1/collaboration/agencies{query_param}"),
        ("GET", f"/api/v1/search?q=robbery&token={token}"),
        ("GET", f"/api/v1/officers/{query_param}"),
        ("GET", f"/api/v1/audit{query_param}"),
        ("GET", f"/api/v1/admin/users{query_param}"),
    ]

    print("\n=======================================================")
    print("      KSP CRIME INTELLIGENCE PLATFORM TEST SUITE      ")
    print("=======================================================\n")

    passed = 0
    failed = 0

    for method, path in endpoints:
        try:
            if method == "GET":
                res = client.get(path)
            elif method == "POST":
                res = client.post(path)
            
            clean_path = path.split('?')[0]
            if res.status_code in [200, 201, 204]:
                print(f"  [OK]   {method:4s} {clean_path:35s} -> HTTP {res.status_code}")
                passed += 1
            else:
                print(f"  [FAIL] {method:4s} {clean_path:35s} -> HTTP {res.status_code} ({res.text[:100]})")
                failed += 1
        except Exception as e:
            clean_path = path.split('?')[0]
            print(f"  [EXC]  {method:4s} {clean_path:35s} -> Exception: {e}")
            failed += 1

    print("\n-------------------------------------------------------")
    print(f"  TOTAL TEST RESULTS: {passed} PASSED, {failed} FAILED")
    print("-------------------------------------------------------\n")

    if failed == 0:
        print("[SUCCESS] ALL API ROUTERS & SERVICES ARE 100% OPERATIONAL!")
        sys.exit(0)
    else:
        print("[WARNING] SOME ENDPOINTS RETURNED NON-200 STATUS CODES.")
        sys.exit(1)

if __name__ == "__main__":
    run_tests()
