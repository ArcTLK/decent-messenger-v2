import React, { useEffect, useReducer, useState } from 'react';
import Reducer from './utils/Reducer';
import { ReactComponent as Logo } from './logo.svg';
import { Context, initialState } from './utils/Store';
import Contact from './models/Contact';
import Message from './models/Message';
import MessageStatus from './enums/MessageStatus';
import { ApiClient } from './utils/ApiClient';
import { connectToPeerServer, listenForMessages, sendMessageToUser, updatePeerIdInPeerServer } from './utils/Peer';
import { Globals } from './Constants';
import { Box, Typography, TextField, Divider, Button, SvgIcon, Dialog, DialogContent, DialogContentText } from '@mui/material';
import SideBar from './components/SideBar';
import ChatPanel from './components/ChatPanel';
import Database from './utils/Database';
import User from './models/User';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { deepPurple, grey } from '@mui/material/colors';

const themeLight = createTheme({
	palette: {
		primary: {
			light: deepPurple[300],
			main: deepPurple[500],
			dark: deepPurple[900],
			contrastText: '#fff',
		},
		secondary: {
			light: grey[200],
			main: grey[500],
			dark: grey[900],
			contrastText: '#fff',
		}
	},
});

function App() {
	const [state, dispatch] = useReducer(Reducer, initialState);

	const [registeringUsername, setRegisteringUsername] = useState('');
	const [registeringName, setRegisteringName] = useState('');

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
				console.log('No User data exists in local DB.');
			}
			else {
				throw error;
			}
		});

		// load contacts
		Database.contacts.allDocs({ include_docs: true }).then(docs => {
			dispatch({
				type: 'UpdateContactList',
				payload: docs.rows.map(x => x.doc)
			});
		});
	}, []);

	const onSubmitRegistrationForm = () => {
		console.log('Creating User');

		ApiClient.post('users', {
			name: registeringName,
			username: registeringUsername
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
	};

	if(Object.keys(state.user).length === 0) {
		return (
			<Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw' }}>
				<Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, borderRadius: 2, boxShadow: '1px 1px 10px gray', p: 4 }}>
					<SvgIcon inheritViewBox component={Logo} sx={{ fontSize: 100 }}/>
					<Typography variant='h6' align='center'>Decent Messenger</Typography>
					<TextField fullWidth onChange={e => setRegisteringUsername(e.target.value)} size='small' label='Username' variant='outlined'/>
					<TextField fullWidth onChange={e => setRegisteringName(e.target.value)} size='small' label='Name' variant='outlined'/>
					<Button fullWidth variant='contained' onClick={onSubmitRegistrationForm}>Submit</Button>
					
					{/* For Debugging */}
					<Button color="secondary" variant='contained' onClick={e => console.log(state)}>Log State (For Debugging)</Button>
				</Box>
			</Box>
		);
	}
	else {
		return (
			<Context.Provider value={{ state, dispatch }}>
				<ThemeProvider theme={themeLight}>
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
}

export default App;
