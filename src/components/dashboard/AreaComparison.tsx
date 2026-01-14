"use client";

import { useState, useMemo } from "react";
import { BarChart3, TrendingUp, Medal, ChevronLeft, ChevronRight } from "lucide-react";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

interface AreaComparisonProps {
    data: {
        areas: Array<{ id: string; name: string; code: string | null }>;
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

    // Get areas sorted by KPI for the selected month
    const sortedAreas = useMemo(() => {
        return [...data.areas]
            .map(area => ({
                ...area,
                kpi: data.data[area.id]?.[monthKey] || 0,
                ranking: data.rankings[area.id]?.[monthKey] || 0
            }))
            .filter(area => area.kpi > 0) // Only show areas with data
            .sort((a, b) => b.kpi - a.kpi);
    }, [data, monthKey]);

    // Chart data
    const chartData = {
        labels: sortedAreas.map(a => a.code || a.name.substring(0, 3).toUpperCase()),
        datasets: [
            {
                label: "KPI Promedio",
                data: sortedAreas.map(a => a.kpi),
                backgroundColor: sortedAreas.map((_, i) => {
                    if (i === 0) return "rgba(122, 68, 227, 0.9)"; // 1st place
                    if (i === 1) return "rgba(122, 68, 227, 0.7)"; // 2nd place
                    if (i === 2) return "rgba(122, 68, 227, 0.5)"; // 3rd place
                    return "rgba(122, 68, 227, 0.3)"; // Others
                }),
                borderColor: "rgba(122, 68, 227, 1)",
                borderWidth: 1,
                borderRadius: 8,
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: "#361973",
                titleColor: "#fff",
                bodyColor: "#c4b9f9",
                padding: 12,
                cornerRadius: 8,
                callbacks: {
                    label: (context: any) => `KPI: ${context.raw.toFixed(2)}`,
                },
            },
        },
        scales: {
            y: {
                beginAtZero: true,
                max: 10,
                grid: { borderDash: [4, 4], color: "#f1f5f9" },
                ticks: {
                    callback: (value: any) => value.toFixed(1),
                },
            },
            x: {
                grid: { display: false },
            },
        },
    };

    const getRankingIcon = (position: number) => {
        if (position === 1) return <span className="text-yellow-500">🥇</span>;
        if (position === 2) return <span className="text-gray-400">🥈</span>;
        if (position === 3) return <span className="text-amber-600">🥉</span>;
        return <span className="text-gray-400 text-sm">#{position}</span>;
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
        <div className="space-y-6">
            {/* Header with Month Selector */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-meteorite-950">
                        Rendimiento por Áreas
                    </h2>
                    <p className="text-sm text-meteorite-500">
                        Comparación de KPI promedio entre áreas
                    </p>
                </div>

                {/* Month Navigator */}
                <div className="flex items-center gap-2 bg-white rounded-xl border border-meteorite-200 p-1">
                    <button
                        onClick={() => setSelectedMonthIndex(prev => prev - 1)}
                        disabled={!canGoBack}
                        className="p-2 rounded-lg hover:bg-meteorite-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-4 py-1 font-semibold text-meteorite-800 min-w-[120px] text-center">
                        {selectedMonth?.label} {selectedMonth?.year}
                    </span>
                    <button
                        onClick={() => setSelectedMonthIndex(prev => prev + 1)}
                        disabled={!canGoForward}
                        className="p-2 rounded-lg hover:bg-meteorite-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Bar Chart */}
                <div className="card-glass p-6 rounded-2xl">
                    <h3 className="font-bold text-meteorite-950 mb-4 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-meteorite-500" />
                        KPI de Área - {selectedMonth?.label}
                    </h3>
                    <div className="h-72">
                        {sortedAreas.length > 0 ? (
                            <Bar data={chartData} options={chartOptions} />
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-400">
                                Sin datos para este mes
                            </div>
                        )}
                    </div>
                </div>

                {/* Ranking Table */}
                <div className="card-glass p-6 rounded-2xl">
                    <h3 className="font-bold text-meteorite-950 mb-4 flex items-center gap-2">
                        <Medal className="w-5 h-5 text-orange-500" />
                        Ranking de Áreas
                    </h3>

                    {sortedAreas.length > 0 ? (
                        <div className="space-y-2">
                            {sortedAreas.map((area, index) => (
                                <div
                                    key={area.id}
                                    className={`flex items-center justify-between p-3 rounded-xl transition-colors ${index === 0
                                            ? "bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200"
                                            : index === 1
                                                ? "bg-gray-50 border border-gray-200"
                                                : index === 2
                                                    ? "bg-amber-50/50 border border-amber-100"
                                                    : "hover:bg-meteorite-50"
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 text-center">
                                            {getRankingIcon(index + 1)}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-gray-800">{area.name}</p>
                                            {area.code && (
                                                <p className="text-xs text-gray-400">{area.code}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-meteorite-700">{area.kpi.toFixed(2)}</p>
                                        <p className="text-xs text-gray-400">/10</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-400">
                            Sin datos para este mes
                        </div>
                    )}
                </div>
            </div>

            {/* Monthly Evolution Table (All months) */}
            <div className="card-glass p-6 rounded-2xl overflow-x-auto">
                <h3 className="font-bold text-meteorite-950 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-500" />
                    Evolución Mensual por Área
                </h3>

                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-meteorite-100">
                            <th className="text-left py-3 px-2 font-semibold text-gray-600">Área</th>
                            {data.months.map((m, i) => (
                                <th
                                    key={i}
                                    className={`text-center py-3 px-2 font-semibold ${i === selectedMonthIndex
                                            ? "text-meteorite-700 bg-meteorite-50 rounded-t-lg"
                                            : "text-gray-600"
                                        }`}
                                >
                                    {m.label.substring(0, 3)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.areas.map(area => {
                            const hasAnyData = data.months.some(
                                m => data.data[area.id]?.[`${m.month}-${m.year}`]
                            );
                            if (!hasAnyData) return null;

                            return (
                                <tr key={area.id} className="border-b border-meteorite-50 hover:bg-meteorite-50/50">
                                    <td className="py-3 px-2 font-medium text-gray-800">
                                        {area.code || area.name}
                                    </td>
                                    {data.months.map((m, i) => {
                                        const key = `${m.month}-${m.year}`;
                                        const kpi = data.data[area.id]?.[key];
                                        return (
                                            <td
                                                key={i}
                                                className={`text-center py-3 px-2 ${i === selectedMonthIndex
                                                        ? "bg-meteorite-50 font-bold text-meteorite-700"
                                                        : "text-gray-600"
                                                    }`}
                                            >
                                                {kpi ? kpi.toFixed(1) : "-"}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
