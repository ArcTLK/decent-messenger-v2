export const Globals = {
    api: {
        protocol: 'http',
        host: 'localhost',
        port: 8080,
        endpoint: {
            peerjs: '/peerjs',
            app: '/api'
        }
    },
    messageRetryInterval: 3000,
    maxPeerConnections: 50,
    maxRetries: 3
}