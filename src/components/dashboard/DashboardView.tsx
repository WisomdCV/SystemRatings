"use client";

import { useState, useEffect, useRef } from "react";
import { User } from "next-auth";
import {
    Zap,
    LayoutDashboard,
    Users,
    CalendarCheck,
    Bell,
    // Forces HMR update
    ChevronDown,
    Trophy,
    Award,
    Calendar,
    Video,
    Shield,
    MoreHorizontal,
    Clock,
    FolderKanban,
    MapPin,
    ChevronRight,
    ChevronLeft,
    GraduationCap,
    User as UserIcon,
    LogOut,
    RefreshCcw,
    X,
    AlertTriangle,
    CheckCircle2,
    TrendingUp,
    BarChart3,
    CalendarPlus,
    FileText,
    Settings,
    Search,
} from "lucide-react";
import { logoutAction } from "@/server/actions/auth.actions";
import { submitJustificationAction, acknowledgeRejectionAction } from "@/server/actions/attendance.actions";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { UserAvatar } from "@/components/ui/user-avatar";
import { hasPermission } from "@/lib/permissions";
import {
    Chart as ChartJS,
    RadialLinearScale,
    PointElement,
    LineElement,
    Filler,
    Tooltip,
    Legend,
    CategoryScale,
    LinearScale,
} from "chart.js";
import { Radar, Line } from "react-chartjs-2";

// Register ChartJS
ChartJS.register(
    RadialLinearScale,
    PointElement,
    LineElement,
    Filler,
    Tooltip,
    Legend,
    CategoryScale,
    LinearScale
);

interface DashboardViewProps {
    user: {
        id: string;
        name: string | null;
        image: string | null;
        email: string;
        role?: string | null;
        customPermissions?: string[];
        areaName?: string | null;
    };
    upcomingEvents?: any[];
    pendingJustifications?: any[];
    attendanceHistory?: any[];
    currentSemester?: { id: string; name: string } | null;
    dashboardData?: {
        kpi: {
            current: number;
            previousMonth: number | null;
            ranking: { position: number; total: number } | null;
        };
        grades: {
            pillars: Array<{ name: string; score: number; maxScore: number; normalized: number }>;
        };
        history: {
            monthly: Array<{ month: string; year: number; myKpi: number; areaAvg: number | null }>;
            semesterly: Array<{ semester: string; myKpi: number; areaAvg: number | null }>;
        };
    };
    pendingApprovalUsers?: Array<{ id: string; name: string | null; email: string; image: string | null; createdAt: Date | null }>;
    roleChanged?: boolean;
}

