import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArtPeriod, Artwork } from '../types/timeline';
import ArtworkCard from './ArtworkCard';

interface Props {
  periods: ArtPeriod[];
  artworks: Artwork[];
  yearToPercent: (year: number) => number;
  formatYear: (year: number) => string;
  onSelectArtwork?: (a: Artwork, p?: ArtPeriod) => void;
  selectedArtworkId?: string;
}

const ArtworksSidebar: React.FC<Props> = ({ periods, artworks, yearToPercent, formatYear, onSelectArtwork, selectedArtworkId }) => {
  // 分组逻辑：以100年为一组（如 [1500,1599], [1600,1699]）
  const buckets = useMemo(() => {
    const map = new Map<number, Artwork[]>();
    artworks.forEach(a => {
      const base = Math.floor(a.year / 100) * 100; // 组起始年
      const arr = map.get(base) ?? [];
      arr.push(a);
      map.set(base, arr);
    });
    // 转换为数组并按时间排序
    return Array.from(map.entries())
      .map(([base, list]) => ({ base, list: list.sort((x, y) => x.year - y.year) }))
      .sort((a, b) => a.base - b.base);
  }, [artworks]);

  return (
    <div className="right-sidebar">
      <div className="artworks-container">
        {buckets.map(({ base, list }) => {
          // 标签到组：用该组中最早年份
          const earliest = list[0]?.year ?? base;
          const minY = list[0]?.year ?? base;
          const maxY = list[list.length - 1]?.year ?? base + 99;
          const label = list.length > 1 ? `${formatYear(minY)}–${formatYear(maxY)}` : `${formatYear(minY)}`;
          const top = yearToPercent(earliest);
          return (
            <div key={`artwork-bucket-${base}`} className="artwork-bucket" style={{ top: `${top}%` }}>
              <div className="artwork-bucket-label">{label}</div>
              <ArtworkBucketRow
                artworks={list}
                periods={periods}
                formatYear={formatYear}
                onSelectArtwork={onSelectArtwork}
                selectedArtworkId={selectedArtworkId}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ArtworksSidebar;

// 自适应堆叠/平铺的分组行组件
// 可调参数：
const CARD_WIDTH = 180; // 与 CSS 的 .artwork-card-inline 宽度保持一致
const GAP = 12;        // 卡片间距（仅在平铺时生效）
const MIN_EDGE = 8;    // 堆叠时最小露边宽度（调大=更松，调小=更挤）
const HEIGHT = Math.round(CARD_WIDTH * 3 / 4); // 由 4:3 比例得出，控制堆叠容器高度

interface RowProps {
  artworks: Artwork[];
  periods: ArtPeriod[];
  formatYear: (year: number) => string;
  onSelectArtwork?: (a: Artwork, p?: ArtPeriod) => void;
  selectedArtworkId?: string;
}

const ArtworkBucketRow: React.FC<RowProps> = ({ artworks, periods, formatYear, onSelectArtwork, selectedArtworkId }) => {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // 监听“父容器（.artwork-bucket）”尺寸变化，获取更真实的可用宽度
  useEffect(() => {
    const rowEl = rowRef.current;
    const target = rowEl?.parentElement as HTMLElement | null; // .artwork-bucket
    if (!target) return;
    const update = () => {
      const cw = Math.floor(target.clientWidth);
      if (cw !== containerWidth) setContainerWidth(cw);
    };
    const ro = new ResizeObserver(() => update());
    ro.observe(target);
    update(); // 初始更新
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const count = artworks.length;
  const totalFlatWidth = count * CARD_WIDTH + Math.max(0, count - 1) * GAP;
  const shouldStack = containerWidth > 0 && totalFlatWidth > containerWidth;

  // 计算重叠时的步进，使最后一张完全可见，其它仅露出边
  const step = useMemo(() => {
    if (!shouldStack || count <= 1 || containerWidth <= 0) return 0;
    // 将第一张放在 0，最后一张放在 containerWidth - CARD_WIDTH，均匀分布中间卡片
    // 这样会充分利用可用宽度，右侧不会留大片空白
    const raw = (containerWidth - CARD_WIDTH) / (count - 1);
    // 保留一个最小露边，防止严重拥挤时完全重合
    return Math.max(MIN_EDGE, Math.min(raw, CARD_WIDTH));
  }, [shouldStack, count, containerWidth]);

  if (!shouldStack) {
    // 空间足够：保持原先横向平铺
    return (
      <div ref={rowRef} className="artwork-bucket-row">
        {artworks.map((art) => {
          const period = periods.find((p) => p.id === art.periodId);
          return (
            <div key={`artwork-card-${art.id}`} className="artwork-card-inline">
              <div className={selectedArtworkId === art.id ? 'is-selected' : undefined}>
                <ArtworkCard artwork={art} period={period} formatYear={formatYear} onClick={onSelectArtwork} />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // 空间不足：改为重叠排列
  return (
    <div
      ref={rowRef}
      className="artwork-bucket-row artwork-bucket-row--stacked"
      style={{ position: 'relative', height: `${HEIGHT}px` }}
    >
      {artworks.map((art, i) => {
        const period = periods.find((p) => p.id === art.periodId);
        const left = Math.round(i * step);
        return (
          <div
            key={`artwork-card-${art.id}`}
            className={"artwork-card-inline is-stacked"}
            style={{ left: `${left}px`, top: 0, position: 'absolute' }}
          >
            <div className={selectedArtworkId === art.id ? 'is-selected' : undefined}>
              <ArtworkCard artwork={art} period={period} formatYear={formatYear} onClick={onSelectArtwork} />
            </div>
          </div>
        );
      })}
    </div>
  );
};
