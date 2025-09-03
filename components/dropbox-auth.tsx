"use client";
import React, { useEffect, useState, useCallback } from 'react';

// Stores access token under localStorage key used by thumbnailUploader
const TOKEN_KEY = 'DROPBOX_ACCESS_TOKEN';

export function DropboxAuth(): React.ReactElement | null {
  const [token, setToken] = useState<string | null>(null);
  const [justStored, setJustStored] = useState(false);
  const [appKey, setAppKey] = useState<string | null>(null);

  useEffect(() => {
    const w = typeof window !== 'undefined' ? (window as unknown as { NEXT_PUBLIC_DROPBOX_APP_KEY?: string }) : undefined;
    setAppKey(process.env.NEXT_PUBLIC_DROPBOX_APP_KEY || w?.NEXT_PUBLIC_DROPBOX_APP_KEY || null);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const existing = localStorage.getItem(TOKEN_KEY);
    if (existing) setToken(existing);
    // Parse hash fragment (implicit grant)
    if (window.location.hash.includes('access_token=')) {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const at = params.get('access_token');
      if (at) {
        localStorage.setItem(TOKEN_KEY, at);
        setToken(at);
        setJustStored(true);
        // Clean hash
        const cleanUrl = window.location.pathname + window.location.search;
        window.history.replaceState(null, '', cleanUrl);
      }
    }
  }, []);

  const beginAuth = useCallback(() => {
    if (!appKey) return;
    const redirectUri = window.location.origin; // root
    const authUrl = `https://www.dropbox.com/oauth2/authorize?response_type=token&client_id=${encodeURIComponent(appKey)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    window.location.href = authUrl;
  }, [appKey]);

  const disconnect = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
  }, []);

  if (!appKey) {
    return (
      <div className="text-xs rounded border p-2 bg-amber-50 border-amber-200 text-amber-800">
        Dropbox 앱 키(NEXT_PUBLIC_DROPBOX_APP_KEY)가 설정되지 않아 OAuth 버튼을 숨깁니다.
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs border rounded p-2 bg-gray-50 border-gray-200">
      {token ? (
        <>
          <span className="text-green-700 font-medium">Dropbox 연결됨</span>
          {justStored && <span className="text-green-600">(토큰 저장 완료)</span>}
          <button
            type="button"
            onClick={disconnect}
            className="px-2 py-0.5 rounded bg-red-500 text-white hover:bg-red-600 text-[11px]"
          >
            해제
          </button>
        </>
      ) : (
        <>
          <span className="text-gray-600">Dropbox 미연결</span>
          <button
            type="button"
            onClick={beginAuth}
            className="px-2 py-0.5 rounded bg-blue-600 text-white hover:bg-blue-700 text-[11px]"
          >
            Dropbox 연결
          </button>
        </>
      )}
    </div>
  );
}