export default function DashboardView({ user, upcomingEvents = [], pendingJustifications = [], attendanceHistory = [], currentSemester, dashboardData, pendingApprovalUsers = [], roleChanged = false }: DashboardViewProps) {
    const [chartView, setChartView] = useState<"monthly" | "semester">("monthly");
    const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);

    // Carousel References and State
    const carouselRef = useRef<HTMLDivElement>(null);
    const [isHoveringCarousel, setIsHoveringCarousel] = useState(false);

    useEffect(() => {
        if (!carouselRef.current || upcomingEvents.length <= 1) return;

        const interval = setInterval(() => {
            if (!isHoveringCarousel && carouselRef.current) {
                const { scrollLeft, scrollWidth, clientWidth } = carouselRef.current;

                // Detectar si hemos llegado al final. 
                // Usamos un margen generoso de 5 pixels para evitar issues con sub-pixeles en pantallas HD
                if (Math.ceil(scrollLeft + clientWidth) >= scrollWidth - 5) {
                    carouselRef.current.scrollTo({ left: 0, behavior: 'smooth' });
                } else {
                    carouselRef.current.scrollTo({ left: scrollLeft + clientWidth, behavior: 'smooth' });
                }
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [isHoveringCarousel, upcomingEvents.length]);

    const getRoleLabel = (role: string | null | undefined) => {
        if (!role) return "Voluntario";
        const labels: Record<string, string> = {
            "DEV": "Desarrollador",
            "PRESIDENT": "Presidente",
            "VICEPRESIDENT": "Vicepresidente",
            "SECRETARY": "Secretario",
            "TREASURER": "Tesorero",
            "DIRECTOR": "Director",
            "SUBDIRECTOR": "Subdirector",
            "MEMBER": "Miembro",
            "VOLUNTEER": "Voluntario"
        };
        return labels[role] || role;
    };


    // --- Logic for Dynamic UI ---
    const userRole = user.role || "";
    const userCustomPermissions = user.customPermissions;
    const canAccessAdmin = hasPermission(userRole, "admin:access", userCustomPermissions);
    const canViewGrades =
        hasPermission(userRole, "grade:view_all", userCustomPermissions) ||
        hasPermission(userRole, "grade:view_own_area", userCustomPermissions);
    const canViewAreaComparison = hasPermission(userRole, "dashboard:analytics", userCustomPermissions);

    const eventsLink = canAccessAdmin ? "/admin/events" : "/dashboard/agenda";

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return "Buenos días";
        if (hour < 19) return "Buenas tardes";
        return "Buenas noches";
    };

    const greeting = getGreeting();

    const quickActions = [
        {
            label: canAccessAdmin ? "Organizar Eventos" : "Buscar Eventos",
            icon: canAccessAdmin ? CalendarPlus : Search,
            href: eventsLink,
            color: canAccessAdmin
                ? "bg-indigo-100/50 text-indigo-700 border-indigo-200"
                : "bg-blue-100/50 text-blue-700 border-blue-200"
        },
        ...(canViewGrades
            ? [{ label: "Evaluar Equipos", icon: FileText, href: "/dashboard/management/grades", color: "bg-emerald-100/50 text-emerald-700 border-emerald-200" }]
            : [{ label: "Mis Proyectos", icon: FolderKanban, href: "/dashboard/projects", color: "bg-violet-100/50 text-violet-700 border-violet-200" }]),
        {
            label: canAccessAdmin ? "Configuración" : "Mi Perfil",
            icon: canAccessAdmin ? Settings : UserIcon,
            href: canAccessAdmin ? "/admin" : "/dashboard/profile",
            color: canAccessAdmin
                ? "bg-gray-100/50 text-gray-700 border-gray-200"
                : "bg-orange-100/50 text-orange-700 border-orange-200"
        }
    ];

    // Only truly pending justifications (action required by the user).
    const actionableJustificationsCount = pendingJustifications.filter((item: any) =>
        (item.status === "ABSENT" || item.status === "LATE") &&
        (item.justificationStatus === "NONE" || item.justificationStatus === "REJECTED")
    ).length;

    const getEventStatusLabel = (event: any) => {
        if (!event) return { label: "", style: "" };

        const now = new Date();
        const eventDateObj = new Date(event.date);

        // Parse Start
        if (!event.startTime) return { label: new Date(event.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }), style: "bg-white/20" };

        const [startH, startM] = event.startTime.split(':').map(Number);

        // CRITICAL FIX: Construct LOCAL date using UTC parts from the source.
        // event.date is stored as UTC Midnight (e.g., 2025-12-28T00:00:00Z) representing "The 28th".
        // We want "The 28th at 18:00 Local Time".
        const startDateTime = new Date(
            eventDateObj.getUTCFullYear(),
            eventDateObj.getUTCMonth(),
            eventDateObj.getUTCDate(),
            startH,
            startM,
            0,
            0
        );

        // Parse End
        let endDateTime = new Date(startDateTime);
        if (event.endTime) {
            const [endH, endM] = event.endTime.split(':').map(Number);
            endDateTime = new Date(
                eventDateObj.getUTCFullYear(),
                eventDateObj.getUTCMonth(),
                eventDateObj.getUTCDate(),
                endH,
                endM,
                0,
                0
            );
        } else {
            endDateTime.setHours(startDateTime.getHours() + 1); // Default 1h duration
        }

        const diffMs = startDateTime.getTime() - now.getTime();

        // 1. Check In Progress
        if (now >= startDateTime && now <= endDateTime) {
            return { label: "🔴 En curso ahora", style: "bg-red-500/90 text-white animate-pulse shadow-lg shadow-red-500/20" };
        }

        // 2. Check Finished (Shouldn't happen often if filtered by DB, but safe to handle)
        if (now > endDateTime) {
            return { label: "Finalizado", style: "bg-gray-500/50" };
        }

        // 3. Future
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);
        const diffMinutes = Math.floor(diffMs / 60000);

        if (diffMinutes < 60) return { label: `En ${diffMinutes} min`, style: "bg-amber-400/90 text-amber-950 font-black" };
        if (diffHours < 24) return { label: `En ${diffHours} horas`, style: "bg-white/20" };
        if (diffDays === 1) return { label: "Mañana", style: "bg-white/20" };
        if (diffDays < 7) return { label: `En ${diffDays} días`, style: "bg-white/20" };

        return { label: new Date(event.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }), style: "bg-white/20" };
    };

    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isJustifyModalOpen, setIsJustifyModalOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
    const [justificationReason, setJustificationReason] = useState("");
    const [justificationLink, setJustificationLink] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [roleNotifDismissed, setRoleNotifDismissed] = useState(false);
    const router = useRouter();

    const handleOpenJustify = (record: any) => {
        setSelectedRecord(record);
        setJustificationReason("");
        setJustificationLink("");
        setIsJustifyModalOpen(true);
        setIsDrawerOpen(false); // Close drawer to focus on modal
    };

    const handleSubmitJustification = async () => {
        if (!selectedRecord || !justificationReason.trim()) {
            toast.error("Por favor ingresa un motivo.");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await submitJustificationAction(selectedRecord.id, justificationReason, justificationLink);
            if (res.success) {
                toast.success("Justificación enviada correctamente.");
                setIsJustifyModalOpen(false);
                router.refresh();
            } else {
                toast.error(res.error || "Error al enviar.");
            }
        } catch (error) {
            toast.error("Error inesperado.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- Radar Data ---
    const hasGradesData = dashboardData?.grades?.pillars && dashboardData.grades.pillars.length > 0;
    const radarLabels = hasGradesData
        ? dashboardData.grades.pillars.map(p => p.name)
        : ["Sin datos"];
    const radarScores = hasGradesData
        ? dashboardData.grades.pillars.map(p => p.normalized)
        : [0];

    const radarData = {
        labels: radarLabels,
        datasets: [
            {
                label: "Mi Nivel",
                data: radarScores,
                backgroundColor: "rgba(122, 68, 227, 0.2)",
                borderColor: "#7a44e3",
                pointBackgroundColor: "#fff",
                pointBorderColor: "#7a44e3",
                pointHoverBackgroundColor: "#7a44e3",
                pointHoverBorderColor: "#fff",
            },
        ],
    };

    const radarOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            r: {
                angleLines: { color: "#edeafd" },
                grid: { color: "#edeafd" },
                pointLabels: {
                    font: { size: 10, weight: "bold" as const },
                    color: "#4a248e",
                },
                ticks: { display: false, backdropColor: "transparent" },
            },
        },
        plugins: { legend: { display: false } },
    };

    // --- Line Data ---
    const hasHistoryData = dashboardData?.history?.monthly && dashboardData.history.monthly.length > 0;
    const monthlyLabels = hasHistoryData
        ? dashboardData.history.monthly.map(h => h.month)
        : ["Sin datos"];
    const monthlyKpi = hasHistoryData
        ? dashboardData.history.monthly.map(h => h.myKpi)
        : [0];
    const monthlyAreaAvg = hasHistoryData
        ? dashboardData.history.monthly.map(h => h.areaAvg || 0)
        : [0];

    // Fallback for semester view (not yet implemented)
    // Semester View Data
    const hasSemesterData = dashboardData?.history?.semesterly && dashboardData.history.semesterly.length > 0;
    const semesterlyLabels = hasSemesterData
        ? dashboardData.history.semesterly.map(h => h.semester)
        : ["Sin datos"];
    const semesterlyKpi = hasSemesterData
        ? dashboardData.history.semesterly.map(h => h.myKpi)
        : [0];

    // Add Area Avg for Semester
    const semesterlyAreaAvg = hasSemesterData
        ? dashboardData.history.semesterly.map(h => h.areaAvg || 0)
        : [0];

    const lineData = {
        labels:
            chartView === "monthly"
                ? monthlyLabels
                : semesterlyLabels,
        datasets: [
            {
                label: "Mi KPI",
                data:
                    chartView === "monthly"
                        ? monthlyKpi
                        : semesterlyKpi,
                borderColor: "#8a65ed",
                backgroundColor: (context: any) => {
                    const ctx = context.chart.ctx;
                    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
                    gradient.addColorStop(0, "rgba(138, 101, 237, 0.4)");
                    gradient.addColorStop(1, "rgba(138, 101, 237, 0.0)");
                    return gradient;
                },
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: "#fff",
                pointBorderColor: "#8a65ed",
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
            },
            {
                label: "Promedio Área",
                data:
                    chartView === "monthly"
                        ? monthlyAreaAvg
                        : semesterlyAreaAvg,
                borderColor: "#cbd5e1",
                borderWidth: 2,
                borderDash: [5, 5],
                tension: 0.4,
                pointRadius: 0,
                fill: false,
            },
        ],
    };

    const lineOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: "#361973",
                titleColor: "#fff",
                bodyColor: "#c4b9f9",
                padding: 10,
                cornerRadius: 8,
                displayColors: false,
            },
        },
        scales: {
            y: {
                beginAtZero: false,
                min: 3,
                max: 5,
                grid: { borderDash: [4, 4], color: "#f1f5f9" },
            },
            x: { grid: { display: false } },
        },
    };

    const handleAcknowledge = async (recordId: string) => {
        toast.loading("Procesando...", { id: "ack-loading" });
        const res = await acknowledgeRejectionAction(recordId);
        toast.dismiss("ack-loading");

        if (res.success) {
            toast.success("Notificación descartada");
            router.refresh();
        } else {
            toast.error(res.error || "Error al descartar");
        }
    };

    return (
        <div className="flex h-screen overflow-hidden text-gray-800 font-sans bg-meteorite-50">
            {/* 1. SIDEBAR (DESKTOP) */}
            <aside
                className={`hidden lg:flex flex-col justify-between bg-meteorite-950 text-white transition-all duration-300 ease-in-out z-50 shadow-2xl relative my-4 ml-4 rounded-[2rem] border border-meteorite-700/50 ${isSidebarExpanded ? "w-64" : "w-[88px]"
                    }`}
            >
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-meteorite-900 to-meteorite-950 opacity-50 z-0 pointer-events-none rounded-[2rem]"></div>

                <div className="relative z-10 w-full">
                    {/* Logo & Toggle */}
                    <div className="h-20 flex items-center justify-between px-6 border-b border-meteorite-800/50">
                        <div className="flex items-center">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-meteorite-400 to-meteorite-600 flex flex-shrink-0 items-center justify-center shadow-lg shadow-meteorite-900/50">
                                <Zap className="text-white w-5 h-5" />
                            </div>
                            <span
                                className={`ml-3 font-bold text-xl tracking-wide transition-all duration-300 overflow-hidden whitespace-nowrap ${isSidebarExpanded ? "opacity-100 w-auto" : "opacity-0 w-0 ml-0"
                                    }`}
                            >
                                IISE Manager
                            </span>
                        </div>

                        {/* Expand/Collapse Toggle Button for Desktop */}
                        <button
                            onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
                            className="text-meteorite-400 hover:text-white transition-colors p-1"
                        >
                            {isSidebarExpanded ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5 absolute right-6" />}
                        </button>
                    </div>

                    {/* Menú */}
                    <nav className="mt-8 px-4 space-y-2">
                        {/* 1. Dashboard (Common) */}
                        <a
                            href="/dashboard"
                            title={!isSidebarExpanded ? "Dashboard" : ""}
                            className={`flex items-center px-4 py-3 bg-meteorite-800 text-white rounded-xl shadow-lg shadow-meteorite-900/20 transition-all group border border-meteorite-700/50 ${!isSidebarExpanded && "justify-center"}`}
                        >
                            <LayoutDashboard className="text-meteorite-300 group-hover:text-white transition-colors w-5 h-5 flex-shrink-0" />
                            <span className={`font-medium transition-all duration-300 overflow-hidden whitespace-nowrap ${isSidebarExpanded ? "ml-3 opacity-100" : "ml-0 w-0 opacity-0"
                                }`}>Dashboard</span>
                        </a>

                        {/* 1.5. Proyectos (Common) */}
                        <a
                            href="/dashboard/projects"
                            title={!isSidebarExpanded ? "Proyectos" : ""}
                            className={`flex items-center px-4 py-3 text-meteorite-200 hover:bg-meteorite-900 hover:text-white rounded-xl transition-all group ${!isSidebarExpanded && "justify-center"}`}
                        >
                            <FolderKanban className="text-meteorite-400 group-hover:text-white transition-colors w-5 h-5 flex-shrink-0" />
                            <span className={`font-medium transition-all duration-300 overflow-hidden whitespace-nowrap ${isSidebarExpanded ? "ml-3 opacity-100" : "ml-0 w-0 opacity-0"
                                }`}>Proyectos</span>
                        </a>

                        {/* 2. Administración Central */}
                        {canAccessAdmin && (
                            <a
                                href="/admin"
                                title={!isSidebarExpanded ? "Administración" : ""}
                                className={`flex items-center px-4 py-3 text-meteorite-200 hover:bg-meteorite-900 hover:text-white rounded-xl transition-all group ${!isSidebarExpanded && "justify-center"}`}
                            >
                                <Users className="text-meteorite-400 group-hover:text-white transition-colors w-5 h-5 flex-shrink-0" />
                                <span className={`font-medium transition-all duration-300 overflow-hidden whitespace-nowrap ${isSidebarExpanded ? "ml-3 opacity-100" : "ml-0 w-0 opacity-0"
                                    }`}>Administración</span>
                            </a>
                        )}

                        {/* 5. Calificaciones */}
                        {canViewGrades && (
                            <a
                                href="/dashboard/management/grades"
                                title={!isSidebarExpanded ? "Calificaciones" : ""}
                                className={`flex items-center px-4 py-3 text-meteorite-200 hover:bg-meteorite-900 hover:text-white rounded-xl transition-all group ${!isSidebarExpanded && "justify-center"}`}
                            >
                                <GraduationCap className="text-meteorite-400 group-hover:text-white transition-colors w-5 h-5 flex-shrink-0" />
                                <span className={`font-medium transition-all duration-300 overflow-hidden whitespace-nowrap ${isSidebarExpanded ? "ml-3 opacity-100" : "ml-0 w-0 opacity-0"
                                    }`}>Calificaciones</span>
                            </a>
                        )}

                        {/* 6. Comparación de Áreas - Leadership Only */}
                        {canViewAreaComparison && (
                            <a
                                href="/dashboard/areas"
                                title={!isSidebarExpanded ? "Áreas KPI" : ""}
                                className={`flex items-center px-4 py-3 text-meteorite-200 hover:bg-meteorite-900 hover:text-white rounded-xl transition-all group ${!isSidebarExpanded && "justify-center"}`}
                            >
                                <BarChart3 className="text-meteorite-400 group-hover:text-white transition-colors w-5 h-5 flex-shrink-0" />
                                <span className={`font-medium transition-all duration-300 overflow-hidden whitespace-nowrap ${isSidebarExpanded ? "ml-3 opacity-100" : "ml-0 w-0 opacity-0"
                                    }`}>Áreas KPI</span>
                            </a>
                        )}

                        {/* 3. Meetings */}
                        {canAccessAdmin ? (
                            <a
                                href="/admin/events"
                                title={!isSidebarExpanded ? "Meetings" : ""}
                                className={`flex items-center px-4 py-3 text-meteorite-200 hover:bg-meteorite-900 hover:text-white rounded-xl transition-all group ${!isSidebarExpanded && "justify-center"}`}
                            >
                                <CalendarCheck className="text-meteorite-400 group-hover:text-white transition-colors w-5 h-5 flex-shrink-0" />
                                <span className={`font-medium transition-all duration-300 overflow-hidden whitespace-nowrap ${isSidebarExpanded ? "ml-3 opacity-100" : "ml-0 w-0 opacity-0"
                                    }`}>Meetings</span>
                            </a>
                        ) : (
                            <a
                                href="/dashboard/agenda"
                                title={!isSidebarExpanded ? "Meetings" : ""}
                                className={`flex items-center px-4 py-3 text-meteorite-200 hover:bg-meteorite-900 hover:text-white rounded-xl transition-all group ${!isSidebarExpanded && "justify-center"}`}
                            >
                                <CalendarCheck className="text-meteorite-400 group-hover:text-white transition-colors w-5 h-5 flex-shrink-0" />
                                <span className={`font-medium transition-all duration-300 overflow-hidden whitespace-nowrap ${isSidebarExpanded ? "ml-3 opacity-100" : "ml-0 w-0 opacity-0"
                                    }`}>Meetings</span>
                            </a>
                        )}
                    </nav>
                </div>

                <div className="relative z-10 p-4 border-t border-meteorite-800/50 bg-meteorite-900/30 rounded-b-[2rem]">
                    <div className={`flex items-center justify-between p-2 rounded-xl hover:bg-meteorite-800 transition-colors group ${!isSidebarExpanded && "flex-col gap-3"}`}>
                        <Link href="/dashboard/profile" title={!isSidebarExpanded ? "Ver Perfil" : ""} className="flex items-center cursor-pointer flex-1 min-w-0">
                            <UserAvatar
                                src={user.image}
                                name={user.name}
                                className="w-10 h-10 rounded-full border-2 border-meteorite-400 group-hover:border-meteorite-300 transition-colors flex-shrink-0"
                                fallbackClassName="bg-meteorite-700"
                                fallbackIcon={<UserIcon className="text-white w-5 h-5" />}
                            />
                            <div className={`overflow-hidden min-w-0 flex-1 transition-all duration-300 ${isSidebarExpanded ? "ml-3 opacity-100 w-auto" : "ml-0 opacity-0 w-0 h-0"}`}>
                                <p className="text-sm font-semibold text-white whitespace-normal break-words leading-tight group-hover:text-meteorite-100 transition-colors">{user.name}</p>
                                <p className="text-[11px] text-meteorite-300 truncate mt-0.5" title={`${getRoleLabel((user as any).role)} • ${(user as any).areaName || "Sin Área"}`}>
                                    {getRoleLabel((user as any).role)} • {(user as any).areaName || "Sin Área"}
                                </p>
                            </div>
                        </Link>
                        <button
                            onClick={async () => await logoutAction()}
                            className="text-meteorite-400 hover:text-red-400 transition-colors p-2 flex-shrink-0"
                            title="Cerrar Sesión"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </aside>

            {/* 2. CONTENIDO PRINCIPAL */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
                {/* Background Orbs */}
                <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-white to-transparent pointer-events-none z-0"></div>
                <div className="absolute -top-20 -right-20 w-96 h-96 bg-meteorite-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50"></div>
                <div className="absolute top-20 -left-20 w-72 h-72 bg-meteorite-300 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animation-delay-2000"></div>

                {/* Header */}
                <header className="h-16 lg:h-20 flex items-center justify-between px-4 lg:px-8 z-10 bg-white/50 backdrop-blur-sm sticky top-0 border-b border-white/50">
                    <div className="lg:hidden flex items-center">
                        <div className="w-8 h-8 rounded-lg bg-meteorite-600 flex items-center justify-center mr-3 shadow-md">
                            <Zap className="text-white w-4 h-4" />
                        </div>
                        <div>
                            <h1 className="font-bold text-meteorite-950 leading-tight">
                                Resumen
                            </h1>
                            <p className="text-[10px] text-meteorite-500 font-bold">
                                {currentSemester?.name || "Sin ciclo"}
                            </p>
                        </div>
                    </div>

                    <div className="hidden lg:block">
                        <h1 className="text-2xl font-bold text-meteorite-950">
                            {greeting}, {user.name?.split(" ")[0]} 👋
                        </h1>
                        <p className="text-sm text-meteorite-600 font-medium">
                            Tienes {upcomingEvents.length} eventos y {actionableJustificationsCount} justificaciones pendientes
                        </p>
                    </div>

                    <div className="flex items-center space-x-3 lg:space-x-4">
                        <div className="relative hidden lg:block">
                            <div className="bg-white pl-4 pr-4 py-2 rounded-xl shadow-sm border border-meteorite-200 text-meteorite-800 font-semibold flex items-center gap-2">
                                <span className="text-sm">{currentSemester?.name || "Sin ciclo"}</span>
                                <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">Actual</span>
                            </div>
                        </div>

                        <button
                            className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-white shadow-sm border border-meteorite-200 text-meteorite-600 hover:text-meteorite-800 hover:bg-meteorite-50 flex items-center justify-center transition-all relative"
                            onClick={() => setIsDrawerOpen(!isDrawerOpen)}
                        >
                            <Bell className="w-5 h-5" />
                            {(pendingJustifications.length + pendingApprovalUsers.length + (roleChanged && !roleNotifDismissed ? 1 : 0)) > 0 && (
                                <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                            )}
                        </button>

                        <UserAvatar
                            src={user.image}
                            name={user.name}
                            alt="Profile"
                            className="lg:hidden w-9 h-9 rounded-full border border-meteorite-300"
                            fallbackClassName="bg-meteorite-700 text-white text-xs"
                        />

                        <button
                            onClick={async () => await logoutAction()}
                            className="lg:hidden w-9 h-9 rounded-xl bg-white shadow-sm border border-meteorite-200 text-meteorite-600 hover:text-red-500 flex items-center justify-center transition-colors"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </header>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto px-4 lg:px-8 pb-24 lg:pb-8 z-10 scroll-smooth">
                    {/* ACCIONES RÁPIDAS (Quick Actions) */}
                    <div className="mb-6 lg:mb-8 mt-2 lg:mt-6 overflow-x-auto hide-scroll pb-2">
                        <div className="flex gap-3 lg:gap-4 min-w-max">
                            {quickActions.map((action, idx) => {
                                const Icon = action.icon;
                                return (
                                    <Link key={idx} href={action.href} className={`flex items-center gap-2 lg:gap-3 px-4 py-2.5 lg:px-5 lg:py-3 rounded-full border shadow-sm backdrop-blur-md transition-all hover:scale-105 active:scale-95 ${action.color}`}>
                                        <Icon className="w-4 h-4 lg:w-5 lg:h-5" />
                                        <span className="text-xs lg:text-sm font-bold whitespace-nowrap">{action.label}</span>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>

                    {/* A. KPI CARDS */}
                    <div className="flex lg:grid lg:grid-cols-4 gap-4 lg:gap-6 mb-6 lg:mb-8 overflow-x-auto hide-scroll snap-x py-2">

                        {/* KPI Total */}
                        <div className="card-glass p-5 lg:p-6 rounded-2xl min-w-[280px] lg:min-w-0 snap-center relative overflow-hidden group">
                            <div className="absolute right-0 top-0 w-24 h-24 bg-meteorite-100 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:bg-meteorite-200"></div>
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-meteorite-500 text-white flex items-center justify-center text-lg lg:text-xl shadow-lg shadow-meteorite-500/30">
                                        <Trophy className="w-5 h-5 lg:w-6 lg:h-6" />
                                    </div>
                                    {(() => {
                                        const current = dashboardData?.kpi?.current || 0;
                                        const prev = dashboardData?.kpi?.previousMonth;
                                        if (prev === null || prev === undefined || prev === 0) {
                                            return (
                                                <span className="text-[10px] lg:text-xs font-bold px-2 py-1 rounded-lg bg-gray-100 text-gray-500">
                                                    Primer registro
                                                </span>
                                            );
                                        }
                                        const change = ((current - prev) / prev * 100);
                                        const isPositive = change >= 0;
                                        return (
                                            <span className={`text-[10px] lg:text-xs font-bold px-2 py-1 rounded-lg ${isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {isPositive ? '+' : ''}{change.toFixed(0)}% vs mes ant.
                                            </span>
                                        );
                                    })()}
                                </div>
                                <h3 className="text-meteorite-500 text-xs font-bold uppercase tracking-wider">
                                    KPI Global
                                </h3>
                                <p className="text-2xl lg:text-3xl font-bold text-meteorite-950 mt-1">
                                    {(dashboardData?.kpi?.current || 0).toFixed(2)}
                                    <span className="text-base lg:text-lg text-meteorite-400 font-normal">
                                        /10
                                    </span>
                                </p>
                            </div>
                        </div>

                        {/* Asistencia KPI */}
                        <div className="card-glass p-5 lg:p-6 rounded-2xl min-w-[280px] lg:min-w-0 snap-center relative overflow-hidden group">
                            <div className="absolute right-0 top-0 w-24 h-24 bg-blue-50 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:bg-blue-100"></div>
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-blue-500 text-white flex items-center justify-center text-lg lg:text-xl shadow-lg shadow-blue-500/30">
                                        <CalendarCheck className="w-5 h-5 lg:w-6 lg:h-6" />
                                    </div>
                                    <Link href="/dashboard/history" className="text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-white/50 hover:bg-white px-2 py-1 rounded-lg transition-colors">
                                        Ver Detalle
                                    </Link>
                                </div>
                                <h3 className="text-blue-500 text-xs font-bold uppercase tracking-wider">
                                    Asistencia
                                </h3>
                                <div className="flex items-baseline gap-2 mt-1">
                                    <p className="text-2xl lg:text-3xl font-bold text-gray-800">
                                        {(attendanceHistory && attendanceHistory.length > 0) ? (
                                            Math.round((attendanceHistory.filter(r => r.status === "PRESENT" || r.status === "EXCUSED").length / attendanceHistory.length) * 100)
                                        ) : 0}%
                                    </p>
                                </div>
                                <div className="w-full bg-blue-100 h-1.5 mt-2 rounded-full overflow-hidden">
                                    <div
                                        className="bg-blue-500 h-1.5 rounded-full transition-all duration-1000"
                                        style={{ width: `${(attendanceHistory && attendanceHistory.length > 0) ? Math.round((attendanceHistory.filter(r => r.status === "PRESENT" || r.status === "EXCUSED").length / attendanceHistory.length) * 100) : 0}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>

                        {/* Ranking */}
                        <div className="card-glass p-5 lg:p-6 rounded-2xl min-w-[280px] lg:min-w-0 snap-center relative overflow-hidden group">
                            <div className="absolute right-0 top-0 w-24 h-24 bg-orange-50 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:bg-orange-100"></div>
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-orange-500 text-white flex items-center justify-center text-lg lg:text-xl shadow-lg shadow-orange-500/30">
                                        <Award className="w-5 h-5 lg:w-6 lg:h-6" />
                                    </div>
                                </div>
                                <h3 className="text-orange-500 text-xs font-bold uppercase tracking-wider">
                                    Ranking
                                </h3>
                                {dashboardData?.kpi?.ranking ? (
                                    <p className="text-2xl lg:text-3xl font-bold text-gray-800 mt-1">
                                        #{dashboardData.kpi.ranking.position}{" "}
                                        <span className="text-sm font-normal text-gray-500">
                                            de {dashboardData.kpi.ranking.total}
                                        </span>
                                    </p>
                                ) : (
                                    <p className="text-lg font-medium text-gray-400 mt-1">
                                        Sin datos
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Próximo Evento */}
                        {/* Próximo Evento (Ahora Slider/Carousel Deslizable Inteligente) */}
                        <div
                            className="card-glass rounded-2xl min-w-[280px] lg:min-w-0 snap-center relative overflow-hidden bg-meteorite-800 text-white border-none transition-all p-0"
                            onMouseEnter={() => setIsHoveringCarousel(true)}
                            onMouseLeave={() => setIsHoveringCarousel(false)}
                            onTouchStart={() => setIsHoveringCarousel(true)}
                            onTouchEnd={() => setIsHoveringCarousel(false)}
                        >
                            {/* Ocultamos scrollbar con class personalizada o global */}
                            <div
                                className="flex overflow-x-auto snap-x snap-mandatory hide-scroll h-[180px] lg:h-full w-full"
                                ref={carouselRef}
                            >
                                {upcomingEvents.length > 0 ? (
                                    upcomingEvents.map((ev, idx) => {
                                        const statusObjEv = getEventStatusLabel(ev);
                                        // Badge Logic para Slides
                                        let badgeColor = "bg-white/20 text-white";
                                        let badgeLabel = "Event";
                                        let slideGradient = "from-meteorite-600 to-meteorite-800"; // General default

                                        if (ev.eventScope === "PROJECT") {
                                            badgeColor = "bg-white/20 text-white border border-white/30";
                                            badgeLabel = ev.project?.name || "Proyecto";
                                            slideGradient = "from-indigo-500 to-violet-700";
                                        } else if (ev.eventScope === "IISE") {
                                            if (ev.targetAreaId) {
                                                badgeColor = "bg-white/20 text-white border border-white/30";
                                                badgeLabel = ev.targetArea?.name || "Área";
                                                slideGradient = "from-orange-500 to-amber-600";
                                            } else {
                                                badgeColor = "bg-white/20 text-white border border-white/30";
                                                badgeLabel = "General";
                                                slideGradient = "from-meteorite-600 to-meteorite-800";
                                            }
                                        }

                                        return (
                                            <div key={ev.id} className={`w-full h-full flex-shrink-0 snap-center p-5 lg:p-6 relative flex flex-col justify-between bg-gradient-to-br transition-all duration-700 ${slideGradient}`}>
                                                <div className="absolute right-0 top-0 w-32 h-32 bg-white opacity-10 rounded-bl-full -mr-6 -mt-6 pointer-events-none"></div>
                                                <div className="relative z-10 flex flex-col h-full justify-between">
                                                    <div>
                                                        <div className="flex justify-between items-start mb-3 xl:mb-4">
                                                            <div className="flex flex-col gap-1.5 items-start">
                                                                <span className={`inline-block px-3 py-1 rounded-lg text-[10px] font-bold backdrop-blur-md transition-all ${statusObjEv.style}`}>
                                                                    {statusObjEv.label}
                                                                </span>
                                                                <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider backdrop-blur-md ${badgeColor} shadow-sm max-w-[150px] truncate`}>
                                                                    {badgeLabel}
                                                                </span>
                                                            </div>
                                                            {upcomingEvents.length > 1 && (
                                                                <div className="flex gap-1 justify-center items-center bg-black/20 px-2.5 py-1.5 rounded-full backdrop-blur-sm self-start">
                                                                    {upcomingEvents.map((_, i) => (
                                                                        <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === idx ? "bg-white scale-125" : "bg-white/40"}`} />
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <h3 className="text-lg font-bold leading-tight line-clamp-2" title={ev.title}>
                                                            {ev.title}
                                                        </h3>
                                                    </div>
                                                    <div className="flex items-center mt-3">
                                                        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm border border-white/10">
                                                            {ev.isVirtual ? <Video className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                                                        </div>
                                                        <span className="ml-2 text-sm font-medium opacity-90 truncate">
                                                            {ev.isVirtual ? "Virtual" : "Campus"}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })
                                ) : (
                                    <div className="flex flex-col items-center justify-center w-full h-full text-center opacity-80 p-6 min-h-[180px]">
                                        <Calendar className="w-8 h-8 mb-2 opacity-50" />
                                        <p className="text-sm font-bold">Sin eventos próximos</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* B. GRÁFICO PRINCIPAL */}
                    <div className="card-glass p-5 lg:p-6 rounded-2xl mb-6 lg:mb-8">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                            <div>
                                <h3 className="font-bold text-meteorite-950 text-lg">
                                    Evolución de Rendimiento
                                </h3>
                                <p className="text-xs text-meteorite-500">
                                    Tus notas vs promedio del área
                                </p>
                            </div>

                            <div className="bg-meteorite-100 p-1 rounded-xl flex border border-meteorite-200 self-end sm:self-auto">
                                <button
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${chartView === "monthly"
                                        ? "tab-active"
                                        : "text-meteorite-500 hover:bg-white/50"
                                        }`}
                                    onClick={() => setChartView("monthly")}
                                >
                                    Mensual
                                </button>
                                <button
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${chartView === "semester"
                                        ? "tab-active"
                                        : "text-meteorite-500 hover:bg-white/50"
                                        }`}
                                    onClick={() => setChartView("semester")}
                                >
                                    Semestral
                                </button>
                            </div>
                        </div>
                        <div className="h-64 w-full relative">
                            {hasGradesData ? (
                                <Line data={lineData} options={lineOptions} />
                            ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/40 rounded-xl backdrop-blur-sm border border-white/50">
                                    <div className="bg-gradient-to-br from-meteorite-100 to-meteorite-50 w-16 h-16 rounded-full flex items-center justify-center mb-4 shadow-sm">
                                        <TrendingUp className="w-8 h-8 text-meteorite-300" />
                                    </div>
                                    <p className="text-meteorite-800 font-bold text-lg mb-1">Sin historial de calificaciones</p>
                                    <p className="text-meteorite-500 text-sm text-center max-w-xs">Aún no hay evoluciones registradas en este semestre. ¡Revisa la agenda y participa!</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* C. SECCIÓN INFERIOR */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Radar Chart */}
                        <div className="card-glass p-6 rounded-2xl col-span-1 flex flex-col">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-meteorite-950">Competencias</h3>
                                <button className="text-meteorite-400 hover:text-meteorite-600">
                                    <MoreHorizontal className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="flex-1 flex items-center justify-center relative h-64">
                                {hasGradesData ? (
                                    <Radar data={radarData} options={radarOptions} />
                                ) : (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pt-4">
                                        <div className="bg-gradient-to-br from-meteorite-100 to-meteorite-50 w-16 h-16 rounded-full flex items-center justify-center mb-4 shadow-sm">
                                            <Award className="w-8 h-8 text-meteorite-300" />
                                        </div>
                                        <p className="text-meteorite-800 font-bold text-center leading-tight">Mapeo de<br />Competencias</p>
                                        <p className="text-meteorite-400 text-xs text-center mt-2 px-4">Se generará al recibir primeras notas.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Agenda */}
                        <div className="card-glass rounded-2xl col-span-1 lg:col-span-2 overflow-hidden flex flex-col p-0">
                            <div className="p-6 border-b border-meteorite-100 bg-white/50 flex justify-between items-center">
                                <h3 className="font-bold text-meteorite-950">
                                    Próximas Actividades
                                </h3>
                                <a
                                    href={eventsLink}
                                    className="text-xs font-bold text-meteorite-600 bg-meteorite-50 px-3 py-1.5 rounded-lg hover:bg-meteorite-100 transition-colors"
                                >
                                    Ver Todo
                                </a>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                {upcomingEvents.length === 0 ? (
                                    <div className="text-center py-6 text-gray-400 text-sm">
                                        No hay actividades próximas.
                                    </div>
                                ) : (
                                    upcomingEvents.map((event) => {
                                        const status = getEventStatusLabel(event);
                                        const isInProgress = status.label.includes("En curso");

                                        // Badge Logic para List
                                        let listBadgeColor = "bg-meteorite-100 text-meteorite-700 border-meteorite-200";
                                        let listBadgeLabel = "General";
                                        if (event.eventScope === "PROJECT") {
                                            listBadgeColor = "bg-indigo-100 text-indigo-700 border-indigo-200";
                                            listBadgeLabel = event.project?.name || "Proyecto";
                                        } else if (event.eventScope === "IISE") {
                                            if (event.targetAreaId) {
                                                listBadgeColor = "bg-orange-100 text-orange-700 border-orange-200";
                                                listBadgeLabel = event.targetArea?.name || "Área";
                                            }
                                        }

                                        return (
                                            <div key={event.id} className={`flex items-center p-3 rounded-xl transition-all group cursor-pointer border ${isInProgress
                                                ? "bg-red-50/80 border-red-300 shadow-sm animate-pulse-slow"
                                                : "hover:bg-meteorite-50 border-transparent hover:border-meteorite-200"
                                                }`}>
                                                <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center font-bold shadow-sm transition-colors ${isInProgress ? "bg-red-500 text-white" :
                                                    event.targetAreaId ? 'bg-orange-50 text-orange-600 group-hover:bg-orange-100' : 'bg-meteorite-100 text-meteorite-600 group-hover:bg-meteorite-200'
                                                    }`}>
                                                    <span className="text-[10px] uppercase tracking-wide">
                                                        {new Date(event.date).toLocaleDateString('es-ES', { month: 'short', timeZone: 'UTC' })}
                                                    </span>
                                                    <span className="text-lg leading-none">
                                                        {new Date(event.date).getUTCDate()}
                                                    </span>
                                                </div>
                                                <div className="ml-4 flex-1">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${listBadgeColor}`}>{listBadgeLabel}</span>
                                                                {isInProgress && (
                                                                    <span className="text-[9px] font-black text-red-500 uppercase tracking-wider animate-pulse">
                                                                        ● En Curso
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <h4 className={`font-bold text-sm leading-tight ${isInProgress ? "text-red-900" : 'text-gray-800 group-hover:text-meteorite-700'}`}>
                                                                {event.title}
                                                            </h4>
                                                        </div>
                                                        {event.isMandatory && !isInProgress && (
                                                            <span className="text-[10px] font-bold bg-green-100 text-green-600 px-2 py-0.5 rounded border border-green-200">
                                                                Obligatorio
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className={`flex items-center mt-1 text-xs ${isInProgress ? "text-red-600/80" : "text-gray-500"}`}>
                                                        <Clock className={`w-3 h-3 mr-1.5 ${isInProgress ? "text-red-500" : (event.targetAreaId ? 'text-orange-400' : 'text-meteorite-400')}`} />
                                                        {event.startTime} - {event.endTime}
                                                        <span className={`mx-2 ${isInProgress ? "text-red-300" : "text-gray-300"}`}>|</span>
                                                        {event.isVirtual ? (
                                                            <>
                                                                <Video className={`w-3 h-3 mr-1.5 ${isInProgress ? "text-red-500" : 'text-meteorite-400'}`} />
                                                                Virtual
                                                            </>
                                                        ) : (
                                                            <>
                                                                <MapPin className={`w-3 h-3 mr-1.5 ${isInProgress ? "text-red-500" : 'text-meteorite-400'}`} />
                                                                Campus
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <Link href={eventsLink} className={`p-2 rounded-full transition-all ${isInProgress ? "text-red-400 hover:text-red-600 hover:bg-red-100" : "text-gray-300 group-hover:text-meteorite-500 hover:bg-meteorite-100"}`}>
                                                    <ChevronRight className="w-4 h-4" />
                                                </Link>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- NOTIFICATION DRAWER --- */}
                {isDrawerOpen && (
                    <>
                        <div
                            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 lg:hidden"
                            onClick={() => setIsDrawerOpen(false)}
                        ></div>
                        <div className="fixed top-20 right-4 w-80 bg-white rounded-2xl shadow-2xl border border-meteorite-100 z-50 overflow-hidden animate-in slide-in-from-top-5 duration-200">
                            <div className="p-4 border-b border-meteorite-100 bg-meteorite-50/50 flex justify-between items-center">
                                <h3 className="font-bold text-meteorite-900">Avisos Importantes</h3>
                                <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                    {pendingJustifications.length + pendingApprovalUsers.length + (roleChanged && !roleNotifDismissed ? 1 : 0)}
                                </span>
                            </div>



                            <div className="max-h-96 overflow-y-auto p-2">
                                {/* Role Changed Notification */}
                                {roleChanged && !roleNotifDismissed && (
                                    <div className="p-3 mb-2 rounded-xl border bg-blue-50 border-blue-200">
                                        <div className="flex items-start gap-3">
                                            <div className="w-8 h-8 rounded-full bg-blue-200 flex items-center justify-center text-blue-700 flex-shrink-0 mt-0.5">
                                                <Shield className="w-4 h-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-bold text-xs text-blue-800">
                                                    Tu rol ha sido actualizado
                                                </h4>
                                                <p className="text-[11px] text-blue-600 mt-0.5">
                                                    Un administrador cambió tu rol. Cierra sesión y vuelve a ingresar para que los cambios se apliquen completamente.
                                                </p>
                                                <div className="flex gap-2 mt-2">
                                                    <button
                                                        onClick={async () => await logoutAction()}
                                                        className="text-[10px] font-bold bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 transition-colors"
                                                    >
                                                        Cerrar sesión
                                                    </button>
                                                    <button
                                                        onClick={() => setRoleNotifDismissed(true)}
                                                        className="text-[10px] font-bold bg-blue-100 text-blue-700 px-3 py-1 rounded-lg hover:bg-blue-200 transition-colors"
                                                    >
                                                        Ahora no
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Pending Approval Notifications (Admin only) */}
                                {pendingApprovalUsers.length > 0 && (
                                    <>
                                        {pendingApprovalUsers.map((pendingUser) => (
                                            <Link
                                                key={pendingUser.id}
                                                href="/admin/approvals"
                                                className="block p-3 mb-2 rounded-xl border transition-colors bg-orange-50 border-orange-200 hover:bg-orange-100"
                                            >
                                                <div className="flex items-center gap-3">
                                                    {pendingUser.image ? (
                                                        <img
                                                            src={pendingUser.image}
                                                            alt={pendingUser.name || "User"}
                                                            className="w-8 h-8 rounded-full border border-orange-200 flex-shrink-0"
                                                        />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-full bg-orange-200 flex items-center justify-center text-orange-700 font-bold text-xs flex-shrink-0">
                                                            {(pendingUser.name || pendingUser.email)[0].toUpperCase()}
                                                        </div>
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-bold text-xs text-orange-800 truncate">
                                                            {pendingUser.name || pendingUser.email}
                                                        </h4>
                                                        <p className="text-[11px] text-orange-600">
                                                            Solicita acceso al sistema
                                                        </p>
                                                    </div>
                                                    <span className="text-[10px] font-bold bg-orange-200 text-orange-700 px-2 py-0.5 rounded-full flex-shrink-0">
                                                        Pendiente
                                                    </span>
                                                </div>
                                            </Link>
                                        ))}
                                    </>
                                )}

                                {pendingJustifications.length === 0 && pendingApprovalUsers.length === 0 && !(roleChanged && !roleNotifDismissed) ? (
                                    <div className="p-8 text-center text-gray-400 text-sm">
                                        ¡Estás al día! No tienes avisos pendientes.
                                    </div>
                                ) : (
                                    pendingJustifications.map((item) => {
                                        const isRejected = item.justificationStatus === 'REJECTED';
                                        const isApproved = item.justificationStatus === 'APPROVED';
                                        const isLate = item.status === 'LATE';

                                        // Dynamic Classes based on Status
                                        let containerClasses = isLate
                                            ? "bg-amber-50 border-amber-100 hover:bg-amber-100"
                                            : "bg-red-50 border-red-100 hover:bg-red-100";
                                        let titleClasses = isLate ? "text-amber-800" : "text-red-800";
                                        let badgeClasses = isLate ? "text-amber-600 border-amber-200" : "text-red-600 border-red-200";
                                        let statusTextClasses = isLate ? "text-amber-600" : "text-red-600";

                                        if (isRejected) {
                                            containerClasses = "bg-red-50 border-red-200 hover:bg-red-100";
                                            titleClasses = "text-red-900";
                                            badgeClasses = "text-red-700 border-red-300 bg-red-100";
                                            statusTextClasses = "text-red-700";
                                        } else if (isApproved) {
                                            containerClasses = "bg-green-50 border-green-200 hover:bg-green-100";
                                            titleClasses = "text-green-900";
                                            badgeClasses = "text-green-700 border-green-300 bg-green-100";
                                            statusTextClasses = "text-green-700";
                                        }

                                        return (
                                            <div key={item.id} className={`p-3 mb-2 rounded-xl border transition-colors ${containerClasses}`}>
                                                <div className="flex justify-between items-start mb-1">
                                                    <h4 className={`font-bold text-xs ${titleClasses}`}>{item.event.title}</h4>
                                                    <span className={`text-[10px] font-bold bg-white px-1.5 rounded border ${badgeClasses}`}>
                                                        {new Date(item.event.date).toLocaleDateString()}
                                                    </span>
                                                </div>

                                                <div className={`text-[11px] mb-2 ${statusTextClasses}`}>
                                                    {isRejected ? (
                                                        <div className="flex flex-col gap-1">
                                                            <span className="font-bold">❌ Justificación Rechazada</span>
                                                            {item.adminFeedback && (
                                                                <span className="italic opacity-90">"{item.adminFeedback}"</span>
                                                            )}
                                                        </div>
                                                    ) : isApproved ? (
                                                        <div className="flex flex-col gap-1">
                                                            <span className="font-bold">✅ Se ha justificado tu falta a {item.event.title}</span>
                                                            {item.adminFeedback && (
                                                                <span className="italic opacity-90">"{item.adminFeedback}"</span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span>Estado: {isLate ? 'Tardanza' : 'Falta'} sin justificar.</span>
                                                    )}
                                                </div>

                                                {isRejected || isApproved ? (
                                                    <div className="flex gap-2">
                                                        {isRejected && (
                                                            <button
                                                                onClick={() => handleOpenJustify(item)}
                                                                className="flex-1 py-1.5 bg-white rounded-lg text-xs font-bold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-all shadow-sm"
                                                            >
                                                                Reintentar
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleAcknowledge(item.id)}
                                                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold text-white transition-all shadow-sm ${isApproved ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}
                                                        >
                                                            Entendido
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => handleOpenJustify(item)}
                                                        className={`w-full py-1.5 bg-white rounded-lg text-xs font-bold hover:text-white transition-all shadow-sm border ${isLate ? "text-amber-600 border-amber-200 hover:bg-amber-600" : "text-red-600 border-red-200 hover:bg-red-600"}`}
                                                    >
                                                        Justificar Ahora
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </>
                )}

                {/* --- JUSTIFICATION MODAL --- */}
                {isJustifyModalOpen && selectedRecord && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="p-6 border-b border-gray-100">
                                <h3 className="text-xl font-black text-meteorite-950">Justificar Faltas</h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    {selectedRecord.event.title} • {new Date(selectedRecord.event.date).toLocaleDateString()}
                                </p>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Motivo de la falta</label>
                                    <textarea
                                        className="w-full p-3 rounded-xl border border-gray-200 focus:border-meteorite-500 focus:ring-2 focus:ring-meteorite-200 outline-none transition-all text-sm resize-none h-24"
                                        placeholder="Explica brevemente por qué no pudiste asistir..."
                                        value={justificationReason}
                                        onChange={(e) => setJustificationReason(e.target.value)}
                                    ></textarea>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Enlace de Prueba (Opcional)</label>
                                    <input
                                        type="url"
                                        className="w-full p-3 rounded-xl border border-gray-200 focus:border-meteorite-500 focus:ring-2 focus:ring-meteorite-200 outline-none transition-all text-sm"
                                        placeholder="https://drive.google.com/..."
                                        value={justificationLink}
                                        onChange={(e) => setJustificationLink(e.target.value)}
                                    />
                                    <p className="text-[10px] text-gray-400 mt-1">Sube tu certificado médico o constancia a Drive y pega el link.</p>
                                </div>
                            </div>
                            <div className="p-4 bg-gray-50 flex justify-end gap-3">
                                <button
                                    onClick={() => setIsJustifyModalOpen(false)}
                                    className="px-4 py-2 text-gray-600 font-bold text-sm hover:bg-gray-100 rounded-xl transition-colors"
                                    disabled={isSubmitting}
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSubmitJustification}
                                    disabled={isSubmitting}
                                    className="px-6 py-2 bg-meteorite-600 text-white font-bold text-sm rounded-xl hover:bg-meteorite-700 transition-all shadow-lg shadow-meteorite-600/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                                            Enviando...
                                        </>
                                    ) : (
                                        "Enviar Justificación"
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* 3. MOBILE BOTTOM NAV */}
            <nav className="lg:hidden fixed bottom-0 left-0 w-full bg-meteorite-950 border-t border-meteorite-800 text-white z-50 pb-safe shadow-[0_-5px_20px_rgba(0,0,0,0.2)]">
                <div className="flex justify-around items-center h-16">
                    <a
                        href="/dashboard"
                        className="flex flex-col items-center justify-center w-full h-full text-meteorite-400 hover:text-white group"
                    >
                        <div className="mb-1 p-1.5 rounded-xl bg-meteorite-800 text-white shadow-lg shadow-meteorite-900/50 transition-all transform group-hover:-translate-y-1">
                            <LayoutDashboard className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-medium opacity-100">Inicio</span>
                    </a>
                    {canAccessAdmin ? (
                        <a
                            href="/admin/events"
                            className="flex flex-col items-center justify-center w-full h-full text-meteorite-400 hover:text-white transition-colors"
                        >
                            <Calendar className="w-5 h-5 mb-1" />
                            <span className="text-[10px] font-medium">Agenda</span>
                        </a>
                    ) : (
                        <a
                            href="/dashboard/agenda"
                            className="flex flex-col items-center justify-center w-full h-full text-meteorite-400 hover:text-white transition-colors"
                        >
                            <Calendar className="w-5 h-5 mb-1" />
                            <span className="text-[10px] font-medium">Agenda</span>
                        </a>
                    )}
                    {canViewGrades && (
                        <a
                            href="/dashboard/management/grades"
                            className="flex flex-col items-center justify-center w-full h-full text-meteorite-400 hover:text-white transition-colors"
                        >
                            <GraduationCap className="w-5 h-5 mb-1" />
                            <span className="text-[10px] font-medium">Notas</span>
                        </a>
                    )}
                    <a
                        href="/dashboard/profile"
                        className="flex flex-col items-center justify-center w-full h-full text-meteorite-400 hover:text-white transition-colors"
                    >
                        <UserIcon className="w-5 h-5 mb-1" />
                        <span className="text-[10px] font-medium">Perfil</span>
                    </a>
                </div>
            </nav>
        </div>
    );
}
