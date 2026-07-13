import client from './client';

export interface CarRequestPayload {
  marca: string;
  model: string;
  year: string;
  email: string;
  region: string;
}

export interface CarRequestResponse {
  success: boolean;
  message?: string;
}

export async function sendCarRequest(payload: CarRequestPayload): Promise<CarRequestResponse> {
  const { data } = await client.post('/car-request/send-car-request', {
    marca: payload.marca.trim(),
    model: payload.model.trim(),
    year: payload.year.trim(),
    email: payload.email.trim(),
    region: payload.region.trim(),
  });

  return data;
}
