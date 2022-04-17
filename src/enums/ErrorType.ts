enum ErrorType {
    KeyExchangeTimeout = 'Key Exchange timed out.',
    RSAKeyStoreNotFound = 'RSA Keystore not found.',
    RSAKeyExchangeNotDone = 'It seems that the RSA key exchange wasn\'t done.',
    MessageTimeout = 'Message sending timed out.',
    ContactNotFound = 'A contact should have been saved in the database, but wasn\'t found.',
    UserNotFound = 'User data was not found.'
}

export default ErrorType;