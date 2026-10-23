import type {
  PiPhiWidgetCameraOfferParams,
  PiPhiWidgetCameraSession,
  PiPhiWidgetHostApi,
} from "./client.js";

export const CAMERA_MEDIA_CONTRACT_VERSION = "camera.media.v1";
export const DEFAULT_CAMERA_ICE_GATHERING_TIMEOUT_MS = 8_000;

export interface CameraSessionTransport {
  openSession(offer: PiPhiWidgetCameraOfferParams): Promise<PiPhiWidgetCameraSession>;
  closeSession(sessionId: string): Promise<unknown>;
}

export interface BrokeredCameraSessionOptions {
  transport: CameraSessionTransport;
  onTrack: (stream: MediaStream, event: RTCTrackEvent) => void;
  includeAudio?: boolean;
  iceGatheringTimeoutMs?: number;
  peerConnectionFactory?: (configuration: RTCConfiguration) => RTCPeerConnection;
}

export interface StartedCameraSession {
  sessionId: string;
  expiresAt?: string;
}

/**
 * Owns a browser WebRTC peer while leaving camera transport and credentials to Core.
 * The same session controller can be used by hosted widgets and Core's native UI.
 */
export class BrokeredCameraSession {
  readonly peer: RTCPeerConnection;

  private readonly transport: CameraSessionTransport;
  private readonly onTrack: BrokeredCameraSessionOptions["onTrack"];
  private readonly includeAudio: boolean;
  private readonly iceGatheringTimeoutMs: number;
  private sessionId: string | undefined;
  private startPromise: Promise<StartedCameraSession> | undefined;
  private closed = false;

  constructor(options: BrokeredCameraSessionOptions) {
    this.transport = options.transport;
    this.onTrack = options.onTrack;
    this.includeAudio = options.includeAudio ?? false;
    this.iceGatheringTimeoutMs = normalizeTimeout(options.iceGatheringTimeoutMs);
    const factory = options.peerConnectionFactory ?? defaultPeerConnectionFactory;
    this.peer = factory({ bundlePolicy: "max-bundle" });
  }

  start(): Promise<StartedCameraSession> {
    if (this.closed) return Promise.reject(new Error("Camera session is closed."));
    this.startPromise ??= this.startInternal();
    return this.startPromise;
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.peer.close();
    const activeSessionId = this.sessionId;
    this.sessionId = undefined;
    if (!activeSessionId) return;
    try {
      await this.transport.closeSession(activeSessionId);
    } catch {
      // A session that has already expired is safe to consider closed locally.
    }
  }

  private async startInternal(): Promise<StartedCameraSession> {
    this.peer.addTransceiver("video", { direction: "recvonly" });
    if (this.includeAudio) this.peer.addTransceiver("audio", { direction: "recvonly" });
    this.peer.addEventListener("track", (event) => {
      const stream = event.streams[0];
      if (stream) this.onTrack(stream, event);
    });

    try {
      const offer = await this.peer.createOffer();
      await this.peer.setLocalDescription(offer);
      await waitForCameraIceGathering(this.peer, this.iceGatheringTimeoutMs);
      const sdp = this.peer.localDescription?.sdp?.trim();
      if (!sdp) throw new Error("Browser did not create a WebRTC offer.");

      const answer = await this.transport.openSession({
        type: "offer",
        sdp,
        includeAudio: this.includeAudio,
      });
      if (!answer || typeof answer.sdp !== "string" || !answer.sdp.trim()) {
        throw new Error("Camera broker returned an invalid WebRTC answer.");
      }
      if (typeof answer.sessionId !== "string" || !answer.sessionId.trim()) {
        throw new Error("Camera broker returned an invalid session identifier.");
      }

      this.sessionId = answer.sessionId;
      await this.peer.setRemoteDescription({ type: "answer", sdp: answer.sdp });
      return answer.expiresAt
        ? { sessionId: answer.sessionId, expiresAt: answer.expiresAt }
        : { sessionId: answer.sessionId };
    } catch (error) {
      await this.close();
      throw error;
    }
  }
}

export function createWidgetHostCameraTransport(
  host: Pick<PiPhiWidgetHostApi, "openCameraSession" | "closeCameraSession">,
  slotId?: string,
): CameraSessionTransport {
  return {
    openSession: (offer) => host.openCameraSession(slotId ? { ...offer, slotId } : offer),
    closeSession: (sessionId) => host.closeCameraSession(sessionId),
  };
}

export async function waitForCameraIceGathering(
  peer: Pick<RTCPeerConnection, "iceGatheringState" | "addEventListener" | "removeEventListener">,
  timeoutMs = DEFAULT_CAMERA_ICE_GATHERING_TIMEOUT_MS,
): Promise<void> {
  if (peer.iceGatheringState === "complete") return;
  await new Promise<void>((resolve) => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const finish = (): void => {
      clearTimeout(timeoutId);
      peer.removeEventListener("icegatheringstatechange", handleChange);
      resolve();
    };
    const handleChange = (): void => {
      if (peer.iceGatheringState === "complete") finish();
    };
    peer.addEventListener("icegatheringstatechange", handleChange);
    timeoutId = setTimeout(finish, normalizeTimeout(timeoutMs));
  });
}

function defaultPeerConnectionFactory(configuration: RTCConfiguration): RTCPeerConnection {
  if (typeof globalThis.RTCPeerConnection !== "function") {
    throw new Error("WebRTC is not supported by this browser.");
  }
  return new globalThis.RTCPeerConnection(configuration);
}

function normalizeTimeout(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_CAMERA_ICE_GATHERING_TIMEOUT_MS;
  return Math.max(0, Math.floor(value ?? DEFAULT_CAMERA_ICE_GATHERING_TIMEOUT_MS));
}
