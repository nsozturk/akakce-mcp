import { z, ZodRawShape } from "zod";

export interface ToolDef {
  name: string;
  config: {
    title?: string;
    description: string;
    inputSchema?: ZodRawShape;
  };
  handler: (args: any) => Promise<unknown>;
}

/** Wrap a handler's return value into MCP tool-result content (pretty JSON text). */
export function asContent(value: unknown) {
  const text =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return { content: [{ type: "text" as const, text }] };
}

export { z };
