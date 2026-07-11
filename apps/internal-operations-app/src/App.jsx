import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import AppShell from "./views/AppShell";
import ContextPage from "./views/pages/ContextPage";
import DocumentLibraryPage from "./views/pages/DocumentLibraryPage";
import GeneratorPage from "./views/pages/GeneratorPage";
import NewDocumentPage from "./views/pages/NewDocumentPage";
import NotFoundPage from "./views/pages/NotFoundPage";
import OverviewPage from "./views/pages/OverviewPage";
import RunsPage from "./views/pages/RunsPage";

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<OverviewPage />} />
            <Route path="overview" element={<OverviewPage />} />
            <Route path="documents/new" element={<NewDocumentPage />} />
            <Route path="documents/:documentType" element={<GeneratorPage />} />
            <Route path="documents" element={<DocumentLibraryPage />} />
            <Route path="runs" element={<RunsPage />} />
            <Route path="context" element={<ContextPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
