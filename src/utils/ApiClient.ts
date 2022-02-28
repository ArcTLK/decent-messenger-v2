import axios from 'axios';
import { Globals } from '../Constants';

export const ApiClient = axios.create({
    baseURL: `${Globals.api.protocol}://${Globals.api.host}:${Globals.api.port}${Globals.api.endpoint.app}`
});

ApiClient.interceptors.response.use(response => response, error => {
    if (error.response && error.response.data) {
        console.error(error.response.data.error);
    }
    else {
        console.error(error);
    }

    throw error;
});

export function doUrlEncodedRequest(method: string, params: any, url: string) {
    const data = Object.keys(params).map((key) => `${key}=${encodeURIComponent(params[key])}`).join('&');
    
    return {
        method,
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        data,
        url
    }
}

/*
const storageKey = 'jwt';
export function setAuthorizationHeader(jwt: string) {
    localStorage.setItem(storageKey, jwt);
    ApiClient.defaults.headers.common['Authorization'] = `Bearer ${jwt}`;
}

export function resetAuthorizationHeader() {
    localStorage.removeItem(storageKey);
    delete ApiClient.defaults.headers.common['Authorization'];
}

export function loadAuthorizationHeaderFromStorage() {
    const jwt = localStorage.getItem(storageKey);
    if (jwt) {
        ApiClient.defaults.headers.common['Authorization'] = `Bearer ${jwt}`;
    }
}
*/