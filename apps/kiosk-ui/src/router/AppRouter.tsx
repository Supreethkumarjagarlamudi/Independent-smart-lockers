import { BrowserRouter, Route, Routes } from "react-router-dom";

import SplashPage from "../pages/splash/SplashPage";
import HomePage from "../pages/home/HomePage";
import SetupPage from "../pages/setup/SetupPage";
import DepositPage from "../pages/deposit/DepositPage";
import RetrievePage from "../pages/retrieve/RetrievePage";
import RecoveryPage from "../pages/maintenance/RecoveryPage";
import CameraCalibration from "../pages/maintenance/CameraCalibration";

export default function AppRouter() {
    return (
        <BrowserRouter>
            <Routes>
                <Route
                    path="/"
                    element={<SplashPage />}
                />

                <Route
                    path="/home"
                    element={<HomePage />}
                />

                <Route
                    path="/setup"
                    element={<SetupPage />}
                />

                <Route
                    path="/deposit"
                    element={<DepositPage />}
                />

                <Route
                    path="/retrieve"
                    element={<RetrievePage />}
                />

                <Route
                    path="/admin"
                    element={<RecoveryPage />}
                />

                <Route
                    path="/admin/calibration"
                    element={<CameraCalibration />}
                />
            </Routes>
        </BrowserRouter>
    );
}