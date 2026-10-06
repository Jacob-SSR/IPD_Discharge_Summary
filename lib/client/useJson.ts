// lib/client/useJson.ts — โหลด JSON ตาม url (url = null คือยังไม่โหลด) เก็บผลเก่าไว้ระหว่างโหลดใหม่
"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "./fetchJson";

interface State<T> {
  url: string | null;
  data: T | null;
  error: string | null;
}

export function useJson<T>(url: string | null) {
  const [state, setState] = useState<State<T>>({ url: null, data: null, error: null });

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    fetchJson<T>(url)
      .then((data) => !cancelled && setState({ url, data, error: null }))
      .catch((e: Error) => !cancelled && setState((s) => ({ url, data: s.data, error: e.message })));
    return () => {
      cancelled = true;
    };
  }, [url]);

  return {
    data: state.data,
    error: state.url === url ? state.error : null,
    loading: url != null && state.url !== url,
  };
}
