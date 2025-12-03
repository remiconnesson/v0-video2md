export type SSEBaseEvent = { type: string; [key: string]: unknown };

export type SSEHandlerMap<TEvent extends SSEBaseEvent> = {
  [K in TEvent["type"]]: (
    event: Extract<TEvent, { type: K }>,
  ) => void | Promise<void>;
};

export interface ConsumeSSEOptions {
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
  options: ConsumeSSEOptions = {},
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

      if (done) {
        // Process any remaining data in buffer to prevent data loss
        // This handles cases where the stream ends without a trailing newline
        if (buffer.trim().startsWith(dataPrefix)) {
          const raw = buffer.slice(dataPrefix.length).trim();
          if (raw) {
            try {
              const parsed = JSON.parse(raw) as TEvent;
              const eventType = parsed.type as
                | NonNullable<TEvent["type"]>
                | undefined;
              if (eventType && handlers[eventType]) {
                await handlers[eventType](
                  parsed as Extract<
                    TEvent,
                    { type: NonNullable<TEvent["type"]> }
                  >,
                );
              }
            } catch {
              // Ignore parse errors on final chunk - it may be incomplete
            }
          }
        }
        break;
      }

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
          throw err;
        }

        const eventType = parsed.type as
          | NonNullable<TEvent["type"]>
          | undefined;

        if (!eventType) {
          throw new Error(
            `Unknown event type: ${raw}, ${JSON.stringify(parsed)}`,
          );
        }

        await handlers[eventType](
          parsed as Extract<TEvent, { type: NonNullable<TEvent["type"]> }>,
        );
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
