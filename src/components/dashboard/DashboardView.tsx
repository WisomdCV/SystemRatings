"use client";

import { useState, useEffect } from "react";
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
    MoreHorizontal,
    Clock,
    MapPin,
    ChevronRight,
    GraduationCap,
    User as UserIcon,
    LogOut,
    RefreshCcw,
    X,
    AlertTriangle,
    CheckCircle2,
    TrendingUp,
} from "lucide-react";
import { logoutAction } from "@/server/actions/auth.actions";
import { submitJustificationAction, acknowledgeRejectionAction } from "@/server/actions/attendance.actions";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
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
        role?: string;
    };
    upcomingEvents?: any[];
    pendingJustifications?: any[];
    attendanceHistory?: any[];
}

export default function DashboardView({ user, upcomingEvents = [], pendingJustifications = [], attendanceHistory = [] }: DashboardViewProps) {
    const [chartView, setChartView] = useState<"monthly" | "semester">("monthly");
    const [eventIndex, setEventIndex] = useState(0);

    // Carousel Effect
    useEffect(() => {
        if (upcomingEvents.length <= 1) return;
        const interval = setInterval(() => {
            setEventIndex((prev) => (prev + 1) % upcomingEvents.length);
        }, 5000); // 5s rotation
        return () => clearInterval(interval);
    }, [upcomingEvents.length]);


    // --- Logic for Dynamic UI ---
    const isManagementRole = ["DEV", "PRESIDENT", "TREASURER", "DIRECTOR", "SUBDIRECTOR"].includes((user as any).role || "");
    const eventsLink = isManagementRole ? "/admin/events" : "/dashboard/agenda";



    // We need to parse dates carefully. 
    // upcomingEvents are sorted by date ASC.
    // However, the first event might be "In Progress" or "Just Finished" depending on when query ran vs render.
    // Use current index.
    const nextEvent = upcomingEvents.length > 0 ? upcomingEvents[eventIndex] : null;

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

    const statusObj = getEventStatusLabel(nextEvent);

    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isJustifyModalOpen, setIsJustifyModalOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
    const [justificationReason, setJustificationReason] = useState("");
    const [justificationLink, setJustificationLink] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
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
    const radarData = {
        labels: ["Proyectos", "Asistencia", "Liderazgo", "Staff", "Innovación"],
        datasets: [
            {
                label: "Mi Nivel",
                data: [4.8, 4.2, 4.5, 3.8, 5.0],
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
    const lineData = {
        labels:
            chartView === "monthly"
                ? ["Mar", "Abr", "May", "Jun", "Jul", "Ago"]
                : ["2023-A", "2023-B", "2024-A", "2024-B", "2025-A"],
        datasets: [
            {
                label: "Mi KPI",
                data:
                    chartView === "monthly"
                        ? [3.8, 4.1, 4.5, 4.4, 4.8, 4.9]
                        : [3.5, 3.9, 4.1, 4.3, 4.85],
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
                        ? [3.5, 3.6, 3.8, 3.9, 4.0, 4.1]
                        : [3.4, 3.8, 4.0, 4.1, 4.2],
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
            <aside className="hidden lg:flex w-64 bg-meteorite-950 text-white flex-col justify-between transition-all duration-300 z-50 shadow-2xl relative">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-meteorite-900 to-meteorite-950 opacity-50 z-0 pointer-events-none"></div>

                <div className="relative z-10">
                    {/* Logo */}
                    <div className="h-20 flex items-center px-6 border-b border-meteorite-800/50">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-meteorite-400 to-meteorite-600 flex items-center justify-center shadow-lg shadow-meteorite-900/50">
                            <Zap className="text-white w-5 h-5" />
                        </div>
                        <span className="ml-3 font-bold text-xl tracking-wide">
                            IISE Manager
                        </span>
                    </div>

                    {/* Menú */}
                    <nav className="mt-8 px-4 space-y-2">
                        {/* 1. Dashboard (Common) */}
                        <a
                            href="/dashboard"
                            className="flex items-center px-4 py-3 bg-meteorite-800 text-white rounded-xl shadow-lg shadow-meteorite-900/20 transition-all group border border-meteorite-700/50"
                        >
                            <LayoutDashboard className="text-meteorite-300 group-hover:text-white transition-colors w-5 h-5" />
                            <span className="ml-3 font-medium">Dashboard</span>
                        </a>

                        {/* 2. Equipo IISE */}
                        {["DEV", "PRESIDENT", "TREASURER", "DIRECTOR", "SUBDIRECTOR"].includes((user as any).role) && (
                            <a
                                href="/admin/users"
                                className="flex items-center px-4 py-3 text-meteorite-200 hover:bg-meteorite-900 hover:text-white rounded-xl transition-all group"
                            >
                                <Users className="text-meteorite-400 group-hover:text-white transition-colors w-5 h-5" />
                                <span className="ml-3 font-medium">Equipo IISE</span>
                            </a>
                        )}

                        {/* 4. Gestión Ciclos (Cycles) - President Only */}
                        {["DEV", "PRESIDENT"].includes((user as any).role) && (
                            <a
                                href="/admin/cycles"
                                className="flex items-center px-4 py-3 text-meteorite-200 hover:bg-meteorite-900 hover:text-white rounded-xl transition-all group"
                            >
                                <RefreshCcw className="text-meteorite-400 group-hover:text-white transition-colors w-5 h-5" />
                                <span className="ml-3 font-medium">Gestión Ciclos</span>
                            </a>
                        )}

                        {/* 5. Calificaciones */}
                        {["DEV", "PRESIDENT", "TREASURER", "DIRECTOR"].includes((user as any).role) && (
                            <a
                                href="/dashboard/management/grades"
                                className="flex items-center px-4 py-3 text-meteorite-200 hover:bg-meteorite-900 hover:text-white rounded-xl transition-all group"
                            >
                                <GraduationCap className="text-meteorite-400 group-hover:text-white transition-colors w-5 h-5" />
                                <span className="ml-3 font-medium">Calificaciones</span>
                            </a>
                        )}

                        {/* 3. Meetings */}
                        {["DEV", "PRESIDENT", "TREASURER", "DIRECTOR", "SUBDIRECTOR"].includes((user as any).role) ? (
                            <a
                                href="/admin/events"
                                className="flex items-center px-4 py-3 text-meteorite-200 hover:bg-meteorite-900 hover:text-white rounded-xl transition-all group"
                            >
                                <CalendarCheck className="text-meteorite-400 group-hover:text-white transition-colors w-5 h-5" />
                                <span className="ml-3 font-medium">Meetings</span>
                            </a>
                        ) : (
                            <a
                                href="/dashboard/agenda"
                                className="flex items-center px-4 py-3 text-meteorite-200 hover:bg-meteorite-900 hover:text-white rounded-xl transition-all group"
                            >
                                <CalendarCheck className="text-meteorite-400 group-hover:text-white transition-colors w-5 h-5" />
                                <span className="ml-3 font-medium">Meetings</span>
                            </a>
                        )}
                    </nav>
                </div>

                <div className="relative z-10 p-4 border-t border-meteorite-800/50 bg-meteorite-900/30">
                    <div className="flex items-center justify-between p-2 rounded-xl hover:bg-meteorite-800 transition-colors group">
                        <div className="flex items-center cursor-pointer">
                            {user.image ? (
                                <img
                                    src={user.image}
                                    alt="User"
                                    className="w-10 h-10 rounded-full border-2 border-meteorite-400"
                                />
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-meteorite-700 flex items-center justify-center border-2 border-meteorite-400">
                                    <UserIcon className="text-white w-5 h-5" />
                                </div>
                            )}
                            <div className="ml-3 overflow-hidden">
                                <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                                <p className="text-xs text-meteorite-300 truncate">
                                    {/* Roles would come from extended session */}
                                    {(user as any).role || "Miembro"}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={async () => await logoutAction()}
                            className="text-meteorite-400 hover:text-red-400 transition-colors p-2"
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
                                2025 - A
                            </p>
                        </div>
                    </div>

                    <div className="hidden lg:block">
                        <h1 className="text-2xl font-bold text-meteorite-950">
                            Resumen Semestral
                        </h1>
                        <p className="text-sm text-meteorite-600 font-medium">
                            Bienvenido de nuevo, {user.name?.split(" ")[0]} 👋
                        </p>
                    </div>

                    <div className="flex items-center space-x-3 lg:space-x-4">
                        <div className="relative hidden lg:block">
                            <select className="appearance-none bg-white pl-4 pr-10 py-2 rounded-xl shadow-sm border border-meteorite-200 text-meteorite-800 font-semibold focus:outline-none focus:ring-2 focus:ring-meteorite-500 cursor-pointer hover:bg-meteorite-50 transition-colors">
                                <option>2025 - A (Actual)</option>
                                <option>2024 - B</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-meteorite-600">
                                <ChevronDown className="w-4 h-4" />
                            </div>
                        </div>

                        <button
                            className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-white shadow-sm border border-meteorite-200 text-meteorite-600 hover:text-meteorite-800 hover:bg-meteorite-50 flex items-center justify-center transition-all relative"
                            onClick={() => setIsDrawerOpen(!isDrawerOpen)}
                        >
                            <Bell className="w-5 h-5" />
                            {pendingJustifications.length > 0 && (
                                <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                            )}
                        </button>

                        {user.image && (
                            <img
                                src={user.image}
                                className="lg:hidden w-9 h-9 rounded-full border border-meteorite-300"
                                alt="Profile"
                            />
                        )}

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
                                    <span className="text-[10px] lg:text-xs font-bold px-2 py-1 rounded-lg bg-green-100 text-green-700">
                                        +12% vs mes ant.
                                    </span>
                                </div>
                                <h3 className="text-meteorite-500 text-xs font-bold uppercase tracking-wider">
                                    KPI Global
                                </h3>
                                <p className="text-2xl lg:text-3xl font-bold text-meteorite-950 mt-1">
                                    4.85
                                    <span className="text-base lg:text-lg text-meteorite-400 font-normal">
                                        /5.0
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
                                <p className="text-2xl lg:text-3xl font-bold text-gray-800 mt-1">
                                    #2{" "}
                                    <span className="text-sm font-normal text-gray-500">
                                        de 8
                                    </span>
                                </p>
                            </div>
                        </div>

                        {/* Próximo Evento */}
                        {/* Próximo Evento */}
                        <div className="card-glass p-5 lg:p-6 rounded-2xl min-w-[280px] lg:min-w-0 snap-center relative overflow-hidden group bg-gradient-to-br from-meteorite-600 to-meteorite-800 text-white border-none transition-all">
                            <div className="absolute right-0 top-0 w-32 h-32 bg-white opacity-10 rounded-bl-full -mr-6 -mt-6"></div>

                            {/* Carousel Content */}
                            <div className="relative z-10 flex flex-col h-full justify-between">
                                {nextEvent ? (
                                    <div key={nextEvent.id} className="animate-in fade-in slide-in-from-right-8 duration-700 h-full flex flex-col justify-between">
                                        <div>
                                            <div className="flex justify-between items-start mb-3">
                                                <span className={`inline-block px-3 py-1 rounded-lg text-[10px] font-bold backdrop-blur-md transition-all ${statusObj.style}`}>
                                                    {statusObj.label}
                                                </span>
                                                {upcomingEvents.length > 1 && (
                                                    <div className="flex gap-1 mt-1">
                                                        {upcomingEvents.slice(0, 5).map((_, i) => (
                                                            <div
                                                                key={i}
                                                                className={`w-1.5 h-1.5 rounded-full transition-all ${i === eventIndex ? "bg-white scale-125" : "bg-white/30"}`}
                                                            />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <h3 className="text-lg font-bold leading-tight line-clamp-2" title={nextEvent.title}>
                                                {nextEvent.title}
                                            </h3>
                                        </div>
                                        <div className="flex items-center mt-4">
                                            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm border border-white/10">
                                                {nextEvent.isVirtual ? <Video className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                                            </div>
                                            <span className="ml-2 text-sm font-medium opacity-90 truncate">
                                                {nextEvent.isVirtual ? "Virtual" : "Campus"}
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-center opacity-80">
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
                        <div className="h-64 w-full">
                            <Line data={lineData} options={lineOptions} />
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
                                <Radar data={radarData} options={radarOptions} />
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

                                        return (
                                            <div key={event.id} className={`flex items-center p-3 rounded-xl transition-all group cursor-pointer border ${isInProgress
                                                ? "bg-red-50/80 border-red-300 shadow-sm animate-pulse-slow"
                                                : "hover:bg-meteorite-50 border-transparent hover:border-meteorite-100"
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
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex flex-col">
                                                            <h4 className={`font-bold text-sm ${isInProgress ? "text-red-900" : (event.targetAreaId ? 'text-gray-800 group-hover:text-orange-700' : 'text-gray-800 group-hover:text-meteorite-700')}`}>
                                                                {event.title}
                                                            </h4>
                                                            {isInProgress && (
                                                                <span className="text-[9px] font-black text-red-500 uppercase tracking-wider animate-pulse">
                                                                    ● En Curso
                                                                </span>
                                                            )}
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
                                                                <Video className={`w-3 h-3 mr-1.5 ${isInProgress ? "text-red-500" : (event.targetAreaId ? 'text-orange-400' : 'text-meteorite-400')}`} />
                                                                Virtual
                                                            </>
                                                        ) : (
                                                            <>
                                                                <MapPin className={`w-3 h-3 mr-1.5 ${isInProgress ? "text-red-500" : (event.targetAreaId ? 'text-orange-400' : 'text-meteorite-400')}`} />
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
                                    {pendingJustifications.length}
                                </span>
                            </div>



                            <div className="max-h-96 overflow-y-auto p-2">
                                {pendingJustifications.length === 0 ? (
                                    <div className="p-8 text-center text-gray-400 text-sm">
                                        ¡Estás al día! No tienes faltas pendientes.
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
                        href="#"
                        className="flex flex-col items-center justify-center w-full h-full text-meteorite-400 hover:text-white group"
                    >
                        <div className="mb-1 p-1.5 rounded-xl bg-meteorite-800 text-white shadow-lg shadow-meteorite-900/50 transition-all transform group-hover:-translate-y-1">
                            <LayoutDashboard className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-medium opacity-100">Inicio</span>
                    </a>
                    {["DEV", "PRESIDENT", "TREASURER", "DIRECTOR", "SUBDIRECTOR"].includes((user as any).role) ? (
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
                    <a
                        href="#"
                        className="flex flex-col items-center justify-center w-full h-full text-meteorite-400 hover:text-white transition-colors"
                    >
                        <GraduationCap className="w-5 h-5 mb-1" />
                        <span className="text-[10px] font-medium">Notas</span>
                    </a>
                    <a
                        href="#"
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
