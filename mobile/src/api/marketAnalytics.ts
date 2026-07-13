import client from './client';

export interface MarketAnalyticsPoint {
  day: string;
  views: number;
  leads: number;
}

export interface MarketAnalyticsListing {
  kind: 'cars' | 'parts';
  id: number;
  _id: string;
  title: string;
  image: string;
  viewsTotal: number;
  leadsTotal: number;
  last7DaysViews: number;
  last7DaysLeads: number;
  series: MarketAnalyticsPoint[];
}

export interface MarketAnalyticsSummary {
  effectivePlan: string;
  days: string[];
  dailyTotals: MarketAnalyticsPoint[];
  totals: {
    viewsTotal: number;
    leadsTotal: number;
    last7DaysViews: number;
    last7DaysLeads: number;
  };
  listings: MarketAnalyticsListing[];
}

export async function getMarketAnalyticsSummary(): Promise<MarketAnalyticsSummary> {
  const { data } = await client.get('/market/analytics/summary');
  return data;
}
