import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

export const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export async function listResource<T>(
  resource: string,
  params?: Record<string, unknown>
): Promise<Paginated<T>> {
  let nextUrl: string | null = resource;
  let allResults: T[] = [];
  let count = 0;

  while (nextUrl) {
    let data: Paginated<T>;

    if (nextUrl.startsWith("http")) {
      const response = await axios.get<Paginated<T>>(nextUrl, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
      });

      data = response.data;
    } else {
      const response = await api.get<Paginated<T>>(nextUrl, {
        params,
      });

      data = response.data;
    }

    allResults.push(...data.results);
    count = data.count;
    nextUrl = data.next;
  }

  return {
    count,
    next: null,
    previous: null,
    results: allResults,
  };
}