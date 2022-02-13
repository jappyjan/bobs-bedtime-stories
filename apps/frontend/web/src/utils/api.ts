import {environment} from "../environments/environment";

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export async function callApi<ReturnType>(path: string, method: HttpMethod, payload?: any, headers?: Record<string, string | string[]>): Promise<ReturnType> {
  const fetchParams: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'pass-code': localStorage.getItem('pass-code') || '',
      ...(headers ?? {})
    },
  };
  if (payload) {
    fetchParams.body = JSON.stringify(payload);
  }

  const response = await fetch(environment.apiEndpoint + path, fetchParams);

  if (response.ok) {
    return await response.json();
  }

  throw new Error(response.statusText);
}
