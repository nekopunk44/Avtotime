import client from './client';

export type HelpRequestStatus = 'active' | 'resolved';

export interface HelpCoordinates {
  lat: number | null;
  lng: number | null;
}

export interface HelpRequest {
  _id?: string;
  id?: string;
  user?: string;
  author?: string;
  time?: string;
  location: string;
  coordinates?: HelpCoordinates | null;
  description: string;
  status: HelpRequestStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface HelpRequestPayload {
  location: string;
  description: string;
  status?: HelpRequestStatus;
  coordinates?: HelpCoordinates | null;
}

export function getHelpRequestKey(request: HelpRequest) {
  return request._id || request.id || '';
}

export async function getHelpRequests(mine = false): Promise<HelpRequest[]> {
  const { data } = await client.get('/market/help-others/requests', {
    params: mine ? { mine: 1 } : undefined,
  });
  return Array.isArray(data) ? data : [];
}

export async function createHelpRequest(payload: HelpRequestPayload): Promise<HelpRequest> {
  const { data } = await client.post('/market/help-others/requests', payload);
  return data;
}

export async function updateHelpRequest(id: string, payload: HelpRequestPayload): Promise<HelpRequest> {
  const { data } = await client.patch(`/market/help-others/requests/${encodeURIComponent(id)}`, payload);
  return data;
}

export async function deleteHelpRequest(id: string) {
  await client.delete(`/market/help-others/requests/${encodeURIComponent(id)}`);
}
