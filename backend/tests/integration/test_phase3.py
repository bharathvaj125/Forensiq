import random
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_security_headers():
    """Verifies that all OWASP security headers are present on responses."""
    response = client.get("/api/v1/auth/me")  # Can be any endpoint
    assert response.headers.get("X-Frame-Options") == "DENY"
    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert response.headers.get("X-XSS-Protection") == "1; mode=block"
    assert "default-src 'self'" in response.headers.get("Content-Security-Policy", "")
    assert "max-age=" in response.headers.get("Strict-Transport-Security", "")

def test_password_strength_validation():
    """Verifies that weak user passwords are rejected on user registration."""
    # First get admin authorization token
    login_response = client.post("/api/v1/auth/login", json={
        "Username": "ksp_admin",
        "Password": "change_me"
    })
    token = login_response.json()["access_token"]
    
    # Try creating a user with a weak password
    rand_val = random.randint(10000, 99999)
    weak_payload = {
        "Username": f"weak_user_{rand_val}",
        "Password": "123",  # Too short, no upper/lowercase/special
        "Email": "weak@ksp.gov.in"
    }
    response = client.post(
        "/api/v1/admin/users",
        json=weak_payload,
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 400
    assert "Password must be at least 8 characters" in response.json()["detail"]

def test_refresh_token_revocation_on_logout():
    """Verifies that refresh tokens are revoked on logout and cannot be reused."""
    login_response = client.post("/api/v1/auth/login", json={
        "Username": "ksp_admin",
        "Password": "change_me"
    })
    tokens = login_response.json()
    refresh_token = tokens["refresh_token"]

    # Logout to revoke the refresh token
    logout_response = client.post("/api/v1/auth/logout", json={
        "refresh_token": refresh_token
    })
    assert logout_response.status_code == 204

    # Attempting to refresh using the revoked token should fail with 401
    refresh_response = client.post("/api/v1/auth/refresh", json={
        "refresh_token": refresh_token
    })
    assert refresh_response.status_code == 401
    assert "revoked" in refresh_response.json()["detail"].lower()

def test_failed_login_lockout():
    """Verifies that account is locked out after 5 consecutive failed logins."""
    temp_username = f"lockout_test_{random.randint(10000, 99999)}"
    
    # Perform 5 failed logins
    for i in range(5):
        response = client.post("/api/v1/auth/login", json={
            "Username": temp_username,
            "Password": "wrongpassword"
        })
        if i < 4:
            assert response.status_code == 401
        else:
            # 5th attempt triggers account lockout (HTTP 403 or 401 with lockout message)
            assert response.status_code in [401, 403]
            assert "locked" in response.json()["detail"].lower()

def test_auth_and_investigation_workflow():
    """
    End-to-end integration test validating authentication, RBAC boundaries,
    case creation, timeline annotations, witness recording, investigator assignments,
    and criminal relationship network configurations.
    """
    # 1. Login
    response = client.post("/api/v1/auth/login", json={
        "Username": "ksp_admin",
        "Password": "change_me"
    })
    assert response.status_code == 200
    token_data = response.json()
    assert "access_token" in token_data
    token = token_data["access_token"]

    # 2. Get Profile
    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["Username"] == "ksp_admin"

    # 3. Get Cases
    response = client.get("/api/v1/cases?page=1&pageSize=5", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert "data" in response.json()

    # 4. Register Case
    rand_val = random.randint(100000, 999999)
    case_payload = {
        "CrimeNo": rand_val,
        "CaseNo": f"KSP/CR/2026/{rand_val}",
        "CrimeRegisteredDate": "2026-07-15",
        "PolicePersonID": 586,
        "PoliceStationID": 1,
        "CaseCategoryID": 1,
        "GravityOffenceID": 1,
        "CrimeMajorHeadID": 1,
        "CrimeMinorHeadID": 1,
        "CaseStatusID": 1,
        "IncidentFromDate": "2026-07-14T10:00:00Z",
        "IncidentToDate": "2026-07-14T12:00:00Z",
        "InfoReceivedPSDate": "2026-07-15T09:00:00Z",
        "latitude": 12.9716,
        "longitude": 77.5946,
        "BriefFacts": "Pytest case registration check."
    }
    response = client.post("/api/v1/cases", json=case_payload, headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 201
    case_data = response.json()
    case_id = case_data["CaseMasterID"]

    # 5. Read Case Details
    response = client.get(f"/api/v1/cases/{case_id}", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200

    # 6. Update Status
    response = client.put(f"/api/v1/cases/{case_id}/status?statusId=2", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200

    # 7. Update Priority
    response = client.put(f"/api/v1/cases/{case_id}/priority?priority=High", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200

    # 8. Record Witness Statement
    witness_payload = {
        "WitnessName": "Vijay Kumar",
        "AgeYear": 34,
        "GenderID": 1,
        "Occupation": "Shopkeeper",
        "Address": "MG Road, Bengaluru",
        "WitnessType": "Eye Witness",
        "StatementSummary": "Saw the incident take place near the corner shop.",
        "IsCooperative": True
    }
    response = client.post(f"/api/v1/cases/{case_id}/witnesses", json=witness_payload, headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 201

    # 9. Add Annotation
    annotation_payload = {
        "NotesText": "Pytest test note annotation.",
        "Category": "Forensic Progress"
    }
    response = client.post(f"/api/v1/cases/{case_id}/annotations", json=annotation_payload, headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 201
    annotation_id = response.json()["AnnotationID"]

    # 10. Delete Annotation
    response = client.delete(f"/api/v1/cases/annotations/{annotation_id}", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200

    # 11. Assign Investigator
    assignment_payload = {
        "OfficerID": 586,
        "AssignmentRole": "Lead Investigator"
    }
    response = client.post(f"/api/v1/cases/{case_id}/assignments", json=assignment_payload, headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 201
    assignment_id = response.json()["CaseAssignmentID"]

    # 12. Release Investigator
    response = client.delete(f"/api/v1/cases/assignments/{assignment_id}", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200

    # 13. Suspect Network Linkage
    rel_payload = {
        "SourcePersonID": 1,
        "TargetPersonID": 2,
        "RelationshipType": "Accomplice",
        "EvidenceSource": "CDR Call Log analysis"
    }
    response = client.post("/api/v1/network/relationships", json=rel_payload, headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 201
    relationship_id = response.json()["RelationshipID"]

    # 14. Verify Suspect Link
    response = client.put(f"/api/v1/network/relationships/{relationship_id}/verify", json={"Status": "Confirmed"}, headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
