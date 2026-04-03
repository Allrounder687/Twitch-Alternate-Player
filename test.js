const TWITCH_CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';

const query = `
  query PlaybackAccessToken_Template($login: String!, $isLive: Boolean!, $playerType: String!) {
    streamPlaybackAccessToken(channelName: $login, params: {platform: "web", playerBackend: "mediaplayer", playerType: $playerType}) @include(if: $isLive) {
      value
      signature
      __typename
    }
  }
`;

fetch('https://gql.twitch.tv/gql', {
  method: 'POST',
  headers: {
    'Client-ID': TWITCH_CLIENT_ID,
    'Content-Type': 'application/json',
    'X-Device-Id': 'test-device-id-12345',
  },
  body: JSON.stringify({
    operationName: 'PlaybackAccessToken_Template',
    query,
    variables: {
      isLive: true,
      login: 'shroud',
      playerType: 'site',
    },
  }),
})
  .then((r) => r.json().then((data) => ({ status: r.status, data })))
  .then((res) => console.log(JSON.stringify(res, null, 2)))
  .catch((e) => console.error('Fetch error:', e.message || String(e)));
