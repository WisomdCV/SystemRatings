"use client";

import { useState } from "react";
import { User } from "next-auth";
import {
    Zap,
    LayoutDashboard,
    Users,
    CalendarCheck,
    Bell,
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
} from "lucide-react";
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
    user: User;
}

export default function DashboardView({ user }: DashboardViewProps) {
    const [chartView, setChartView] = useState<"monthly" | "semester">("monthly");

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
                    font: { size: 10, weight: "700" as const },
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
                        <a
                            href="#"
                            className="flex items-center px-4 py-3 bg-meteorite-800 text-white rounded-xl shadow-lg shadow-meteorite-900/20 transition-all group border border-meteorite-700/50"
                        >
                            <LayoutDashboard className="text-meteorite-300 group-hover:text-white transition-colors w-5 h-5" />
                            <span className="ml-3 font-medium">Dashboard</span>
                        </a>
                        <a
                            href="#"
                            className="flex items-center px-4 py-3 text-meteorite-200 hover:bg-meteorite-900 hover:text-white rounded-xl transition-all group"
                        >
                            <Users className="text-meteorite-400 group-hover:text-white transition-colors w-5 h-5" />
                            <span className="ml-3 font-medium">Mi Equipo</span>
                        </a>
                        <a
                            href="#"
                            className="flex items-center px-4 py-3 text-meteorite-200 hover:bg-meteorite-900 hover:text-white rounded-xl transition-all group"
                        >
                            <CalendarCheck className="text-meteorite-400 group-hover:text-white transition-colors w-5 h-5" />
                            <span className="ml-3 font-medium">Agenda</span>
                        </a>
                    </nav>
                </div>

                {/* Perfil Mini */}
                <div className="relative z-10 p-4 border-t border-meteorite-800/50 bg-meteorite-900/30">
                    <div className="flex items-center p-2 rounded-xl hover:bg-meteorite-800 cursor-pointer transition-colors">
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

                        <button className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-white shadow-sm border border-meteorite-200 text-meteorite-600 hover:text-meteorite-800 hover:bg-meteorite-50 flex items-center justify-center transition-all relative">
                            <Bell className="w-5 h-5" />
                            <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                        </button>

                        {user.image && (
                            <img
                                src={user.image}
                                className="lg:hidden w-9 h-9 rounded-full border border-meteorite-300"
                                alt="Profile"
                            />
                        )}

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

                        {/* Asistencia */}
                        <div className="card-glass p-5 lg:p-6 rounded-2xl min-w-[280px] lg:min-w-0 snap-center relative overflow-hidden group">
                            <div className="absolute right-0 top-0 w-24 h-24 bg-blue-50 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:bg-blue-100"></div>
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-blue-500 text-white flex items-center justify-center text-lg lg:text-xl shadow-lg shadow-blue-500/30">
                                        <CalendarCheck className="w-5 h-5 lg:w-6 lg:h-6" />
                                    </div>
                                </div>
                                <h3 className="text-blue-500 text-xs font-bold uppercase tracking-wider">
                                    Asistencia
                                </h3>
                                <p className="text-2xl lg:text-3xl font-bold text-gray-800 mt-1">
                                    92%
                                </p>
                                <div className="w-full bg-blue-100 h-1.5 mt-2 rounded-full">
                                    <div className="bg-blue-500 h-1.5 rounded-full w-[92%]"></div>
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
                        <div className="card-glass p-5 lg:p-6 rounded-2xl min-w-[280px] lg:min-w-0 snap-center relative overflow-hidden group bg-gradient-to-br from-meteorite-600 to-meteorite-800 text-white border-none">
                            <div className="absolute right-0 top-0 w-32 h-32 bg-white opacity-10 rounded-bl-full -mr-6 -mt-6"></div>
                            <div className="relative z-10 flex flex-col h-full justify-between">
                                <div>
                                    <span className="inline-block px-2 py-1 rounded bg-white/20 text-[10px] font-bold mb-2 backdrop-blur-sm">
                                        En 2 horas
                                    </span>
                                    <h3 className="text-lg font-bold leading-tight">
                                        Reunión Mensual
                                    </h3>
                                </div>
                                <div className="flex items-center mt-4">
                                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                                        <Video className="w-4 h-4" />
                                    </div>
                                    <span className="ml-2 text-sm font-medium opacity-90">
                                        Google Meet
                                    </span>
                                </div>
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
                                    href="#"
                                    className="text-xs font-bold text-meteorite-600 bg-meteorite-50 px-3 py-1.5 rounded-lg hover:bg-meteorite-100 transition-colors"
                                >
                                    Ver Todo
                                </a>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                {/* Event Item 1 */}
                                <div className="flex items-center p-3 rounded-xl hover:bg-meteorite-50 border border-transparent hover:border-meteorite-100 transition-all group cursor-pointer">
                                    <div className="w-12 h-12 rounded-xl bg-meteorite-100 text-meteorite-600 flex flex-col items-center justify-center font-bold shadow-sm group-hover:bg-meteorite-200 group-hover:text-meteorite-700 transition-colors">
                                        <span className="text-[10px] uppercase tracking-wide">
                                            Hoy
                                        </span>
                                        <span className="text-lg leading-none">14</span>
                                    </div>
                                    <div className="ml-4 flex-1">
                                        <div className="flex justify-between items-start">
                                            <h4 className="font-bold text-gray-800 text-sm group-hover:text-meteorite-700">
                                                Capacitación de Liderazgo
                                            </h4>
                                            <span className="text-[10px] font-bold bg-green-100 text-green-600 px-2 py-0.5 rounded border border-green-200">
                                                Obligatorio
                                            </span>
                                        </div>
                                        <div className="flex items-center mt-1 text-xs text-gray-500">
                                            <Clock className="w-3 h-3 mr-1.5 text-meteorite-400" />{" "}
                                            16:00 - 18:00
                                            <span className="mx-2 text-gray-300">|</span>
                                            <Video className="w-3 h-3 mr-1.5 text-meteorite-400" />{" "}
                                            Virtual
                                        </div>
                                    </div>
                                    <div className="text-gray-300 group-hover:text-meteorite-500">
                                        <ChevronRight className="w-4 h-4" />
                                    </div>
                                </div>

                                {/* Event Item 2 */}
                                <div className="flex items-center p-3 rounded-xl hover:bg-meteorite-50 border border-transparent hover:border-meteorite-100 transition-all group cursor-pointer">
                                    <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-600 flex flex-col items-center justify-center font-bold shadow-sm group-hover:bg-orange-100 transition-colors">
                                        <span className="text-[10px] uppercase tracking-wide">
                                            Mar
                                        </span>
                                        <span className="text-lg leading-none">16</span>
                                    </div>
                                    <div className="ml-4 flex-1">
                                        <div className="flex justify-between items-start">
                                            <h4 className="font-bold text-gray-800 text-sm group-hover:text-orange-700">
                                                Integración Presencial
                                            </h4>
                                            <span className="text-[10px] font-bold bg-orange-100 text-orange-600 px-2 py-0.5 rounded border border-orange-200">
                                                Social
                                            </span>
                                        </div>
                                        <div className="flex items-center mt-1 text-xs text-gray-500">
                                            <Clock className="w-3 h-3 mr-1.5 text-orange-400" />{" "}
                                            10:00 - 13:00
                                            <span className="mx-2 text-gray-300">|</span>
                                            <MapPin className="w-3 h-3 mr-1.5 text-orange-400" />{" "}
                                            Campus
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
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
                    <a
                        href="#"
                        className="flex flex-col items-center justify-center w-full h-full text-meteorite-400 hover:text-white transition-colors"
                    >
                        <Calendar className="w-5 h-5 mb-1" />
                        <span className="text-[10px] font-medium">Agenda</span>
                    </a>
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
