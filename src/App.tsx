import React, { useEffect, useReducer, useState } from 'react';
import Reducer from './utils/Reducer';
import { Context, initialState } from './utils/Store';
import { ApiClient } from './utils/ApiClient';
import { connectToPeerServer, sendMessageToUser, updatePeerIdInPeerServer } from './utils/Peer';
import { Globals } from './Constants';
import { Box, Divider } from '@mui/material';
import SideBar from './components/SideBar';
import ChatPanel from './components/ChatPanel';

function App() {
	const [state, dispatch] = useReducer(Reducer, initialState);

	useEffect(() => {
		// check if user object exists
		if (!state || !state.user || !state.user.deviceKey) {
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

				const peer = connectToPeerServer(Globals.api.host, Globals.api.port);

				peer.on('open', id => {
					console.log('My peer ID is: ' + id);
					// talk to API to update peerId
					updatePeerIdInPeerServer(data.username, data.deviceKey, id).then(({ data }) => {
						dispatch({
							type: 'UpdateUser',
							payload: data
						});
					});
				});

				peer.on('connection', dataConnection => {
					dataConnection.on('data', data => {
						console.log(data);
					})
				});
			});
		}
		else {
			const peer = connectToPeerServer(Globals.api.host, Globals.api.port);

			peer.on('open', id => {
				console.log('My peer ID is: ' + id);
				// talk to API to update peerId
				updatePeerIdInPeerServer(state.user.username, state.user.deviceKey, id).then(({ data }) => {
					dispatch({
						type: 'UpdateUser',
						payload: data
					});
				});
			});

			peer.on('connection', dataConnection => {
				dataConnection.on('data', data => {
					console.log(data);
				})
			});
		}

		if (state && state.user && state.user.username && state.user.username !== 'test456') {
			sendMessageToUser('test456', 'Hey!');
		}
	}, []);

	return (
		<Context.Provider value={{ state, dispatch }}>
			<Box sx={{ display: 'flex', height: '100vh', width: '100vw', p: { md: 2 } }}>
				<Box sx={{ display: 'flex', flexGrow: 1, boxShadow: '1px 1px 10px gray' }}>
					<SideBar />
					<Divider orientation="vertical" />
					<ChatPanel />
				</Box>
			</Box>
		</Context.Provider>
	);
}

export default App;
