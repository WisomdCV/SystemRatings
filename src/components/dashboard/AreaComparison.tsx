"use client";

import { useState, useMemo, useEffect } from "react";
import { BarChart3, TrendingUp, Medal, ChevronLeft, ChevronRight, Users, Target, Zap, Activity, ArrowUpRight, Award, User as UserIcon } from "lucide-react";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    RadialLinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from "chart.js";
import { Bar, Line, Doughnut, Radar } from "react-chartjs-2";
import { getTopMembersGlobalAction, getPerformanceDistributionAction, getAreaPillarsAction } from "@/server/actions/area-comparison.actions";

ChartJS.register(
    CategoryScale,
    LinearScale,
    RadialLinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

interface AreaComparisonProps {
    data: {
        areas: Array<{ id: string; name: string; code: string | null; color: string | null }>;
        months: Array<{ month: number; year: number; label: string }>;
        data: Record<string, Record<string, number>>;
        rankings: Record<string, Record<string, number>>;
    };
}

export default function AreaComparison({ data }: AreaComparisonProps) {
    const [selectedMonthIndex, setSelectedMonthIndex] = useState(
        data.months.length > 0 ? data.months.length - 1 : 0
    );

    const selectedMonth = data.months[selectedMonthIndex];
    const monthKey = selectedMonth ? `${selectedMonth.month}-${selectedMonth.year}` : "";

    // -- State for Server Actions (Top Members & Distribution) --
    const [topMembers, setTopMembers] = useState<any[]>([]);
    const [distribution, setDistribution] = useState<{ sobresaliente: number; bueno: number; enRiesgo: number; total: number } | null>(null);
    const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);

    // Drill-down State
    const [hoveredMember, setHoveredMember] = useState<any | null>(null);

    // -- Radar State --
    const [selectedAreaId, setSelectedAreaId] = useState<string>(data.areas[0]?.id || "");
    const [areaPillars, setAreaPillars] = useState<Array<{ name: string; normalized: number }>>([]);
    const [isLoadingRadar, setIsLoadingRadar] = useState(false);

    useEffect(() => {
        const fetchMetrics = async () => {
            if (!selectedMonth) return;
            setIsLoadingMetrics(true);
            try {
                const [topRes, distRes] = await Promise.all([
                    getTopMembersGlobalAction(selectedMonth.month, selectedMonth.year),
                    getPerformanceDistributionAction(selectedMonth.month, selectedMonth.year)
                ]);

                if (topRes.success && topRes.data) setTopMembers(topRes.data);
                if (distRes.success && distRes.data) setDistribution(distRes.data);
            } catch (error) {
                console.error("Error fetching drill-downs", error);
            } finally {
                setIsLoadingMetrics(false);
            }
        };

        fetchMetrics();
    }, [selectedMonthIndex, selectedMonth]);

    useEffect(() => {
        const fetchRadar = async () => {
            if (!selectedMonth || !selectedAreaId) return;
            setIsLoadingRadar(true);
            try {
                const res = await getAreaPillarsAction(selectedAreaId, selectedMonth.month, selectedMonth.year);
                if (res.success && res.data) setAreaPillars(res.data);
                else setAreaPillars([]);
            } catch (error) {
                console.error("Error loading area pillars", error);
                setAreaPillars([]);
            } finally {
                setIsLoadingRadar(false);
            }
        };
        fetchRadar();
    }, [selectedMonth, selectedAreaId]);

    // -- Derived Stats (Local) --
    const sortedAreas = useMemo(() => {
        return [...data.areas]
            .map(area => ({
                ...area,
                kpi: data.data[area.id]?.[monthKey] || 0,
                ranking: data.rankings[area.id]?.[monthKey] || 0
            }))
            .filter(area => area.kpi > 0)
            .sort((a, b) => b.kpi - a.kpi);
    }, [data, monthKey]);

    const { globalAvg, topArea, highestGrowth } = useMemo(() => {
        let globalSum = 0;
        let globalCount = 0;
        const areaMetrics = data.areas.map(area => {
            let areaSum = 0;
            let areaCount = 0;
            let firstData = 0;
            let lastData = 0;

            data.months.forEach((m, i) => {
                const kpi = data.data[area.id]?.[`${m.month}-${m.year}`];
                if (kpi) {
                    areaSum += kpi;
                    areaCount++;
                    globalSum += kpi;
                    globalCount++;
                    if (firstData === 0) firstData = kpi;
                    lastData = kpi;
                }
            });

            return {
                name: area.name,
                avg: areaCount > 0 ? areaSum / areaCount : 0,
                growth: areaCount > 1 ? lastData - firstData : 0
            };
        });

        const sortedByAvg = [...areaMetrics].sort((a, b) => b.avg - a.avg);
        const sortedByGrowth = [...areaMetrics].sort((a, b) => b.growth - a.growth);

        return {
            globalAvg: globalCount > 0 ? (globalSum / globalCount).toFixed(2) : "0.00",
            topArea: sortedByAvg[0] || { name: "N/A", avg: 0 },
            highestGrowth: sortedByGrowth[0] || { name: "N/A", growth: 0 }
        };
    }, [data]);


    // -- Charts Configurations --
    // 1. Line Chart (Evolution)
    const lineChartData = {
        labels: data.months.map(m => m.label.substring(0, 3)),
        datasets: data.areas.filter(area => {
            return data.months.some(m => data.data[area.id]?.[`${m.month}-${m.year}`]);
        }).map((area, index) => {
            const color = area.color || ["#7a44e3", "#f59e0b", "#10b981", "#ef4444", "#3b82f6", "#ec4899"][index % 6];
            return {
                label: area.code || area.name,
                data: data.months.map(m => data.data[area.id]?.[`${m.month}-${m.year}`] || null),
                borderColor: color,
                backgroundColor: color,
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
            };
        })
    };

    const lineChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: "bottom" as const, labels: { usePointStyle: true, padding: 20 } },
            tooltip: { backgroundColor: "#361973", titleColor: "#fff", bodyColor: "#c4b9f9", padding: 10, cornerRadius: 8 },
        },
        scales: {
            y: { min: 0, max: 10, grid: { borderDash: [4, 4], color: "#f1f5f9" } },
            x: { grid: { display: false } },
        }
    };

    // 2. Doughnut Chart (Performance Distribution)
    const doughnutData = {
        labels: ['Sobresaliente (9-10)', 'Bueno (7.5-8.9)', 'En Riesgo (<7.5)'],
        datasets: [{
            data: distribution ? [distribution.sobresaliente, distribution.bueno, distribution.enRiesgo] : [0, 0, 0],
            backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
            borderWidth: 0,
            hoverOffset: 4
        }]
    };

    const doughnutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '75%',
        plugins: {
            legend: { display: false },
            tooltip: { backgroundColor: "#361973", titleColor: "#fff", bodyColor: "#c4b9f9", padding: 10, cornerRadius: 8 },
        }
    };

    // 3. Bar Chart (Area KPIs for selected month)
    const barChartData = {
        labels: sortedAreas.map(a => a.code || a.name.substring(0, 3).toUpperCase()),
        datasets: [{
            label: "KPI Promedio",
            data: sortedAreas.map(a => a.kpi),
            backgroundColor: sortedAreas.map((a) => {
                const c = a.color || "#7a44e3";
                return sortedAreas.indexOf(a) === 0 ? `${c}e6` : `${c}66`;
            }),
            borderRadius: 8,
        }],
    };

    const barChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            y: { beginAtZero: true, max: 10, grid: { borderDash: [4, 4], color: "#f1f5f9" } },
            x: { grid: { display: false } },
        }
    };

    // 4. Radar Chart (Area Competencies)
    const radarData = {
        labels: areaPillars.map(p => p.name),
        datasets: [{
            label: "Promedio del Área",
            data: areaPillars.map(p => p.normalized),
            backgroundColor: "rgba(122, 68, 227, 0.2)",
            borderColor: "rgba(122, 68, 227, 1)",
            pointBackgroundColor: "rgba(122, 68, 227, 1)",
            pointBorderColor: "#fff",
            borderWidth: 2,
        }]
    };

    const radarOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            r: {
                min: 0,
                max: 5,
                ticks: { display: false, stepSize: 1 },
                grid: { color: "rgba(0, 0, 0, 0.05)" },
                pointLabels: { font: { size: 11, family: "'Inter', sans-serif" }, color: "#64748b" }
            }
        },
        plugins: {
            legend: { display: false },
            tooltip: { backgroundColor: "#361973", titleColor: "#fff", bodyColor: "#c4b9f9", padding: 10, cornerRadius: 8 },
        }
    };


    const getRankingIcon = (position: number) => {
        if (position === 1) return <span className="text-yellow-500 text-xl drop-shadow-sm animate-pulse">🥇</span>;
        if (position === 2) return <span className="text-gray-400 text-xl drop-shadow-sm">🥈</span>;
        if (position === 3) return <span className="text-amber-600 text-xl drop-shadow-sm">🥉</span>;
        return <span className="text-gray-400 text-sm font-bold">#{position}</span>;
    };

    const canGoBack = selectedMonthIndex > 0;
    const canGoForward = selectedMonthIndex < data.months.length - 1;

    if (data.months.length === 0) {
        return (
            <div className="card-glass p-8 rounded-2xl text-center">
                <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-gray-600 mb-2">Sin datos de áreas</h3>
                <p className="text-sm text-gray-400">
                    Los datos se generarán automáticamente cuando se asignen calificaciones.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-12">
            {/* HERO STATS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="card-glass relative overflow-hidden rounded-3xl p-6 border border-meteorite-100 shadow-xl shadow-meteorite-900/5 group hover:shadow-2xl transition-all">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-yellow-400 to-amber-600 p-[2px] shadow-lg">
                            <div className="w-full h-full bg-white rounded-2xl flex items-center justify-center">
                                <Award className="w-6 h-6 text-yellow-600" />
                            </div>
                        </div>
                        <div>
                            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Global Líder</p>
                            <h3 className="text-xl font-bold text-meteorite-950 truncate">{topArea.name}</h3>
                            <p className="text-sm font-bold text-amber-600 mt-1">⭐ {topArea.avg.toFixed(2)} Promedio Ciclo</p>
                        </div>
                    </div>
                </div>

                <div className="card-glass relative overflow-hidden rounded-3xl p-6 border border-meteorite-100 shadow-xl shadow-meteorite-900/5 group hover:shadow-2xl transition-all">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-green-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-green-400 to-emerald-600 p-[2px] shadow-lg">
                            <div className="w-full h-full bg-white rounded-2xl flex items-center justify-center">
                                <TrendingUp className="w-6 h-6 text-green-600" />
                            </div>
                        </div>
                        <div>
                            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Mayor Crecimiento</p>
                            <h3 className="text-xl font-bold text-meteorite-950 truncate">{highestGrowth.name}</h3>
                            <p className="text-sm font-bold text-green-600 mt-1">+{highestGrowth.growth.toFixed(2)} pts desde inicio</p>
                        </div>
                    </div>
                </div>

                <div className="card-glass relative overflow-hidden rounded-3xl p-6 border border-meteorite-100 shadow-xl shadow-meteorite-900/5 group hover:shadow-2xl transition-all bg-gradient-to-br from-meteorite-900 to-meteorite-950">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-meteorite-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-white/20 to-white/5 p-[2px] shadow-lg border border-white/10 backdrop-blur-sm">
                            <div className="w-full h-full rounded-2xl flex items-center justify-center">
                                <Activity className="w-6 h-6 text-white" />
                            </div>
                        </div>
                        <div>
                            <p className="text-sm font-bold text-meteorite-300 uppercase tracking-widest">Promedio IISE</p>
                            <h3 className="text-3xl font-black text-white">{globalAvg}<span className="text-sm font-normal text-meteorite-400">/10</span></h3>
                            <p className="text-xs font-medium text-meteorite-200 mt-1">Rendimiento Histórico Consolidado</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* DASHBOARD HEADER & NAV */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-meteorite-200 pb-4">
                <div>
                    <h2 className="text-2xl font-black text-meteorite-950">
                        Análisis Detallado
                    </h2>
                    <p className="text-sm text-meteorite-500 font-medium tracking-wide">
                        Explorando {selectedMonth?.label} de {selectedMonth?.year}
                    </p>
                </div>

                {/* Month Navigator */}
                <div className="flex items-center gap-2 bg-white rounded-2xl border border-meteorite-100 shadow-sm p-1">
                    <button
                        onClick={() => setSelectedMonthIndex(prev => prev - 1)}
                        disabled={!canGoBack}
                        className="p-2 rounded-xl hover:bg-meteorite-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5 text-meteorite-700" />
                    </button>
                    <span className="px-6 py-1 font-bold text-meteorite-900 min-w-[140px] text-center uppercase tracking-widest text-sm">
                        {selectedMonth?.label} '{selectedMonth?.year.toString().slice(2)}
                    </span>
                    <button
                        onClick={() => setSelectedMonthIndex(prev => prev + 1)}
                        disabled={!canGoForward}
                        className="p-2 rounded-xl hover:bg-meteorite-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                        <ChevronRight className="w-5 h-5 text-meteorite-700" />
                    </button>
                </div>
            </div>

            {/* MAIN METRIC GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 1. Bar Chart Area KPIs */}
                <div className="lg:col-span-2 card-glass p-6 rounded-3xl shadow-sm border border-white">
                    <h3 className="font-bold text-meteorite-950 mb-6 flex items-center gap-2 text-lg">
                        <BarChart3 className="w-5 h-5 text-meteorite-500" />
                        KPI de Áreas ({selectedMonth?.label})
                    </h3>
                    <div className="h-72">
                        {sortedAreas.length > 0 ? (
                            <Bar data={barChartData} options={barChartOptions} />
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-400 font-medium">
                                Sin datos suficientes para este mes.
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. Demographic / Performance Distribution */}
                <div className="card-glass p-6 rounded-3xl shadow-sm border border-white flex flex-col items-center justify-center relative">
                    <h3 className="font-bold text-meteorite-950 mb-2 w-full flex items-center gap-2 text-lg">
                        <Target className="w-5 h-5 text-meteorite-500" />
                        Distribución de Salud
                    </h3>
                    <p className="text-xs text-gray-400 font-medium w-full mb-6">Mapeo de {distribution?.total || 0} miembros activos</p>

                    {isLoadingMetrics ? (
                        <div className="animate-pulse flex space-x-4">
                            <div className="rounded-full bg-meteorite-200 h-40 w-40"></div>
                        </div>
                    ) : distribution && distribution.total > 0 ? (
                        <div className="relative h-56 w-full flex justify-center">
                            <Doughnut data={doughnutData} options={doughnutOptions} />
                            {/* Inner Doughnut Text */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-2">
                                <span className="text-3xl font-black text-meteorite-900">{distribution.total}</span>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-meteorite-400">Usuarios</span>
                            </div>
                        </div>
                    ) : (
                        <div className="h-40 flex items-center justify-center text-gray-400 font-medium">
                            No hay evaluaciones.
                        </div>
                    )}

                    {/* Legend Below Doughnut */}
                    <div className="mt-6 w-full space-y-2">
                        <div className="flex justify-between items-center text-sm">
                            <div className="flex items-center gap-2 font-medium text-gray-700">
                                <div className="w-3 h-3 rounded-full bg-emerald-500"></div> Sobresaliente
                            </div>
                            <span className="font-bold">{distribution?.sobresaliente || 0}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <div className="flex items-center gap-2 font-medium text-gray-700">
                                <div className="w-3 h-3 rounded-full bg-amber-500"></div> Bueno
                            </div>
                            <span className="font-bold">{distribution?.bueno || 0}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <div className="flex items-center gap-2 font-medium text-gray-700">
                                <div className="w-3 h-3 rounded-full bg-red-500"></div> Riesgo
                            </div>
                            <span className="font-bold text-red-500">{distribution?.enRiesgo || 0}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* SECONDARY ROW: TOP 5 LEADERBOARD & LINE EVOLUTION */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Global Leaderboard (Drill-Down capability) */}
                <div className="card-glass p-0 rounded-3xl shadow-sm border border-white overflow-hidden flex flex-col relative group">
                    <div className="bg-gradient-to-r from-meteorite-900 to-meteorite-800 p-6 flex-shrink-0">
                        <h3 className="font-bold text-white flex items-center gap-2 text-lg">
                            <Zap className="w-5 h-5 text-yellow-400" />
                            Top 5 Global Elite
                        </h3>
                        <p className="text-xs text-meteorite-300 mt-1">Miembros de más alto rendimiento en {selectedMonth?.label}</p>
                    </div>

                    <div className="p-4 flex-1 flex flex-col gap-2">
                        {isLoadingMetrics ? (
                            [...Array(5)].map((_, i) => (
                                <div key={i} className="animate-pulse flex space-x-4 items-center p-3">
                                    <div className="rounded-full bg-gray-200 h-10 w-10"></div>
                                    <div className="flex-1 space-y-2 py-1">
                                        <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                                        <div className="h-2 bg-gray-200 rounded w-1/2"></div>
                                    </div>
                                </div>
                            ))
                        ) : topMembers.length > 0 ? (
                            topMembers.map((member, index) => (
                                <div
                                    key={member.user.id}
                                    onMouseEnter={() => setHoveredMember(member)}
                                    onMouseLeave={() => setHoveredMember(null)}
                                    className={`relative flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all ${hoveredMember?.user.id === member.user.id
                                        ? "bg-meteorite-50 shadow-inner scale-[1.02]"
                                        : "hover:bg-gray-50 bg-white border border-gray-100"
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 text-center flex-shrink-0">
                                            {getRankingIcon(index + 1)}
                                        </div>
                                        {member.user.image ? (
                                            <UserAvatar src={member.user.image} name={member.user.name} className="w-10 h-10 rounded-full border border-gray-200 flex-shrink-0" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-meteorite-100 to-meteorite-200 flex items-center justify-center flex-shrink-0">
                                                <UserIcon className="w-5 h-5 text-meteorite-600" />
                                            </div>
                                        )}
                                        <div className="overflow-hidden min-w-0 pr-2">
                                            <p className="font-bold text-sm text-gray-900 truncate">{member.user.name}</p>
                                            <p className="text-[10px] text-gray-500 font-medium truncate uppercase tracking-widest">{member.area?.name || "Sin Área"}</p>
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <div className="bg-meteorite-100 px-3 py-1 rounded-full text-meteorite-900 font-bold text-sm">
                                            {member.kpi.toFixed(2)}
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-gray-400 font-medium text-sm text-center px-4">
                                Top 5 se calculará cuando se asienten notas.
                            </div>
                        )}
                    </div>

                    {/* Drill-Down Popover Overlay inside the card */}
                    {hoveredMember && (
                        <div className="absolute inset-0 bg-white/95 backdrop-blur-md z-20 flex flex-col p-6 shadow-[inset_0_0_20px_rgba(0,0,0,0.05)] animate-in fade-in duration-200 pointer-events-none">
                            <div className="flex items-center justify-between mb-6">
                                <h4 className="font-bold text-meteorite-950 flex items-center gap-2">
                                    <ArrowUpRight className="w-5 h-5 text-meteorite-500" />
                                    Desglose de Pilares
                                </h4>
                                <div className="bg-gradient-to-r from-yellow-400 to-amber-500 text-white font-bold px-3 py-1 rounded-full text-sm shadow-md">
                                    {hoveredMember.kpi.toFixed(2)} / 10
                                </div>
                            </div>

                            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100">
                                {hoveredMember.user.image ? (
                                    <UserAvatar src={hoveredMember.user.image} name={hoveredMember.user.name} className="w-14 h-14 rounded-full border-2 border-meteorite-200" />
                                ) : (
                                    <div className="w-14 h-14 rounded-full bg-meteorite-100 flex items-center justify-center border-2 border-meteorite-200">
                                        <UserIcon className="w-6 h-6 text-meteorite-500" />
                                    </div>
                                )}
                                <div>
                                    <p className="font-bold text-gray-900 text-lg leading-tight">{hoveredMember.user.name}</p>
                                    <p className="text-xs font-bold text-meteorite-500 uppercase tracking-widest">{hoveredMember.area?.name}</p>
                                </div>
                            </div>

                            <div className="flex-1 space-y-4 overflow-y-auto">
                                {hoveredMember.pillars.length > 0 ? hoveredMember.pillars.map((pillar: any, idx: number) => (
                                    <div key={idx}>
                                        <div className="flex justify-between text-xs font-bold mb-1">
                                            <span className="text-gray-700">{pillar.name}</span>
                                            <span className="text-meteorite-600">{pillar.normalized.toFixed(1)}/5</span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                                            <div
                                                className="h-2.5 rounded-full bg-gradient-to-r from-meteorite-400 to-meteorite-600"
                                                style={{ width: `${(pillar.normalized / 5) * 100}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                )) : (
                                    <p className="text-sm text-gray-500 italic text-center mt-8">Sin desgloses guardados para este resumen.</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Evolution Line Chart */}
                <div className="lg:col-span-2 card-glass p-6 rounded-3xl shadow-sm border border-white flex flex-col">
                    <h3 className="font-bold text-meteorite-950 mb-2 flex items-center gap-2 text-lg">
                        <TrendingUp className="w-5 h-5 text-meteorite-500" />
                        Evolución Histórica Global
                    </h3>
                    <p className="text-xs text-gray-400 font-medium mb-6">Comparativa de tendencias cruzadas entre áreas</p>

                    <div className="h-80 w-full flex-1">
                        {data.months.length > 0 ? (
                            <Line data={lineChartData} options={lineChartOptions} />
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-400 font-medium">
                                Histórico no disponible aún.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* THIRD ROW: AREA RADAR EXPLORER */}
            <div className="card-glass p-6 rounded-3xl shadow-sm border border-white flex flex-col md:flex-row gap-8">
                <div className="md:w-1/3 flex flex-col justify-center">
                    <h3 className="font-bold text-meteorite-950 mb-2 flex items-center gap-2 text-lg">
                        <Target className="w-5 h-5 text-meteorite-500" />
                        Mapeo de Competencias
                    </h3>
                    <p className="text-xs text-gray-400 font-medium mb-6">
                        Desglose de Pilares promediados por todos los miembros del Área seleccionada.
                    </p>

                    <label className="text-sm font-bold text-gray-700 mb-2">Seleccionar Área:</label>
                    <select
                        value={selectedAreaId}
                        onChange={(e) => setSelectedAreaId(e.target.value)}
                        className="p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-meteorite-500 outline-none transition-shadow text-gray-800 font-medium"
                    >
                        {data.areas.map(area => (
                            <option key={area.id} value={area.id}>{area.name}</option>
                        ))}
                    </select>

                    <div className="mt-8 p-4 bg-meteorite-50 rounded-2xl border border-meteorite-100">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-meteorite-200 flex items-center justify-center">
                                <Users className="w-5 h-5 text-meteorite-600" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-meteorite-400 uppercase tracking-widest">Identificador</p>
                                <p className="font-bold text-meteorite-900">{data.areas.find(a => a.id === selectedAreaId)?.code || "N/A"}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="md:w-2/3 flex items-center justify-center bg-white/40 rounded-3xl p-6 border border-white/60">
                    <div className="h-80 w-full max-w-md">
                        {isLoadingRadar ? (
                            <div className="h-full flex items-center justify-center animate-pulse">
                                <div className="w-48 h-48 rounded-full bg-meteorite-100"></div>
                            </div>
                        ) : areaPillars.length > 0 ? (
                            <Radar data={radarData} options={radarOptions} />
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                <Target className="w-10 h-10 mb-2 text-gray-300" />
                                <span className="font-medium text-sm">Sin evaluaciones en esta área para {selectedMonth?.label}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
