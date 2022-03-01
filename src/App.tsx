import React, { useEffect, useReducer, useState } from 'react';
import logo from './logo.svg';
import './App.css';
import Reducer from './utils/Reducer';
import { Context, initialState } from './utils/Store';
import { ApiClient } from './utils/ApiClient';
import { connectToPeerServer, listenForMessages, sendMessageToUser, updatePeerIdInPeerServer } from './utils/Peer';
import { Globals } from './Constants';
import Database from './utils/Database';
import User from './models/User';

function App() {
  const [state, dispatch] = useReducer(Reducer, initialState);

  useEffect(() => {
    // check if user object exists
    Database.app.get<User>('user').then(user => {
      dispatch({
        type: 'UpdateUser',
        payload: user
      });

      const peer = connectToPeerServer(Globals.api.host, Globals.api.port, user);
      listenForMessages(peer);
    }).catch(error => {
      if (error.status === 404) {
        // create user
        console.log('Creating User');

        ApiClient.post('users', {
          name: 'Tester',
          username: prompt('Enter Username')
        }).then(({ data }) => {
          dispatch({
            type: 'UpdateUser',
            payload: data
          });

          Database.app.put<User>({
            ...data,
            _id: 'user'
          });

          const peer = connectToPeerServer(Globals.api.host, Globals.api.port, data);
          listenForMessages(peer);
        });
      }
      else {
        throw error;
      }
    });
  }, []);

  return (
    <Context.Provider value={{state, dispatch}}>
      <div className="__main">
        
      </div>
    </Context.Provider>
  );
}

export default App;
