"use client";

import React, { useMemo } from 'react';
import { ActivityCalendar, ThemeInput } from 'react-activity-calendar';
import { Tooltip as ReactTooltip } from 'react-tooltip';

interface Activity {
    date: string;
    count: number;
    level: number;
}

interface AttendanceHeatmapProps {
    history: any[];
}

/**
 * Generates all dates in a range (inclusive) using UTC to avoid timezone issues
 */
function generateDateRange(startDate: Date, endDate: Date): string[] {
    const dates: string[] = [];
    const current = new Date(Date.UTC(
        startDate.getUTCFullYear(),
        startDate.getUTCMonth(),
        startDate.getUTCDate()
    ));

    const end = new Date(Date.UTC(
        endDate.getUTCFullYear(),
        endDate.getUTCMonth(),
        endDate.getUTCDate()
    ));

    while (current <= end) {
        // Format as YYYY-MM-DD using UTC values
        const year = current.getUTCFullYear();
        const month = String(current.getUTCMonth() + 1).padStart(2, '0');
        const day = String(current.getUTCDate()).padStart(2, '0');
        dates.push(`${year}-${month}-${day}`);
        current.setUTCDate(current.getUTCDate() + 1);
    }
    return dates;
}

/**
 * Converts a Drizzle date value to YYYY-MM-DD string
 * Handles: Date objects, ISO strings, Unix timestamps (seconds or ms)
 */
function parseDateToString(dateValue: unknown): string | null {
    if (!dateValue) return null;

    let date: Date;

    if (dateValue instanceof Date) {
        date = dateValue;
    } else if (typeof dateValue === 'string') {
        date = new Date(dateValue);
    } else if (typeof dateValue === 'number') {
        // Drizzle stores timestamps as Unix seconds, not milliseconds
        // Check if it's seconds (< year 3000 in seconds) or milliseconds
        const isSeconds = dateValue < 100000000000;
        date = new Date(isSeconds ? dateValue * 1000 : dateValue);
    } else {
        return null;
    }

    if (isNaN(date.getTime())) return null;

    // Use UTC to get consistent date string
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export default function AttendanceHeatmap({ history }: AttendanceHeatmapProps) {
    // Label Map for Tooltip - define outside useMemo for use in render
    const getLabel = (level: number) => {
        switch (level) {
            case 1: return "Falta";
            case 2: return "Tardanza";
            case 3: return "Justificado";
            case 4: return "Asistencia";
            default: return "Sin eventos";
        }
    };

    // Memoize the data transformation
    const { data, eventCount } = useMemo(() => {
        // Level mapping:
        // Level 0: No event (gray)
        // Level 1: ABSENT (Red)
        // Level 2: LATE (Yellow/Amber)
        // Level 3: EXCUSED (Blue)
        // Level 4: PRESENT (Green)

        const dataMap = new Map<string, number>();

        // Debug: Log first item to understand the data structure
        if (history.length > 0) {
            console.log('[Heatmap] Sample history item:', {
                rawDate: history[0]?.event?.date,
                parsedDate: parseDateToString(history[0]?.event?.date),
                status: history[0]?.status
            });
        }

        history.forEach(item => {
            const dateStr = parseDateToString(item?.event?.date);
            if (!dateStr) {
                console.warn('[Heatmap] Could not parse date:', item?.event?.date);
                return;
            }

            const status = item.status;
            const justification = item.justificationStatus;

            let level = 0;
            if (status === "PRESENT") level = 4;
            else if (status === "EXCUSED" || (status === "ABSENT" && justification === "APPROVED")) level = 3;
            else if (status === "LATE") level = 2;
            else if (status === "ABSENT") level = 1;

            // Keep the best status (max level) for multiple events on same day
            const current = dataMap.get(dateStr) || 0;
            if (level > current) {
                dataMap.set(dateStr, level);
            }
        });

        console.log('[Heatmap] Events with attendance:', Array.from(dataMap.entries()));

        // Generate complete date range for the last year using UTC
        const now = new Date();
        const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        const startDate = new Date(endDate);
        startDate.setUTCFullYear(startDate.getUTCFullYear() - 1);
        startDate.setUTCDate(startDate.getUTCDate() + 1);

        const allDates = generateDateRange(startDate, endDate);

        // Create the final data array with ALL dates
        const calendarData = allDates.map(date => ({
            date,
            count: dataMap.get(date) || 0,
            level: dataMap.get(date) || 0
        }));

        // Count: Total attendance records (not unique days)
        // This shows all events the user attended/missed across all semesters
        const totalRecords = history.length;

        return { data: calendarData, eventCount: totalRecords };
    }, [history]);

    // Custom Theme - use explicit color for each level
    // Level 0: Very light gray (clearly distinguishable from red/absent)
    const theme: ThemeInput = {
        light: ['#f3f4f6', '#ef4444', '#f59e0b', '#3b82f6', '#10b981'],
        dark: ['#1f2937', '#ef4444', '#f59e0b', '#3b82f6', '#10b981'],
    };

    return (
        <div className="w-full overflow-x-auto text-gray-600 font-bold">
            <ActivityCalendar
                data={data}
                theme={theme}
                labels={{
                    months: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
                    weekdays: ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'],
                    totalCount: `${eventCount} eventos registrados`,
                    legend: {
                        less: 'Falta',
                        more: 'Asistencia',
                    },
                }}
                renderBlock={(block, activity) =>
                    React.cloneElement(block, {
                        'data-tooltip-id': 'heatmap-tooltip',
                        'data-tooltip-content': `${activity.date}: ${getLabel(activity.level)}`,
                    })
                }
                showWeekdayLabels
                blockSize={14}
                blockRadius={3}
                blockMargin={4}
                maxLevel={4}
            />
            <ReactTooltip
                id="heatmap-tooltip"
                className="!bg-gray-900 !text-white !rounded-lg !text-xs !font-bold !px-3 !py-1.5 !z-50 !shadow-xl"
            />

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-4 text-xs text-gray-600 font-medium">
                <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-[#f3f4f6] border border-gray-200"></span>
                    <span>Sin eventos</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-[#ef4444]"></span>
                    <span>Falta</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-[#f59e0b]"></span>
                    <span>Tardanza</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-[#3b82f6]"></span>
                    <span>Justificado</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-[#10b981]"></span>
                    <span>Asistencia</span>
                </div>
            </div>
        </div>
    );
}

