// app/diagnostic/page.tsx (v2 - lebih akurat)
// Akses di: http://localhost:3000/diagnostic
'use client';

import { useState } from 'react';
import {
  isConnected,
  isAllowed,
  requestAccess,
  getAddress,
  getNetwork,
} from '@stellar/freighter-api';

type LogEntry = {
  step: string;
  status: 'ok' | 'fail' | 'info' | 'warn';
  detail: string;
  duration?: number;
};

export default function Diagnostic() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState(false);

  const log = (entry: LogEntry) => {
    setLogs((prev) => [...prev, entry]);
  };

  const runFullDiagnostic = async () => {
    setRunning(true);
    setLogs([]);

    log({ step: 'Origin', status: 'info', detail: window.location.origin });

    // 1. Test isConnected (REAL SDK call, bukan manual postMessage)
    log({ step: 'isConnected()', status: 'info', detail: 'Calling SDK...' });
    const t1 = Date.now();
    try {
      const result = await isConnected();
      const duration = Date.now() - t1;
      log({
        step: 'isConnected()',
        status: result ? 'ok' : 'fail',
        detail: `Return value: ${JSON.stringify(result)} (${duration}ms)`,
        duration,
      });
    } catch (e) {
      log({
        step: 'isConnected()',
        status: 'fail',
        detail: `Exception: ${e instanceof Error ? e.message : String(e)}`,
      });
    }

    // 2. Test getNetwork
    log({ step: 'getNetwork()', status: 'info', detail: 'Calling SDK...' });
    try {
      const result = await getNetwork();
      log({
        step: 'getNetwork()',
        status: 'ok',
        detail: `Result: ${JSON.stringify(result)}`,
      });
    } catch (e) {
      log({
        step: 'getNetwork()',
        status: 'fail',
        detail: `Exception: ${e instanceof Error ? e.message : String(e)}`,
      });
    }

    // 3. Test isAllowed
    log({ step: 'isAllowed()', status: 'info', detail: 'Calling SDK...' });
    try {
      const result = await isAllowed();
      log({
        step: 'isAllowed()',
        status: 'ok',
        detail: `Result: ${JSON.stringify(result)}`,
      });
    } catch (e) {
      log({
        step: 'isAllowed()',
        status: 'fail',
        detail: `Exception: ${e instanceof Error ? e.message : String(e)}`,
      });
    }

    // 4. Test getAddress (akan gagal kalau belum diizinkan)
    log({ step: 'getAddress()', status: 'info', detail: 'Calling SDK...' });
    try {
      const result = await getAddress();
      log({
        step: 'getAddress()',
        status: result.error ? 'warn' : 'ok',
        detail: `Result: ${JSON.stringify(result)}`,
      });
    } catch (e) {
      log({
        step: 'getAddress()',
        status: 'fail',
        detail: `Exception: ${e instanceof Error ? e.message : String(e)}`,
      });
    }

    setRunning(false);
  };

  const runRequestAccess = async () => {
    setRunning(true);
    log({ step: 'requestAccess()', status: 'info', detail: 'Calling SDK — HARUS muncul popup Freighter...' });
    try {
      const result = await requestAccess();
      log({
        step: 'requestAccess()',
        status: result.error ? 'fail' : 'ok',
        detail: `Result: ${JSON.stringify(result)}`,
      });
    } catch (e) {
      log({
        step: 'requestAccess()',
        status: 'fail',
        detail: `Exception: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
    setRunning(false);
  };

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif', maxWidth: 900 }}>
      <h1>Freighter Diagnostic v2</h1>
      <p style={{ color: '#666', marginBottom: 16 }}>
        Versi ini pakai SDK resmi <code>@stellar/freighter-api</code> langsung (bukan
        postMessage manual). Hasilnya akurat sama dengan yang dipakai halaman utama.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          onClick={runFullDiagnostic}
          disabled={running}
          style={{
            padding: '10px 20px',
            background: running ? '#999' : '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: running ? 'not-allowed' : 'pointer',
          }}
        >
          {running ? 'Running...' : 'Run Full Diagnostic'}
        </button>
        <button
          onClick={runRequestAccess}
          disabled={running}
          style={{
            padding: '10px 20px',
            background: running ? '#999' : '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: running ? 'not-allowed' : 'pointer',
          }}
        >
          Request Access (Test Popup)
        </button>
        <button
          onClick={() => setLogs([])}
          disabled={running}
          style={{
            padding: '10px 20px',
            background: '#f3f4f6',
            color: '#374151',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Clear
        </button>
      </div>

      <div style={{ marginTop: 16 }}>
        {logs.map((c, i) => (
          <div
            key={i}
            style={{
              padding: 12,
              marginBottom: 6,
              border: '1px solid #ddd',
              borderRadius: 6,
              background:
                c.status === 'ok'
                  ? '#f0fdf4'
                  : c.status === 'fail'
                  ? '#fef2f2'
                  : c.status === 'warn'
                  ? '#fffbeb'
                  : '#f8fafc',
              fontFamily: 'ui-monospace, monospace',
              fontSize: 13,
            }}
          >
            <div style={{ fontWeight: 600 }}>
              {c.status === 'ok' && '✅ '}
              {c.status === 'fail' && '❌ '}
              {c.status === 'warn' && '⚠️ '}
              {c.status === 'info' && 'ℹ️ '}
              {c.step}
              {c.duration !== undefined && (
                <span style={{ color: '#888', fontWeight: 400 }}> · {c.duration}ms</span>
              )}
            </div>
            <div style={{ color: '#555', marginTop: 4, wordBreak: 'break-all' }}>
              {c.detail}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 24,
          padding: 12,
          background: '#000000',
          borderRadius: 6,
          fontSize: 13,
        }}
      >
        <strong>Cara pakai:</strong>
        <ol style={{ marginTop: 8, paddingLeft: 20 }}>
          <li>Klik <strong>"Run Full Diagnostic"</strong> — tidak akan munculkan popup</li>
          <li>
            Lihat hasil <code>isConnected()</code>. Kalau <code>false</code> → kasih tahu
            saya. Kalau <code>true</code> → lanjut langkah 3.
          </li>
          <li>
            Klik <strong>"Request Access"</strong> — harus muncul popup Freighter. Approve
            di popup.
          </li>
          <li>Run Full Diagnostic lagi — <code>getAddress()</code> harus return address.</li>
          <li>Screenshot semua hasil, kirim ke saya.</li>
        </ol>
      </div>
    </div>
  );
}
