export interface MicrophoneDevice {
  id: string;
  label: string;
}

const systemDefaultDevice: MicrophoneDevice = {
  id: "system",
  label: "System default"
};

export async function listMicrophoneDevices(
  mediaDevices: Pick<MediaDevices, "enumerateDevices"> = navigator.mediaDevices
): Promise<MicrophoneDevice[]> {
  try {
    const devices = await mediaDevices.enumerateDevices();
    const microphones = devices
      .filter((device) => device.kind === "audioinput" && device.deviceId && device.deviceId !== "default")
      .map((device, index) => ({
        id: device.deviceId,
        label: device.label || `Microphone ${index + 1}`
      }));

    return [systemDefaultDevice, ...microphones];
  } catch {
    return [systemDefaultDevice];
  }
}
