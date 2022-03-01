import React, { useEffect, useReducer, useState } from 'react';
import Reducer from './utils/Reducer';
import { Context, initialState } from './utils/Store';
import { ApiClient } from './utils/ApiClient';
import { connectToPeerServer, listenForMessages, sendMessageToUser, updatePeerIdInPeerServer } from './utils/Peer';
import { Globals } from './Constants';
import { Box, Divider } from '@mui/material';
import SideBar from './components/SideBar';
import ChatPanel from './components/ChatPanel';
import Database from './utils/Database';
import User from './models/User';


import { createTheme, ThemeProvider } from '@mui/material/styles';

const theme = createTheme({
	palette: {
		primary: {
			light: '#757ce8',
			main: '#3f50b5',
			dark: '#002884',
			contrastText: '#fff',
		},
		secondary: {
			light: '#ff7961',
			main: '#f44336',
			dark: '#ba000d',
			contrastText: '#000',
		},
	},
});

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
		<Context.Provider value={{ state, dispatch }}>
			<ThemeProvider theme={theme}>
				<Box sx={{ display: 'flex', height: '100vh', width: '100vw', p: { md: 2 } }}>
					<Box sx={{ display: 'flex', flexGrow: 1, boxShadow: '1px 1px 10px gray' }}>
						<SideBar />
						<Divider orientation="vertical" />
						<ChatPanel />
					</Box>
				</Box>
			</ThemeProvider>
		</Context.Provider>
	);
}

export default App;
