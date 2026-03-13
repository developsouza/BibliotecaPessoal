import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

// Layouts
import ProtectedLayout from "./components/Layout/ProtectedLayout";
import AdminLayout from "./components/Layout/AdminLayout";

// Auth pages
import LoginPage from "./pages/Auth/LoginPage";
import RegisterPage from "./pages/Auth/RegisterPage";

// App pages
import DashboardPage from "./pages/Dashboard/DashboardPage";
import BooksPage from "./pages/Books/BooksPage";
import BookDetailPage from "./pages/Books/BookDetailPage";
import BookFormPage from "./pages/Books/BookFormPage";
import ShelfPage from "./pages/Shelf/ShelfPage";
import ReadingPage from "./pages/Reading/ReadingPage";
import LoansPage from "./pages/Loans/LoansPage";
import CategoriesPage from "./pages/Categories/CategoriesPage";
import GamificationPage from "./pages/Gamification/GamificationPage";
import LeaderboardPage from "./pages/Gamification/LeaderboardPage";
import StatisticsPage from "./pages/Statistics/StatisticsPage";
import ShareCardPage from "./pages/Statistics/ShareCardPage";
import GoogleBooksPage from "./pages/GoogleBooks/GoogleBooksPage";
import ProfilePage from "./pages/Profile/ProfilePage";
import BillingPage from "./pages/Billing/BillingPage";
import UpgradePage from "./pages/Billing/UpgradePage";
import SubscriptionIssuePage from "./pages/Billing/SubscriptionIssuePage";
import ExpiredPage from "./pages/Billing/ExpiredPage";
import TrialExpiredPage from "./pages/Billing/TrialExpiredPage";

// Admin pages
import AdminDashboardPage from "./pages/Admin/AdminDashboardPage";
import AdminTenantsPage from "./pages/Admin/AdminTenantsPage";
import AdminTenantDetail from "./pages/Admin/AdminTenantDetailPage";
import AdminTenantCreatePage from "./pages/Admin/AdminTenantCreatePage";
import AdminTenantEditPage from "./pages/Admin/AdminTenantEditPage";

// Tenant
import TenantSetupPage from "./pages/Tenant/TenantSetupPage";

function Spinner() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-[--color-bg]">
            <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                <span className="text-[--color-muted] text-sm">Carregando...</span>
            </div>
        </div>
    );
}

export default function App() {
    const { loading } = useAuth();
    if (loading) return <Spinner />;

    return (
        <Routes>
            {/* Públicas */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/setup" element={<TenantSetupPage />} />

            {/* Protegidas */}
            <Route element={<ProtectedLayout />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/books" element={<BooksPage />} />
                <Route path="/books/new" element={<BookFormPage />} />
                <Route path="/books/:id" element={<BookDetailPage />} />
                <Route path="/books/:id/edit" element={<BookFormPage />} />
                <Route path="/shelf" element={<ShelfPage />} />
                <Route path="/reading" element={<ReadingPage />} />
                <Route path="/loans" element={<LoansPage />} />
                <Route path="/categories" element={<CategoriesPage />} />
                <Route path="/gamification" element={<GamificationPage />} />
                <Route path="/gamification/leaderboard" element={<LeaderboardPage />} />
                <Route path="/statistics" element={<StatisticsPage />} />
                <Route path="/statistics/share-card" element={<ShareCardPage />} />
                <Route path="/google-books" element={<GoogleBooksPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/billing" element={<BillingPage />} />
                <Route path="/billing/upgrade" element={<UpgradePage />} />
                <Route path="/billing/subscription-issue" element={<SubscriptionIssuePage />} />
                <Route path="/billing/expired" element={<ExpiredPage />} />
                <Route path="/billing/trial-expired" element={<TrialExpiredPage />} />
            </Route>

            {/* Admin */}
            <Route element={<AdminLayout />}>
                <Route path="/admin" element={<AdminDashboardPage />} />
                <Route path="/admin/tenants" element={<AdminTenantsPage />} />
                <Route path="/admin/tenants/new" element={<AdminTenantCreatePage />} />
                <Route path="/admin/tenants/:id" element={<AdminTenantDetail />} />
                <Route path="/admin/tenants/:id/edit" element={<AdminTenantEditPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}
