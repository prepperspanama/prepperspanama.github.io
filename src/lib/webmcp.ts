// Tipos mínimos para navigator.modelContext (WebMCP), un estándar del W3C
// Web Machine Learning Community Group todavía en borrador, disponible
// detrás de un origin trial desde Chrome 149. No tiene tipos oficiales en
// lib.dom.d.ts, así que se declaran aquí los que realmente se usan.
// Spec: https://github.com/webmachinelearning/webmcp

export interface WebMcpTool<TInput = Record<string, unknown>, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: Record<string, unknown>;
  execute: (input: TInput) => Promise<TOutput>;
}

export interface WebMcpModelContext {
  registerTool: <TInput = Record<string, unknown>, TOutput = unknown>(
    tool: WebMcpTool<TInput, TOutput>
  ) => void;
  unregisterTool?: (name: string) => void;
}

// Feature-detection: en cualquier navegador sin soporte (todos excepto
// Chrome 149+ con el flag/origin trial activo), navigator.modelContext no
// existe, así que esto devuelve null y el resto del código no hace nada.
export function getWebMcpContext(): WebMcpModelContext | null {
  if (typeof navigator === "undefined" || !("modelContext" in navigator)) return null;
  return (navigator as unknown as { modelContext: WebMcpModelContext }).modelContext;
}
