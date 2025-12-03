export type SSEBaseEvent = { type?: string; [key: string]: unknown };

export type SSEHandlerMap<TEvent extends SSEBaseEvent> = {
  [K in NonNullable<TEvent["type"]>]?: (
    event: Extract<TEvent, { type: K }>,
  ) => void | Promise<void>;
};

export interface ConsumeSSEOptions<TEvent extends SSEBaseEvent> {
  /**
   * Called when an event has a `type` not present in the handler map or missing entirely.
   */
  onUnknownEvent?: (event: TEvent) => void | Promise<void>;
  /**
   * Called when something goes wrong while reading/parsing the stream.
   */
  onError?: (error: unknown) => void | Promise<void>;
  /**
   * Prefix for SSE data lines. Defaults to `data: `.
   */
  dataPrefix?: string;
}

/**
 * Generic SSE consumer using fetch + ReadableStream.
 * Works in both browser and server runtimes as long as you have a Response object.
 */
export async function consumeSSE<TEvent extends SSEBaseEvent>(
  response: Response,
  handlers: SSEHandlerMap<TEvent>,
  options: ConsumeSSEOptions<TEvent> = {},
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Response body is not a readable stream");
  }

  const decoder = new TextDecoder();
  const dataPrefix = options.dataPrefix ?? "data: ";
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith(dataPrefix)) continue;

        const raw = line.slice(dataPrefix.length).trim();
        if (!raw) continue;

        let parsed: TEvent;
        try {
          parsed = JSON.parse(raw) as TEvent;
        } catch (err) {
          if (err instanceof SyntaxError) continue;
          await options.onError?.(err);
          throw err;
        }

        const eventType = parsed.type as
          | NonNullable<TEvent["type"]>
          | undefined;

        if (!eventType) {
          await options.onUnknownEvent?.(parsed);
          continue;
        }

        const handler = handlers[eventType];

        if (handler) {
          await handler(
            parsed as Extract<TEvent, { type: NonNullable<TEvent["type"]> }>,
          );
        } else {
          await options.onUnknownEvent?.(parsed);
        }
      }
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return;

    if (options.onError) {
      await options.onError(err);
      return;
    }

    throw err;
  }
}
