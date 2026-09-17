import { apiClient } from "./apiClient";

export const reportService = {
  async getCaseReportSummary(caseId: number) {
    const response = await apiClient.get(`/reports/cases/${caseId}/summary`);
    return response.data;
  },

  async getReportHistory() {
    const response = await apiClient.get("/reports/history");
    return response.data;
  },

  async generateReport(caseInput: string | number) {
    const response = await apiClient.post("/reports/compile", { case_input: caseInput });
    return response.data;
  },

  async downloadReportPdf(reportJobId: number, caseMasterId?: number) {
    const filename = caseMasterId ? `Case_Dossier_${caseMasterId}.pdf` : `Case_Dossier_${reportJobId}.pdf`;
    const response = await apiClient.get(`/reports/jobs/${reportJobId}/download`, {
      responseType: "blob",
    });

    const url = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  async getReportBlobUrl(reportJobId: number) {
    const response = await apiClient.get(`/reports/jobs/${reportJobId}/download`, {
      responseType: "blob",
    });
    return window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
  },

  async downloadCsv() {
    const response = await apiClient.get("/reports/export/csv", { responseType: "blob" });
    const url = window.URL.createObjectURL(new Blob([response.data], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "ksp_cases_dataset.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  async downloadExcel(caseId: number) {
    const response = await apiClient.get(`/reports/export/excel/${caseId}`, { responseType: "blob" });
    const url = window.URL.createObjectURL(new Blob([response.data], { type: "application/vnd.ms-excel" }));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `case_dossier_${caseId}.xls`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  async downloadDocx(caseId: number) {
    const response = await apiClient.get(`/reports/export/docx/${caseId}`, { responseType: "blob" });
    const url = window.URL.createObjectURL(new Blob([response.data], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `case_dossier_${caseId}.docx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};
