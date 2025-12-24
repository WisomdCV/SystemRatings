// src/lib/utils/kpi-colors.ts

export type KpiStatus = 'EXCELLENT' | 'GOOD' | 'RISK';

export interface KpiColorConfig {
    status: KpiStatus;
    color: string;      // Tailwind Class for text/bg
    hex: string;        // Hex Code for charts
    label: string;
    min: number;
    max: number;
}

export function getKpiStatus(score: number): KpiColorConfig {
    // RANGO VERDE: 8.00 a 10.00
    if (score >= 8.0) {
        return {
            status: 'EXCELLENT',
            color: 'text-green-600 bg-green-50 border-green-200',
            hex: '#16a34a', // Green-600
            label: 'Sobresaliente',
            min: 8.0,
            max: 10.0
        };
    }

    // RANGO AMARILLO: 6.00 a 7.99
    if (score >= 6.0) {
        return {
            status: 'GOOD',
            color: 'text-yellow-600 bg-yellow-50 border-yellow-200',
            hex: '#ca8a04', // Yellow-600
            label: 'Regular',
            min: 6.0,
            max: 7.99
        };
    }

    // RANGO ROJO: 0.00 a 5.99
    return {
        status: 'RISK',
        color: 'text-red-600 bg-red-50 border-red-200',
        hex: '#dc2626', // Red-600
        label: 'En Riesgo',
        min: 0.0,
        max: 5.99
    };
}
