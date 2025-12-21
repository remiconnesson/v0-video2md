export async function emit<T>(
  event: T,
  writable: WritableStream<T>,
  close = false,
) {
  "use step";
  const writer = writable.getWriter();
  await writer.write(event);
  writer.releaseLock();
  if (close) await writable.close();
}
