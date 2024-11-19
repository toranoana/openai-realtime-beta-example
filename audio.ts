import Speaker from "speaker";
import mic from "mic";
import { type RealtimeClient } from "@openai/realtime-api-beta";
import { Readable } from "node:stream";

let currentSpeaker: Speaker | null = null;

export function playAudio(audioData: Buffer) {
  try {
    // 前の音声再生が終わっていない場合は停止
    if (currentSpeaker) {
      if (!currentSpeaker.closed) {
        currentSpeaker.close(true);
      }
      if (!currentSpeaker.destroyed) {
        currentSpeaker.destroy();
      }
      currentSpeaker = null;
    }

    const speaker = (currentSpeaker = new Speaker({
      channels: 1,
      bitDepth: 16,
      sampleRate: 24000,
    }));

    const buffer = Buffer.from(audioData.buffer);

    const stream = new Readable({
      read() {
        this.push(buffer);
        this.push(null);
      },
    });
    stream.pipe(speaker);
    stream.on("error", (error) => {
      console.error("Error playing audio:", error);
    });
  } catch (error) {
    console.error("Error playing audio:", error);
  }
}

export function handleAudioStream(client: RealtimeClient) {
  try {
    const micInstance = mic({
      rate: "24000",
      channels: "1",
      debug: false,
      exitOnSilence: 6,
      fileType: "raw",
      encoding: "signed-integer",
    });

    const micInputStream = micInstance.getAudioStream();

    micInputStream.on("error", (error) => {
      console.error("Microphone error:", error);
    });

    micInstance.start();
    console.info("Microphone started streaming.");

    let audioBuffer = Buffer.alloc(0);
    const chunkSize = 4800; // 0.2 seconds of audio at 24kHz

    micInputStream.on("data", (data) => {
      audioBuffer = Buffer.concat([audioBuffer, data]);

      while (audioBuffer.length >= chunkSize) {
        const chunk = audioBuffer.slice(0, chunkSize);
        audioBuffer = audioBuffer.slice(chunkSize);

        const int16Array = new Int16Array(
          chunk.buffer,
          chunk.byteOffset,
          chunk.length / 2,
        );

        try {
          client.appendInputAudio(int16Array);
        } catch (error) {
          console.error("Error sending audio data:", error);
        }
      }
    });

    let init = false;
    micInputStream.on("silence", () => {
      if (!init) {
        init = true;
        console.info("マイク入力の準備ができました。");
        return;
      }
      console.log("Silence detected, creating response...");
      try {
        client.createResponse();
      } catch (error) {
        console.error("Error creating response:", error);
      }
    });
  } catch (error) {
    console.error("Error starting audio stream:", error);
  }
}
