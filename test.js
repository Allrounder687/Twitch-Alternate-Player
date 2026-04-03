const TWITCH_CLIENT_ID = 'ue6666qo983tsx6so1t0vnawi233wa';

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
  },
  body: JSON.stringify({
    operationName: 'PlaybackAccessToken_Template',
    query,
    variables: {
      isLive: true,
      login: 'shroud',
      playerType: "embed"
    }
  })
})
.then(r => r.json().then(data => ({status: r.status, data})))
.then(res => console.log(JSON.stringify(res, null, 2)))
.catch(e => console.error(e));
