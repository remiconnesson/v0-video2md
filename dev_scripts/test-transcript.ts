import { ProxyAgent, fetch as undiFetch } from "undici";
import { Innertube } from "youtubei.js";

async function testTranscript() {
  const videoId = "k1t2xyWMUdY";
  const zyteApiKey = "d8afe5e10d2c4c1bad860dee3648e5ad";
  const zyteHost = "api.zyte.com";

  const proxyAgent = new ProxyAgent({
    uri: `http://${zyteHost}:8011`,
    token: `Basic ${Buffer.from(`${zyteApiKey.trim()}:`).toString("base64")}`,
    connect: { rejectUnauthorized: false },
  });

  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  const yt = await Innertube.create({
    fetch: (async (input: any, init: any) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const fetchInit = { ...init };
      const method = fetchInit.method?.toUpperCase() || "GET";
      if (method === "GET" || method === "HEAD") delete fetchInit.body;
      return undiFetch(url, {
        ...fetchInit,
        dispatcher: proxyAgent,
        connect: { rejectUnauthorized: false },
      });
    }) as any,
  });

  const info = await yt.getInfo(videoId);
  console.log("Captions from info:", !!info.captions);

  try {
    console.log("Calling getTranscript()...");
    const transcript = await info.getTranscript();
    console.log("Transcript available:", !!transcript);
  } catch (e: any) {
    console.log("getTranscript() failed:", e.message);
  }
}

testTranscript();
