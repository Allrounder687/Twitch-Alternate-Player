export const TWITCH_CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';

// Generate once per extension install, persist in storage
let deviceId: string | null = null;

async function getDeviceId(): Promise<string> {
  if (deviceId) return deviceId;

  const result = await chrome.storage.local.get('twitch_device_id');
  if (result.twitch_device_id) {
    deviceId = result.twitch_device_id;
    return deviceId!;
  }

  deviceId = crypto.randomUUID().replace(/-/g, '');
  await chrome.storage.local.set({ twitch_device_id: deviceId });
  return deviceId;
}

export interface StreamToken {
  value: string;
  signature: string;
}

/**
 * Fetches the PlaybackAccessToken for a given streamer.
 */
export async function getStreamToken(channelName: string): Promise<StreamToken | null> {
  const query = `
    query PlaybackAccessToken_Template($login: String!, $isLive: Boolean!, $playerType: String!) {
      streamPlaybackAccessToken(channelName: $login, params: {platform: "web", playerBackend: "mediaplayer", playerType: $playerType}) @include(if: $isLive) {
        value
        signature
        __typename
      }
    }
  `;

  const currentDeviceId = await getDeviceId();

  const response = await fetch('https://gql.twitch.tv/gql', {
    method: 'POST',
    headers: {
      'Client-ID': TWITCH_CLIENT_ID,
      'Content-Type': 'application/json',
      'X-Device-Id': currentDeviceId,
    },
    body: JSON.stringify({
      operationName: 'PlaybackAccessToken_Template',
      query,
      variables: {
        isLive: true,
        login: channelName.toLowerCase(),
        playerType: 'site',
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[TwitchAPI] GQL request failed: ${response.status}`, errorText);
    throw new Error(`GQL request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (data.errors) {
    console.error('[TwitchAPI] GQL returned errors:', data.errors);
    throw new Error(`GQL error: ${data.errors[0].message}`);
  }

  if (data.data?.streamPlaybackAccessToken) {
    return {
      value: data.data.streamPlaybackAccessToken.value,
      signature: data.data.streamPlaybackAccessToken.signature,
    };
  }

  // No token means streamer is likely offline
  console.warn('[TwitchAPI] No streamPlaybackAccessToken — streamer may be offline.');
  return null;
}

/**
 * Constructs the Usher M3U8 URL from the token and signature.
 */
export function getStreamUrl(channelName: string, token: StreamToken): string {
  const params = new URLSearchParams({
    client_id: TWITCH_CLIENT_ID,
    token: token.value,
    sig: token.signature,
    allow_source: 'true',
    allow_audio_only: 'true',
    allow_spectre: 'true',
    fast_bread: 'true',
    p: String(Math.floor(Math.random() * 9999999)),
    player_backend: 'mediaplayer',
    playlist_include_framerate: 'true',
    reassignments_supported: 'true',
  });

  return `https://usher.ttvnw.net/api/channel/hls/${channelName.toLowerCase()}.m3u8?${params.toString()}`;
}