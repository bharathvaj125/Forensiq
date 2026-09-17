import { BrowserRouter } from "react-router-dom";
import AuthProvider from "./providers/AuthProvider";
import QueryProvider from "./providers/QueryProvider";
import { LanguageProvider } from "./providers/LanguageContext";
import AppRoutes from "./routes/AppRoutes";

export default function App() {
  return (
    <QueryProvider>
      <LanguageProvider>
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </LanguageProvider>
    </QueryProvider>
  );
}

