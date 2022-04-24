import { useEffect, useReducer, useState } from 'react';
import Reducer from './utils/Reducer';
import { ReactComponent as Logo } from './logo.svg';
import { Context, initialState, SimpleObjectStore } from './utils/Store';
import { ApiClient } from './utils/ApiClient';
import { connectToPeerServer, listenForMessages } from './utils/Peer';
import { Globals } from './Constants';
import { Box, Typography, TextField, Divider, Button, SvgIcon, Dialog, DialogContent, DialogContentText } from '@mui/material';
import SideBar from './components/SideBar';
import ChatPanel from './components/ChatPanel';
import Database from './utils/Database';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { deepPurple, grey } from '@mui/material/colors';
import SnackbarElement from './components/SnackbarElement';
import { useLiveQuery } from 'dexie-react-hooks';
import LogType from "./enums/LogType";
import { addLog } from './models/Log';
import { IndexableType, liveQuery } from 'dexie';
import { GroupManager } from './utils/GroupManager';
import User from './models/User';
import ChatType from './enums/ChatType';
import BlockChainDebug from './components/BlockChainDebug';

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

	/* App initialization */
	useEffect(() => {
		// load user data
		const userSubscription = liveQuery(() => Database.app.get('user')).subscribe(async rawUserData => {
			if (rawUserData) {
				const userData: User = JSON.parse(rawUserData.payload);
				dispatch({
					type: 'UpdateUser',
					payload: userData
				});
	
				if (SimpleObjectStore.peerConnection !== null) {
					SimpleObjectStore.peerConnection.destroy();			
				}
		
				SimpleObjectStore.peerConnection = connectToPeerServer(Globals.api.host, Globals.api.port, userData);
				listenForMessages(SimpleObjectStore.peerConnection);
		
				SimpleObjectStore.user = userData;
				
				// terminate existing group managers then repopulate group managers
				await Promise.all(SimpleObjectStore.groupManagers.map(async groupManager => await groupManager.terminate()))
				.then(() => {
					Database.groups.toArray().then(groups => {
						SimpleObjectStore.groupManagers = [];
						groups.forEach(group => {
							const groupManager = new GroupManager(group);
							SimpleObjectStore.groupManagers.push(groupManager);
							groupManager.connect();
						});
					});
				});
	
				return userData;
			}
			else {
				addLog('No User data exists in local DB.', '0', 'Initialization');
			}
		});

		return () => {
			userSubscription.unsubscribe();
		}
	}, []);	

	const onSubmitRegistrationForm = () => {
		addLog('Creating User', '0', 'Initialization');

		ApiClient.post('users', {
			name: registeringName,
			username: registeringUsername
		}).then(({ data }) => {
			Database.app.add({
				type: 'user',
				payload: JSON.stringify(data)
			});

			addLog('Saving device key for authentication with Web Server.', '0', 'Initialization', LogType.Info, 1);

			const peer = connectToPeerServer(Globals.api.host, Globals.api.port, data);
			listenForMessages(peer);
		}).catch(error => {
			dispatch({
				type: 'UpdateSnackbar',
				payload: {
					isOpen: true,
					type: 'error',
					message: error.message
				}
			});
		});
	};

	if(Object.keys(state.user).length === 0) {
		return (
			<Context.Provider value={{ state, dispatch }}>
				<SnackbarElement />
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
			</Context.Provider>
		);
	}
	else {
		return (
			<Context.Provider value={{ state, dispatch }}>
				<SnackbarElement />
				<ThemeProvider theme={themeLight}>
					<Box sx={{ display: 'flex', height: '100vh', width: '100vw', p: { md: 2 } }}>
						<Box sx={{ display: 'flex', flexGrow: 1, boxShadow: '1px 1px 10px gray' }}>
							<SideBar />
							<Divider orientation="vertical" />
							<ChatPanel />
							{state.currentOpenedChat.type === ChatType.Group && 
								(
									<>
										<Divider orientation="vertical" />
										<BlockChainDebug />
									</>
								)
							}							
						</Box>
					</Box>
				</ThemeProvider>
			</Context.Provider>
		);
	}
}

export default App;
