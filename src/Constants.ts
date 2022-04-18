export const Globals = {
    api: {
        protocol: 'https',
        host: 'api.decent-messenger.me',
        port: 443,
        endpoint: {
            peerjs: '/peerjs',
            app: '/api'
        }
    },
    messageRetryInterval: 3000,
    maxPeerConnections: 50,
    maxRetries: 5,
    messageTimeoutDuration: 2500,
    maxErrorsBeforeTermination: 5,
    blockInterval: 5000
}