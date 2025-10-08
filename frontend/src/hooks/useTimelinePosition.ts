import { useMemo } from 'react';
import { ArtPeriod, Artwork } from '../types/timeline';

interface TimelinePosition {
  minYear: number;
  maxYear: number;
  totalYears: number;
  yearToPercent: (year: number) => number;
  formatYear: (year: number) => string;
}

export const useTimelinePosition = (periods: ArtPeriod[], artworks: Artwork[]): TimelinePosition => {
  return useMemo(() => {
    // 计算总时间跨度（包含缓冲区域）
    const allYears = [
      ...periods.flatMap(p => [p.startYear, p.endYear]),
      ...artworks.map(a => a.year)
    ];
    
    const rawMinYear = Math.min(...allYears);
    const rawMaxYear = Math.max(...allYears);
    const rawTotalYears = rawMaxYear - rawMinYear;
    
    // 计算缓冲区域（上下各8%）
    const bufferYears = Math.round(rawTotalYears * 0.08);
    const minYear = rawMinYear - bufferYears;
    const maxYear = rawMaxYear + bufferYears;
    const totalYears = maxYear - minYear;

    // 核心函数：年份转百分比位置（考虑缓冲）
    const yearToPercent = (year: number): number => {
      const rawPosition = ((year - minYear) / totalYears) * 100;
      return Math.max(0, Math.min(100, rawPosition));
    };

    // 格式化年份显示
    const formatYear = (year: number): string => {
      if (year < 0) return `${Math.abs(year)} BC`;
      if (year === 0) return '1 AD';
      return `${year} AD`;
    };

    return {
      minYear,
      maxYear,
      totalYears,
      yearToPercent,
      formatYear
    };
  }, [periods, artworks]);
};