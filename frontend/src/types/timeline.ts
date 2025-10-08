export interface Artwork {
  id: string;
  title: string;
  artist: string;
  year: number;
  imageUrl: string;
  description: string;
  periodId: string; // 关联的艺术时期
}

export interface ArtPeriod {
  id: string;
  name: string;
  startYear: number;
  endYear: number;
  color: string;
  description: string;
  imageUrl: string;
}