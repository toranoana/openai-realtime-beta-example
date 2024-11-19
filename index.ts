import { RealtimeClient } from "@openai/realtime-api-beta";

import { playAudio, handleAudioStream } from "./audio.ts";
import {
  audioInputAvailable,
  audioOutputAvailable,
  systemPrompt,
} from "./settings.ts";

const client = new RealtimeClient({
  apiKey: process.env.OPENAI_API_KEY,
});

client.updateSession({
  modalities: audioOutputAvailable ? ["text", "audio"] : ["text"],
  instructions: systemPrompt,
  voice: "shimmer",
});

client.on("conversation.item.completed", ({ item }) => {
  if (item.type !== "message") return;

  if (item.role === "assistant" && item.formatted?.audio?.length) {
    playAudio(item.formatted.audio);
  }
  const text = item.formatted?.text || item.formatted?.transcript;
  if (text) {
    console.info(`[${item.role}]: `, text);
  } else if (item.formatted?.audio?.length) {
    console.info(`[${item.role}]: `, "(音声入力)");
  }
});

await client.connect();

process.on("SIGINT", () => {
  try {
    if (client.isConnected()) {
      console.info("disconnecting...");
      client.disconnect();
    }
  } catch (error) {
    console.error("Error disconnecting:", error);
  }

  process.exit(0);
});

function handleUserInput() {
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (input) => {
    // 入力された内容は一旦消す
    process.stdout.write("\x1B[1A"); // カーソルを1行上に移動
    process.stdout.write("\x1B[2K"); // 現在の行を消去

    const text = input.toString().trim();

    client.sendUserMessageContent([{ type: "input_text", text }]);
  });
  console.log("テキスト入力の準備ができました。");
}

console.info("Connected to server.");

// テキスト入力受付
handleUserInput();

if (audioInputAvailable) {
  // 音声入力受付
  handleAudioStream(client);
}
