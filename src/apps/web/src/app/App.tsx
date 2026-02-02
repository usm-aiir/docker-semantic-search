import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Collection from "./pages/Collection";
import { JobsProvider } from "./context/JobsContext";
import BackgroundJobs from "./components/BackgroundJobs";

export default function App() {
  return (
    <JobsProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/collection/:name" element={<Collection />} />
      </Routes>
      <BackgroundJobs />
    </JobsProvider>
  );
}
